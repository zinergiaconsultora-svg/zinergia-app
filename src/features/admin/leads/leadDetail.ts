import type { InvoiceRegistryRow } from '@/app/actions/invoices';

export type LeadTimelineStatus = 'done' | 'pending' | 'warning';

export interface LeadTimelineItem {
    id: string;
    label: string;
    detail?: string;
    at: string | null;
    status: LeadTimelineStatus;
}

export function maskCups(cups: string | null): string {
    if (!cups) return '—';
    const compact = cups.trim().replace(/\s+/g, '').toUpperCase();
    if (compact.length <= 10) return compact;
    return `${compact.slice(0, 6)}...${compact.slice(-4)}`;
}

export function buildLeadTimeline(lead: InvoiceRegistryRow): LeadTimelineItem[] {
    const items: LeadTimelineItem[] = [
        {
            id: 'uploaded',
            label: 'Factura subida',
            detail: lead.agent_name ? `Subida por ${lead.agent_name}` : undefined,
            at: lead.created_at,
            status: 'done',
        },
    ];

    if (lead.ocr_status === 'failed' || lead.process_status === 'failed') {
        items.push({
            id: 'ocr-failed',
            label: 'OCR con error',
            detail: 'Requiere revisión o reintento',
            at: null,
            status: 'warning',
        });
        return items;
    }

    if (lead.ocr_status === 'completed' || lead.process_status !== 'uploaded') {
        items.push({
            id: 'ocr-completed',
            label: 'OCR completado',
            detail: lead.titular || 'Datos extraídos de la factura',
            at: null,
            status: 'done',
        });
    }

    if (lead.compared_at) {
        items.push({
            id: 'compared',
            label: 'Comparativa lista',
            detail: lead.comercializadora_actual || undefined,
            at: lead.compared_at,
            status: 'done',
        });
    }

    if (lead.archived_in_drive) {
        items.push({
            id: 'drive-synced',
            label: 'Archivada en Drive',
            detail: 'Copia operativa disponible',
            at: lead.drive_synced_at,
            status: 'done',
        });
    } else {
        items.push({
            id: 'drive-pending',
            label: 'Drive pendiente',
            detail: 'Aún no consta archivo sincronizado',
            at: null,
            status: 'pending',
        });
    }

    if (lead.closed) {
        items.push({
            id: 'won',
            label: 'Cliente confirmado',
            detail: lead.compania_contratada || undefined,
            at: lead.closed_at,
            status: 'done',
        });
    }

    if (lead.lost) {
        items.push({
            id: 'lost',
            label: 'Lead perdido',
            detail: lead.lost_reason || 'Sin motivo registrado',
            at: null,
            status: 'warning',
        });
    }

    if (lead.permanencia_hasta) {
        items.push({
            id: 'permanence',
            label: 'Permanencia registrada',
            detail: lead.permanencia_hasta,
            at: lead.permanencia_hasta,
            status: 'pending',
        });
    }

    return items;
}
