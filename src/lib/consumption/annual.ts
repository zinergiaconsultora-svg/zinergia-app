import type { InvoiceData as CrmInvoiceData } from '@/types/crm';
import { getElectricityAnnualConsumption, type SipsAnnualConsumption } from '@/lib/cnmc/sips';

export type AnnualConsumptionSource = 'CNMC_SIPS' | 'OCR_INVOICE' | 'ESTIMATED_FROM_INVOICE' | 'MANUAL';
export type AnnualConsumptionConfidence = 'high' | 'medium' | 'low';

export interface AnnualConsumptionResult {
    annualKwh: number;
    annualMwh: number;
    source: AnnualConsumptionSource;
    confidence: AnnualConsumptionConfidence;
    reason: string;
}

export interface ResolveAnnualConsumptionInput {
    cups?: string | null;
    invoice?: Partial<CrmInvoiceData> | null;
    manualAnnualKwh?: number | null;
    allowSips?: boolean;
    sipsLookup?: (cups: string) => Promise<SipsAnnualConsumption>;
}

export async function resolveAnnualConsumption(input: ResolveAnnualConsumptionInput): Promise<AnnualConsumptionResult> {
    if (input.allowSips && input.cups) {
        try {
            const sips = await (input.sipsLookup ?? getElectricityAnnualConsumption)(input.cups);
            if (sips.annualKwh > 0) {
                return {
                    annualKwh: sips.annualKwh,
                    annualMwh: sips.annualMwh,
                    source: 'CNMC_SIPS',
                    confidence: 'high',
                    reason: 'Consumo anual obtenido desde CNMC SIPS por CUPS.',
                };
            }
        } catch {
            // Fall through to invoice/manual sources.
        }
    }

    const invoiceAnnual = getAnnualKwhFromInvoice(input.invoice);
    if (invoiceAnnual > 0) {
        return toResult(invoiceAnnual, 'OCR_INVOICE', 'medium', 'Consumo anual detectado en la factura.');
    }

    const estimated = estimateAnnualKwhFromInvoice(input.invoice);
    if (estimated > 0) {
        return toResult(estimated, 'ESTIMATED_FROM_INVOICE', 'low', 'Consumo anual estimado desde consumo del periodo facturado.');
    }

    if (input.manualAnnualKwh && input.manualAnnualKwh > 0) {
        return toResult(input.manualAnnualKwh, 'MANUAL', 'medium', 'Consumo anual introducido manualmente.');
    }

    return toResult(0, 'MANUAL', 'low', 'No hay datos suficientes para calcular consumo anual.');
}

export function estimateAnnualKwhFromInvoice(invoice?: Partial<CrmInvoiceData> | null): number {
    if (!invoice) return 0;
    const days = Number(invoice.period_days) || 0;
    if (days <= 0) return 0;

    const periodKwh: number = [
        invoice.energy_p1,
        invoice.energy_p2,
        invoice.energy_p3,
        invoice.energy_p4,
        invoice.energy_p5,
        invoice.energy_p6,
    ].reduce<number>((sum, value) => sum + (Number(value) || 0), 0);

    if (periodKwh <= 0) return 0;
    return (periodKwh / days) * 365;
}

function getAnnualKwhFromInvoice(invoice?: Partial<CrmInvoiceData> | null): number {
    const annual = invoice?.annual_consumption_kwh;
    return Number(annual) > 0 ? Number(annual) : 0;
}

function toResult(
    annualKwh: number,
    source: AnnualConsumptionSource,
    confidence: AnnualConsumptionConfidence,
    reason: string,
): AnnualConsumptionResult {
    return {
        annualKwh,
        annualMwh: annualKwh / 1000,
        source,
        confidence,
        reason,
    };
}
