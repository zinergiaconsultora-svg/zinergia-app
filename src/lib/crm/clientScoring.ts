/**
 * Pure client scoring logic — no I/O, no DB access.
 *
 * Score breakdown (max 100):
 *   OCR anomaly critical    +40
 *   OCR anomaly warning     +20
 *   Savings > 2000 €/year   +20
 *   Savings > 800 €/year    +10
 *   No proposal > 14 days   +20  (after rejected)
 *   No proposal > 7 days    +12  (after rejected) / +20 (new client)
 *   No proposal > 3 days    +5   (after rejected) / +10 (new client)
 *   Status 'new'            +10
 *   Status 'contacted'      +5
 *
 * The action getClientScoresAction fetches the required data from DB
 * and delegates to this function.
 */

export interface OcrScoringData {
    forensic_details?: { reactive_penalty?: unknown } | null;
    current_energy_price_p1?: number | null;
    tariff_name?: string | null;
    total_amount?: number | null;
}

export interface ProposalScoringData {
    created_at: string;
    status: string;
}

export interface ClientScoringData {
    status: string;
    created_at: string;
}

export interface ClientScore {
    clientId: string;
    score: number;
    reasons: string[];
}

/**
 * Compute the priority score for a single client.
 *
 * @param clientId  Client UUID.
 * @param ocr       Latest completed OCR job for this client, or null.
 * @param proposal  Latest proposal for this client, or null.
 * @param meta      Client row (status, created_at).
 * @param now       Current timestamp in ms (pass Date.now() in production, or a fixed value in tests).
 */
export function computeClientScore(
    clientId: string,
    ocr: OcrScoringData | null,
    proposal: ProposalScoringData | null,
    meta: ClientScoringData | null,
    now: number,
): ClientScore {
    let score = 0;
    const reasons: string[] = [];

    // 1. OCR anomaly + savings potential
    if (ocr) {
        const forensic = ocr.forensic_details;
        const price = ocr.current_energy_price_p1 ?? undefined;
        const hasCritical = !!forensic?.reactive_penalty || (price != null && price > 0.22);
        const hasWarning = !hasCritical && (
            (ocr.tariff_name?.toUpperCase().includes('PVPC') ?? false) ||
            (price != null && price > 0.19)
        );

        if (hasCritical) { score += 40; reasons.push('Anomalía crítica'); }
        else if (hasWarning) { score += 20; reasons.push('Anomalía detectada'); }

        const monthly = ocr.total_amount ?? undefined;
        if (monthly != null) {
            const annual = monthly * 12;
            if (annual > 2000) { score += 20; reasons.push('Alto potencial'); }
            else if (annual > 800) { score += 10; reasons.push('Potencial medio'); }
        }
    }

    // 2. Days without active proposal
    const noActiveProposal = !proposal || proposal.status === 'rejected' || proposal.status === 'lost';
    if (noActiveProposal && meta?.created_at) {
        const referenceDate = !proposal ? meta.created_at : (proposal.created_at ?? meta.created_at);
        const daysSince = Math.floor((now - new Date(referenceDate).getTime()) / 86_400_000);

        if (!proposal) {
            // New client: lower threshold
            if (daysSince > 7) { score += 20; reasons.push('Sin propuesta'); }
            else if (daysSince > 3) { score += 10; reasons.push('Sin propuesta'); }
        } else {
            // After rejected/lost
            if (daysSince > 14) { score += 20; reasons.push('>14d sin propuesta'); }
            else if (daysSince > 7) { score += 12; reasons.push('>7d sin propuesta'); }
            else if (daysSince > 3) { score += 5; }
        }
    }

    // 3. Status bonus
    const status = meta?.status;
    if (status === 'new') { score += 10; }
    else if (status === 'contacted') { score += 5; }

    return { clientId, score: Math.min(score, 100), reasons };
}
