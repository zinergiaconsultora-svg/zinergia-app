/**
 * Calcula un score de calidad 0-100 para un ejemplo de entrenamiento basado en:
 * - Confianza media OCR de los campos (0-40 pts)
 * - Si fue validado por humano (0-30 pts)
 * - Completitud de campos relevantes (0-20 pts)
 * - Si tiene correcciones documentadas (0-10 pts bonus)
 */
export function computeExampleQualityScore(example: {
    extracted_fields: Record<string, unknown> | null;
    is_validated: boolean;
    corrected_fields: Record<string, unknown> | null;
}): number {
    let score = 0;

    // Confianza OCR (0-40 pts)
    const conf = (example.extracted_fields?._confidence) as Record<string, number> | undefined;
    if (conf) {
        const vals = Object.values(conf).filter((v): v is number => typeof v === 'number');
        if (vals.length > 0) {
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            score += Math.round(avg * 40);
        }
    }

    // Validación humana (0-30 pts)
    if (example.is_validated) score += 30;

    // Completitud de campos relevantes (0-20 pts)
    const KEY_FIELDS = ['client_name', 'cups', 'dni_cif', 'company_name', 'invoice_number', 'invoice_date', 'tariff_name', 'total_amount'];
    const fields = example.extracted_fields ?? {};
    const filled = KEY_FIELDS.filter(f => fields[f] !== undefined && fields[f] !== null && fields[f] !== '').length;
    score += Math.round((filled / KEY_FIELDS.length) * 20);

    // Correcciones documentadas (0-10 pts bonus)
    if (example.corrected_fields && Object.keys(example.corrected_fields).length > 0) score += 10;

    return Math.min(100, score);
}
