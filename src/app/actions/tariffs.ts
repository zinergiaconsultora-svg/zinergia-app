'use server'

import { createClient } from '@/lib/supabase/server'
import { requireServerRole } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TarifaRow {
    id: string
    company: string
    tariff_name: string
    tariff_type: string | null
    supply_type: 'electricity' | 'gas'
    modelo: string | null
    tipo_cliente: 'PYME' | 'RESIDENCIAL' | 'GRAN_CUENTA'
    codigo_producto: string | null
    offer_type: 'fixed' | 'indexed'
    contract_duration: string
    power_price_p1: number; power_price_p2: number; power_price_p3: number
    power_price_p4: number; power_price_p5: number; power_price_p6: number
    energy_price_p1: number; energy_price_p2: number; energy_price_p3: number
    energy_price_p4: number; energy_price_p5: number; energy_price_p6: number
    connection_fee: number
    fixed_fee: number
    consumption_min_kwh: number
    consumption_max_kwh: number
    fixed_annual_fee_gas: number
    variable_price_kwh_gas: number
    logo_color: string | null
    notes: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface TariffCommissionRow {
    id: string
    company: string
    modelo: string | null
    supply_type: 'electricity' | 'gas'
    tipo_cliente: 'PYME' | 'RESIDENCIAL' | 'GRAN_CUENTA'
    producto_tipo: string | null
    consumption_min_mwh: number
    consumption_max_mwh: number
    commission_fixed_eur: number
    commission_variable_mwh: number
    servicio: string | null
    notes: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

// ─── Tariffs ─────────────────────────────────────────────────────────────────

export async function getTarifas(supplyType?: 'electricity' | 'gas', activeOnly = false): Promise<TarifaRow[]> {
    const supabase = await createClient()
    let query = supabase
        .from('lv_zinergia_tarifas')
        .select('*')
        .order('company', { ascending: true })
        .order('tariff_name', { ascending: true })

    if (supplyType) query = query.eq('supply_type', supplyType)
    if (activeOnly) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as TarifaRow[]
}

export async function upsertTarifa(data: Partial<TarifaRow>): Promise<TarifaRow> {
    await requireServerRole(['admin'])

    const supabase = await createClient()
    const payload = { ...data, updated_at: new Date().toISOString() }
    delete (payload as Partial<TarifaRow>).created_at

    const { data: row, error } = data.id
        ? await supabase.from('lv_zinergia_tarifas').update(payload).eq('id', data.id).select().single()
        : await supabase.from('lv_zinergia_tarifas').insert(payload).select().single()

    if (error) throw error
    revalidatePath('/dashboard/tariffs')
    return row as TarifaRow
}

export async function toggleTarifaActive(id: string, isActive: boolean): Promise<void> {
    await requireServerRole(['admin'])
    const supabase = await createClient()
    const { error } = await supabase
        .from('lv_zinergia_tarifas')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id)
    if (error) throw error
    revalidatePath('/dashboard/tariffs')
}

export async function deleteTarifa(id: string): Promise<void> {
    await requireServerRole(['admin'])
    const supabase = await createClient()
    const { error } = await supabase.from('lv_zinergia_tarifas').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/dashboard/tariffs')
}

// ─── Commissions ─────────────────────────────────────────────────────────────

export async function getTariffCommissions(): Promise<TariffCommissionRow[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('tariff_commissions')
        .select('*')
        .order('company', { ascending: true })
        .order('modelo', { ascending: true })
        .order('consumption_min_mwh', { ascending: true })
    if (error) throw error
    return (data ?? []) as TariffCommissionRow[]
}

export async function upsertTariffCommission(data: Partial<TariffCommissionRow>): Promise<TariffCommissionRow> {
    await requireServerRole(['admin'])
    const supabase = await createClient()
    const payload = { ...data, updated_at: new Date().toISOString() }
    delete (payload as Partial<TariffCommissionRow>).created_at

    const { data: row, error } = data.id
        ? await supabase.from('tariff_commissions').update(payload).eq('id', data.id).select().single()
        : await supabase.from('tariff_commissions').insert(payload).select().single()

    if (error) throw error
    revalidatePath('/dashboard/tariffs')
    return row as TariffCommissionRow
}

export async function deleteTariffCommission(id: string): Promise<void> {
    await requireServerRole(['admin'])
    const supabase = await createClient()
    const { error } = await supabase.from('tariff_commissions').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/dashboard/tariffs')
}

// ─── Collaborator % ──────────────────────────────────────────────────────────

export async function getCollaboratorPct(): Promise<number> {
    const supabase = await createClient()
    const { data } = await supabase
        .from('commission_rules')
        .select('collaborator_pct')
        .eq('is_active', true)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle()
    return data?.collaborator_pct ?? 0.5
}

export async function saveCollaboratorPct(pct: number): Promise<void> {
    await requireServerRole(['admin'])
    if (pct < 0 || pct > 1) throw new Error('El porcentaje debe estar entre 0 y 100')
    const supabase = await createClient()
    const { error } = await supabase
        .from('commission_rules')
        .update({ collaborator_pct: pct })
        .eq('is_active', true)
    if (error) throw error
    revalidatePath('/dashboard/tariffs')
}
