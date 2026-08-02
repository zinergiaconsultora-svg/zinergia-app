import { z } from 'zod';
import { isValidCups } from '@/lib/cnmc/sips';
import {
    encryptNullable,
    hashCups,
    hashDni,
    normalizeCups,
    normalizeDni,
} from '@/lib/crypto/pii';
import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/utils/logger';
import { OPPORTUNITY_STAGES, type OpportunityStage } from './opportunityState';

export type OcrManualReviewReason =
    | 'missing_cups'
    | 'invalid_cups'
    | 'missing_client_name'
    | 'identity_conflict';

export type OcrOpportunityReconciliation =
    | {
        status: 'linked';
        clientId: string;
        supplyPointId: string;
        opportunityId: string;
        stage: OpportunityStage;
        opportunityCreated: boolean;
        opportunityAdvanced: boolean;
    }
    | {
        status: 'manual_review';
        reason: OcrManualReviewReason;
    };

const rpcRowSchema = z.object({
    resolution: z.enum(['linked', 'manual_review']),
    client_id: z.string().uuid().nullable(),
    supply_point_id: z.string().uuid().nullable(),
    opportunity_id: z.string().uuid().nullable(),
    opportunity_stage: z.enum(OPPORTUNITY_STAGES).nullable(),
    opportunity_created: z.boolean(),
    opportunity_advanced: z.boolean(),
});

const MANUAL_REVIEW_MESSAGE = 'OCR completado; la factura requiere revisión manual.';

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number | null {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function buildContractedPower(invoice: Record<string, unknown>): Record<string, number> | null {
    const power: Record<string, number> = {};
    for (let period = 1; period <= 6; period++) {
        const value = numberValue(invoice[`power_p${period}`]);
        if (value !== null) power[`p${period}`] = value;
    }
    return Object.keys(power).length > 0 ? power : null;
}

function averageMonthlyBill(invoice: Record<string, unknown>): number | null {
    const total = numberValue(invoice.total_amount);
    const days = numberValue(invoice.period_days);
    if (total === null) return null;
    if (days === null || days === 0) return total;
    return Math.round((total / (days / 30)) * 100) / 100;
}

async function markManualReview(
    jobId: string,
    reason: OcrManualReviewReason,
): Promise<OcrOpportunityReconciliation> {
    const service = createServiceClient();
    const { error } = await service
        .from('ocr_jobs')
        .update({ error_message: MANUAL_REVIEW_MESSAGE })
        .eq('id', jobId);

    if (error) {
        logger.error(
            '[crm] could not mark OCR job for manual review',
            undefined,
            { code: error.code ?? 'unknown', jobId },
        );
        throw new Error('No se pudo preparar el expediente comercial');
    }

    return { status: 'manual_review', reason };
}

export async function reconcileCompletedOcrOpportunity(
    jobId: string,
    invoice: Record<string, unknown>,
): Promise<OcrOpportunityReconciliation> {
    const rawCups = stringValue(invoice.cups);
    if (!rawCups) return markManualReview(jobId, 'missing_cups');

    const cups = normalizeCups(rawCups);
    if (!isValidCups(cups)) return markManualReview(jobId, 'invalid_cups');

    const clientName = stringValue(invoice.client_name);
    if (!clientName || clientName === 'Cliente Desconocido') {
        return markManualReview(jobId, 'missing_client_name');
    }

    const rawDni = stringValue(invoice.dni_cif);
    const dni = rawDni ? normalizeDni(rawDni) : '';
    const service = createServiceClient();
    const { data, error } = await service.rpc('reconcile_crm_ocr_opportunity', {
        p_job_id: jobId,
        p_client_name: clientName.slice(0, 200),
        p_cups_ciphertext: encryptNullable(cups),
        p_cups_hash: hashCups(cups),
        p_cups_last4: cups.slice(-4),
        p_dni_cif_ciphertext: dni ? encryptNullable(dni) : null,
        p_dni_cif_hash: dni ? hashDni(dni) : null,
        p_supply_address: stringValue(invoice.supply_address).slice(0, 300) || null,
        p_current_marketer: stringValue(invoice.company_name).slice(0, 160) || null,
        p_current_tariff: stringValue(invoice.tariff_name).slice(0, 120) || null,
        p_contracted_power: buildContractedPower(invoice),
        p_average_monthly_bill: averageMonthlyBill(invoice),
    });

    if (error || !data) {
        logger.error(
            '[crm] OCR opportunity reconciliation failed',
            undefined,
            { code: error?.code ?? 'empty_result', jobId },
        );
        throw new Error('No se pudo preparar el expediente comercial');
    }

    const candidate = Array.isArray(data) ? data[0] : data;
    const parsed = rpcRowSchema.safeParse(candidate);
    if (!parsed.success) {
        logger.error('[crm] OCR opportunity reconciliation returned an invalid result');
        throw new Error('No se pudo preparar el expediente comercial');
    }

    const row = parsed.data;
    if (row.resolution === 'manual_review') {
        return { status: 'manual_review', reason: 'identity_conflict' };
    }

    if (
        !row.client_id
        || !row.supply_point_id
        || !row.opportunity_id
        || !row.opportunity_stage
    ) {
        throw new Error('No se pudo preparar el expediente comercial');
    }

    return {
        status: 'linked',
        clientId: row.client_id,
        supplyPointId: row.supply_point_id,
        opportunityId: row.opportunity_id,
        stage: row.opportunity_stage,
        opportunityCreated: row.opportunity_created,
        opportunityAdvanced: row.opportunity_advanced,
    };
}
