'use server';

import { logger } from '@/lib/utils/logger';

import { InvoiceData } from '@/types/crm';
import { env } from '@/lib/env';
import { requireServerRole } from '@/lib/auth/permissions';
import { aletheiaResultToWebhookShape } from '@/lib/aletheia/adapter';
import { calculateAletheiaSavings } from './simulator';

const N8N_TIMEOUT_MS = Number(env.N8N_TIMEOUT_MS) || 10_000;

// ── Aletheia local fallback ───────────────────────────────────────────────────
//
// Delega en el MISMO motor que usa la comparación real (calculateAletheiaSavings):
// catálogo con tariff_type, comisiones por tramo, surplus y Normalizer completo.
// Antes este fallback tenía su propia query empobrecida (sin tariff_type ni
// comisiones), lo que producía resultados divergentes entre el preview/comparación
// múltiple y la comparación individual. Unificado para que haya un único motor.

async function runAletheiaFallback(invoice: InvoiceData) {
    const result = await calculateAletheiaSavings(invoice);
    if (!result.success) {
        throw new Error(`Aletheia fallback: ${result.error}`);
    }
    return aletheiaResultToWebhookShape(result.data);
}

// ── Main action ───────────────────────────────────────────────────────────────

export async function calculateSavingsAction(invoice: InvoiceData) {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const COMPARISON_WEBHOOK_URL = env.COMPARISON_WEBHOOK_URL;
    const WEBHOOK_API_KEY = env.WEBHOOK_API_KEY;

    // If webhook is not configured, go straight to local engine
    if (!COMPARISON_WEBHOOK_URL || !WEBHOOK_API_KEY) {
        logger.warn('[Compare Action] Webhook not configured — using Aletheia fallback');
        return runAletheiaFallback(invoice);
    }

    // Try n8n with a hard timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

    try {
        const response = await fetch(COMPARISON_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': WEBHOOK_API_KEY,
            },
            body: JSON.stringify(invoice),
            signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
            logger.error('[Compare Action] n8n error response', {
                status: response.status,
                statusText: response.statusText,
            });
            throw new Error(`n8n returned ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        clearTimeout(timer);

        const isTimeout = error instanceof Error && error.name === 'AbortError';
        logger.warn(
            isTimeout
                ? `[Compare Action] n8n timed out after ${N8N_TIMEOUT_MS}ms — falling back to Aletheia`
                : `[Compare Action] n8n failed (${(error as Error).message}) — falling back to Aletheia`
        );

        return runAletheiaFallback(invoice);
    }
}
