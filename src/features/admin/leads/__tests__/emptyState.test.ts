import { describe, expect, it } from 'vitest';
import { buildAdminLeadsEmptyState } from '../emptyState';

describe('buildAdminLeadsEmptyState', () => {
    it('prioritizes queue-specific guidance over outcome guidance', () => {
        expect(buildAdminLeadsEmptyState({ outcome: 'all', queue: 'ocr_failed' })).toMatchObject({
            title: 'Sin OCR fallido',
            description: expect.stringContaining('errores técnicos'),
        });
    });

    it('explains the default open-leads empty state', () => {
        expect(buildAdminLeadsEmptyState({})).toMatchObject({
            title: 'No hay leads abiertos',
            actionHint: expect.stringContaining('factura nueva'),
        });
    });

    it('explains won, lost, and all outcome empty states', () => {
        expect(buildAdminLeadsEmptyState({ outcome: 'won' }).title).toBe('Aún no hay clientes en este filtro');
        expect(buildAdminLeadsEmptyState({ outcome: 'lost' }).title).toBe('No hay leads perdidos en este filtro');
        expect(buildAdminLeadsEmptyState({ outcome: 'all' }).title).toBe('No hay leads con estos filtros');
    });
});
