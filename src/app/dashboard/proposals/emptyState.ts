import type { StatusFilter } from './proposalsListShared';

export interface ProposalsEmptyStateCopy {
    title: string;
    description: string;
    actionLabel: string;
    actionKind: 'clear-filters' | 'open-simulator';
}

const STATUS_EMPTY_COPY: Record<Exclude<StatusFilter, 'all'>, Omit<ProposalsEmptyStateCopy, 'actionLabel' | 'actionKind'>> = {
    sent: {
        title: 'No hay propuestas enviadas con estos filtros',
        description: 'Cuando compartas una propuesta pendiente de respuesta, aparecerá en esta pestaña.',
    },
    accepted: {
        title: 'No hay propuestas firmadas con estos filtros',
        description: 'Las propuestas aceptadas aparecerán aquí para seguir alta, comisión y documentación.',
    },
    draft: {
        title: 'No hay borradores con estos filtros',
        description: 'Los borradores se generan al guardar una simulación antes de enviarla al cliente.',
    },
    rejected: {
        title: 'No hay propuestas rechazadas con estos filtros',
        description: 'Las oportunidades descartadas aparecerán aquí para revisar motivos y recuperar contexto.',
    },
};

export function buildProposalsEmptyState({
    statusFilter,
    hasSearch,
    hasAdvancedFilters,
}: {
    statusFilter: StatusFilter;
    hasSearch: boolean;
    hasAdvancedFilters: boolean;
}): ProposalsEmptyStateCopy {
    if (hasSearch || hasAdvancedFilters) {
        return {
            title: 'Sin resultados con estos filtros',
            description: 'Relaja la búsqueda, fechas, ahorro mínimo o comercializadora para recuperar propuestas.',
            actionLabel: 'Limpiar filtros',
            actionKind: 'clear-filters',
        };
    }

    if (statusFilter !== 'all') {
        return {
            ...STATUS_EMPTY_COPY[statusFilter],
            actionLabel: 'Ver todas',
            actionKind: 'clear-filters',
        };
    }

    return {
        title: 'Sin propuestas todavía',
        description: 'Carga una factura en el simulador, compara tarifas y guarda la propuesta en CRM para iniciar el seguimiento.',
        actionLabel: 'Abrir simulador',
        actionKind: 'open-simulator',
    };
}
