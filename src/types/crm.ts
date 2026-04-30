export type ClientType = 'residential' | 'company' | 'public_admin' | 'particular';
export type ClientStatus = 'new' | 'contacted' | 'in_process' | 'won' | 'lost';
export type DetectedClientType = 'particular' | 'empresa';
export type DetectedTariffType = 'fija' | 'indexada';

export interface Client {
    id: string;
    created_at: string;
    updated_at?: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    cups?: string;
    average_monthly_bill?: number;
    contracted_power?: Record<string, number>; // { p1: 3.4, ... }
    current_supplier?: string;
    tariff_type?: string;

    // Metadata
    type: ClientType;
    status: ClientStatus;
    dni_cif?: string;

    // Geolocation for Geo-Intelligence
    zip_code?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
}

// Comparator Types
export interface InvoiceData {
    period_days: number;

    // Core Power
    power_p1: number;
    power_p2: number;
    power_p3: number;
    power_p4: number;
    power_p5: number;
    power_p6: number;

    // Core Energy
    energy_p1: number;
    energy_p2: number;
    energy_p3: number;
    energy_p4: number;
    energy_p5: number;
    energy_p6: number;

    // --- Extended Webhook Data ---
    client_name?: string;
    dni_cif?: string;
    cups?: string;
    supply_address?: string;
    company_name?: string;
    tariff_name?: string;
    invoice_number?: string;
    invoice_date?: string;

    // --- Detected Classification Fields (Forensic Analysis) ---
    detected_client_type?: DetectedClientType;
    detected_tariff_type?: DetectedTariffType;
    forensic_details?: {
        energy_reactive?: number;
        reactive_penalty?: boolean;
        tariff_access?: string;
        power_rental_cost?: number;
        price_match_boe?: boolean;
        pass_through_components?: string[];
        has_financial_adjustments?: boolean;
        has_losses_coefficient?: boolean;
        contract_end_date?: string;
        has_clausule_exit_penalty?: boolean;
    };
    forensic_mismatch?: string; // For forensic validation errors

    // Financials
    subtotal?: number;
    vat?: number;
    total_amount?: number;
    rights_cost?: number; // Derechos de enganche

    // Optional Max Demand (Maxímetro) for Optimization
    max_demand_p1?: number;
    max_demand_p2?: number;
    max_demand_p3?: number;
    max_demand_p4?: number;
    max_demand_p5?: number;
    max_demand_p6?: number;

    // Optional Current Prices (if user wants to override default estimation)
    current_power_price_p1?: number;
    current_power_price_p2?: number;
    current_power_price_p3?: number;
    current_power_price_p4?: number;
    current_power_price_p5?: number;
    current_power_price_p6?: number;

    current_energy_price_p1?: number;
    current_energy_price_p2?: number;
    current_energy_price_p3?: number;
    current_energy_price_p4?: number;
    current_energy_price_p5?: number;
    current_energy_price_p6?: number;

    detected_power_type?: string;
    client_id?: string;
}

export interface TariffPrice {
    p1: number;
    p2: number;
    p3: number;
    p4: number;
    p5: number;
    p6: number;
}

export interface Offer {
    id: string;
    marketer_name: string;
    tariff_name: string;
    logo_color: string; // Hex code or Tailwind class precursor
    type?: 'fixed' | 'indexed';
    power_price: TariffPrice;
    energy_price: TariffPrice;
    fixed_fee?: number; // Monthly fixed fee if any
    contract_duration: string;
}

export interface SavingsResult {
    offer: Offer;
    current_annual_cost: number;
    offer_annual_cost: number;
    annual_savings: number;
    savings_percent: number;
    optimization_result?: {
        optimized_powers: Record<string, number>;
        original_annual_fixed_cost: number;
        optimized_annual_fixed_cost: number;
        annual_optimization_savings: number;
    };
}

export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface Proposal {
    id: string;
    client_id: string;
    franchise_id?: string;
    agent_id?: string;
    created_at: string;
    updated_at?: string;
    status: ProposalStatus;
    offer_snapshot: Offer; // Full copy of offer at time of generation
    calculation_data: InvoiceData;
    current_annual_cost: number;
    offer_annual_cost: number;
    annual_savings: number;
    savings_percent: number;
    notes?: string;
    optimization_result?: {
        optimized_powers: Record<string, number>;
        original_annual_fixed_cost: number;
        optimized_annual_fixed_cost: number;
        annual_optimization_savings: number;
    };
    clients?: {
        name: string;
    };
    // Firma digital
    signature_data?: string | null;
    signed_name?: string | null;
    signed_at?: string | null;
    public_token?: string | null;
    public_expires_at?: string | null;
    public_accepted_at?: string | null;

    aletheia_summary?: {
        client_profile: {
            tags: string[];
            sales_argument: string;
        };
        opportunities: {
            type: string;
            description: string;
            annual_savings: number;
            priority: string;
        }[];
        recommendations: unknown[];
    };
}


// Network & Franchise Types

export type UserRole = 'admin' | 'franchise' | 'agent';

export interface NetworkUser {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    parent_id?: string | null;
    avatar_url?: string;
    // Computed/Joined fields
    children?: NetworkUser[];
    stats?: {
        active_clients: number;
        total_sales: number;
        commission_earned: number;
    };
    franchise_config?: {
        company_name?: string;
        royalty_percent?: number;
    } | null;
}

export interface CommissionRule {
    id: string;
    name: string;
    commission_rate: number;   // % of annual_savings as pot (e.g. 0.15)
    agent_share: number;       // Agent's cut of pot (e.g. 0.30)
    franchise_share: number;   // Franchise's cut of pot (e.g. 0.50)
    hq_share: number;          // HQ's cut of pot (e.g. 0.20)
    points_per_win: number;    // Gamification points awarded on win
    is_active: boolean;
    effective_from: string;
    created_by?: string;
    created_at: string;
}

// Sprint 3: Commissions & Gamification
export interface Commission {
    id: string;
    proposal_id: string;
    agent_id: string;
    franchise_id: string;
    total_revenue: number;
    agent_commission: number;
    franchise_commission: number;
    franchise_profit?: number;
    hq_royalty: number;
    status: 'pending' | 'cleared' | 'paid';
    created_at: string;

    // Joined fields from crmService
    proposals?: {
        client_id: string;
        clients?: {
            name: string;
        };
    };
}

export interface UserPoints {
    id: string;
    user_id: string;
    points: number;
    badges: string[]; // JSONB stored as array of strings
    last_updated: string;

    // Joined fields
    profiles?: {
        full_name: string;
        role: UserRole;
        avatar_url?: string;
    };
}

// Fase 3: Motor Financiero
export type BillingCycleStatus = 'open' | 'closed' | 'voided';

export interface BillingCycle {
    id: string;
    franchise_id: string;
    month_year: string;       // '2026-03'
    status: BillingCycleStatus;
    total_commissions: number;
    total_proposals: number;
    snapshot_data: Commission[] | null;
    closed_by: string | null;
    closed_at: string | null;
    created_at: string;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface WithdrawalRequest {
    id: string;
    user_id: string;
    amount: number;
    status: WithdrawalStatus;
    iban: string;
    commission_ids: string[];
    rejection_reason?: string;
    reviewed_by?: string;
    reviewed_at?: string;
    paid_at?: string;
    created_at: string;
    updated_at: string;
}

export interface WithdrawalGrowth {
    current_month_earned: number;
    previous_month_earned: number;
    growth_percent: number;
}

export interface WalletBalance {
    franchise_id: string;
    balance_available: number;
    balance_paid: number;
    balance_pending: number;
    total_earned: number;
    proposals_cleared: number;
    proposals_paid: number;
    proposals_pending: number;
}

// ========================================
// PERFIL FISCAL
// ========================================

export type CompanyType = 'autonomo' | 'sociedad_limitada' | 'sociedad_anonima' | 'cooperativa' | 'otros';

export interface FiscalProfile {
    nif_cif?: string;
    fiscal_address?: string;
    fiscal_city?: string;
    fiscal_province?: string;
    fiscal_postal_code?: string;
    fiscal_country?: string;
    iban?: string;
    company_name?: string;
    company_type?: CompanyType;
    invoice_prefix?: string;
    invoice_next_number?: number;
    retention_percent?: number;
    fiscal_verified?: boolean;
    fiscal_verified_at?: string;
}

export interface ProfileFiscalComplete extends NetworkUser, FiscalProfile {}

export function isProfileReadyForInvoicing(profile: FiscalProfile): { ready: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!profile.nif_cif) missing.push('NIF/CIF');
    if (!profile.fiscal_address) missing.push('Dirección fiscal');
    if (!profile.fiscal_city) missing.push('Ciudad');
    if (!profile.fiscal_province) missing.push('Provincia');
    if (!profile.fiscal_postal_code) missing.push('Código postal');
    if (!profile.iban) missing.push('IBAN');
    return { ready: missing.length === 0, missing };
}

// ========================================
// FACTURACIÓN
// ========================================

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';
export type PaymentMethod = 'transferencia' | 'bizum' | 'efectivo' | 'otros';

export interface InvoiceLine {
    description: string;
    commission_id: string;
    client_name: string;
    proposal_id: string;
    marketer_name: string;
    base_amount: number;
    retention: number;
    total_line: number;
}

export interface Invoice {
    id: string;
    invoice_number: string;
    agent_id: string;
    franchise_id?: string;

    issuer_name: string;
    issuer_nif: string;
    issuer_address?: string;
    issuer_city?: string;
    issuer_postal_code?: string;

    recipient_name: string;
    recipient_nif: string;
    recipient_address?: string;
    recipient_city?: string;
    recipient_postal_code?: string;

    issue_date: string;
    due_date: string;
    billing_period_start?: string;
    billing_period_end?: string;

    invoice_lines: InvoiceLine[];
    subtotal: number;
    retention_total: number;
    retention_percent: number;
    tax_base: number;
    tax_type: string;
    tax_percent: number;
    tax_amount: number;
    total: number;

    status: InvoiceStatus;
    paid_date?: string;
    payment_method?: PaymentMethod;
    payment_reference?: string;
    notes?: string;
    pdf_url?: string;

    created_at: string;
    updated_at: string;
}

export interface InvoiceWithAgent extends Invoice {
    profiles?: {
        full_name: string;
        email: string;
    };
}

// ========================================
// ACTIVIDADES
// ========================================

export type ActivityType =
    | 'client_created'
    | 'client_updated'
    | 'client_status_changed'
    | 'simulation_completed'
    | 'proposal_created'
    | 'proposal_sent'
    | 'proposal_accepted'
    | 'proposal_rejected'
    | 'note_added';

export interface ClientActivity {
    id: string;
    client_id: string;
    agent_id: string;
    franchise_id?: string;
    type: ActivityType;
    description: string;
    metadata?: Record<string, unknown>;
    created_at: string;
}

// ========================================
// TAREAS
// ========================================

export type TaskType = 'manual' | 'follow_up' | 'documentation' | 'contract_signature' | 'welcome_call';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Task {
    id: string;
    client_id?: string;
    proposal_id?: string;
    agent_id: string;
    franchise_id?: string;
    title: string;
    description?: string;
    type: TaskType;
    priority: TaskPriority;
    status: TaskStatus;
    due_date?: string;
    completed_at?: string;
    auto_generated: boolean;
    created_at: string;
    updated_at: string;
    clients?: { id: string; name: string };
    proposals?: { id: string; offer_snapshot: { marketer_name: string } };
}

// ========================================
// DOCUMENTOS
// ========================================

export type DocumentCategory = 'factura' | 'contrato' | 'dni' | 'escritura' | 'otro';

export interface ClientDocument {
    id: string;
    client_id: string;
    agent_id: string;
    franchise_id?: string;
    name: string;
    file_path: string;
    size_bytes: number;
    file_type: string;
    category: DocumentCategory;
    created_at: string;
    updated_at: string;
}

// ========================================
// CONTRATOS
// ========================================

export type ContractType = 'electricidad' | 'gas' | 'dual';
export type ContractStatus = 'active' | 'pending_switch' | 'cancelled' | 'expired';

export interface Contract {
    id: string;
    client_id: string;
    proposal_id?: string;
    agent_id: string;
    franchise_id?: string;
    marketer_name: string;
    tariff_name?: string;
    contract_type: ContractType;
    status: ContractStatus;
    start_date: string;
    end_date?: string;
    notice_date?: string;
    annual_savings?: number;
    monthly_cost_estimate?: number;
    notes?: string;
    created_at: string;
    updated_at: string;
    clients?: { id: string; name: string };
}

export interface ExpiringContract {
    id: string;
    client_id: string;
    client_name: string;
    agent_id: string;
    marketer_name: string;
    tariff_name?: string;
    end_date: string;
    days_remaining: number;
    annual_savings?: number;
}

// ========================================
// ANALYTICS
// ========================================

export interface FunnelStep {
    status: string;
    count: number;
    percentage: number;
}

export interface MonthlyMetric {
    month: string;
    new_clients: number;
    won_clients: number;
    lost_clients: number;
    proposals_sent: number;
    proposals_accepted: number;
    total_savings: number;
}

export interface StatusTransition {
    id: string;
    client_id: string;
    agent_id: string;
    franchise_id?: string;
    from_status?: string;
    to_status: string;
    created_at: string;
}
