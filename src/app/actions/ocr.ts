'use server';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { InvoiceData } from '@/types/crm';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Envía una solicitud con retry + backoff exponencial.
 * Retorna la Response si status es OK; lanza si agota intentos.
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

            // Server errors (5xx) son retriables; client errors (4xx) no
            if (response.status >= 400 && response.status < 500) {
                throw new Error(`Error del servidor OCR: ${response.status} ${response.statusText}`);
            }

            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));

            // AbortError = timeout
            if (lastError.name === 'AbortError') {
                lastError = new Error(`Timeout: el servidor OCR no respondió en ${FETCH_TIMEOUT_MS / 1000}s`);
            }
        }

        // Backoff exponencial solo si quedan intentos
        if (attempt < retries - 1) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            console.warn(`[OCR] Intento ${attempt + 1} fallido. Reintentando en ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    throw lastError ?? new Error('Fallo después de múltiples reintentos');
}

export async function analyzeDocumentAction(formData: FormData): Promise<{ jobId: string; isMock: boolean; data?: InvoiceData }> {
    const OCR_WEBHOOK_URL = env.OCR_WEBHOOK_URL;
    const WEBHOOK_API_KEY = env.WEBHOOK_API_KEY;

    if (!OCR_WEBHOOK_URL || !WEBHOOK_API_KEY) {
        throw new Error('Variables de entorno de OCR no definidas');
    }

    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No se ha proporcionado archivo');
    }

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('No estás autenticado');
        }

        // 1. Obtener la franquicia del usuario
        const { data: profile } = await supabase.from('profiles').select('franchise_id').eq('id', user.id).single();
        const franchiseId = profile?.franchise_id;

        // 2. Crear el Job en la DB
        const { data: job, error: jobError } = await supabase.from('ocr_jobs').insert({
            agent_id: user.id,
            franchise_id: franchiseId,
            status: 'processing',
            file_name: file.name,
            attempts: 1,
        }).select('id').single();

        if (jobError || !job) {
            throw new Error('Fallo al crear el trabajo de OCR en la base de datos');
        }

        // 3. Añadir el jobId al FormData para N8N
        formData.append('job_id', job.id);

        // 4. Enviar con retry + backoff
        const response = await fetchWithRetry(OCR_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'x-api-key': WEBHOOK_API_KEY },
            body: formData,
        });

        // 5. Validar que la respuesta es JSON válido (si N8N no está en "Respond Immediately")
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            const body = await response.json();
            // Sanity check: N8N a veces devuelve string instead of object
            if (typeof body === 'string') {
                console.warn('[OCR] N8N devolvió string en lugar de JSON. Registrando advertencia.');
                await supabase.from('ocr_jobs').update({
                    status: 'processing',
                    error_message: 'Respuesta N8N en formato inesperado (string), el job puede seguir procesando'
                }).eq('id', job.id);
            }
        }

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
