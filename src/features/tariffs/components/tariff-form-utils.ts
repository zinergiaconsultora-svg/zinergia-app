'use client'

import type { TarifaRow, TariffCommissionRow } from '@/app/actions/tariffs'

export const MODELO_COLORS: Record<string, string> = {
    BASE:  'bg-slate-100 text-slate-700',
    ONE:   'bg-blue-50 text-blue-700',
    SUPRA: 'bg-indigo-50 text-indigo-700',
}

export const SUPPLY_COLORS: Record<string, string> = {
    electricity: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    gas:         'bg-orange-50 text-orange-700 border-orange-200',
}

export const inputCls = 'w-full text-xs bg-slate-50/50 border border-slate-200/60 rounded-xl px-3 py-2 text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all'
export const selectCls = `${inputCls} appearance-none cursor-pointer`

export function fmt(n: number, decimals = 6) {
    return n === 0 ? '—' : n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function fmtEur(n: number) {
    return n === 0 ? '—' : `${n.toFixed(2)} €`
}

export function blankTarifa(supply: 'electricity' | 'gas'): Partial<TarifaRow> {
    return {
        supply_type: supply, company: '', tariff_name: '', tariff_type: supply === 'gas' ? 'RL.1' : '2.0TD',
        modelo: null, tipo_cliente: 'PYME', codigo_producto: '', offer_type: 'fixed',
        contract_duration: '12 meses',
        power_price_p1: 0, power_price_p2: 0, power_price_p3: 0,
        power_price_p4: 0, power_price_p5: 0, power_price_p6: 0,
        energy_price_p1: 0, energy_price_p2: 0, energy_price_p3: 0,
        energy_price_p4: 0, energy_price_p5: 0, energy_price_p6: 0,
        connection_fee: 0, fixed_fee: 0,
        consumption_min_kwh: 0, consumption_max_kwh: 9999999999,
        fixed_annual_fee_gas: 0, variable_price_kwh_gas: 0,
        logo_color: 'bg-slate-600', notes: '', is_active: true,
    }
}

export function blankCommission(): Partial<TariffCommissionRow> {
    return {
        company: '', modelo: null, supply_type: 'electricity', tipo_cliente: 'PYME',
        producto_tipo: 'ELECTRICIDAD_FIJO', consumption_min_mwh: 0, consumption_max_mwh: 9999999999,
        commission_fixed_eur: 0, commission_variable_mwh: 0, servicio: 'LUZ', notes: '', is_active: true,
    }
}
