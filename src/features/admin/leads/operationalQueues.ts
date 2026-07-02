import type { AdminLeadFilters, AdminLeadQueue } from '@/app/actions/invoices';

export interface OperationalQueue {
    value: AdminLeadQueue;
    label: string;
    description: string;
}

export const OPERATIONAL_QUEUES: OperationalQueue[] = [
    {
        value: 'drive_pending',
        label: 'Drive pendiente',
        description: 'Facturas sin archivo operativo sincronizado',
    },
    {
        value: 'ocr_failed',
        label: 'OCR fallido',
        description: 'Facturas que requieren revisión técnica',
    },
    {
        value: 'needs_comparison',
        label: 'Sin comparar',
        description: 'OCR listo pero sin comparativa comercial',
    },
    {
        value: 'permanence_due',
        label: 'Renovaciones',
        description: 'Clientes que conviene revisar en 60 días',
    },
    {
        value: 'needs_review',
        label: 'Pendientes de revisar',
        description: 'Leads abiertos que el admin aún no ha revisado',
    },
    {
        value: 'cooling',
        label: 'Enfriándose',
        description: 'Leads abiertos con más de 7 días sin cerrar',
    },
];

export function buildOperationalQueuePatch(
    currentQueue: AdminLeadQueue | undefined,
    nextQueue: AdminLeadQueue,
): Partial<AdminLeadFilters> {
    if (currentQueue === nextQueue) return { queue: undefined };
    return { outcome: 'all', queue: nextQueue };
}
