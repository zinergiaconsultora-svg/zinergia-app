'use server';

import { logger } from '@/lib/utils/logger';

import { InvoiceData, Offer } from '@/types/crm';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';
import { AletheiaEngine } from '@/lib/aletheia/engine';
import { aletheiaResultToWebhookShape, crmToAletheiaInvoice, offerToTariffCandidate } from '@/lib/aletheia/adapter';

const N8N_TIMEOUT_MS = Number(env.N8N_TIMEOUT_MS) || 10_000;

// ── Aletheia local fallback ───────────────────────────────────────────────────

async function runAletheiaFallback(invoice: InvoiceData) {
    const supabase = await createClient();

    // Filtrar por el segmento elegido por el usuario (RESIDENCIAL/PYME), que
    // coincide con lv_zinergia_tarifas.tipo_cliente. El segmento viaja en la
    // factura (invoice.segment); si no está, no se filtra (compatibilidad).
    const segment = invoice.segment === 'RESIDENCIAL' || invoice.segment === 'PYME' ? invoice.segment : undefined;

    let query = supabase
        .from('lv_zinergia_tarifas')
        .select('id, company, tariff_name, logo_color, offer_type, fixed_fee, contract_duration, power_price_p1, power_price_p2, power_price_p3, power_price_p4, power_price_p5, power_price_p6, energy_price_p1, energy_price_p2, energy_price_p3, energy_price_p4, energy_price_p5, energy_price_p6')
        .eq('is_active', true)
        .eq('supply_type', 'electricity');

    if (segment) query = query.eq('tipo_cliente', segment);

    const { data: rows, error } = await query;

    if (error || !rows || rows.length === 0) {
        throw new Error('Aletheia fallback: no active tariffs in DB');
    }

    const offers: Offer[] = rows.map(t => ({
        id: t.id,
        marketer_name: t.company,
        tariff_name: t.tariff_name,
        logo_color: t.logo_color ?? '#10b981',
        type: t.offer_type ?? 'fixed',
        power_price: { p1: t.power_price_p1 ?? 0, p2: t.power_price_p2 ?? 0, p3: t.power_price_p3 ?? 0, p4: t.power_price_p4 ?? 0, p5: t.power_price_p5 ?? 0, p6: t.power_price_p6 ?? 0 },
        energy_price: { p1: t.energy_price_p1 ?? 0, p2: t.energy_price_p2 ?? 0, p3: t.energy_price_p3 ?? 0, p4: t.energy_price_p4 ?? 0, p5: t.energy_price_p5 ?? 0, p6: t.energy_price_p6 ?? 0 },
        fixed_fee: t.fixed_fee ?? 0,
        contract_duration: t.contract_duration ?? 'Sin permanencia',
    }));

    const aletheiaInvoice = crmToAletheiaInvoice(invoice);
    const candidates = offers.map(offerToTariffCandidate);
    const result = AletheiaEngine.run(aletheiaInvoice, candidates);

    return aletheiaResultToWebhookShape(result);
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
