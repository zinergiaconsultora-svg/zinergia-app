import {
    OPPORTUNITY_STAGES,
    OPPORTUNITY_TYPES,
    type OpportunityStage,
    type OpportunityType,
} from './opportunityState';

export interface ClientPortfolioSource {
    clients: Array<{
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        status: string | null;
        owner_id: string;
        last_contact_date: string | null;
        created_at: string | null;
    }>;
    owners: Array<{ id: string; full_name: string | null }>;
    supplyPoints: Array<{
        id: string;
        client_id: string;
        supply_type: string;
        cups_last4: string | null;
        address: string | null;
        city: string | null;
        current_marketer: string | null;
        current_tariff: string | null;
    }>;
    opportunities: Array<{
        id: string;
        client_id: string;
        supply_point_id: string;
        type: string;
        stage: string;
        stage_entered_at: string;
        next_action_title: string | null;
        next_action_due_at: string | null;
        closed_at: string | null;
        created_at: string;
    }>;
    contracts: Array<{
        id: string;
        client_id: string;
        supply_point_id: string | null;
        opportunity_id: string | null;
        status: string;
        marketer_name: string;
        tariff_name: string | null;
        start_date: string;
        end_date: string | null;
        permanence_status: string;
        created_at: string | null;
    }>;
}

export interface ClientPortfolioItem {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
    ownerId: string;
    ownerName: string;
    lastContactAt: string | null;
    supplyPointCount: number;
    activeSupplyCount: number;
    openOpportunityCount: number;
    nextAction: {
        opportunityId: string;
        title: string;
        dueAt: string | null;
        stage: OpportunityStage;
    } | null;
    currentContract: {
        marketer: string;
        tariff: string | null;
        supplyPointId: string | null;
    } | null;
    nearestPermanenceDate: string | null;
}

export interface ClientRelationshipSource extends ClientPortfolioSource {
    documents: Array<{
        id: string;
        client_id: string | null;
        supply_point_id: string | null;
        opportunity_id: string | null;
        file_name: string;
        status: string;
        created_at: string;
    }>;
    activities: Array<{
        id: string;
        client_id: string;
        type: string;
        description: string;
        created_at: string | null;
    }>;
}

export interface ClientRelationshipRecord {
    client: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        status: string;
        ownerId: string;
        ownerName: string;
        lastContactAt: string | null;
    };
    supplyPoints: Array<{
        id: string;
        label: string;
        address: string | null;
        marketer: string | null;
        tariff: string | null;
    }>;
    openOpportunities: ClientRelationshipOpportunity[];
    history: ClientRelationshipOpportunity[];
    contracts: Array<{
        id: string;
        opportunityId: string | null;
        supplyPointId: string | null;
        supplyLabel: string;
        status: string;
        marketer: string;
        tariff: string | null;
        startDate: string;
        endDate: string | null;
        permanenceStatus: string;
    }>;
    documents: Array<{
        id: string;
        opportunityId: string | null;
        supplyPointId: string | null;
        supplyLabel: string;
        name: string;
        status: string;
        createdAt: string;
    }>;
    activities: Array<{
        id: string;
        type: string;
        description: string;
        createdAt: string | null;
    }>;
}

export interface ClientRelationshipOpportunity {
    id: string;
    supplyPointId: string;
    supplyLabel: string;
    type: OpportunityType;
    stage: OpportunityStage;
    nextActionTitle: string | null;
    nextActionDueAt: string | null;
    createdAt: string;
}

function isStage(value: string): value is OpportunityStage {
    return OPPORTUNITY_STAGES.includes(value as OpportunityStage);
}

function isType(value: string): value is OpportunityType {
    return OPPORTUNITY_TYPES.includes(value as OpportunityType);
}

function labelSupply(supplyType: string, cupsLast4: string | null): string {
    const type = supplyType === 'gas' ? 'Gas' : 'Electricidad';
    return cupsLast4 ? `${type} · ${cupsLast4}` : type;
}

function joinAddress(address: string | null, city: string | null): string | null {
    const parts = [address, city].filter((part): part is string => Boolean(part?.trim()));
    return parts.length ? parts.join(', ') : null;
}

function dueTime(value: string | null): number {
    if (!value) return Number.POSITIVE_INFINITY;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function isOpen(stage: OpportunityStage, closedAt: string | null): boolean {
    return closedAt === null && stage !== 'won' && stage !== 'lost';
}

function validOpportunityForClient(
    clientId: string,
    supplyIds: ReadonlySet<string>,
    opportunity: ClientPortfolioSource['opportunities'][number],
): opportunity is ClientPortfolioSource['opportunities'][number] & {
    type: OpportunityType;
    stage: OpportunityStage;
} {
    return opportunity.client_id === clientId
        && supplyIds.has(opportunity.supply_point_id)
        && isType(opportunity.type)
        && isStage(opportunity.stage);
}

export function buildClientPortfolio(source: ClientPortfolioSource): ClientPortfolioItem[] {
    const ownerNames = new Map(source.owners.map(owner => [
        owner.id,
        owner.full_name?.trim() || 'Sin nombre',
    ]));

    return source.clients.map(client => {
        const supplies = source.supplyPoints.filter(supply => supply.client_id === client.id);
        const supplyIds = new Set(supplies.map(supply => supply.id));
        const opportunities = source.opportunities.filter(opportunity =>
            validOpportunityForClient(client.id, supplyIds, opportunity),
        );
        const openOpportunities = opportunities
            .filter(opportunity => isOpen(opportunity.stage as OpportunityStage, opportunity.closed_at))
            .sort((left, right) =>
                dueTime(left.next_action_due_at) - dueTime(right.next_action_due_at)
                || left.stage_entered_at.localeCompare(right.stage_entered_at)
                || left.id.localeCompare(right.id),
            );
        const contracts = source.contracts
            .filter(contract => contract.client_id === client.id
                && (contract.supply_point_id === null || supplyIds.has(contract.supply_point_id)))
            .sort((left, right) =>
                (right.created_at ?? right.start_date).localeCompare(left.created_at ?? left.start_date),
            );
        const activeContracts = contracts.filter(contract => contract.status === 'active');
        const activeSupplyIds = new Set(activeContracts
            .map(contract => contract.supply_point_id)
            .filter((id): id is string => Boolean(id)));
        const nearestPermanenceDate = activeContracts
            .filter(contract => contract.permanence_status === 'known' && contract.end_date)
            .map(contract => contract.end_date as string)
            .sort()[0] ?? null;
        const next = openOpportunities.find(opportunity => opportunity.next_action_title) ?? null;
        const currentContract = activeContracts[0] ?? null;

        return {
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone,
            status: client.status ?? 'new',
            ownerId: client.owner_id,
            ownerName: ownerNames.get(client.owner_id) ?? 'Sin nombre',
            lastContactAt: client.last_contact_date,
            supplyPointCount: supplies.length,
            activeSupplyCount: activeSupplyIds.size,
            openOpportunityCount: openOpportunities.length,
            nextAction: next ? {
                opportunityId: next.id,
                title: next.next_action_title as string,
                dueAt: next.next_action_due_at,
                stage: next.stage as OpportunityStage,
            } : null,
            currentContract: currentContract ? {
                marketer: currentContract.marketer_name,
                tariff: currentContract.tariff_name,
                supplyPointId: currentContract.supply_point_id,
            } : null,
            nearestPermanenceDate,
        };
    });
}

export function buildClientRelationshipRecord(
    clientId: string,
    source: ClientRelationshipSource,
): ClientRelationshipRecord {
    const client = source.clients.find(item => item.id === clientId);
    if (!client) throw new Error('Client relationship not found');

    const owner = source.owners.find(item => item.id === client.owner_id);
    const supplies = source.supplyPoints.filter(supply => supply.client_id === clientId);
    const supplyMap = new Map(supplies.map(supply => [supply.id, supply]));
    const supplyIds = new Set(supplyMap.keys());
    const opportunities = source.opportunities
        .filter(opportunity => validOpportunityForClient(clientId, supplyIds, opportunity))
        .map(opportunity => ({
            id: opportunity.id,
            supplyPointId: opportunity.supply_point_id,
            supplyLabel: labelSupply(
                supplyMap.get(opportunity.supply_point_id)?.supply_type ?? 'electricity',
                supplyMap.get(opportunity.supply_point_id)?.cups_last4 ?? null,
            ),
            type: opportunity.type as OpportunityType,
            stage: opportunity.stage as OpportunityStage,
            nextActionTitle: opportunity.next_action_title,
            nextActionDueAt: opportunity.next_action_due_at,
            createdAt: opportunity.created_at,
        }))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const opportunityIds = new Set(opportunities.map(opportunity => opportunity.id));

    return {
        client: {
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone,
            status: client.status ?? 'new',
            ownerId: client.owner_id,
            ownerName: owner?.full_name?.trim() || 'Sin nombre',
            lastContactAt: client.last_contact_date,
        },
        supplyPoints: supplies.map(supply => ({
            id: supply.id,
            label: labelSupply(supply.supply_type, supply.cups_last4),
            address: joinAddress(supply.address, supply.city),
            marketer: supply.current_marketer,
            tariff: supply.current_tariff,
        })),
        openOpportunities: opportunities.filter(opportunity =>
            isOpen(opportunity.stage, source.opportunities.find(item => item.id === opportunity.id)?.closed_at ?? null),
        ),
        history: opportunities.filter(opportunity => opportunity.stage === 'won' || opportunity.stage === 'lost'),
        contracts: source.contracts
            .filter(contract => contract.client_id === clientId
                && (contract.supply_point_id === null || supplyIds.has(contract.supply_point_id))
                && (contract.opportunity_id === null || opportunityIds.has(contract.opportunity_id)))
            .map(contract => ({
                id: contract.id,
                opportunityId: contract.opportunity_id,
                supplyPointId: contract.supply_point_id,
                supplyLabel: contract.supply_point_id
                    ? labelSupply(
                        supplyMap.get(contract.supply_point_id)?.supply_type ?? 'electricity',
                        supplyMap.get(contract.supply_point_id)?.cups_last4 ?? null,
                    )
                    : 'Suministro sin vincular',
                status: contract.status,
                marketer: contract.marketer_name,
                tariff: contract.tariff_name,
                startDate: contract.start_date,
                endDate: contract.end_date,
                permanenceStatus: contract.permanence_status,
            })),
        documents: source.documents
            .filter(document => document.client_id === clientId
                && (document.supply_point_id === null || supplyIds.has(document.supply_point_id))
                && (document.opportunity_id === null || opportunityIds.has(document.opportunity_id)))
            .map(document => ({
                id: document.id,
                opportunityId: document.opportunity_id,
                supplyPointId: document.supply_point_id,
                supplyLabel: document.supply_point_id
                    ? labelSupply(
                        supplyMap.get(document.supply_point_id)?.supply_type ?? 'electricity',
                        supplyMap.get(document.supply_point_id)?.cups_last4 ?? null,
                    )
                    : 'Sin suministro',
                name: document.file_name,
                status: document.status,
                createdAt: document.created_at,
            })),
        activities: source.activities
            .filter(activity => activity.client_id === clientId)
            .map(activity => ({
                id: activity.id,
                type: activity.type,
                description: activity.description,
                createdAt: activity.created_at,
            }))
            .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? '')),
    };
}
