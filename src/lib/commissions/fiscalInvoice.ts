export type FiscalInvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';

export type FiscalDraftCandidate = {
    id: string;
    commercialId: string | null;
    status: string;
    reconciliationStatus: string;
    invoiceId: string | null;
    netAmount: number;
};

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

export function calculateFiscalTotals(baseAmount: number, taxPercent: number, retentionPercent: number) {
    const taxBase = roundMoney(baseAmount);
    const taxAmount = roundMoney(taxBase * taxPercent / 100);
    const retentionAmount = roundMoney(taxBase * retentionPercent / 100);
    return {
        taxBase,
        taxAmount,
        retentionAmount,
        total: roundMoney(taxBase + taxAmount - retentionAmount),
    };
}

export function validateFiscalDraftCandidates(candidates: FiscalDraftCandidate[]): string[] {
    const errors: string[] = [];
    if (candidates.length === 0) errors.push('Selecciona al menos una comisión.');
    if (new Set(candidates.map((item) => item.id)).size !== candidates.length) {
        errors.push('Una comisión no puede repetirse en el mismo borrador.');
    }
    if (new Set(candidates.map((item) => item.commercialId)).size > 1) {
        errors.push('Todas las comisiones deben pertenecer al mismo comercial.');
    }
    if (candidates.some((item) => item.status !== 'validated' || item.reconciliationStatus !== 'ready' || item.invoiceId !== null)) {
        errors.push('Solo se pueden facturar comisiones validadas, conciliadas y no reservadas.');
    }
    if (candidates.some((item) => item.netAmount <= 0)) {
        errors.push('El importe neto de cada comisión debe ser positivo.');
    }
    return errors;
}

export function canTransitionFiscalInvoice(from: FiscalInvoiceStatus, to: FiscalInvoiceStatus): boolean {
    return (from === 'draft' && (to === 'issued' || to === 'cancelled'))
        || (from === 'issued' && to === 'paid');
}

export function validateSelfBillingReadiness({ agreementAccepted, invoiceAccepted }: { agreementAccepted: boolean; invoiceAccepted: boolean }): string[] {
    const errors: string[] = [];
    if (!agreementAccepted) errors.push('La autofacturación requiere un acuerdo previo aceptado.');
    if (!invoiceAccepted) errors.push('Cada documento de autofacturación debe ser aceptado antes de emitirse.');
    return errors;
}
