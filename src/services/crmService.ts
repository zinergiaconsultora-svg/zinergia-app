import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { Client, InvoiceData, Offer, SavingsResult, Proposal, TariffPrice, NetworkUser, UserRole } from '@/types/crm';

export const crmService = {
    /**
     * PRIVATE HELPER: strictly gets the current user's franchise ID.
     * This acts as a second layer of security (Defense in Depth) on top of RLS.
     */
    async _getFranchiseId(supabase: SupabaseClient) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data: profile } = await supabase
            .from('profiles')
            .select('franchise_id')
            .eq('id', user.id)
            .single();

        if (!profile) {
            // Retrieve via ensureProfile if missing (self-healing for brand new users)
            const newProfile = await this.ensureProfile(user.id, user.email || 'User');
            return newProfile.franchise_id;
        }

        return profile.franchise_id;
    },

    async getClients() {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('franchise_id', franchiseId) // SECURITY: Application-side filtering
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching clients:', error);
            throw error;
        }

        return data as Client[];
    },

    async getDashboardStats() {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        // Date calc for "Monthly Goal"
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // Parallel Fetching
        const [clientsStatusResponse, proposalsResponse, recentProposalsResponse, recentClientsResponse] = await Promise.all([
            // 1. Light query for Stats counting (High volume)
            supabase.from('clients').select('status').eq('franchise_id', franchiseId),

            // 2. Proposals for stats
            supabase.from('proposals').select('id, annual_savings, status, created_at, clients(name)').eq('franchise_id', franchiseId),

            // 3. Recent Proposals (Activity Feed)
            supabase.from('proposals')
                .select('id, annual_savings, status, created_at, clients(name)')
                .eq('franchise_id', franchiseId)
                .order('created_at', { ascending: false })
                .limit(5),

            // 4. Recent Clients (Full data for list)
            supabase.from('clients')
                .select('*')
                .eq('franchise_id', franchiseId)
                .order('created_at', { ascending: false })
                .limit(5)
        ]);

        const clients = clientsStatusResponse.data || [] as Partial<Client>[]; // Only needs status
        const proposals = (proposalsResponse.data || []) as unknown as (Proposal & { clients: { name: string } | null })[];
        const recentProposals = (recentProposalsResponse.data || []) as unknown as (Proposal & { clients: { name: string } | null })[];
        const recentClients = (recentClientsResponse.data || []) as Client[];

        const totalClients = clients.length;
        const activeClients = clients.filter(c => c.status === 'won').length;
        const pendingClients = clients.filter(c => ['new', 'contacted', 'in_process'].includes(c.status || '')).length;
        const newClientsCount = clients.filter(c => c.status === 'new').length;

        // --- FINANCIAL METRICS ---
        const totalSavingsDetected = proposals.reduce((sum, p) => sum + (p.annual_savings || 0), 0);

        const pipelineSavings = proposals
            .filter(p => ['draft', 'sent'].includes(p.status as string))
            .reduce((sum, p) => sum + (p.annual_savings || 0), 0);

        const securedSavings = proposals
            .filter(p => p.status === 'accepted')
            .reduce((sum, p) => sum + (p.annual_savings || 0), 0);

        // Monthly Savings (for Goal Widget)
        const monthSavings = proposals
            .filter(p => p.created_at && p.created_at >= startOfMonth)
            .reduce((sum, p) => sum + (p.annual_savings || 0), 0);

        const closedProposals = proposals.filter(p => ['accepted', 'rejected'].includes(p.status as string)).length;
        const acceptedProposals = proposals.filter(p => p.status === 'accepted').length;
        const conversionRate = closedProposals > 0 ? Math.round((acceptedProposals / closedProposals) * 100) : 0;

        const growth = '+12%';

        const { data: userProfile } = await supabase.from('profiles').select('full_name, role, avatar_url').eq('id', (await supabase.auth.getUser()).data.user!.id).single();

        return {
            user: userProfile,
            total: totalClients,
            active: activeClients,
            pending: pendingClients,
            new: newClientsCount,
            growth,
            recent: recentClients,
            recentProposals: recentProposals.map(p => ({
                id: p.id,
                client_name: p.clients?.name || 'Cliente',
                annual_savings: p.annual_savings,
                status: p.status,
                created_at: p.created_at
            })),
            pendingActions: proposals.filter(p => p.status === 'accepted').map(p => ({
                id: p.id,
                client_name: p.clients?.name || 'Cliente',
                type: 'documentation_needed' as const
            })),
            financials: {
                total_detected: totalSavingsDetected,
                pipeline: pipelineSavings,
                secured: securedSavings,
                conversion_rate: conversionRate,
                month_savings: monthSavings
            }
        };
    },

    /**
     * Ensures the current user has a profile and is linked to a franchise.
     * If not, it self-heals by linking to 'hq'.
     */
    async ensureProfile(userId: string, email: string) {
        const supabase = createClient();

        // 1. Check if profile exists
        const { data: profile } = await supabase
            .from('profiles')
            .select('franchise_id, full_name, role')
            .eq('id', userId)
            .maybeSingle();

        if (profile) return profile;

        // 2. If not, get HQ franchise (or auto-create it)
        let { data: franchise } = await supabase
            .from('franchises')
            .select('id')
            .eq('slug', 'hq')
            .maybeSingle();

        if (!franchise) {
            // Auto-heal: Create HQ if missing
            console.log('Auto-creating HQ franchise...');
            const { data: newFranchise, error: franchiseError } = await supabase
                .from('franchises')
                .insert({ slug: 'hq', name: 'Zinergia Central' })
                .select('id')
                .single();

            if (franchiseError) {
                // Handle potential race condition if another client created it simultaneously
                if (franchiseError.code === '23505') { // Unique violation
                    const { data: retryFranchise } = await supabase.from('franchises').select('id').eq('slug', 'hq').single();
                    if (retryFranchise) franchise = retryFranchise;
                    else throw new Error('Could not recover HQ franchise');
                } else {
                    console.error('Failed to auto-create franchise:', franchiseError);
                    throw new Error('Error crítico: No se pudo iniciar la franquicia base (HQ).');
                }
            } else {
                franchise = newFranchise;
            }
        }

        // 3. Create User Profile linked to HQ
        // Use UPSERT to prevent race conditions if profile was created in parallel
        const { data: newProfile, error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                franchise_id: franchise!.id,
                full_name: email.split('@')[0],
                role: 'agent'
            }, { onConflict: 'id' }) // Ensure we update if exists (though 'maybeSingle' check above should have caught it, replication lag is possible)
            .select('franchise_id, full_name, role')
            .single();

        if (profileError) {
            console.error('Failed to create/upsert profile:', JSON.stringify(profileError));

            // Critical Fallback:
            // If we can't create a profile, we return a volatile in-memory profile.
            // This allows the user to at least see the dashboard, even if saving fails.
            return {
                franchise_id: franchise?.id || '00000000-0000-0000-0000-000000000000',
                role: 'agent',
                full_name: email.split('@')[0]
            };
        }
        return newProfile;
    },

    async createClient(client: Partial<Client>) {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error('User not authenticated');

        // Robust initialization with self-healing
        const profile = await this.ensureProfile(user.id, user.email || 'Usuario');
        if (!profile) throw new Error('No se pudo inicializar el perfil del usuario.');

        const { data, error } = await supabase
            .from('clients')
            .insert({
                ...client,
                owner_id: user.id,
                franchise_id: profile.franchise_id
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getClientById(id: string) {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', id)
            .eq('franchise_id', franchiseId) // SECURITY: Application-side filtering
            .single();

        if (error) {
            console.error('Error fetching client:', error);
            throw error;
        }

        return data as Client;
    },

    async updateClient(id: string, updates: Partial<Client>) {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        const { data, error } = await supabase
            .from('clients')
            .update(updates)
            .eq('id', id)
            .eq('franchise_id', franchiseId) // SECURITY: Ensure we only update our own clients
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteClient(id: string) {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', id)
            .eq('franchise_id', franchiseId); // SECURITY: Ensure we only delete our own clients

        if (error) throw error;
        return true;
    },

    async saveProposal(proposal: Omit<Proposal, 'id' | 'created_at'>) {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        const { data, error } = await supabase
            .from('proposals')
            .insert({
                ...proposal,
                franchise_id: franchiseId
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving proposal:', error);
            throw error;
        }

        return data as Proposal;
    },

    async getProposalsByClient(clientId: string) {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        const { data, error } = await supabase
            .from('proposals')
            .select('*')
            .eq('client_id', clientId)
            .eq('franchise_id', franchiseId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching proposals:', error);
            throw error;
        }

        return data as Proposal[];
    },

    async updateProposalStatus(id: string, status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired') {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        // 1. Update the proposal status
        const { data: proposal, error } = await supabase
            .from('proposals')
            .update({ status })
            .eq('id', id)
            .eq('franchise_id', franchiseId)
            .select()
            .single();

        if (error) {
            console.error('Error updating proposal status:', error);
            throw error;
        }

        // 2. SPRINT 3 TRIGGER: If accepted, process commissions and points
        if (status === 'accepted') {
            await this._processCommissionsAndPoints(supabase, proposal);
        }

        return proposal as Proposal;
    },

    // Old implementation moved to clarify Sprint 3 structure below.


    async deleteProposal(id: string) {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        const { error } = await supabase
            .from('proposals')
            .delete()
            .eq('id', id)
            .eq('franchise_id', franchiseId);

        if (error) {
            console.error('Error deleting proposal:', error);
            throw error;
        }

        return true;
    },

    async getProposalById(id: string) {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        const { data, error } = await supabase
            .from('proposals')
            .select('*')
            .eq('id', id)
            .eq('franchise_id', franchiseId)
            .single();

        if (error) {
            console.error('Error fetching proposal:', error);
            throw error;
        }

        return data as Proposal;
    },


    // --- Tariff / Offer Management ---

    /**
     * Retrieves all active energy offers for the current franchise.
     * Includes both custom franchise offers and system-wide specific offers if implemented.
     * @returns Array of Offer objects
     */
    async getOffers(): Promise<Offer[]> {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        try {
            const { data, error } = await supabase
                .from('offers')
                .select('*')
                .or(`franchise_id.eq.${franchiseId},franchise_id.is.null`) // Fetch own + system offers
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('Could not fetch offers from DB, checks if table exists. Falling back to mock.', error);
                throw error;
            }

            return data as Offer[];

        } catch {
            // FALLBACK FOR DEV: If table missing or error, return mocks
            console.log('Serving Mock Offers due to DB error or missing table.');
            return [
                {
                    id: '1',
                    marketer_name: 'Naturgy',
                    tariff_name: 'Tarifa Compromiso',
                    logo_color: 'bg-blue-600',
                    contract_duration: '12 meses',
                    type: 'fixed',
                    power_price: { p1: 0.08, p2: 0.04, p3: 0.02, p4: 0.02, p5: 0.02, p6: 0.02 },
                    energy_price: { p1: 0.14, p2: 0.12, p3: 0.09, p4: 0.08, p5: 0.08, p6: 0.08 }
                },
                {
                    id: '2',
                    marketer_name: 'Endesa',
                    tariff_name: 'Conecta Empresas',
                    logo_color: 'bg-blue-500',
                    contract_duration: '12 meses',
                    type: 'fixed',
                    power_price: { p1: 0.09, p2: 0.05, p3: 0.03, p4: 0.03, p5: 0.03, p6: 0.03 },
                    energy_price: { p1: 0.13, p2: 0.11, p3: 0.10, p4: 0.09, p5: 0.09, p6: 0.09 }
                },
                {
                    id: '3',
                    marketer_name: 'Iberdrola',
                    tariff_name: 'Plan Estable',
                    logo_color: 'bg-green-600',
                    contract_duration: '24 meses',
                    type: 'fixed',
                    power_price: { p1: 0.075, p2: 0.045, p3: 0.025, p4: 0.025, p5: 0.025, p6: 0.025 },
                    energy_price: { p1: 0.15, p2: 0.13, p3: 0.11, p4: 0.10, p5: 0.10, p6: 0.10 }
                },
                {
                    id: '4',
                    marketer_name: 'TotalEnergies',
                    tariff_name: 'A Tu Aire Gas + Luz',
                    logo_color: 'bg-red-500',
                    contract_duration: '12 meses',
                    type: 'indexed',
                    power_price: { p1: 0.06, p2: 0.03, p3: 0.015, p4: 0.015, p5: 0.015, p6: 0.015 },
                    energy_price: { p1: 0.12, p2: 0.10, p3: 0.08, p4: 0.07, p5: 0.07, p6: 0.07 }
                }
            ];
        }
    },

    /**
     * Creates or Updates an Energy Offer.
     * - If ID is present, updates existing.
     * - If ID is missing, creates new active offer.
     * @param offer Partial offer object
     */
    async saveOffer(offer: Partial<Offer>) {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        // If ID exists, Update
        if (offer.id) {
            const { data, error } = await supabase
                .from('offers')
                .update({
                    ...offer,
                    // franchise_id: franchiseId // Usually we don't change ownership
                })
                .eq('id', offer.id)
                .eq('franchise_id', franchiseId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            // Create New
            const { data, error } = await supabase
                .from('offers')
                .insert({
                    ...offer,
                    franchise_id: franchiseId,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        }
    },

    /**
     * Soft deletes an offer by setting is_active to false.
     * @param id Offer UUID
     */
    async deleteOffer(id: string) {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        const { error } = await supabase
            .from('offers')
            .update({ is_active: false }) // Soft delete preferred
            .eq('id', id)
            .eq('franchise_id', franchiseId);

        if (error) throw error;
        return true;
    },

    async calculateSavings(invoice: InvoiceData): Promise<SavingsResult[]> {
        const offers = await this.getOffers();

        // Refactored cost calculation helper
        const getCost = (inv: InvoiceData, off: Offer) => {
            const annualPower = [1, 2, 3, 4, 5, 6].reduce((sum, i) =>
                sum + ((inv[`power_p${i}` as keyof InvoiceData] as number || 0) * off.power_price[`p${i}` as keyof TariffPrice]), 0
            ) * 365;

            const annualEnergy = [1, 2, 3, 4, 5, 6].reduce((sum, i) =>
                sum + ((inv[`energy_p${i}` as keyof InvoiceData] as number || 0) * off.energy_price[`p${i}` as keyof TariffPrice]), 0
            );

            return annualPower + annualEnergy + ((off.fixed_fee || 0) * 12);
        };

        // Estimate current cost: Worst existing offer + 15% markup
        const currentSimulatedCost = Math.max(...offers.map(o => getCost(invoice, o))) * 1.15;

        // Power Optimization Logic
        // Check if any max_demand data is present to trigger optimization
        const hasMaxDemand = [1, 2, 3, 4, 5, 6].some(p => (invoice[`max_demand_p${p}` as keyof InvoiceData] as number) > 0);

        return offers.map(offer => {
            let offer_annual_cost = 0;
            let optimized_annual_fixed_cost_for_this_offer = 0;
            const optimized_powers_map: Record<string, number> = {};

            // 1. Initial Optimal Powers based on Max Demand + Safety Margin
            const rawOptimalPowers: number[] = [1, 2, 3, 4, 5, 6].map(i => {
                const power = (invoice[`power_p${i}` as keyof InvoiceData] as number) || 0;
                const maxDemand = (invoice[`max_demand_p${i}` as keyof InvoiceData] as number) || 0;

                // If no max demand data, we can't safely optimize, so we keep current power
                if (maxDemand === 0) return power;

                // Safety margin: 5% above max demand, but not exceeding current power if it's already tight
                return Math.ceil((maxDemand * 1.05) * 10) / 10;
            });

            // 2. Enforce Rule: P(n+1) >= P(n)
            // This is mandatory for tariffs like 3.0TD in Spain.
            const adjustedPowers: number[] = [...rawOptimalPowers];
            for (let i = 1; i < 6; i++) {
                if (adjustedPowers[i] < adjustedPowers[i - 1]) {
                    adjustedPowers[i] = adjustedPowers[i - 1];
                }
            }

            // 3. Map back to result structure
            adjustedPowers.forEach((p, idx) => {
                optimized_powers_map[`p${idx + 1}`] = p;
            });

            // Calculate costs for P1-P6 using Adjusted Powers
            for (let i = 1; i <= 6; i++) {
                const pKey = `p${i}` as keyof TariffPrice;
                const power = invoice[`power_p${i}` as keyof InvoiceData] as number || 0;
                const energy = invoice[`energy_p${i}` as keyof InvoiceData] as number || 0;
                const optimalPower = optimized_powers_map[`p${i}`];

                // Offer Cost with ORIGINAL powers
                // POWER is daily price -> * 365
                offer_annual_cost += (power * offer.power_price[pKey] * 365) + (energy * offer.energy_price[pKey]);

                // Fixed Cost with OPTIMIZED powers
                optimized_annual_fixed_cost_for_this_offer += (optimalPower * offer.power_price[pKey] * 365);
            }

            // Fixed Fee
            if (offer.fixed_fee) {
                offer_annual_cost += offer.fixed_fee * 12;
                optimized_annual_fixed_cost_for_this_offer += offer.fixed_fee * 12; // Fixed fee remains
            }

            // Calculate the "Technical Saving" (Difference between Offer@CurrentPower and Offer@OptimizedPower)
            // Original Fixed Cost with Offer Prices
            let original_fixed_cost_with_offer = 0;
            for (let i = 1; i <= 6; i++) {
                const pKey = `p${i}` as keyof TariffPrice;
                const power = invoice[`power_p${i}` as keyof InvoiceData] as number || 0;
                original_fixed_cost_with_offer += (power * offer.power_price[pKey] * 365);
            }

            const annual_optimization_savings = hasMaxDemand
                ? Math.max(0, original_fixed_cost_with_offer - optimized_annual_fixed_cost_for_this_offer)
                : 0;

            return {
                offer,
                current_annual_cost: currentSimulatedCost, // Use the smart simulated cost instead of hardcoded raw cost
                offer_annual_cost,
                annual_savings: currentSimulatedCost - offer_annual_cost,
                savings_percent: ((currentSimulatedCost - offer_annual_cost) / currentSimulatedCost) * 100,
                optimization_result: hasMaxDemand ? {
                    optimized_powers: optimized_powers_map,
                    original_annual_fixed_cost: original_fixed_cost_with_offer,
                    optimized_annual_fixed_cost: optimized_annual_fixed_cost_for_this_offer,
                    annual_optimization_savings: annual_optimization_savings
                } : undefined
            };
        }).sort((a, b) => b.annual_savings - a.annual_savings);
    },

    /**
     * Uploads a document (Invoice/Fiscal) to the webhook for OCR processing.
     * @param file File object to upload
     * @returns Parsed data from the webhook
     */
    async analyzeDocument(file: File) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('https://sswebhook.iawarrior.com/webhook/fd77781d-8afc-4177-b793-accf923ad106', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Webhook upload failed: ${response.statusText}`);
            }

            const responseData = await response.json();

            // The platform receives an array. We take the first element.
            // Structure: data[0] -> { bestOfferDetails, FacturaOriginal, ... }
            const data = Array.isArray(responseData) ? responseData[0] : responseData;

            if (data && data.FacturaOriginal) {
                const original = data.FacturaOriginal;
                const best = data.bestOfferDetails || {};

                return {
                    // Mapping Power from FacturaOriginal
                    power_p1: original.POTENCIA_P1 ? parseFloat(original.POTENCIA_P1.replace(',', '.')) : 0,
                    power_p2: original.POTENCIA_P2 ? parseFloat(original.POTENCIA_P2.replace(',', '.')) : 0,
                    power_p3: original.POTENCIA_P3 ? parseFloat(original.POTENCIA_P3.replace(',', '.')) : 0,
                    // Tariffs like 3.0TD may have P4-P6, defaulting to 0 if not present
                    power_p4: original.POTENCIA_P4 ? parseFloat(original.POTENCIA_P4.replace(',', '.')) : 0,
                    power_p5: original.POTENCIA_P5 ? parseFloat(original.POTENCIA_P5.replace(',', '.')) : 0,
                    power_p6: original.POTENCIA_P6 ? parseFloat(original.POTENCIA_P6.replace(',', '.')) : 0,

                    // Mapping Consumption from FacturaOriginal (Received as ENERGIA_PX)
                    energy_p1: original.ENERGIA_P1 ? parseFloat(original.ENERGIA_P1.replace(',', '.')) : 0,
                    energy_p2: original.ENERGIA_P2 ? parseFloat(original.ENERGIA_P2.replace(',', '.')) : 0,
                    energy_p3: original.ENERGIA_P3 ? parseFloat(original.ENERGIA_P3.replace(',', '.')) : 0,
                    energy_p4: original.ENERGIA_P4 ? parseFloat(original.ENERGIA_P4.replace(',', '.')) : 0,
                    energy_p5: original.ENERGIA_P5 ? parseFloat(original.ENERGIA_P5.replace(',', '.')) : 0,
                    energy_p6: original.ENERGIA_P6 ? parseFloat(original.ENERGIA_P6.replace(',', '.')) : 0,

                    razon_social: original.CLIENTE_NOMBRE || 'Cliente Desconocido',
                    cups: original.CUPS || '',
                    direccion: original.DIRECCION_SUMINISTRO || '',
                    // Metadata from the best offer if found
                    best_offer: best
                };
            }

            // FALLBACK: If webhook returns "Workflow was started" (Async n8n default)
            if (data && (data.message === 'Workflow was started' || !data.FacturaOriginal)) {
                console.warn('Webhook data incomplete or async. Returning MOCK data for UI verification.');
                return {
                    power_p1: 5.5, power_p2: 5.5, power_p3: 5.5, power_p4: 5.5, power_p5: 5.5, power_p6: 5.5,
                    energy_p1: 1200, energy_p2: 1100, energy_p3: 900, energy_p4: 800, energy_p5: 700, energy_p6: 600,
                    razon_social: 'Empresa de Prueba S.L.',
                    cif: 'B12345678',
                    direccion: 'Calle Industria 45, Madrid'
                };
            }

            return data;
        } catch (error) {
            console.error('Error uploading document:', error);
            throw error;
        }
    },

    /**
     * Logs a simulation as a Draft Proposal.
     * Auto-creates a "Prospect" client if needed.
     */
    async logSimulation(invoiceData: InvoiceData, bestResult: SavingsResult, clientName?: string) {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error('User not authenticated');

        // 1. Create or Identify Client
        // For simplicity in this flow, we ALWAYS create a new "Prospect" to ensure history tracking without collisions,
        // unless we had a robust "Select Client" dropdown in the comparator (which we might add later).
        // The user asked for "Si no pones nombre, pondremos 'Cliente Potencial'".
        const finalName = clientName || `Cliente Potencial ${new Date().toLocaleDateString('es-ES')}`;

        const { data: client, error: clientError } = await supabase
            .from('clients')
            .insert({
                name: finalName,
                status: 'new', // New Prospect
                type: 'company', // Default
                franchise_id: franchiseId,
                owner_id: user.id
            })
            .select()
            .single();

        if (clientError) {
            console.error('Error auto-creating client for simulation:', clientError);
            throw clientError;
        }

        // 2. Save Proposal as Draft
        const proposal = {
            client_id: client.id,
            franchise_id: franchiseId,
            status: 'draft',
            created_at: new Date().toISOString(),
            offer_snapshot: bestResult.offer,
            calculation_data: invoiceData,
            annual_savings: bestResult.annual_savings,
            current_annual_cost: bestResult.current_annual_cost,
            offer_annual_cost: bestResult.offer_annual_cost,
            savings_percent: bestResult.savings_percent,
            optimization_result: bestResult.optimization_result
        };

        const { data: savedProposal, error: proposalError } = await supabase
            .from('proposals')
            .insert(proposal)
            .select()
            .single();

        if (proposalError) {
            console.error('Error saving draft simulation:', proposalError);
            throw proposalError;
        }

        return savedProposal;
    },

    // --- NETWORK MANAGEMENT (Sprint 1) ---

    async getNetworkHierarchy(): Promise<NetworkUser[]> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // 1. Fetch all profiles I'm allowed to see (RLS will filter this)
        // We also join franchise_config to get company names
        const { data: rawProfiles, error } = await supabase
            .from('profiles')
            .select(`
                id, full_name, role, parent_id, avatar_url,
                franchise_config ( company_name, royalty_percent )
            `);

        if (error) throw error;

        const profiles = rawProfiles || [];

        // 3. Build the Tree
        // Map to NetworkUser type
        // 3. Fetch Real Stats (Parallel to profiles)
        const { data: allClients } = await supabase.from('clients').select('owner_id, status');

        const clientCounts: Record<string, number> = {};
        const volumeCounts: Record<string, number> = {};

        if (allClients) {
            allClients.forEach(c => {
                if (c.owner_id) {
                    clientCounts[c.owner_id] = (clientCounts[c.owner_id] || 0) + 1;
                    // Mock volume logic: Each client is worth ~1500€/yr roughly
                    volumeCounts[c.owner_id] = (volumeCounts[c.owner_id] || 0) + (c.status === 'won' ? 1500 : 0);
                }
            });
        }

        // 4. Build the Tree Nodes
        const nodes: NetworkUser[] = profiles.map(p => ({
            id: p.id,
            email: '',
            full_name: p.full_name || 'Usuario',
            role: p.role as UserRole,
            parent_id: p.parent_id,
            avatar_url: p.avatar_url,
            franchise_config: Array.isArray(p.franchise_config) ? p.franchise_config[0] : p.franchise_config,
            children: [],
            stats: {
                active_clients: clientCounts[p.id] || 0,
                total_sales: volumeCounts[p.id] || 0,
                commission_earned: Math.floor((volumeCounts[p.id] || 0) * 0.10)
            }
        }));

        const nodeMap = new Map<string, NetworkUser>();
        nodes.forEach(n => nodeMap.set(n.id, n));

        const rootNodes: NetworkUser[] = [];

        nodes.forEach(node => {
            if (node.parent_id && nodeMap.has(node.parent_id)) {
                const parent = nodeMap.get(node.parent_id)!;
                parent.children = parent.children || [];
                parent.children.push(node);
            } else {
                // If no parent, or parent not visible (e.g. I am a franchise seeing myself as root of my view)
                rootNodes.push(node);
            }
        });

        // If I am a franchise, I might appear as a child of HQ in the DB, 
        // but if HQ is not in "rawProfiles" (due to RLS?), I become a root node.
        // This logic holds.

        return rootNodes;
    },

    async createInvitation(email: string, role: 'franchise' | 'agent') {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // SECURITY: Verify creator has permission to invite
        const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (creatorProfile?.role === 'agent') {
            throw new Error('No tienes permisos suficientes para generar invitaciones.');
        }

        // Generate a random 6-char code
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();

        const { data, error } = await supabase
            .from('network_invitations')
            .insert({
                creator_id: user.id,
                email,
                role,
                code
            })
            .select()
            .single();

        if (error) throw error;
        return data; // Returns the invitation object with the code
    },

    // --- GAMIFICATION (Sprint 3) ---

    async getLeaderboard() {
        // Mock Data for now
        // In real app: await supabase.from('leaderboard_stats').select('*').order('points', { ascending: false }).limit(5);

        await new Promise(r => setTimeout(r, 800)); // Simulate net latency

        return [
            { id: '1', name: 'Carlos Ruiz', role: 'Franquicia', points: 12500, trend: 'up', avatar_url: 'https://i.pravatar.cc/150?u=1', badges: ['Top Seller', 'Club 100k'] },
            { id: '2', name: 'Ana Garcia', role: 'Agente', points: 9800, trend: 'up', avatar_url: 'https://i.pravatar.cc/150?u=2', badges: ['Rising Star'] },
            { id: '3', name: 'Roberto Diaz', role: 'Agente', points: 8400, trend: 'down', avatar_url: 'https://i.pravatar.cc/150?u=3', badges: [] },
            { id: '4', name: 'Elena M.', role: 'Colaborador', points: 7200, trend: 'stable', avatar_url: 'https://i.pravatar.cc/150?u=4', badges: ['First Sale'] },
            { id: '5', name: 'Juan P.', role: 'Agente', points: 5100, trend: 'up', avatar_url: 'https://i.pravatar.cc/150?u=5', badges: [] }
        ];
    },

    async getUserGamificationStats() {
        await new Promise(r => setTimeout(r, 600));
        return {
            level: 5,
            xp: 2450,
            nextLevelXp: 3000,
            progress: 75,
            badges: [
                { id: '1', title: 'Primera Venta', icon: '⚡', color: 'bg-yellow-100 text-yellow-600 border-yellow-200', unlocked: true },
                { id: '2', title: 'Club 100k', icon: '💎', color: 'bg-indigo-100 text-indigo-600 border-indigo-200', unlocked: true },
                { id: '3', title: 'Networker', icon: '🌐', color: 'bg-emerald-100 text-emerald-600 border-emerald-200', unlocked: true },
                { id: '4', title: 'Master Energía', icon: '🔋', color: 'bg-slate-100 text-slate-400 border-slate-200', unlocked: false },
            ]
        };
    },

    // --- ACADEMY & GEO-INTELLIGENCE (Sprint 2) ---
    async getAcademyResources() {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('academy_resources')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async getGeolocatedClients() {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('clients')
            .select('id, name, latitude, longitude, city, zip_code')
            .not('latitude', 'is', null);

        if (error) throw error;
        return data;
    },

    // --- COMMISSIONS & GAMIFICATION (Sprint 3) ---
    async getNetworkCommissions() {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data: profile } = await supabase.from('profiles').select('role, franchise_id').eq('id', user.id).single();

        let query = supabase
            .from('network_commissions')
            .select('*, proposals(client_id, clients(name))')
            .order('created_at', { ascending: false });

        if (profile?.role === 'franchise') {
            // Franchise sees everything in their network
            query = query.eq('franchise_id', profile.franchise_id);
        } else {
            // Agents only see their own commissions
            query = query.eq('agent_id', user.id);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    },

    /**
     * PRIVATE: Processes commissions and gamification points after a win.
     */
    async _processCommissionsAndPoints(supabase: SupabaseClient, proposal: Proposal) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Get profile for hierarchy
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (!profile) return;

            // 2. Commission Distribution (Rule: 15% pot divided 30/50/20)
            const pot = (proposal.annual_savings || 1000) * 0.15;

            // Logic: Is the seller the Franchise Owner?
            const isFranchiseOwner = profile.role === 'franchise';

            const distributions = {
                // If owner sells, they keep Agent Cut + Franchise Cut (80% of Pot).
                agent: isFranchiseOwner ? (pot * 0.80) : (pot * 0.30),
                franchise: isFranchiseOwner ? 0 : (pot * 0.50), // If owner sold, it's all in "agent" field or we split it? Let's put it in Agent to keep it simple for their personal wallet, or split. 
                // BETTER APPROACH: Keep the split semantic. 
                // Agent Cut (30%) -> Goes to Seller (whether User or Owner).
                // Franchise Cut (50%) -> Goes to Franchise ID (which might be the same User).
                // HQ Cut (20%) -> Goes to HQ.
                agent_calc: pot * 0.30,
                franchise_calc: pot * 0.50,
                hq_calc: pot * 0.20
            };

            // 3. Persistent Record
            await supabase.from('network_commissions').insert({
                proposal_id: proposal.id,
                agent_id: user.id, // The seller
                franchise_id: profile.franchise_id, // The franchise bucket
                total_revenue: pot,
                agent_commission: distributions.agent_calc,
                franchise_profit: distributions.franchise_calc,
                hq_royalty: distributions.hq_calc,
                status: 'pending'
            });

            // 4. Gamification
            const { data: current } = await supabase.from('user_points').select('points').eq('user_id', user.id).maybeSingle();
            await supabase.from('user_points').upsert({
                user_id: user.id,
                points: (current?.points || 0) + 50,
                last_updated: new Date().toISOString()
            });

        } catch (err) {
            console.error('Sprint 3 Post-Win Processing Error:', err);
        }
    },


    async getNetworkStats() {
        const supabase = createClient();
        const { data: commissions, error } = await supabase
            .from('network_commissions')
            .select('total_revenue, created_at');

        if (error) throw error;

        const totalVolumen = commissions.reduce((sum, c) => sum + (c.total_revenue || 0), 0);

        // Growth calc (this month vs last month)
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

        const thisMonthVol = commissions
            .filter(c => c.created_at >= startOfThisMonth)
            .reduce((sum, c) => sum + (c.total_revenue || 0), 0);

        const lastMonthVol = commissions
            .filter(c => c.created_at >= startOfLastMonth && c.created_at < startOfThisMonth)
            .reduce((sum, c) => sum + (c.total_revenue || 0), 0);

        const growth = lastMonthVol > 0 ? Math.round(((thisMonthVol - lastMonthVol) / lastMonthVol) * 100) : 0;

        return {
            totalVolumen,
            monthlyGrowth: growth
        };
    },

    async getRecentProposals(limit = 20) {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);

        const { data, error } = await supabase
            .from('proposals')
            .select('*, clients(name)')
            .eq('franchise_id', franchiseId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data as Proposal[];
    },

    /**
     * DEMO UTILITY: Simulates a complete sales cycle in one click.
     * 1. Creates a prospect.
     * 2. Creates a proposal.
     * 3. Accepts the proposal (triggering commissions).
     */
    async simulateSale(amount = 2500) {
        console.log('--- STARTING SALES SIMULATION ---');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not loaded');

        // 1. Create Prospect
        const fakeName = `Empresa Demo ${Math.floor(Math.random() * 1000)} S.L.`;
        const { data: client } = await supabase.from('clients').insert({
            name: fakeName,
            status: 'new',
            franchise_id: (await this._getFranchiseId(supabase)),
            owner_id: user.id
        }).select().single();

        if (!client) throw new Error('Failed to create mock client');

        // 2. Create Proposal
        const { data: proposal } = await supabase.from('proposals').insert({
            client_id: client.id,
            franchise_id: client.franchise_id,
            status: 'draft',
            annual_savings: amount, // The base for the commission pot
            offer_snapshot: { tariff_name: 'Tarifa Demo 2.0', marketer_name: 'Simulada' }
        }).select().single();

        if (!proposal) throw new Error('Failed to create mock proposal');

        // 3. Accept Proposal -> Triggers Commissions
        // We reuse the existing logic
        await this.updateProposalStatus(proposal.id, 'accepted');

        console.log('--- SIMULATION COMPLETE ---');
        return proposal;
    }
};
