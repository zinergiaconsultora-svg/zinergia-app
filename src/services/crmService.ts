import { createClient } from '@/lib/supabase/client';
import { InvoiceData, SavingsResult, Offer } from '@/types/crm';
import { analyzeDocumentAction } from '@/app/actions/ocr';
import { calculateSavingsAction } from '@/app/actions/compare';
import { saveOfferAction, deleteOfferAction } from '@/app/actions/offers';

// Atomic Services
import { clientService } from './crm/clients';
import { proposalService } from './crm/proposals';
import { networkService } from './crm/network';
import { gamificationService } from './crm/gamification';
import { dashboardService } from './crm/dashboard';
import { ensureProfile, getFranchiseId } from './crm/shared';

// Re-export atomic services for direct use (tree-shakeable)
export { clientService, proposalService, networkService, gamificationService, dashboardService };

/**
 * CRM SERVICE FACADE (v2.0 - Pragmatic Split)
 * --------------------------------------------
 * Este archivo actúa como fachada para mantener compatibilidad hacia atrás
 * mientras que la lógica pesada se ha movido a módulos especializados en /crm.
 *
 * Ventaja: Mejora el LCP al permitir tree-shaking y reduce la duplicación.
 */
export const crmService = {
    // Shared / Internal
    _getFranchiseId: getFranchiseId,
    ensureProfile: ensureProfile,

    // Dashboard
    getDashboardStats: dashboardService.getDashboardStats,

    // Clients
    getClients: clientService.getClients,
    getClientById: clientService.getClientById,
    createClient: clientService.createClient,
    updateClient: clientService.updateClient,
    
    // Proposals
    getProposalsByClient: proposalService.getProposalsByClient,
    getProposalById: proposalService.getProposalById,
    updateProposalStatus: proposalService.updateProposalStatus,
    logSimulation: proposalService.logSimulation,

    // Clients (extended)
    deleteClient: clientService.deleteClient,
    getGeolocatedClients: clientService.getGeolocatedClients,

    // Proposals (extended)
    saveProposal: proposalService.saveProposal,
    deleteProposal: proposalService.deleteProposal,
    getRecentProposals: proposalService.getRecentProposals,

    // Network
    getNetworkHierarchy: networkService.getNetworkHierarchy,
    createInvitation: networkService.createInvitation,
    getNetworkCommissions: networkService.getNetworkCommissions,
    getNetworkStats: networkService.getNetworkStats,

    // Gamification
    getLeaderboard: gamificationService.getLeaderboard,
    getUserGamificationStats: gamificationService.getUserGamificationStats,

    // --- Complex Orchestrations (Logic remains for now to avoid breaking complex flows) ---

    async analyzeDocument(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        return analyzeDocumentAction(formData);
    },

    async calculateSavings(invoice: InvoiceData): Promise<SavingsResult[]> {
        const data = await calculateSavingsAction(invoice);
        if (data?.offers) {
            return data.offers.map((offer: any) => ({
                offer: {
                    id: offer.id || Math.random().toString(36).substr(2, 9),
                    marketer_name: offer.marketer_name || 'Comercializadora',
                    tariff_name: offer.tariff_name || 'Tarifa',
                    logo_color: offer.logo_color || 'bg-blue-600',
                    type: offer.type || 'fixed',
                    power_price: offer.power_price || { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
                    energy_price: offer.energy_price || { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
                    fixed_fee: offer.fixed_fee || 0,
                    contract_duration: offer.contract_duration || '12 meses',
                },
                current_annual_cost: data.current_annual_cost || 0,
                offer_annual_cost: offer.annual_cost || 0,
                annual_savings: Math.max(0, (data.current_annual_cost || 0) - (offer.annual_cost || 0)),
                savings_percent: (data.current_annual_cost || 0) > 0 ? (((data.current_annual_cost || 0) - (offer.annual_cost || 0)) / (data.current_annual_cost || 0)) * 100 : 0,
            }));
        }
        return [];
    },

    async getAcademyResources() {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('academy_resources')
            .select('*')
            .eq('is_published', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    // Tariff mutations — role-protected via Server Actions (admin/franchise only)
    saveOffer: saveOfferAction,
    deleteOffer: deleteOfferAction,

    async getOffers(): Promise<Offer[]> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('lv_zinergia_tarifas')
            .select('*')
            .eq('is_active', true);
        
        if (error) return [];
        return data.map(t => ({
            id: t.id,
            marketer_name: t.company,
            tariff_name: t.tariff_name,
            type: t.offer_type,
            fixed_fee: t.fixed_fee,
            power_price: { p1: t.power_price_p1, p2: t.power_price_p2, p3: t.power_price_p3 },
            energy_price: { p1: t.energy_price_p1, p2: t.energy_price_p2, p3: t.energy_price_p3 }
        })) as any[];
    },

    async simulateSale(amount = 2500) {
        const supabase = createClient();
        const franchiseId = await getFranchiseId(supabase);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !franchiseId) throw new Error('Auth fail');

        const { data: client } = await supabase.from('clients').insert({ name: `Demo ${Date.now()}`, franchise_id: franchiseId, status: 'new', owner_id: user.id }).select().single();
        const { data: proposal } = await supabase.from('proposals').insert({ client_id: client.id, status: 'draft', annual_savings: amount, franchise_id: franchiseId }).select().single();
        
        await this.updateProposalStatus(proposal.id, 'accepted');
        return proposal;
    }
};
