import {
    OPPORTUNITY_STAGES,
    OPPORTUNITY_TYPES,
    type OpportunityNextActionType,
    type OpportunityStage,
    type OpportunityType,
} from './opportunityState';

type Nullable<T> = T | null;

export interface OpportunityWorkspaceSource {
    opportunity: {
        id: string;
        client_id: string;
        supply_point_id: string;
        owner_id: string;
        type: string;
        stage: string;
        stage_entered_at: string;
        next_action_type: string | null;
        next_action_title: string | null;
        next_action_due_at: string | null;
        loss_reason: string | null;
    };
    client: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        status: string | null;
    };
    supplyPoint: {
        id: string;
        client_id: string;
        supply_type: string;
        cups_last4: string | null;
        address: string | null;
        city: string | null;
        current_marketer: string | null;
        current_tariff: string | null;
        annual_consumption_kwh: number | null;
    };
    owner: {
        id: string;
        full_name: string | null;
    };
    documents: Array<{
        id: string;
        opportunity_id: string | null;
        file_name: string;
        status: string;
        created_at: string;
        confirmed_at: string | null;
        error_message: string | null;
    }>;
    proposals: Array<{
        id: string;
        opportunity_id: string | null;
        status: string | null;
        created_at: string | null;
        sent_date: string | null;
        accepted_date: string | null;
        annual_savings: number;
        offer_snapshot: unknown;
        alta_status: string | null;
    }>;
    contracts: Array<{
        id: string;
        opportunity_id: string | null;
        status: string;
        marketer_name: string;
        tariff_name: string | null;
        start_date: string;
        end_date: string | null;
        permanence_status: string;
    }>;
    commissions: Array<{
        id: string;
        opportunity_id: string | null;
        status: string | null;
        agent_commission: number;
        franchise_commission: number;
        invoiced: boolean | null;
        paid_date: string | null;
    }>;
    tasks: Array<{
        id: string;
        opportunity_id: string | null;
        title: string;
        description: string | null;
        status: string;
        due_date: string | null;
        created_at: string | null;
    }>;
    history: Array<{
        id: string;
        opportunity_id: string;
        from_stage: string | null;
        to_stage: string;
        reason_code: string | null;
        created_at: string;
    }>;
}

export interface OpportunityWorkspace {
    id: string;
    type: OpportunityType;
    stage: OpportunityStage;
    stageEnteredAt: string;
    lossReason: string | null;
    nextAction: Nullable<{
        type: OpportunityNextActionType;
        title: string;
        dueAt: string | null;
    }>;
    client: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        status: string | null;
    };
    supplyPoint: {
        id: string;
        label: string;
        supplyType: string;
        address: string | null;
        currentMarketer: string | null;
        currentTariff: string | null;
        annualConsumptionKwh: number | null;
    };
    owner: { id: string; name: string };
    documents: Array<{
        id: string;
        name: string;
        status: string;
        createdAt: string;
        confirmedAt: string | null;
        errorMessage: string | null;
    }>;
    proposals: Array<{
        id: string;
        status: string;
        createdAt: string | null;
        sentAt: string | null;
        acceptedAt: string | null;
        annualSavings: number;
        marketer: string;
        tariff: string;
        activationStatus: string | null;
    }>;
    contracts: Array<{
        id: string;
        status: string;
        marketer: string;
        tariff: string | null;
        startDate: string;
        endDate: string | null;
        permanenceStatus: string;
    }>;
    commissions: Array<{
        id: string;
        status: string;
        agentAmount: number;
        franchiseAmount: number;
        invoiced: boolean;
        paidAt: string | null;
    }>;
    tasks: Array<{
        id: string;
        title: string;
        description: string | null;
        status: string;
        dueAt: string | null;
    }>;
    activity: Array<{
        id: string;
        kind: 'stage' | 'task';
        title: string;
        detail: string | null;
        createdAt: string;
    }>;
}

export interface OpportunityWorkspacePrimaryAction {
    label: string;
    href: string;
}

const STAGE_LABELS: Record<OpportunityStage, string> = {
    invoice_received: 'Factura recibida',
    data_review: 'Revisar datos',
    proposal_preparation: 'Preparar propuesta',
    proposal_sent: 'Propuesta enviada',
    accepted: 'Aceptada',
    activation: 'En alta',
    won: 'Cliente activo',
    lost: 'Perdida',
};

const REASON_LABELS: Record<string, string> = {
    ocr_completed: 'OCR completado',
    ocr_confirmed: 'Datos confirmados',
    proposal_sent: 'Propuesta enviada',
    proposal_accepted: 'Propuesta aceptada',
    activation_started: 'Alta iniciada',
    activation_confirmed: 'Alta confirmada',
    lead_lost: 'Oportunidad cerrada como perdida',
    reopen: 'Oportunidad reabierta',
    manual_correction: 'Corrección administrativa',
};

const NEXT_ACTION_TYPES: readonly OpportunityNextActionType[] = [
    'wait_for_ocr',
    'review_invoice',
    'compare_tariffs',
    'follow_up_proposal',
    'complete_activation',
    'resolve_activation',
];

function isOpportunityStage(value: string): value is OpportunityStage {
    return OPPORTUNITY_STAGES.includes(value as OpportunityStage);
}

function isOpportunityType(value: string): value is OpportunityType {
    return OPPORTUNITY_TYPES.includes(value as OpportunityType);
}

function isNextActionType(value: string): value is OpportunityNextActionType {
    return NEXT_ACTION_TYPES.includes(value as OpportunityNextActionType);
}

function belongsToOpportunity(
    opportunityId: string,
    row: { opportunity_id: string | null },
): boolean {
    return row.opportunity_id === opportunityId;
}

function readOfferText(snapshot: unknown, key: 'marketer_name' | 'tariff_name'): string {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return 'Sin especificar';
    const value = (snapshot as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() ? value.trim() : 'Sin especificar';
}

function supplyLabel(supplyType: string, cupsLast4: string | null): string {
    const type = supplyType === 'gas' ? 'Gas' : 'Electricidad';
    return cupsLast4 ? `${type} · ${cupsLast4}` : type;
}

function joinedAddress(address: string | null, city: string | null): string | null {
    const parts = [address, city].filter((part): part is string => Boolean(part?.trim()));
    return parts.length ? parts.join(', ') : null;
}

export function buildOpportunityWorkspace(
    source: OpportunityWorkspaceSource,
): OpportunityWorkspace {
    const { opportunity, client, supplyPoint, owner } = source;
    if (
        opportunity.client_id !== client.id
        || opportunity.supply_point_id !== supplyPoint.id
        || supplyPoint.client_id !== client.id
        || opportunity.owner_id !== owner.id
        || !isOpportunityType(opportunity.type)
        || !isOpportunityStage(opportunity.stage)
        || (opportunity.next_action_type !== null
            && !isNextActionType(opportunity.next_action_type))
    ) {
        throw new Error('Opportunity workspace boundary mismatch');
    }

    const documents = source.documents
        .filter(row => belongsToOpportunity(opportunity.id, row))
        .map(row => ({
            id: row.id,
            name: row.file_name,
            status: row.status,
            createdAt: row.created_at,
            confirmedAt: row.confirmed_at,
            errorMessage: row.error_message,
        }));
    const proposals = source.proposals
        .filter(row => belongsToOpportunity(opportunity.id, row))
        .map(row => ({
            id: row.id,
            status: row.status ?? 'draft',
            createdAt: row.created_at,
            sentAt: row.sent_date,
            acceptedAt: row.accepted_date,
            annualSavings: row.annual_savings,
            marketer: readOfferText(row.offer_snapshot, 'marketer_name'),
            tariff: readOfferText(row.offer_snapshot, 'tariff_name'),
            activationStatus: row.alta_status,
        }));
    const contracts = source.contracts
        .filter(row => belongsToOpportunity(opportunity.id, row))
        .map(row => ({
            id: row.id,
            status: row.status,
            marketer: row.marketer_name,
            tariff: row.tariff_name,
            startDate: row.start_date,
            endDate: row.end_date,
            permanenceStatus: row.permanence_status,
        }));
    const commissions = source.commissions
        .filter(row => belongsToOpportunity(opportunity.id, row))
        .map(row => ({
            id: row.id,
            status: row.status ?? 'pending',
            agentAmount: row.agent_commission,
            franchiseAmount: row.franchise_commission,
            invoiced: row.invoiced ?? false,
            paidAt: row.paid_date,
        }));
    const tasks = source.tasks
        .filter(row => belongsToOpportunity(opportunity.id, row))
        .map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            status: row.status,
            dueAt: row.due_date,
        }));
    const stageActivity: OpportunityWorkspace['activity'] = source.history
        .filter(row => row.opportunity_id === opportunity.id && isOpportunityStage(row.to_stage))
        .map(row => ({
            id: row.id,
            kind: 'stage' as const,
            title: `${row.from_stage && isOpportunityStage(row.from_stage)
                ? STAGE_LABELS[row.from_stage]
                : 'Inicio'} → ${STAGE_LABELS[row.to_stage as OpportunityStage]}`,
            detail: row.reason_code ? REASON_LABELS[row.reason_code] ?? 'Cambio registrado' : null,
            createdAt: row.created_at,
        }));
    const taskActivity: OpportunityWorkspace['activity'] = source.tasks
        .filter(row => belongsToOpportunity(opportunity.id, row))
        .map(row => ({
            id: `task-${row.id}`,
            kind: 'task' as const,
            title: row.title,
            detail: row.status === 'completed' ? 'Tarea completada' : row.description,
            createdAt: row.created_at ?? row.due_date ?? opportunity.stage_entered_at,
        }));

    return {
        id: opportunity.id,
        type: opportunity.type,
        stage: opportunity.stage,
        stageEnteredAt: opportunity.stage_entered_at,
        lossReason: opportunity.loss_reason,
        nextAction: opportunity.next_action_type && opportunity.next_action_title
            ? {
                type: opportunity.next_action_type,
                title: opportunity.next_action_title,
                dueAt: opportunity.next_action_due_at,
            }
            : null,
        client: {
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone,
            status: client.status,
        },
        supplyPoint: {
            id: supplyPoint.id,
            label: supplyLabel(supplyPoint.supply_type, supplyPoint.cups_last4),
            supplyType: supplyPoint.supply_type,
            address: joinedAddress(supplyPoint.address, supplyPoint.city),
            currentMarketer: supplyPoint.current_marketer,
            currentTariff: supplyPoint.current_tariff,
            annualConsumptionKwh: supplyPoint.annual_consumption_kwh,
        },
        owner: { id: owner.id, name: owner.full_name?.trim() || 'Sin nombre' },
        documents,
        proposals,
        contracts,
        commissions,
        tasks,
        activity: [...stageActivity, ...taskActivity].sort((left, right) =>
            right.createdAt.localeCompare(left.createdAt),
        ),
    };
}

export function getOpportunityWorkspacePrimaryAction(
    workspace: OpportunityWorkspace,
): OpportunityWorkspacePrimaryAction | null {
    if (!workspace.nextAction) return null;

    const simulatorHref = `/dashboard/simulator?opportunity=${workspace.id}&client=${workspace.client.id}`;
    const hrefByType: Record<OpportunityNextActionType, string> = {
        wait_for_ocr: '#documentos',
        review_invoice: simulatorHref,
        compare_tariffs: simulatorHref,
        follow_up_proposal: '#actividad',
        complete_activation: '#alta-contrato',
        resolve_activation: '#alta-contrato',
    };

    return {
        label: workspace.nextAction.title,
        href: hrefByType[workspace.nextAction.type] ?? '#resumen',
    };
}
