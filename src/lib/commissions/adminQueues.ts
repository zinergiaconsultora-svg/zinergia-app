export type AdminCommissionSource = {
    id: string;
    agent_id: string | null;
    proposal_id: string | null;
    lifecycle_status: string;
    reconciliation_status: string;
    commercial_net_amount: number | null;
    agent_commission: number;
    total_reversed_commercial: number;
    invoice_id: string | null;
    created_at: string | null;
    eligible_at: string | null;
    validated_at: string | null;
    clients: { name: string } | null;
    proposals: { clients: { name: string } | null } | null;
    commercial: {
        full_name: string | null;
        email: string | null;
        company_name: string | null;
        fiscal_verified: boolean | null;
    } | null;
};

export type AdminAdjustmentSource = {
    id: string;
    commission_id: string;
    reason_code: string;
    active_days: number | null;
    reversal_bps: number;
    commercial_amount: number;
    evidence_reference: string;
    status: string;
    proposed_at: string;
};

export type AdminReconciliationSource = {
    commissionId: string;
    commercialId: string | null;
    lifecycleStatus: string;
    reconciliationStatus: string;
    requiredAction: string;
    createdAt: string | null;
};

export type CommissionAdminQueueItem = {
    id: string;
    commercialId: string | null;
    commercialName: string;
    commercialEmail: string | null;
    clientName: string;
    proposalId: string | null;
    originalAmount: number;
    reversedAmount: number;
    netAmount: number;
    fiscalReady: boolean;
    referenceAt: string | null;
};

export type CommissionAdminAdjustmentItem = {
    id: string;
    commissionId: string;
    commercialName: string;
    clientName: string;
    causeLabel: string;
    activeDays: number | null;
    reversalPercent: number;
    reversedAmount: number;
    evidenceReference: string;
    proposedAt: string;
};

export type CommissionAdminQueues = {
    validation: CommissionAdminQueueItem[];
    settlement: CommissionAdminQueueItem[];
    adjustments: CommissionAdminAdjustmentItem[];
    reconciliation: AdminReconciliationSource[];
    attentionCount: number;
};

const CAUSE_LABELS: Record<string, string> = {
    permanence_breach: 'Permanencia incumplida',
    early_switch: 'Cambio anticipado de comercializadora',
    non_consolidation: 'Contrato no consolidado',
    non_payment: 'Impago del cliente',
    irregular_sale: 'Venta irregular',
    supplier_correction: 'Corrección de la comercializadora',
    other: 'Otro ajuste documentado',
};

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

function mapCommission(source: AdminCommissionSource): CommissionAdminQueueItem {
    const originalAmount = roundMoney(source.commercial_net_amount ?? source.agent_commission ?? 0);
    const reversedAmount = roundMoney(source.total_reversed_commercial ?? 0);
    return {
        id: source.id,
        commercialId: source.agent_id,
        commercialName: source.commercial?.full_name?.trim()
            || source.commercial?.company_name?.trim()
            || source.commercial?.email
            || 'Comercial sin identificar',
        commercialEmail: source.commercial?.email ?? null,
        clientName: source.clients?.name?.trim()
            || source.proposals?.clients?.name?.trim()
            || 'Cliente sin identificar',
        proposalId: source.proposal_id,
        originalAmount,
        reversedAmount,
        netAmount: roundMoney(Math.max(0, originalAmount - reversedAmount)),
        fiscalReady: source.commercial?.fiscal_verified === true,
        referenceAt: source.validated_at ?? source.eligible_at ?? source.created_at,
    };
}

export function buildCommissionAdminQueues({
    commissions,
    adjustments,
    reconciliation,
}: {
    commissions: AdminCommissionSource[];
    adjustments: AdminAdjustmentSource[];
    reconciliation: AdminReconciliationSource[];
}): CommissionAdminQueues {
    const commissionById = new Map(commissions.map((item) => [item.id, item]));
    const validation = commissions
        .filter((item) => item.lifecycle_status === 'eligible' && item.reconciliation_status === 'ready')
        .map(mapCommission);
    const settlement = commissions
        .filter((item) => item.lifecycle_status === 'validated' && item.reconciliation_status === 'ready' && item.invoice_id === null)
        .map(mapCommission);
    const adjustmentItems = adjustments
        .filter((item) => item.status === 'proposed')
        .map((adjustment) => {
            const commission = commissionById.get(adjustment.commission_id);
            const mapped = commission ? mapCommission(commission) : null;
            return {
                id: adjustment.id,
                commissionId: adjustment.commission_id,
                commercialName: mapped?.commercialName ?? 'Comercial sin identificar',
                clientName: mapped?.clientName ?? 'Cliente sin identificar',
                causeLabel: CAUSE_LABELS[adjustment.reason_code] ?? 'Ajuste documentado',
                activeDays: adjustment.active_days,
                reversalPercent: adjustment.reversal_bps / 100,
                reversedAmount: roundMoney(adjustment.commercial_amount),
                evidenceReference: adjustment.evidence_reference,
                proposedAt: adjustment.proposed_at,
            };
        });

    return {
        validation,
        settlement,
        adjustments: adjustmentItems,
        reconciliation,
        attentionCount: adjustmentItems.length + reconciliation.length,
    };
}
