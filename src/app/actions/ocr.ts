'use server';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { InvoiceData } from '@/types/crm';
import { z } from 'zod';

// Schema de validación para datos crudos del webhook N8N
// Usa coerce para manejar strings numéricos (formato europeo ya normalizado por N8N)
const rawInvoiceSchema = z.object({
    period_days: z.coerce.number().nonnegative().optional(),
    power_p1: z.coerce.number().nonnegative().optional(),
    power_p2: z.coerce.number().nonnegative().optional(),
    power_p3: z.coerce.number().nonnegative().optional(),
    power_p4: z.coerce.number().nonnegative().optional(),
    power_p5: z.coerce.number().nonnegative().optional(),
    power_p6: z.coerce.number().nonnegative().optional(),
    energy_p1: z.coerce.number().nonnegative().optional(),
    energy_p2: z.coerce.number().nonnegative().optional(),
    energy_p3: z.coerce.number().nonnegative().optional(),
    energy_p4: z.coerce.number().nonnegative().optional(),
    energy_p5: z.coerce.number().nonnegative().optional(),
    energy_p6: z.coerce.number().nonnegative().optional(),
}).passthrough(); // Permite campos adicionales del webhook

function parseRawInvoiceData(rawData: Record<string, unknown>): Record<string, unknown> {
    const result = rawInvoiceSchema.safeParse(rawData);
    if (!result.success) {
        // Log solo el error de validación, no los datos (pueden contener PII)
        console.warn('[OCR] Raw data validation warnings:', result.error.issues.map(i => i.path.join('.')));
    }
    // Devuelve los datos parseados si son válidos, o los originales si no
    // El normalizer downstream maneja datos incompletos con coerciones propias
    return result.success ? result.data : rawData;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 30_000;

// Tipos y tamaño permitidos — rechazar antes del webhook
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Envía una solicitud con retry + backoff exponencial.
 */
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = MAX_RETRIES
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (response.ok) return response;

            // Client errors (4xx) no son retriables
            if (response.status >= 400 && response.status < 500) {
                throw new Error(`Error del servidor OCR: ${response.status} ${response.statusText}`);
            }

            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));

            if (lastError.name === 'AbortError') {
                lastError = new Error(`Timeout: el servidor OCR no respondió en ${FETCH_TIMEOUT_MS / 1000}s`);
            }
        }

        if (attempt < retries - 1) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            console.warn(`[OCR] Intento ${attempt + 1} fallido. Reintentando en ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    throw lastError ?? new Error('Fallo después de múltiples reintentos');
}

/**
 * Sube el archivo a Supabase Storage y devuelve la URL firmada (válida 7 días).
 * El path usa userId como prefijo para cumplir con las RLS del bucket.
 */
async function uploadToStorage(
    supabase: Awaited<ReturnType<typeof createClient>>,
    file: File,
    userId: string
): Promise<string | null> {
    try {
        const ext = file.name.split('.').pop() ?? 'bin';
        const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error } = await supabase.storage
            .from('ocr-invoices')
            .upload(path, file, { contentType: file.type, upsert: false });

        if (error) {
            console.warn('[OCR] Storage upload failed (non-blocking):', error.message);
            return null;
        }

        const { data } = await supabase.storage
            .from('ocr-invoices')
            .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 días

        return data?.signedUrl ?? null;
    } catch (e) {
        console.warn('[OCR] Storage upload exception (non-blocking):', e);
        return null;
    }
}

export async function analyzeDocumentAction(formData: FormData): Promise<{ jobId: string; isMock: boolean; data?: InvoiceData }> {
    const OCR_WEBHOOK_URL = env.OCR_WEBHOOK_URL;
    const WEBHOOK_API_KEY = env.WEBHOOK_API_KEY;

    if (!OCR_WEBHOOK_URL || !WEBHOOK_API_KEY) {
        throw new Error('Variables de entorno de OCR no definidas');
    }

    const file = formData.get('file') as File;
    if (!file) throw new Error('No se ha proporcionado archivo');

    // Validación temprana: tipo y tamaño
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Formato no soportado: ${file.type}. Usa PDF, JPG, PNG o WEBP.`);
    }
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`El archivo supera el límite de 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
    }

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error('No estás autenticado');

        const { data: profile } = await supabase
            .from('profiles')
            .select('franchise_id')
            .eq('id', user.id)
            .single();
        const franchiseId = profile?.franchise_id;

        // Subir a Storage para habilitar retry real (no bloquea el flujo principal)
        const fileUrl = await uploadToStorage(supabase, file, user.id);

        // Crear el Job en la DB
        const { data: job, error: jobError } = await supabase
            .from('ocr_jobs')
            .insert({
                agent_id: user.id,
                franchise_id: franchiseId,
                status: 'processing',
                file_name: file.name,
                file_path: fileUrl,
                attempts: 1,
            })
            .select('id')
            .single();

        if (jobError || !job) {
            throw new Error('Fallo al crear el trabajo de OCR en la base de datos');
        }

        formData.append('job_id', job.id);

        const response = await fetchWithRetry(OCR_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'x-api-key': WEBHOOK_API_KEY },
            body: formData,
        });

        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            try {
                const body = await response.json();

                // N8N puede devolver los datos directamente en la respuesta (modo síncrono).
                // Intentamos extraer datos de distintas estructuras que N8N puede devolver.
                const candidates = Array.isArray(body)
                    ? [body[0]?.output, body[0]?.data, body[0]?.json, body[0]]
                    : [body?.output, body?.data, body?.json, body?.result, body];

                let rawData: Record<string, unknown> | null = null;
                for (const candidate of candidates) {
                    if (
                        candidate &&
                        typeof candidate === 'object' &&
                        !Array.isArray(candidate) &&
                        Object.keys(candidate).length > 2
                    ) {
                        rawData = candidate as Record<string, unknown>;
                        break;
                    }
                }

                const hasMeaningfulData = rawData && (
                    rawData.client_name || rawData.CLIENTE_NOMBRE || rawData.TITULAR ||
                    rawData.cups || rawData.CUPS || rawData.importe_total || rawData.total ||
                    rawData.power_p1 || rawData.POTENCIA_P1 || rawData.energia_p1 || rawData.ENERGIA_P1
                );

                if (hasMeaningfulData && rawData) {
                    const validatedData = parseRawInvoiceData(rawData);
                    await supabase.from('ocr_jobs')
                        .update({ status: 'completed', extracted_data: validatedData })
                        .eq('id', job.id);
                    return { jobId: job.id, isMock: false, data: validatedData as unknown as InvoiceData };
                }
            } catch {
                // JSON parse failed — caer al flujo asíncrono
            }
        }

        // Flujo asíncrono: N8N procesará y llamará al callback
        return { jobId: job.id, isMock: false };

    } catch (error) {
        if (env.NODE_ENV === 'development') {
            console.warn('⚠️ OCR Webhook failed. Using MOCK data for development.', error);
            return {
                jobId: 'MOCK-JOB',
                isMock: true,
                data: {
                    client_name: 'Empresa Mock S.L.',
                    dni_cif: 'B12345678',
                    company_name: 'Comercializadora Mock',
                    cups: 'ES0021000000000000XX',
                    tariff_name: '2.0TD',
                    invoice_number: 'FACT-2024-001',
                    invoice_date: new Date().toISOString().split('T')[0],
                    period_days: 30,
                    supply_address: 'Calle Falsa 123, Madrid',
                    subtotal: 100.00,
                    vat: 21.00,
                    total_amount: 121.00,
                    rights_cost: 0,
                    power_p1: 4.6, power_p2: 4.6, power_p3: 0, power_p4: 0, power_p5: 0, power_p6: 0,
                    energy_p1: 150, energy_p2: 100, energy_p3: 0, energy_p4: 0, energy_p5: 0, energy_p6: 0,
                    detected_power_type: '2.0'
                } as InvoiceData
            };
        }

        console.error('[OCR] Error tras reintentos:', error);
        throw new Error('No se ha podido enviar la factura para su procesamiento tras múltiples intentos.');
    }
}
