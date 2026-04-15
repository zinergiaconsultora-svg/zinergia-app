/**
 * Shared helpers for sending OCR jobs to N8N and parsing the response.
 *
 * Three callers funnel through here so they cannot drift apart:
 *   - analyzeDocumentAction         (FormData upload path)
 *   - analyzeDocumentByUrlAction    (signed-URL path)
 *   - retryOcrJob                   (re-dispatch from stored file)
 */

import { z } from 'zod';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 30_000;

/** Tipos y tamaño permitidos — rechazar antes del webhook. */
export const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Validación de datos crudos del webhook ────────────────────────────────────
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
}).passthrough();

export function parseRawInvoiceData(rawData: Record<string, unknown>): Record<string, unknown> {
    const result = rawInvoiceSchema.safeParse(rawData);
    if (!result.success) {
        // Solo paths, no datos (PII).
        console.warn('[OCR] Raw data validation warnings:', result.error.issues.map(i => i.path.join('.')));
    }
    return result.success ? result.data : rawData;
}

// ── HTTP con retry + backoff ──────────────────────────────────────────────────
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = MAX_RETRIES,
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeout);

            if (response.ok) return response;

            // 4xx no son retriables.
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

// ── Envío a N8N ───────────────────────────────────────────────────────────────

export interface PostToN8nOptions {
    webhookUrl: string;
    apiKey: string;
    file: File;
    jobId: string;
    /** Texto extraído directamente del PDF (digital), si está disponible. */
    rawText?: string;
    /** Si se quieren reintentos automáticos (default true). retryOcrJob los desactiva. */
    withRetries?: boolean;
}

/** POST común al webhook OCR de N8N. Devuelve la Response cruda para parseo. */
export async function postOcrToN8n(opts: PostToN8nOptions): Promise<Response> {
    const formData = new FormData();
    formData.append('file', opts.file);
    formData.append('job_id', opts.jobId);
    if (opts.rawText) formData.append('raw_text', opts.rawText.slice(0, 8000));

    const init: RequestInit = {
        method: 'POST',
        headers: { 'x-api-key': opts.apiKey },
        body: formData,
    };

    if (opts.withRetries === false) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            return await fetch(opts.webhookUrl, { ...init, signal: controller.signal });
        } finally {
            clearTimeout(timeout);
        }
    }

    return fetchWithRetry(opts.webhookUrl, init);
}

// ── Parseo de respuesta síncrona ──────────────────────────────────────────────

/**
 * N8N puede devolver datos directamente en la respuesta (modo síncrono) o sólo
 * confirmar recepción y enviar el resultado más tarde por callback.
 *
 * Esta función intenta extraer datos del body. Devuelve los datos validados si
 * son significativos, o `null` si toca esperar al callback.
 */
export async function extractSyncDataFromResponse(response: Response): Promise<Record<string, unknown> | null> {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return null;

    let body: unknown;
    try {
        body = await response.json();
    } catch {
        return null;
    }

    const candidates = Array.isArray(body)
        ? [
            (body[0] as Record<string, unknown> | undefined)?.output,
            (body[0] as Record<string, unknown> | undefined)?.data,
            (body[0] as Record<string, unknown> | undefined)?.json,
            body[0],
        ]
        : [
            (body as Record<string, unknown> | null)?.output,
            (body as Record<string, unknown> | null)?.data,
            (body as Record<string, unknown> | null)?.json,
            (body as Record<string, unknown> | null)?.result,
            body,
        ];

    let rawData: Record<string, unknown> | null = null;
    for (const candidate of candidates) {
        if (
            candidate &&
            typeof candidate === 'object' &&
            !Array.isArray(candidate) &&
            Object.keys(candidate as Record<string, unknown>).length > 2
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

    if (!hasMeaningfulData || !rawData) return null;
    return parseRawInvoiceData(rawData);
}

// ── Mock data para development ────────────────────────────────────────────────
import type { InvoiceData } from '@/types/crm';

export const MOCK_INVOICE_DATA: InvoiceData = {
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
    detected_power_type: '2.0',
} as InvoiceData;
