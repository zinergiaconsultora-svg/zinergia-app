import type { AdminLeadFilters, AdminLeadOutcome, AdminLeadQueue } from '@/app/actions/invoices';

export interface AdminLeadsEmptyStateCopy {
    title: string;
    description: string;
    actionHint?: string;
}

const QUEUE_EMPTY_COPY: Record<AdminLeadQueue, AdminLeadsEmptyStateCopy> = {
    drive_pending: {
        title: 'Drive está al día',
        description: 'No hay facturas pendientes de sincronizar con el archivo operativo.',
        actionHint: 'Puedes revisar otras colas o volver a Abiertos para seguir con leads comerciales.',
    },
    ocr_failed: {
        title: 'Sin OCR fallido',
        description: 'No hay facturas bloqueadas por errores técnicos de lectura.',
        actionHint: 'La cola técnica está limpia; revisa Sin comparar o Pendientes de revisar si buscas trabajo operativo.',
    },
    needs_comparison: {
        title: 'No quedan leads sin comparar',
        description: 'Todas las facturas visibles en esta cola ya tienen comparativa o están cerradas.',
        actionHint: 'El siguiente paso suele estar en Pendientes de revisar o Enfriándose.',
    },
    permanence_due: {
        title: 'Sin renovaciones próximas',
        description: 'No hay clientes que requieran revisión de renovación en esta ventana.',
        actionHint: 'Vuelve a esta cola más adelante o revisa clientes abiertos con prioridad.',
    },
    needs_review: {
        title: 'No hay leads pendientes de revisar',
        description: 'El equipo admin no tiene leads abiertos esperando primera revisión.',
        actionHint: 'Puedes pasar a Enfriándose para recuperar oportunidades antiguas.',
    },
    cooling: {
        title: 'Sin leads enfriándose',
        description: 'No hay leads abiertos con más de siete días sin cerrar en este filtro.',
        actionHint: 'La presión comercial está controlada; revisa Abiertos para trabajo nuevo.',
    },
};

const OUTCOME_EMPTY_COPY: Record<AdminLeadOutcome, AdminLeadsEmptyStateCopy> = {
    open: {
        title: 'No hay leads abiertos',
        description: 'No hay oportunidades pendientes de gestión con los filtros actuales.',
        actionHint: 'Cuando entre una factura nueva o una propuesta pendiente, aparecerá aquí.',
    },
    won: {
        title: 'Aún no hay clientes en este filtro',
        description: 'No hay leads convertidos a cliente que coincidan con la búsqueda actual.',
        actionHint: 'Quita filtros o revisa Abiertos si quieres continuar el flujo comercial.',
    },
    lost: {
        title: 'No hay leads perdidos en este filtro',
        description: 'No hay oportunidades marcadas como perdidas para esta selección.',
        actionHint: 'Si estás auditando pérdidas, prueba a quitar la búsqueda o cambiar a Todos.',
    },
    all: {
        title: 'No hay leads con estos filtros',
        description: 'La combinación actual de búsqueda, estado o cola no devuelve resultados.',
        actionHint: 'Quita filtros para recuperar la vista completa del embudo.',
    },
};

export function buildAdminLeadsEmptyState(filters: AdminLeadFilters): AdminLeadsEmptyStateCopy {
    if (filters.queue) return QUEUE_EMPTY_COPY[filters.queue];
    return OUTCOME_EMPTY_COPY[filters.outcome ?? 'open'];
}
