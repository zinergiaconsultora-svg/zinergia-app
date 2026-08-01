import { z } from 'zod';
import {
    OPPORTUNITY_STAGES,
    OPPORTUNITY_TYPES,
    type OpportunityNextAction,
    type OpportunityRole,
    type OpportunityStage,
    type OpportunityType,
} from './opportunityState';

export const WORK_QUEUE_DUE_GROUPS = [
    'overdue',
    'today',
    'upcoming',
    'no_date',
] as const;

export type WorkQueueDueGroup = (typeof WORK_QUEUE_DUE_GROUPS)[number];

export interface OpportunityWorkItem {
    opportunityId: string;
    clientId: string;
    supplyPointId: string;
    ownerId: string;
    ownerName: string;
    franchiseId: string | null;
    type: OpportunityType;
    stage: OpportunityStage;
    clientName: string;
    supplyLabel: string;
    stageEnteredAt: string;
    stageAgeDays: number;
    nextAction: OpportunityNextAction | null;
    nextActionDueAt: string | null;
    dueGroup: WorkQueueDueGroup;
}

export interface OpportunityWorkGroup {
    key: WorkQueueDueGroup;
    label: 'Vencido' | 'Hoy' | 'Próximos' | 'Sin fecha';
    items: OpportunityWorkItem[];
}

export interface OpportunityWorkQueueFilters {
    ownerId?: string;
    types?: OpportunityType[];
    stages?: OpportunityStage[];
    dueGroup?: WorkQueueDueGroup;
}

const nextActionTypeSchema = z.enum([
    'wait_for_ocr',
    'review_invoice',
    'compare_tariffs',
    'follow_up_proposal',
    'complete_activation',
    'resolve_activation',
]);

const workQueueRowSchema = z.object({
    opportunity_id: z.string().min(1),
    client_id: z.string().min(1),
    supply_point_id: z.string().min(1),
    owner_id: z.string().min(1),
    owner_name: z.string().min(1),
    franchise_id: z.string().nullable(),
    type: z.enum(OPPORTUNITY_TYPES),
    stage: z.enum(OPPORTUNITY_STAGES),
    client_name: z.string().min(1),
    supply_label: z.string().min(1),
    stage_entered_at: z.string().datetime({ offset: true }),
    stage_age_days: z.number().int().nonnegative(),
    next_action_type: nextActionTypeSchema.nullable(),
    next_action_title: z.string().min(1).nullable(),
    next_action_due_at: z.string().datetime({ offset: true }).nullable(),
    due_group: z.enum(WORK_QUEUE_DUE_GROUPS),
}).superRefine((row, context) => {
    if ((row.next_action_type === null) !== (row.next_action_title === null)) {
        context.addIssue({
            code: 'custom',
            message: 'Next action type and title must be present together',
        });
    }
});

const GROUP_LABELS: Readonly<Record<WorkQueueDueGroup, OpportunityWorkGroup['label']>> = {
    overdue: 'Vencido',
    today: 'Hoy',
    upcoming: 'Próximos',
    no_date: 'Sin fecha',
};

export function mapOpportunityWorkQueueRow(row: unknown): OpportunityWorkItem {
    const parsed = workQueueRowSchema.safeParse(row);
    if (!parsed.success) {
        throw new Error('Invalid CRM work queue row');
    }

    const value = parsed.data;
    return {
        opportunityId: value.opportunity_id,
        clientId: value.client_id,
        supplyPointId: value.supply_point_id,
        ownerId: value.owner_id,
        ownerName: value.owner_name,
        franchiseId: value.franchise_id,
        type: value.type,
        stage: value.stage,
        clientName: value.client_name,
        supplyLabel: value.supply_label,
        stageEnteredAt: value.stage_entered_at,
        stageAgeDays: value.stage_age_days,
        nextAction: value.next_action_type && value.next_action_title
            ? {
                type: value.next_action_type,
                title: value.next_action_title,
            }
            : null,
        nextActionDueAt: value.next_action_due_at,
        dueGroup: value.due_group,
    };
}

export function groupOpportunityWorkItems(
    items: readonly OpportunityWorkItem[],
): OpportunityWorkGroup[] {
    const priority = new Map(
        WORK_QUEUE_DUE_GROUPS.map((group, index) => [group, index]),
    );
    const sorted = [...items].sort((left, right) => {
        const groupDifference = (priority.get(left.dueGroup) ?? 99)
            - (priority.get(right.dueGroup) ?? 99);
        if (groupDifference !== 0) return groupDifference;

        const leftDue = left.nextActionDueAt
            ? new Date(left.nextActionDueAt).getTime()
            : Number.POSITIVE_INFINITY;
        const rightDue = right.nextActionDueAt
            ? new Date(right.nextActionDueAt).getTime()
            : Number.POSITIVE_INFINITY;
        if (leftDue !== rightDue) return leftDue - rightDue;

        const stageDifference = new Date(left.stageEnteredAt).getTime()
            - new Date(right.stageEnteredAt).getTime();
        if (stageDifference !== 0) return stageDifference;
        return left.opportunityId.localeCompare(right.opportunityId);
    });
    const seenOpportunityIds = new Set<string>();
    const uniqueItems = sorted.filter((item) => {
        if (seenOpportunityIds.has(item.opportunityId)) return false;
        seenOpportunityIds.add(item.opportunityId);
        return true;
    });

    return WORK_QUEUE_DUE_GROUPS.map(key => ({
        key,
        label: GROUP_LABELS[key],
        items: uniqueItems.filter(item => item.dueGroup === key),
    }));
}

export function resolveWorkQueueScope(
    role: OpportunityRole,
    userId: string,
    filters: Pick<OpportunityWorkQueueFilters, 'ownerId'>,
): { ownerId: string | null } {
    if (role === 'agent') return { ownerId: userId };
    return { ownerId: filters.ownerId ?? null };
}
