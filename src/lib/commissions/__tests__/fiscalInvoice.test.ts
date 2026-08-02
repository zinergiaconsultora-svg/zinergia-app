import { describe, expect, it } from 'vitest';
import {
    calculateFiscalTotals,
    canTransitionFiscalInvoice,
    validateFiscalDraftCandidates,
    validateSelfBillingReadiness,
} from '../fiscalInvoice';

describe('fiscal commission invoices', () => {
    it('calculates VAT on the full base and subtracts withholding only from payable total', () => {
        expect(calculateFiscalTotals(1_000, 21, 15)).toEqual({
            taxBase: 1_000,
            taxAmount: 210,
            retentionAmount: 150,
            total: 1_060,
        });
    });

    it('accepts only validated, reconciled, uninvoiced commissions from one commercial', () => {
        expect(validateFiscalDraftCandidates([
            { id: 'one', commercialId: 'agent-1', status: 'validated', reconciliationStatus: 'ready', invoiceId: null, netAmount: 300 },
            { id: 'two', commercialId: 'agent-1', status: 'validated', reconciliationStatus: 'ready', invoiceId: null, netAmount: 200 },
        ])).toEqual([]);

        expect(validateFiscalDraftCandidates([
            { id: 'one', commercialId: 'agent-1', status: 'validated', reconciliationStatus: 'ready', invoiceId: null, netAmount: 300 },
            { id: 'two', commercialId: 'agent-2', status: 'validated', reconciliationStatus: 'ready', invoiceId: null, netAmount: 200 },
        ])).toContain('Todas las comisiones deben pertenecer al mismo comercial.');
    });

    it('rejects duplicate, already invoiced and non-positive candidates', () => {
        expect(validateFiscalDraftCandidates([
            { id: 'one', commercialId: 'agent-1', status: 'validated', reconciliationStatus: 'ready', invoiceId: 'invoice-1', netAmount: 0 },
            { id: 'one', commercialId: 'agent-1', status: 'validated', reconciliationStatus: 'ready', invoiceId: null, netAmount: 100 },
        ])).toEqual(expect.arrayContaining([
            'Una comisión no puede repetirse en el mismo borrador.',
            'Solo se pueden facturar comisiones validadas, conciliadas y no reservadas.',
            'El importe neto de cada comisión debe ser positivo.',
        ]));
    });

    it('allows only draft issue, draft cancellation and issued payment', () => {
        expect(canTransitionFiscalInvoice('draft', 'issued')).toBe(true);
        expect(canTransitionFiscalInvoice('draft', 'cancelled')).toBe(true);
        expect(canTransitionFiscalInvoice('issued', 'paid')).toBe(true);
        expect(canTransitionFiscalInvoice('issued', 'cancelled')).toBe(false);
        expect(canTransitionFiscalInvoice('paid', 'cancelled')).toBe(false);
    });

    it('requires prior agreement and per-document acceptance for self-billing', () => {
        expect(validateSelfBillingReadiness({ agreementAccepted: false, invoiceAccepted: false })).toEqual([
            'La autofacturación requiere un acuerdo previo aceptado.',
            'Cada documento de autofacturación debe ser aceptado antes de emitirse.',
        ]);
        expect(validateSelfBillingReadiness({ agreementAccepted: true, invoiceAccepted: true })).toEqual([]);
    });
});
