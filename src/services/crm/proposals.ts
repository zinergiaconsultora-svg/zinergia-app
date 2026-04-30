import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { Proposal, SavingsResult, InvoiceData } from '@/types/crm';
import { AletheiaResult } from '@/lib/aletheia/types';
import { getFranchiseId } from './shared';
import { logger } from '@/lib/utils/logger';
import { activitiesService } from './activities';
import { updateProposalStatusAction } from '@/app/actions/proposals';

export const proposalService = {
    async getProposalsByClient(clientId: string, serverClient?: SupabaseClient) {
        const supabase = serverClient || createClient();
        const { data, error } = await supabase
            .from('proposals')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Proposal[];
    },

    async getProposalById(id: string, serverClient?: SupabaseClient) {
        const supabase = serverClient || createClient();
        const { data, error } = await supabase
            .from('proposals')
            .select('*, clients(name)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Proposal;
    },

    async logSimulation(
        invoiceData: InvoiceData,
        bestResult: SavingsResult,
        clientName?: string,
        aletheiaResult?: Partial<AletheiaResult>
    ) {
        const supabase = createClient();
        const franchiseId = await getFranchiseId(supabase);
        if (!franchiseId) throw new Error('Auth required');
        const { data: { user } } = await supabase.auth.getUser();
        const ownerId = user?.id;

        // 1. Resolve client — explicit id → deduplicate by CUPS → deduplicate by DNI/CIF → create
        let clientId = invoiceData.client_id;
        if (!clientId && invoiceData.cups) {
            const { data: existing } = await supabase
                .from('clients')
                .select('id')
                .eq('franchise_id', franchiseId)
                .eq('cups', invoiceData.cups)
                .maybeSingle();
            clientId = existing?.id;
        }
        if (!clientId && invoiceData.dni_cif) {
            const { data: existing } = await supabase
                .from('clients')
                .select('id')
                .eq('franchise_id', franchiseId)
                .eq('dni_cif', invoiceData.dni_cif)
                .maybeSingle();
            clientId = existing?.id;
        }
        if (!clientId) {
            const { data: newClient, error: clientError } = await supabase
                .from('clients')
                .insert({
                    name: clientName || invoiceData.client_name || invoiceData.company_name || 'Nuevo Cliente',
                    franchise_id: franchiseId,
                    owner_id: ownerId,
                    type: 'residential',
                    status: 'new',
                    cups: invoiceData.cups || null,
                    dni_cif: invoiceData.dni_cif || null,
                    address: invoiceData.supply_address || null,
                })
                .select('id')
                .single();
            if (clientError) throw clientError;
            clientId = newClient?.id;
        }

        // 2. Save Proposal
        const proposal: Partial<Proposal> = {
            client_id: clientId,
            franchise_id: franchiseId,
            agent_id: ownerId,
            status: 'draft',
            offer_snapshot: bestResult.offer,
            calculation_data: invoiceData,
            current_annual_cost: bestResult.current_annual_cost,
            offer_annual_cost: bestResult.offer_annual_cost,
            annual_savings: bestResult.annual_savings,
            savings_percent: bestResult.savings_percent,
            aletheia_summary: aletheiaResult && aletheiaResult.client_profile ? {
                client_profile: {
                    tags: aletheiaResult.client_profile.tags || [],
                    sales_argument: aletheiaResult.client_profile.sales_argument || ''
                },
                opportunities: (aletheiaResult.opportunities || []).map(o => ({
                    type: o.type,
                    description: o.description,
                    annual_savings: o.annual_savings,
                    priority: o.priority
                })),
                recommendations: aletheiaResult.optimization_recommendations || []
            } : undefined
        };

        const { data: savedProposal, error: proposalError } = await supabase
            .from('proposals')
            .insert(proposal)
            .select()
            .single();

        if (proposalError) throw proposalError;

        activitiesService.logActivity(
            clientId!,
            'simulation_completed',
            `Simulación: ${bestResult.offer.marketer_name} — ahorro de ${Math.round(bestResult.annual_savings)}€/año`,
            {
                proposal_id: (savedProposal as Proposal).id,
                marketer: bestResult.offer.marketer_name,
                savings: bestResult.annual_savings,
            }
        ).catch((e) => logger.error('Failed to log proposal activity', e));

        return savedProposal;
    },

    async saveProposal(proposal: Partial<Proposal>) {
        const supabase = createClient();
        const franchiseId = await getFranchiseId(supabase);
        if (!franchiseId) throw new Error('Auth required');

        if (proposal.id) {
            const { data, error } = await supabase
                .from('proposals')
                .update(proposal)
                .eq('id', proposal.id)
                .select()
                .single();
            if (error) throw error;
            return data as Proposal;
        }

        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('proposals')
            .insert({ ...proposal, franchise_id: franchiseId, agent_id: user?.id })
            .select()
            .single();
        if (error) throw error;
        return data as Proposal;
    },

    async deleteProposal(id: string) {
        const supabase = createClient();
        const { error } = await supabase.from('proposals').delete().eq('id', id);
        if (error) throw error;
    },

    async getRecentProposals(limit = 20, offset = 0) {
        const supabase = createClient();
        const franchiseId = await getFranchiseId(supabase);
        if (!franchiseId) return [];

        const { data, error } = await supabase
            .from('proposals')
            .select('*, clients(name)')
            .eq('franchise_id', franchiseId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return data as Proposal[];
    },

    // Delegates to Server Action: updates status + triggers commissions if accepted
    updateProposalStatus: updateProposalStatusAction,
};
