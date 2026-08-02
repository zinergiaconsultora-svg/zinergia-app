'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireServerRole } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { Proposal } from '@/types/crm';
import { reconcileAcceptedProposalDurableEffects } from './proposals';

export interface AcceptanceIntegrityItem {
    proposalId: string;
    opportunityId: string | null;
    ownerId: string | null;
    acceptedAt: string | null;
    opportunityStage: string | null;
    missingOpportunity: boolean;
    missingActivation: boolean;
    missingCommission: boolean;
    missingContract: boolean;
    issueCount: number;
}

const selectIntegrity = `
    proposal_id, opportunity_id, owner_id, accepted_at, opportunity_stage,
    missing_opportunity, missing_activation, missing_commission, missing_contract, issue_count
`;

function mapItem(row: Record<string, unknown>): AcceptanceIntegrityItem {
    return {
        proposalId: row.proposal_id as string,
        opportunityId: (row.opportunity_id as string) ?? null,
        ownerId: (row.owner_id as string) ?? null,
        acceptedAt: (row.accepted_at as string) ?? null,
        opportunityStage: (row.opportunity_stage as string) ?? null,
        missingOpportunity: Boolean(row.missing_opportunity),
        missingActivation: Boolean(row.missing_activation),
        missingCommission: Boolean(row.missing_commission),
        missingContract: Boolean(row.missing_contract),
        issueCount: Number(row.issue_count ?? 0),
    };
}

export async function getAcceptanceIntegrityItemsAction(): Promise<AcceptanceIntegrityItem[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('proposal_acceptance_integrity')
        .select(selectIntegrity)
        .order('accepted_at', { ascending: true });

    if (error) throw new Error('No se pudo cargar la cola de integridad');
    return (data ?? []).map((row) => mapItem(row as Record<string, unknown>));
}

export async function retryAcceptanceIntegrityAction(proposalId: string): Promise<{
    ok: boolean;
    remaining: AcceptanceIntegrityItem | null;
}> {
    await requireServerRole(['admin']);
    const parsed = z.uuid().safeParse(proposalId);
    if (!parsed.success) return { ok: false, remaining: null };

    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return { ok: false, remaining: null };

    const { data: before } = await session
        .from('proposal_acceptance_integrity')
        .select(selectIntegrity)
        .eq('proposal_id', parsed.data)
        .maybeSingle();
    if (!before || before.missing_opportunity) return { ok: false, remaining: before ? mapItem(before) : null };

    const service = createServiceClient();
    const { error: stateError } = await service.rpc('reconcile_crm_acceptance_state', {
        p_proposal_id: parsed.data,
        p_actor_id: user.id,
    });
    if (stateError) return { ok: false, remaining: mapItem(before) };

    const { data: proposal, error: proposalError } = await service
        .from('proposals')
        .select(`
            id, client_id, opportunity_id, supply_point_id, franchise_id, agent_id,
            created_at, updated_at, status, offer_snapshot, calculation_data,
            current_annual_cost, offer_annual_cost, annual_savings, savings_percent
        `)
        .eq('id', parsed.data)
        .maybeSingle();
    if (proposalError || !proposal) return { ok: false, remaining: mapItem(before) };

    await reconcileAcceptedProposalDurableEffects(service, proposal as unknown as Proposal, {
        commission: Boolean(before.missing_commission),
        contract: Boolean(before.missing_contract),
    });

    const { data: remaining } = await session
        .from('proposal_acceptance_integrity')
        .select(selectIntegrity)
        .eq('proposal_id', parsed.data)
        .maybeSingle();

    revalidatePath('/admin');
    revalidatePath(`/dashboard/opportunities/${before.opportunity_id}`);
    return { ok: !remaining, remaining: remaining ? mapItem(remaining) : null };
}
