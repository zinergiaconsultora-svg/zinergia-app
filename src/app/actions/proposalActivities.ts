'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';
import { z } from 'zod';

const uuidSchema = z.uuid();

export interface ProposalActivity {
    id: string;
    type: string;
    description: string;
    created_at: string;
}

export async function logProposalCreatedAction(proposalId: string, clientId: string): Promise<void> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('franchise_id')
        .eq('id', user.id)
        .maybeSingle();

    await supabase.from('client_activities').insert({
        client_id: clientId,
        agent_id: user.id,
        franchise_id: profile?.franchise_id ?? null,
        type: 'proposal_created',
        description: 'Se ha creado una nueva propuesta de ahorro.',
        metadata: { proposal_id: proposalId },
    });
}

export async function getProposalActivitiesAction(proposalId: string): Promise<ProposalActivity[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const idResult = uuidSchema.safeParse(proposalId);
    if (!idResult.success) throw new Error('ID de propuesta inválido');

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('client_activities')
        .select('id, type, description, created_at')
        .contains('metadata', { proposal_id: proposalId })
        .order('created_at', { ascending: true });

    if (error) throw new Error(`Error cargando actividades: ${error.message}`);

    return (data || []) as ProposalActivity[];
}
