import type { InvoiceStatus } from '@/types/crm';

type InvoiceFilter = InvoiceStatus | 'all';

export interface InvoicingEmptyStateCopy {
    title: string;
    description: string;
}

const INVOICE_STATUS_COPY: Record<Exclude<InvoiceFilter, 'all'>, InvoicingEmptyStateCopy> = {
    draft: {
        title: 'No hay borradores de factura',
        description: 'No tienes facturas pendientes de emitir. Genera una factura cuando haya comisiones disponibles para agrupar.',
    },
    issued: {
        title: 'No hay facturas emitidas pendientes',
        description: 'Las facturas enviadas y pendientes de cobro apareceran aqui hasta marcarlas como pagadas.',
    },
    paid: {
        title: 'No hay facturas pagadas todavia',
        description: 'Cuando marques una factura como pagada, quedara registrada aqui para seguimiento historico.',
    },
    cancelled: {
        title: 'No hay facturas canceladas',
        description: 'No hay facturas anuladas en este filtro. Si cancelas una factura, quedara aqui como referencia.',
    },
};

export function buildInvoicesEmptyState(filter: InvoiceFilter): InvoicingEmptyStateCopy {
    if (filter !== 'all') return INVOICE_STATUS_COPY[filter];

    return {
        title: 'Sin facturas todavia',
        description: 'Las facturas se crean desde comisiones disponibles. Cuando una propuesta aceptada genere comision facturable, podras agruparla en una nueva factura.',
    };
}

export function buildUninvoicedCommissionsEmptyState(): InvoicingEmptyStateCopy {
    return {
        title: 'No hay comisiones pendientes',
        description: 'Primero debe haber propuestas aceptadas con comisiones facturables. Cuando existan, podras seleccionarlas aqui para generar una factura.',
    };
}
