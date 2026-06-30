import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { Proposal, SavingsResult, InvoiceData } from '@/types/crm';
import { AletheiaResult } from '@/lib/aletheia/types';
import { getFranchiseId, invalidateCacheByPrefix } from './shared';
import { logger } from '@/lib/utils/logger';
import { activitiesService } from './activities';
import { updateProposalStatusAction } from '@/app/actions/proposals';
import { resolveOrCreateClientAction } from '@/app/actions/clients';
import { buildProposalPricingDefaults } from '@/lib/proposals/pricing';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeOcrJobId(ocrJobId?: string | null): string | null {
    return ocrJobId && UUID_RE.test(ocrJobId) ? ocrJobId : null;
}

async function resolveOcrHandoffContext(ocrJobId?: string | null) {
    const { resolveOcrHandoffContextAction } = await import('@/app/actions/ocr-handoff');
    return resolveOcrHandoffContextAction(ocrJobId);
}

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
        aletheiaResult?: Partial<AletheiaResult>,
        ocrJobId?: string | null,
    ) {
        const supabase = createClient();
        const safeOcrJobId = normalizeOcrJobId(ocrJobId);
        const handoff = await resolveOcrHandoffContext(safeOcrJobId);
        const sessionFranchiseId = await getFranchiseId(supabase);
        const franchiseId = handoff?.franchiseId ?? sessionFranchiseId;
        if (!franchiseId) throw new Error('Auth required');
        const { data: { user } } = await supabase.auth.getUser();
        const ownerId = handoff?.agentId ?? user?.id;

        // 1. Resolve client — explicit id → dedup by CUPS/DNI blind index → create.
        // Delegated to a server action so CUPS/DNI are encrypted server-side and
        // deduplicated against the *_hash columns (browser has no encryption key).
        const clientId = await resolveOrCreateClientAction({
            client_id: invoiceData.client_id ?? null,
            source_ocr_job_id: safeOcrJobId,
            cups: invoiceData.cups ?? null,
            dni_cif: invoiceData.dni_cif ?? null,
            name: clientName || invoiceData.client_name || invoiceData.company_name || 'Nuevo Cliente',
            address: invoiceData.supply_address ?? null,
            segment: invoiceData.segment ?? null,
        });

        // 2. Save Proposal
        const calculationData = {
            ...invoiceData,
            calculation_audit: bestResult.calculation_audit,
        } as Proposal['calculation_data'];
        const pricingDefaults = buildProposalPricingDefaults(bestResult, 'simulator');

        const proposal: Partial<Proposal> = {
            client_id: clientId,
            franchise_id: franchiseId,
            agent_id: ownerId,
            ocr_job_id: safeOcrJobId,
            status: 'draft',
            offer_snapshot: pricingDefaults.offer_snapshot,
            calculation_data: calculationData,
            source_tariff_id: pricingDefaults.source_tariff_id,
            price_snapshot_at: pricingDefaults.price_snapshot_at,
            price_snapshot: pricingDefaults.price_snapshot,
            pricing_status: pricingDefaults.pricing_status,
            proposal_version: pricingDefaults.proposal_version,
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
                recommendations: aletheiaResult.optimization_recommendations || [],
                supervised_recommendation: aletheiaResult.supervised_recommendation,
            } : undefined
        };

        const { data: savedProposal, error: proposalError } = await supabase
            .from('proposals')
            .insert(proposal)
            .select()
            .single();

        if (proposalError) throw proposalError;

        if (safeOcrJobId) {
            const { error: linkError } = await supabase
                .from('ocr_jobs')
                .update({
                    client_id: clientId,
                    compared_at: new Date().toISOString(),
                })
                .eq('id', safeOcrJobId);

            if (linkError) {
                logger.warn('[proposalService] Could not link OCR job to client', {
                    error: linkError.message,
                    ocrJobId: safeOcrJobId,
                    clientId,
                });
            }
        }

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
        const handoff = await resolveOcrHandoffContext(normalizeOcrJobId(proposal.ocr_job_id));
        const sessionFranchiseId = await getFranchiseId(supabase);
        const franchiseId = handoff?.franchiseId ?? sessionFranchiseId;
        if (!franchiseId) throw new Error('Auth required');
        const proposalWithPricing = withPricingDefaults(proposal);

        if (proposal.id) {
            const { data, error } = await supabase
                .from('proposals')
                .update(proposalWithPricing)
                .eq('id', proposal.id)
                .select()
                .single();
            if (error) throw error;
            invalidateCacheByPrefix('dashboard_stats_');
            return data as Proposal;
        }

        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('proposals')
            .insert({ ...proposalWithPricing, franchise_id: franchiseId, agent_id: handoff?.agentId ?? user?.id })
            .select()
            .single();
        if (error) throw error;
        invalidateCacheByPrefix('dashboard_stats_');
        return data as Proposal;
    },

    async deleteProposal(id: string) {
        const supabase = createClient();
        const { error } = await supabase.from('proposals').delete().eq('id', id);
        if (error) throw error;
        invalidateCacheByPrefix('dashboard_stats_');
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

function withPricingDefaults(proposal: Partial<Proposal>): Partial<Proposal> {
    if (
        !proposal.offer_snapshot ||
        !proposal.calculation_data ||
        typeof proposal.current_annual_cost !== 'number' ||
        typeof proposal.offer_annual_cost !== 'number' ||
        typeof proposal.annual_savings !== 'number' ||
        typeof proposal.savings_percent !== 'number'
    ) {
        return proposal;
    }

    const result: SavingsResult = {
        offer: proposal.offer_snapshot,
        current_annual_cost: proposal.current_annual_cost,
        offer_annual_cost: proposal.offer_annual_cost,
        annual_savings: proposal.annual_savings,
        savings_percent: proposal.savings_percent,
        optimization_result: proposal.optimization_result,
    };
    const defaults = buildProposalPricingDefaults(result, 'simulator');

    return {
        ...proposal,
        offer_snapshot: defaults.offer_snapshot,
        source_tariff_id: proposal.source_tariff_id ?? defaults.source_tariff_id,
        price_snapshot_at: proposal.price_snapshot_at ?? defaults.price_snapshot_at,
        price_snapshot: proposal.price_snapshot ?? defaults.price_snapshot,
        pricing_status: proposal.pricing_status ?? defaults.pricing_status,
        proposal_version: proposal.proposal_version ?? defaults.proposal_version,
    };
}
