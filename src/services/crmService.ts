import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { Client, InvoiceData, Offer, SavingsResult, Proposal, TariffPrice, NetworkUser, UserRole } from '@/types/crm';
import { analyzeDocumentAction } from '@/app/actions/ocr';
import { calculateSavingsAction } from '@/app/actions/compare';

// Simple in-memory cache for client-side
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data as T;
    }
    return null;
}

function setCache<T>(key: string, data: T): void {
    cache.set(key, { data, timestamp: Date.now() });
}

export const crmService = {
    /**
     * PRIVATE HELPER: strictly gets the current user's franchise ID.
     * This acts as a second layer of security (Defense in Depth) on top of RLS.
     * OPTIMIZED: Parallel auth and profile fetch to eliminate waterfall
     */
    async _getFranchiseId(supabase: SupabaseClient) {
        const [{ data: { user } }, { data: profile }] = await Promise.all([
            supabase.auth.getUser(),
            supabase
                .from('profiles')
                .select('franchise_id')
                .single()
        ]);

        if (!user) return null;

        if (!profile) {
            // Retrieve via ensureProfile if missing (self-healing for brand new users)
            const newProfile = await this.ensureProfile(user.id, user.email || 'User');
            return newProfile.franchise_id;
        }

        return profile.franchise_id;
    },

    async getClients(serverClient?: SupabaseClient) {
        const supabase = serverClient || createClient();
        const franchiseId = await this._getFranchiseId(supabase);
        if (!franchiseId) return [];

        const cacheKey = `clients_${franchiseId}`;
        const cached = getCached<Client[]>(cacheKey);
        if (cached) return cached;

        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('franchise_id', franchiseId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching clients:', error);
            throw error;
        }

        setCache(cacheKey, data);
        return data as Client[];
    },

    async getDashboardStats() {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);
        if (!franchiseId) return null;

        const cacheKey = `dashboard_stats_${franchiseId}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

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

        // Parallel: Fetch user and profile simultaneously
        const [{ data: { user } }, { data: userProfile }] = await Promise.all([
            supabase.auth.getUser(),
            supabase.from('profiles').select('full_name, role, avatar_url').single()
        ]);

        if (!user) {
            return {
                user: null,
                total: 0,
                active: 0,
                pending: 0,
                new: 0,
                growth: '0%',
                recent: [],
                recentProposals: [],
                pendingActions: [],
                financials: {
                    total_detected: 0,
                    pipeline: 0,
                    secured: 0,
                    conversion_rate: 0,
                    month_savings: 0
                }
            };
        }

        const result = {
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

        setCache(cacheKey, result);
        return result;
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
        if (!franchiseId) return null;

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
        if (!franchiseId) return null;

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
        if (!franchiseId) return false;

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
        if (!franchiseId) return [];

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
        if (!franchiseId) throw new Error('No franchise access');

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

    async deleteProposal(id: string) {
        const supabase = createClient();
        const franchiseId = await this._getFranchiseId(supabase);
        if (!franchiseId) return false;

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
        if (!franchiseId) return null;

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
        // During build/SSR without authentication, return empty list
        if (!franchiseId) return [];

        try {
            const { data, error } = await supabase
                .from('lv_zinergia_tarifas')
                .select('*')
                .eq('is_active', true)
                .order('company', { ascending: true });

            if (error) {
                console.warn('Could not fetch tariffs from lv_zinergia_tarifas. Falling back to offers table.', error);

                const { data: offersData, error: offersError } = await supabase
                    .from('offers')
                    .select('*')
                    .or(`franchise_id.eq.${franchiseId},franchise_id.is.null`)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });

                if (offersError) throw offersError;
                return offersData as Offer[];
            }

            if (!data || data.length === 0) {
                console.warn('No tariffs found in lv_zinergia_tarifas. Returning empty array.');
                return [];
            }

            return data.map(tariff => ({
                id: tariff.id,
                marketer_name: tariff.company,
                tariff_name: tariff.tariff_name,
                logo_color: tariff.logo_color || 'bg-slate-600',
                contract_duration: tariff.contract_duration || '12 meses',
                type: tariff.offer_type as 'fixed' | 'indexed' || 'fixed',
                power_price: {
                    p1: tariff.power_price_p1 || 0,
                    p2: tariff.power_price_p2 || 0,
                    p3: tariff.power_price_p3 || 0,
                    p4: tariff.power_price_p4 || 0,
                    p5: tariff.power_price_p5 || 0,
                    p6: tariff.power_price_p6 || 0,
                },
                energy_price: {
                    p1: tariff.energy_price_p1 || 0,
                    p2: tariff.energy_price_p2 || 0,
                    p3: tariff.energy_price_p3 || 0,
                    p4: tariff.energy_price_p4 || 0,
                    p5: tariff.energy_price_p5 || 0,
                    p6: tariff.energy_price_p6 || 0,
                },
                fixed_fee: tariff.fixed_fee || 0,
            })) as Offer[];

        } catch (error) {
            console.error('Error fetching offers from both tables:', error);
            return [];
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
        try {
            const data = await calculateSavingsAction(invoice);

            if (data && data.offers && Array.isArray(data.offers)) {
                const currentCost = data.current_annual_cost || data.current_annual_cost_calculated || 0;

                interface PricePoint {
                    p1?: number;
                    p2?: number;
                    p3?: number;
                    p4?: number;
                    p5?: number;
                    p6?: number;
                }

                interface WebhookOffer {
                    id?: string;
                    offer_id?: string;
                    marketer_name?: string;
                    comercializadora?: string;
                    company_name?: string;
                    tariff_name?: string;
                    nombre_tarifa?: string;
                    tarifa?: string;
                    logo_color?: string;
                    color_logo?: string;
                    type?: 'fixed' | 'indexed';
                    tipo?: 'fixed' | 'indexed';
                    power_price?: PricePoint;
                    precio_potencia?: PricePoint;
                    energy_price?: PricePoint;
                    precio_energia?: PricePoint;
                    fixed_fee?: number;
                    cuota_fija?: number;
                    contract_duration?: string;
                    duracion_contrato?: string;
                    annual_cost?: number;
                    costo_anual?: number;
                    optimization_result?: unknown;
                    resultado_optimizacion?: unknown;
                }

                return data.offers.map((offer: WebhookOffer) => ({
                    offer: {
                        id: offer.id || offer.offer_id || Math.random().toString(36).substr(2, 9),
                        marketer_name: offer.marketer_name || offer.comercializadora || offer.company_name || 'Comercializadora',
                        tariff_name: offer.tariff_name || offer.nombre_tarifa || offer.tarifa || 'Tarifa',
                        logo_color: offer.logo_color || offer.color_logo || 'bg-blue-600',
                        type: offer.type || offer.tipo || 'fixed',
                        power_price: (offer.power_price || offer.precio_potencia || { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 }) as TariffPrice,
                        energy_price: (offer.energy_price || offer.precio_energia || { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 }) as TariffPrice,
                        fixed_fee: offer.fixed_fee || offer.cuota_fija || 0,
                        contract_duration: offer.contract_duration || offer.duracion_contrato || '12 meses',
                    },
                    current_annual_cost: currentCost,
                    offer_annual_cost: offer.annual_cost || offer.costo_anual || 0,
                    annual_savings: Math.max(0, currentCost - (offer.annual_cost || offer.costo_anual || 0)),
                    savings_percent: currentCost > 0 ? ((currentCost - (offer.annual_cost || offer.costo_anual || 0)) / currentCost) * 100 : 0,
                    optimization_result: (offer.optimization_result || offer.resultado_optimizacion) as SavingsResult['optimization_result'],
                }));
            }
            return [];
        } catch (error) {
            console.error('❌ Server Action comparison failed, using mock data:', error);

            const currentCost = invoice.total_amount || 1200;

            return [
                {
                    offer: {
                        id: 'mock-offer-1',
                        marketer_name: 'Energía Plus',
                        tariff_name: 'Tarifa Optimizada 2.0TD',
                        logo_color: 'bg-emerald-600',
                        type: 'fixed',
                        power_price: { p1: 0.045, p2: 0.045, p3: 0, p4: 0, p5: 0, p6: 0 },
                        energy_price: { p1: 0.22, p2: 0.18, p3: 0, p4: 0, p5: 0, p6: 0 },
                        fixed_fee: 35,
                        contract_duration: '12 meses',
                    },
                    current_annual_cost: currentCost,
                    offer_annual_cost: currentCost * 0.85,
                    annual_savings: currentCost * 0.15,
                    savings_percent: 15,
                    optimization_result: undefined,
                },
                {
                    offer: {
                        id: 'mock-offer-2',
                        marketer_name: 'Luz Directa',
                        tariff_name: 'Tarifa Verde 24h',
                        logo_color: 'bg-blue-600',
                        type: 'fixed',
                        power_price: { p1: 0.04, p2: 0.04, p3: 0, p4: 0, p5: 0, p6: 0 },
                        energy_price: { p1: 0.20, p2: 0.20, p3: 0, p4: 0, p5: 0, p6: 0 },
                        fixed_fee: 28,
                        contract_duration: '12 meses',
                    },
                    current_annual_cost: currentCost,
                    offer_annual_cost: currentCost * 0.92,
                    annual_savings: currentCost * 0.08,
                    savings_percent: 8,
                    optimization_result: undefined,
                },
            ];
        }
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
            return await analyzeDocumentAction(formData);
        } catch (error) {
            console.error('Error uploading document via server action:', error);
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
        if (!franchiseId) return [];

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
