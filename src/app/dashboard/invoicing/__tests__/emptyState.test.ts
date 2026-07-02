import { describe, expect, it } from 'vitest';
import { buildInvoicesEmptyState, buildUninvoicedCommissionsEmptyState } from '../emptyState';

describe('invoicing empty state copy', () => {
    it('guides first invoice creation from payable commissions', () => {
        expect(buildInvoicesEmptyState('all')).toEqual({
            title: 'Sin facturas todavia',
            description: 'Las facturas se crean desde comisiones disponibles. Cuando una propuesta aceptada genere comision facturable, podras agruparla en una nueva factura.',
        });
    });

    it('explains empty invoice status filters', () => {
        expect(buildInvoicesEmptyState('draft').title).toBe('No hay borradores de factura');
        expect(buildInvoicesEmptyState('issued').description).toContain('pendientes de cobro');
        expect(buildInvoicesEmptyState('paid').description).toContain('seguimiento historico');
        expect(buildInvoicesEmptyState('cancelled').description).toContain('referencia');
    });

    it('explains why the create invoice modal has no selectable commissions', () => {
        expect(buildUninvoicedCommissionsEmptyState()).toEqual({
            title: 'No hay comisiones pendientes',
            description: 'Primero debe haber propuestas aceptadas con comisiones facturables. Cuando existan, podras seleccionarlas aqui para generar una factura.',
        });
    });
});
