import { SupervisedRecommendationResult } from '@/lib/supervised/recommender';

export type TariffPeriod = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6';

export interface InvoiceData {
    period_start: string; // ISO Date
    period_end: string;   // ISO Date
    days_involced: number;
    tariff_type: '2.0TD' | '3.0TD' | '6.1TD';
    tariff_determined?: string;
    warnings?: string[];

    // Power (kW)
    contracted_power: Record<TariffPeriod, number>;
    max_demand?: Record<TariffPeriod, number>; // Critical for 3.0TD optimization

    // Energy (kWh)
    energy_consumption: Record<TariffPeriod, number>;

    // Costs (Euros) - Used for "Current Status" analysis
    current_cost_power: number;
    current_cost_energy: number;
    current_cost_reactive: number; // Penalty
    current_cost_rental: number;   // Meter rental
    current_total_tax_excluded: number;
    current_total_amount?: number; // Full invoice total, VAT included when OCR detects it
    bono_social_cost?: number;
    distribution_excess_cost?: number;
    reactive_energy_cost?: number;
    excluded_services_cost?: number;
    surplus_export_kwh?: number;
    electricity_tax_rate?: number;
    vat_rate?: number;
    has_sips_annual_consumption?: boolean;
    annual_consumption_mwh?: number;

    // Detected "Bad" Services
    extra_services?: {
        name: string;
        cost: number;
    }[];
}

export interface TariffCandidate {
    id: string;
    name: string;
    company: string;
    type: 'fixed' | 'indexed';
    tariff_type?: '2.0TD' | '3.0TD' | '6.1TD' | string;
    logo_color?: string;
    permanence_months: number;

    // Prices
    power_price: Record<TariffPeriod, number>; // €/kW/day
    energy_price: Record<TariffPeriod, number>; // €/kWh
    fixed_fee: number; // €/month
    surplus_compensation_price?: number; // €/kWh for autoconsumo excedentes
    modelo?: string | null;
    estimated_agent_commission?: number | null;
    commission_source?: 'tariff_commissions' | 'missing';
}

export interface AuditOpportunity {
    type: 'REACTIVE_COMPENSATION' | 'POWER_OPTIMIZATION' | 'TARIFF_SAVING';
    title: string;
    description: string;
    annual_savings: number;
    investment_cost?: number; // e.g. Capacitor Bank cost
    roi_months?: number;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    message?: string;
}

export interface OptimizationRecommendation {
    type: 'POWER_OPTIMIZATION' | 'ENERGY_SHIFT' | 'TARIFF_RECOMMENDATION' | 'EFFICIENCY_AUDIT' | 'SOLAR_EVALUATION';
    title: string;
    description: string;
    annual_savings: number;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    details?: Record<string, unknown>[];
    action_items?: string[];
}

export interface ClientProfile {
    tags: string[]; // e.g. "NIGHT_OWL", "WEEKEND_WARRIOR", "FLAT_CONSUMER"
    sales_argument: string; // Human readable "script" for the agent
}

export interface SimulationResult {
    tariff_id: string;
    tariff_name: string;
    company: string;
    candidate: TariffCandidate; // Full snapshot for proposal logging
    annual_cost_total: number;
    annual_cost_power: number;
    annual_cost_energy: number;
    annual_savings: number;
    score: number; // Weighted score (savings - permanence_penalty)
    is_best_value: boolean;
    invoice_simulation?: import('@/lib/comparison/invoice-simulator').InvoiceSimulationResult;
}

export interface AletheiaResult {
    analysis_meta: {
        invoice_days: number;
        projected_annual_kwh: number;
        seasonality_factor_applied: number; // e.g. 1.05 (Jan is heavier)
    };
    current_status: {
        annual_projected_cost: number;
        avg_price_kwh: number;
        inefficiencies_detected: string[]; // "Reactiva", "Exceso Potencia", "Mantenimiento"
    };
    opportunities: AuditOpportunity[];
    optimization_recommendations: OptimizationRecommendation[]; // New field
    client_profile: ClientProfile;
    top_proposals: SimulationResult[];
    supervised_recommendation?: SupervisedRecommendationResult;
}
