// ========================================
// TIPOS ENERGÉTICOS — Consultora
// ========================================

/**
 * Etapa del ciclo energético de un cliente.
 * Se deriva automáticamente de propuestas, contratos y expedientes ATR.
 */
export type EnergyStage =
    | 'lead'              // Sin propuestas todavía
    | 'factura_analizada' // Tiene propuesta en borrador
    | 'propuesta_enviada' // Propuesta enviada al cliente
    | 'firmada'           // Propuesta aceptada
    | 'atr_en_curso'      // Expediente ATR en proceso
    | 'activa'            // Contrato activo
    | 'renovable';        // Contrato próximo a vencer

export interface EnergyStageInfo {
    stage: EnergyStage;
    label: string;
    shortLabel: string;
    color: string;
    dot: string;
    bg: string;
    border: string;
    icon: string;
}

export const ENERGY_STAGES: Record<EnergyStage, EnergyStageInfo> = {
    lead: {
        stage: 'lead',
        label: 'Lead',
        shortLabel: 'Lead',
        color: 'text-slate-600',
        dot: 'bg-slate-400',
        bg: 'bg-slate-50/50',
        border: 'border-slate-200/60',
        icon: 'UserPlus',
    },
    factura_analizada: {
        stage: 'factura_analizada',
        label: 'Factura Analizada',
        shortLabel: 'Factura',
        color: 'text-blue-600',
        dot: 'bg-blue-500',
        bg: 'bg-blue-50/50',
        border: 'border-blue-200/60',
        icon: 'FileSearch',
    },
    propuesta_enviada: {
        stage: 'propuesta_enviada',
        label: 'Propuesta Enviada',
        shortLabel: 'Propuesta',
        color: 'text-amber-600',
        dot: 'bg-amber-500',
        bg: 'bg-amber-50/50',
        border: 'border-amber-200/60',
        icon: 'Send',
    },
    firmada: {
        stage: 'firmada',
        label: 'Firmada',
        shortLabel: 'Firmada',
        color: 'text-violet-600',
        dot: 'bg-violet-500',
        bg: 'bg-violet-50/50',
        border: 'border-violet-200/60',
        icon: 'FileSignature',
    },
    atr_en_curso: {
        stage: 'atr_en_curso',
        label: 'ATR en Curso',
        shortLabel: 'ATR',
        color: 'text-orange-600',
        dot: 'bg-orange-500',
        bg: 'bg-orange-50/50',
        border: 'border-orange-200/60',
        icon: 'ArrowRightLeft',
    },
    activa: {
        stage: 'activa',
        label: 'Contrato Activo',
        shortLabel: 'Activa',
        color: 'text-emerald-600',
        dot: 'bg-emerald-500',
        bg: 'bg-emerald-50/50',
        border: 'border-emerald-200/60',
        icon: 'CheckCircle2',
    },
    renovable: {
        stage: 'renovable',
        label: 'Renovable',
        shortLabel: 'Renovable',
        color: 'text-red-600',
        dot: 'bg-red-500',
        bg: 'bg-red-50/50',
        border: 'border-red-200/60',
        icon: 'RefreshCw',
    },
};

export const ENERGY_PIPELINE_ORDER: EnergyStage[] = [
    'lead',
    'factura_analizada',
    'propuesta_enviada',
    'firmada',
    'atr_en_curso',
    'activa',
    'renovable',
];

export interface ClientEnergyData {
    clientId: string;
    clientName: string;
    phone?: string;
    energyStage: EnergyStage;
    cups?: string;
    currentSupplier?: string;
    averageMonthlyBill?: number;
    lastContactDate?: string;
    updatedAt?: string;
}

// ========================================
// PUNTO DE SUMINISTRO (Multi-CUPS)
// ========================================

export type SupplyType = 'electricity' | 'gas';

export interface SupplyPoint {
    id: string;
    client_id: string;
    cups: string;
    cups_last4?: string;
    supply_type: SupplyType;
    address?: string;
    city?: string;
    zip_code?: string;
    contracted_power?: Record<string, number>;
    current_marketer?: string;
    current_tariff?: string;
    annual_consumption_kwh?: number;
    is_primary: boolean;
    created_at: string;
    updated_at?: string;
}

// ========================================
// CAMBIO DE COMERCIALIZADORA
// ========================================

export type SwitchReason = 'mejor_precio' | 'mejor_servicio' | 'fin_permanencia' | 'insatisfaccion' | 'nuevo_punto' | 'recomendacion';

export interface SwitchEvent {
    id: string;
    client_id: string;
    supply_point_id?: string;
    cups?: string;
    switch_date: string;
    previous_marketer?: string;
    previous_tariff?: string;
    previous_annual_cost?: number;
    new_marketer: string;
    new_tariff?: string;
    new_annual_cost?: number;
    annual_savings?: number;
    reason?: SwitchReason;
    notes?: string;
    proposal_id?: string;
    created_at: string;
}

// ========================================
// PANEL "MI DÍA"
// ========================================

export interface MyDayTask {
    id: string;
    type: 'call' | 'follow_up' | 'atr_sla' | 'renewal' | 'no_proposal' | 'expiring_contract';
    priority: 'critical' | 'high' | 'medium' | 'low';
    client_id: string;
    client_name: string;
    phone?: string;
    title: string;
    subtitle: string;
    cta_label: string;
    cta_href: string;
    due_label: string;
    energy_stage?: EnergyStage;
}
