import { Commission } from '@/types/crm';

function escapeCell(value: string | number | null | undefined): string {
    const str = value == null ? '' : String(value);
    // Wrap in quotes if the cell contains commas, quotes, or newlines
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function buildCsv(rows: string[][]): string {
    return rows.map(row => row.map(escapeCell).join(',')).join('\r\n');
}

function downloadCsv(content: string, filename: string): void {
    const bom = '\uFEFF'; // UTF-8 BOM so Excel opens it correctly
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente',
    cleared: 'Aprobada',
    paid: 'Pagada',
};

export function exportCommissionsToCSV(commissions: Commission[], label = 'comisiones'): void {
    const header = [
        'Fecha',
        'Cliente',
        'ID Propuesta',
        'ID Agente',
        'Comisión Agente (€)',
        'Ganancia Franquicia (€)',
        'Royalty HQ (€)',
        'Revenue Total (€)',
        'Estado',
    ];

    const rows = commissions.map(c => [
        new Date(c.created_at).toLocaleDateString('es-ES'),
        c.proposals?.clients?.name ?? '',
        c.proposal_id,
        c.agent_id,
        c.agent_commission.toFixed(2),
        ((c.franchise_commission ?? c.franchise_profit ?? 0) as number).toFixed(2),
        c.hq_royalty.toFixed(2),
        c.total_revenue.toFixed(2),
        STATUS_LABELS[c.status] ?? c.status,
    ]);

    // Summary row
    const totalAgent = commissions.reduce((s, c) => s + c.agent_commission, 0);
    const totalFranchise = commissions.reduce((s, c) => s + (c.franchise_commission ?? c.franchise_profit ?? 0), 0);
    const totalHq = commissions.reduce((s, c) => s + c.hq_royalty, 0);
    const totalRevenue = commissions.reduce((s, c) => s + c.total_revenue, 0);
    const totals = ['TOTAL', '', '', '', totalAgent.toFixed(2), totalFranchise.toFixed(2), totalHq.toFixed(2), totalRevenue.toFixed(2), ''];

    const csv = buildCsv([header, ...rows, [], totals]);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `zinergia-${label}-${date}.csv`);
}
