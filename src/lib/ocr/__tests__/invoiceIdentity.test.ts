import { describe, expect, it } from 'vitest';

import {
    isSameCups,
    isSameInvoice,
    parseInvoiceYearMonth,
    resolveDedupScope,
} from '../invoiceIdentity';

describe('resolveDedupScope', () => {
    it('busca dentro de la franquicia cuando la hay', () => {
        expect(resolveDedupScope({ franchiseId: 'fr-1', userId: 'u-1' }))
            .toEqual({ column: 'franchise_id', value: 'fr-1' });
    });

    // El caso que dejó entrar los doce duplicados: sin franquicia se devolvía
    // "no es duplicado" sin mirar nada. Y quien no tiene franquicia es el
    // administrador, por el invariante que sostiene su autoridad.
    it('cae al propio usuario cuando no hay franquicia, en vez de rendirse', () => {
        expect(resolveDedupScope({ franchiseId: null, userId: 'u-1' }))
            .toEqual({ column: 'agent_id', value: 'u-1' });
        expect(resolveDedupScope({ userId: 'u-1' }))
            .toEqual({ column: 'agent_id', value: 'u-1' });
    });

    it('trata la cadena vacía como ausencia de franquicia', () => {
        expect(resolveDedupScope({ franchiseId: '', userId: 'u-1' }).column).toBe('agent_id');
    });
});

describe('parseInvoiceYearMonth', () => {
    it('lee los tres formatos que devuelve el OCR', () => {
        expect(parseInvoiceYearMonth('2026-06-29')).toBe('2026-06');
        expect(parseInvoiceYearMonth('29/06/2026')).toBe('2026-06');
        expect(parseInvoiceYearMonth('06/2026')).toBe('2026-06');
    });

    it('ignora espacios sobrantes', () => {
        expect(parseInvoiceYearMonth('  2026-06-29  ')).toBe('2026-06');
    });

    // Devolver null significa "no lo sé". Quien llame no puede confundirlo con
    // "no es duplicado".
    it('devuelve null cuando no reconoce la fecha', () => {
        expect(parseInvoiceYearMonth('')).toBeNull();
        expect(parseInvoiceYearMonth(null)).toBeNull();
        expect(parseInvoiceYearMonth(undefined)).toBeNull();
        expect(parseInvoiceYearMonth('junio de 2026')).toBeNull();
    });
});

describe('isSameCups', () => {
    it('compara sin distinguir mayúsculas ni espacios', () => {
        expect(isSameCups('ES0021000000000000AB', ' es0021000000000000ab ')).toBe(true);
    });

    it('distingue CUPS diferentes', () => {
        expect(isSameCups('ES0021000000000000AB', 'ES0022000000000000AB')).toBe(false);
    });

    // Dos facturas sin CUPS no son "la misma factura": serían todas iguales.
    it('no considera iguales dos ausencias', () => {
        expect(isSameCups('', '')).toBe(false);
        expect(isSameCups(null, null)).toBe(false);
        expect(isSameCups(undefined, '')).toBe(false);
    });
});

describe('isSameInvoice', () => {
    const factura = { cups: 'ES0021000000000000AB', invoiceDate: '2026-06-29' };

    it('reconoce la misma factura aunque venga con otro formato de fecha', () => {
        expect(isSameInvoice(factura, { cups: 'ES0021000000000000AB', invoiceDate: '29/06/2026' })).toBe(true);
    });

    // El mismo suministro factura todos los meses: mismo CUPS y distinto mes son
    // dos facturas legítimas, no un duplicado.
    it('no confunde dos meses del mismo suministro', () => {
        expect(isSameInvoice(factura, { cups: 'ES0021000000000000AB', invoiceDate: '2026-07-29' })).toBe(false);
    });

    it('no confunde el mismo mes de dos suministros', () => {
        expect(isSameInvoice(factura, { cups: 'ES0022000000000000AB', invoiceDate: '2026-06-29' })).toBe(false);
    });

    it('no afirma nada si falta el periodo de alguna', () => {
        expect(isSameInvoice(factura, { cups: 'ES0021000000000000AB', invoiceDate: null })).toBe(false);
        expect(isSameInvoice({ cups: factura.cups, invoiceDate: 'sin fecha' }, factura)).toBe(false);
    });
});
