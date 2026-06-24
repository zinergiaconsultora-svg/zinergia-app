import type { InvoiceRegistryRow } from '@/app/actions/invoices';

export type PriorityTier = 'alta' | 'media' | 'baja';

export interface LeadPriority {
    score: number;                   // 0–100
    tier: PriorityTier;
    estimatedSavings: number | null; // €/año (real si hay propuesta, estimado si no)
    savingsIsReal: boolean;
    reasons: string[];               // señales explicables, en orden de relevancia
}

const DAY = 86_400_000;
// La landing promete "hasta 40%"; estimamos un 12% conservador para no inflar la
// prioridad cuando aún no existe una comparativa real.
const ESTIMATED_SAVINGS_RATE = 0.12;
const DEFAULT_PERIOD_DAYS = 30;

/** Parses an OCR amount string ("85,40" / "85.40") into a number, or null. */
export function parseAmount(raw: string | number | null): number | null {
    if (raw === null || raw === undefined || raw === '') return null;
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

/** Annualizes the invoice amount using its billing period (defaults to 30 days). */
function annualizedBill(row: InvoiceRegistryRow): number | null {
    const amt = parseAmount(row.importe_total);
    if (amt === null || amt <= 0) return null;
    const days = Number(row.period_days);
    const period = Number.isFinite(days) && days > 0 ? days : DEFAULT_PERIOD_DAYS;
    return amt * (365 / period);
}

/**
 * Commercial priority score for a lead — savings-driven, explainable and
 * urgency-aware. Closed/lost leads fall to the bottom (no action needed).
 */
export function scoreLead(row: InvoiceRegistryRow, now: number = Date.now()): LeadPriority {
    if (row.closed) {
        return { score: 0, tier: 'baja', estimatedSavings: row.annual_savings ?? null, savingsIsReal: row.has_proposal, reasons: ['Ya es cliente'] };
    }
    if (row.lost) {
        return { score: 0, tier: 'baja', estimatedSavings: null, savingsIsReal: false, reasons: ['Lead perdido'] };
    }

    const reasons: string[] = [];

    // 1. Valor económico (ahorro) — hasta 45
    let estimatedSavings: number | null;
    let savingsIsReal: boolean;
    if (row.annual_savings != null && row.annual_savings > 0) {
        estimatedSavings = Math.round(row.annual_savings);
        savingsIsReal = true;
    } else {
        const annual = annualizedBill(row);
        estimatedSavings = annual != null ? Math.round(annual * ESTIMATED_SAVINGS_RATE) : null;
        savingsIsReal = false;
    }
    let economic = 4;
    if (estimatedSavings != null) {
        if (estimatedSavings >= 400) economic = 45;
        else if (estimatedSavings >= 200) economic = 33;
        else if (estimatedSavings >= 80) economic = 20;
        else economic = 9;
        reasons.push(savingsIsReal ? `Ahorro ${estimatedSavings} €/año (propuesta)` : `Ahorro estimado ${estimatedSavings} €/año`);
    } else {
        reasons.push('Sin importe para estimar ahorro');
    }

    // 2. Preparación / etapa — hasta 25
    let readiness: number;
    switch (row.process_status) {
        case 'compared': readiness = 25; reasons.push('Comparada — lista para propuesta'); break;
        case 'ocr_done': readiness = 16; break;
        case 'failed': readiness = 2; reasons.push('OCR fallido — revisar'); break;
        default: readiness = 8; // uploaded
    }
    if (row.has_proposal) { readiness = Math.min(25, readiness + 4); reasons.push('Propuesta enviada'); }

    // 3. Frescura / urgencia — hasta 20 (decay + aviso de enfriamiento)
    const ageDays = Math.max(0, (now - new Date(row.created_at).getTime()) / DAY);
    let recency: number;
    if (ageDays <= 2) { recency = 20; reasons.push('Lead reciente'); }
    else if (ageDays <= 5) recency = 14;
    else if (ageDays <= 10) { recency = 8; reasons.push(`Enfriándose: ${Math.round(ageDays)} días`); }
    else if (ageDays <= 30) recency = 4;
    else { recency = 1; reasons.push(`Antiguo: ${Math.round(ageDays)} días`); }

    // 4. Completitud de datos — hasta 10
    let completeness = 0;
    if (row.cups) completeness += 5; else reasons.push('Falta CUPS');
    if (row.archived_in_drive) completeness += 3; else reasons.push('Sin archivar en Drive');
    if (row.titular) completeness += 2;

    const score = Math.max(0, Math.min(100, Math.round(economic + readiness + recency + completeness)));
    const tier: PriorityTier = score >= 65 ? 'alta' : score >= 35 ? 'media' : 'baja';

    return { score, tier, estimatedSavings, savingsIsReal, reasons };
}

const TIER_RANK: Record<PriorityTier, number> = { alta: 0, media: 1, baja: 2 };

/** Sorts a copy of the leads by priority (highest score first). */
export function sortByPriority(rows: InvoiceRegistryRow[], now: number = Date.now()): InvoiceRegistryRow[] {
    return [...rows]
        .map((row) => ({ row, p: scoreLead(row, now) }))
        .sort((a, b) => TIER_RANK[a.p.tier] - TIER_RANK[b.p.tier] || b.p.score - a.p.score)
        .map((x) => x.row);
}
