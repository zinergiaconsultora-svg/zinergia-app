import type { Json } from '@/types/database.types';

export const COMMISSION_LIFECYCLE_STATUSES = [
    'pending',
    'eligible',
    'validated',
    'invoiced',
    'paid',
    'reverted',
] as const;

export type CommissionLifecycleStatus = typeof COMMISSION_LIFECYCLE_STATUSES[number];

export type CommissionAdjustmentSource = {
    id: string;
    reason_code: string;
    active_days: number | null;
    reversal_bps: number;
    commercial_amount: number;
    evidence_reference: string;
    policy_snapshot: Json;
    status: string;
    proposed_at: string;
    resolved_at: string | null;
    resolution_note: string | null;
};

export type CommissionWorkspaceSource = {
    id: string;
    proposal_id: string | null;
    contract_id: string | null;
    created_at: string | null;
    lifecycle_status: string;
    reconciliation_status: string;
    agent_commission: number;
    commercial_net_amount: number | null;
    gross_supplier_commission: number | null;
    total_reversed_commercial: number;
    calculation_snapshot: Json | null;
    policy_snapshot: Json | null;
    clients: { name: string } | null;
    proposals: {
        offer_snapshot: Json | null;
        clients: { name: string } | null;
    } | null;
    commission_adjustments: CommissionAdjustmentSource[];
};

export type CommissionAdjustmentItem = {
    id: string;
    reasonCode: string;
    reasonLabel: string;
    activeDays: number | null;
    reversalPercent: number;
    reversedAmount: number;
    evidenceReference: string;
    disputeStatus: string;
    disputeLabel: string;
    frozenPolicyLabel: string;
    proposedAt: string;
    resolvedAt: string | null;
    resolutionNote: string | null;
};

export type CommissionWorkspaceItem = {
    id: string;
    status: CommissionLifecycleStatus;
    statusLabel: string;
    reconciliationStatus: string;
    reconciliationLabel: string;
    clientName: string;
    marketerName: string;
    productName: string;
    proposalId: string | null;
    contractId: string | null;
    createdAt: string | null;
    grossAmount: number | null;
    originalAmount: number;
    reversedAmount: number;
    netAmount: number;
    adjustments: CommissionAdjustmentItem[];
};

export type CommissionStatusSummary = {
    id: CommissionLifecycleStatus;
    label: string;
    shortLabel: string;
    count: number;
    amount: number;
};

export type CommissionWorkspace = {
    items: CommissionWorkspaceItem[];
    statuses: CommissionStatusSummary[];
    totalNetAmount: number;
    availableToInvoiceAmount: number;
    paidAmount: number;
    reversedAmount: number;
    adjustmentCount: number;
};

const STATUS_LABELS: Record<CommissionLifecycleStatus, { label: string; shortLabel: string }> = {
    pending: { label: 'Pendiente de consolidar', shortLabel: 'Pendientes' },
    eligible: { label: 'Pendiente de validación', shortLabel: 'En validación' },
    validated: { label: 'Disponible para facturar', shortLabel: 'Disponibles' },
    invoiced: { label: 'Facturada', shortLabel: 'Facturadas' },
    paid: { label: 'Pagada', shortLabel: 'Pagadas' },
    reverted: { label: 'Revertida', shortLabel: 'Revertidas' },
};

const RECONCILIATION_LABELS: Record<string, string> = {
    ready: 'Datos conciliados',
    plan_unassigned: 'Falta asignar el plan comercial',
    policy_unmatched: 'Falta política de decomisión',
    pending_review: 'Revisión administrativa pendiente',
    contradictory_legacy: 'Datos históricos por conciliar',
};

const ADJUSTMENT_REASON_LABELS: Record<string, string> = {
    early_switch: 'Cambio anticipado de comercializadora',
    non_consolidation: 'Contrato no consolidado',
    non_payment: 'Impago del cliente',
    irregular_sale: 'Venta irregular',
    supplier_correction: 'Corrección de la comercializadora',
    other: 'Otro ajuste documentado',
};

const ADJUSTMENT_STATUS_LABELS: Record<string, string> = {
    proposed: 'Pendiente de resolver',
    confirmed: 'Confirmado',
    disputed: 'En disputa',
    waived: 'Anulado',
};

function isRecord(value: Json | null | undefined): value is Record<string, Json | undefined> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: Json | null | undefined, key: string): string | null {
    if (!isRecord(value)) return null;
    const entry = value[key];
    return typeof entry === 'string' && entry.trim() ? entry.trim() : null;
}

function normalizeStatus(status: string): CommissionLifecycleStatus {
    return COMMISSION_LIFECYCLE_STATUSES.includes(status as CommissionLifecycleStatus)
        ? status as CommissionLifecycleStatus
        : 'pending';
}

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

function formatFrozenPolicy(snapshot: Json): string {
    const code = readText(snapshot, 'code');
    if (!code) return 'Politica congelada';
    const version = isRecord(snapshot) && typeof snapshot.version === 'number'
        ? ` v${snapshot.version}`
        : '';
    return `${code}${version}`;
}

function mapAdjustment(source: CommissionAdjustmentSource): CommissionAdjustmentItem {
    return {
        id: source.id,
        reasonCode: source.reason_code,
        reasonLabel: ADJUSTMENT_REASON_LABELS[source.reason_code] ?? 'Ajuste documentado',
        activeDays: source.active_days,
        reversalPercent: source.reversal_bps / 100,
        reversedAmount: roundMoney(source.commercial_amount),
        evidenceReference: source.evidence_reference,
        disputeStatus: source.status,
        disputeLabel: ADJUSTMENT_STATUS_LABELS[source.status] ?? 'Estado pendiente',
        frozenPolicyLabel: formatFrozenPolicy(source.policy_snapshot),
        proposedAt: source.proposed_at,
        resolvedAt: source.resolved_at,
        resolutionNote: source.resolution_note,
    };
}

function mapCommission(source: CommissionWorkspaceSource): CommissionWorkspaceItem {
    const status = normalizeStatus(source.lifecycle_status);
    const originalAmount = roundMoney(source.commercial_net_amount ?? source.agent_commission ?? 0);
    const reversedAmount = roundMoney(source.total_reversed_commercial ?? 0);
    const offerSnapshot = source.proposals?.offer_snapshot;

    return {
        id: source.id,
        status,
        statusLabel: STATUS_LABELS[status].label,
        reconciliationStatus: source.reconciliation_status,
        reconciliationLabel: RECONCILIATION_LABELS[source.reconciliation_status] ?? 'Revision pendiente',
        clientName: source.clients?.name?.trim()
            || source.proposals?.clients?.name?.trim()
            || 'Cliente sin identificar',
        marketerName: readText(source.calculation_snapshot, 'marketer_name')
            ?? readText(offerSnapshot, 'marketer_name')
            ?? 'Comercializadora sin identificar',
        productName: readText(source.calculation_snapshot, 'product_code')
            ?? readText(offerSnapshot, 'tariff_name')
            ?? 'Producto sin identificar',
        proposalId: source.proposal_id,
        contractId: source.contract_id,
        createdAt: source.created_at,
        grossAmount: source.gross_supplier_commission === null
            ? null
            : roundMoney(source.gross_supplier_commission),
        originalAmount,
        reversedAmount,
        netAmount: roundMoney(Math.max(0, originalAmount - reversedAmount)),
        adjustments: (source.commission_adjustments ?? []).map(mapAdjustment),
    };
}

export function buildCommissionWorkspace(sources: CommissionWorkspaceSource[]): CommissionWorkspace {
    const items = sources.map(mapCommission);
    const statuses = COMMISSION_LIFECYCLE_STATUSES.map((id) => {
        const matching = items.filter((item) => item.status === id);
        return {
            id,
            ...STATUS_LABELS[id],
            count: matching.length,
            amount: roundMoney(matching.reduce((sum, item) => sum + item.netAmount, 0)),
        };
    });

    return {
        items,
        statuses,
        totalNetAmount: roundMoney(items.reduce((sum, item) => sum + item.netAmount, 0)),
        availableToInvoiceAmount: statuses.find((status) => status.id === 'validated')?.amount ?? 0,
        paidAmount: statuses.find((status) => status.id === 'paid')?.amount ?? 0,
        reversedAmount: roundMoney(items.reduce((sum, item) => sum + item.reversedAmount, 0)),
        adjustmentCount: items.reduce((sum, item) => sum + item.adjustments.length, 0),
    };
}
