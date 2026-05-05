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
    if (error) throw new Error('Error al cargar las tarifas')
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

    if (error) throw new Error('Error al guardar la tarifa')
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
    if (error) throw new Error('Error al cambiar el estado de la tarifa')
    revalidatePath('/dashboard/tariffs')
}

export async function deleteTarifa(id: string): Promise<void> {
    await requireServerRole(['admin'])
    const supabase = await createClient()
    const { error } = await supabase.from('lv_zinergia_tarifas').delete().eq('id', id)
    if (error) throw new Error('Error al eliminar la tarifa')
    revalidatePath('/dashboard/tariffs')
}

// ─── Bulk Excel import ───────────────────────────────────────────────────────

export interface BulkUpsertResult {
    upserted: number
    errors: string[]
}

export async function bulkUpsertTarifasAction(
    rows: Array<Partial<TarifaRow>>,
    supplyType: 'electricity' | 'gas'
): Promise<BulkUpsertResult> {
    await requireServerRole(['admin'])

    if (!Array.isArray(rows) || rows.length === 0) throw new Error('No hay filas para importar')
    if (rows.length > 300) throw new Error('Máximo 300 tarifas por importación')

    const supabase = await createClient()
    const errors: string[] = []
    const toUpsert: object[] = []
    const now = new Date().toISOString()

    rows.forEach((row, idx) => {
        const rowNum = idx + 2
        if (!row.company?.trim()) { errors.push(`Fila ${rowNum}: falta compañía`); return }
        if (!row.tariff_name?.trim()) { errors.push(`Fila ${rowNum}: falta nombre de tarifa`); return }
        toUpsert.push({
            company: row.company.trim(),
            tariff_name: row.tariff_name.trim(),
            tariff_type: row.tariff_type ?? null,
            supply_type: supplyType,
            modelo: row.modelo ?? null,
            tipo_cliente: row.tipo_cliente ?? 'PYME',
            offer_type: row.offer_type ?? 'fixed',
            contract_duration: row.contract_duration ?? '12 meses',
            power_price_p1: Number(row.power_price_p1) || 0,
            power_price_p2: Number(row.power_price_p2) || 0,
            power_price_p3: Number(row.power_price_p3) || 0,
            power_price_p4: Number(row.power_price_p4) || 0,
            power_price_p5: Number(row.power_price_p5) || 0,
            power_price_p6: Number(row.power_price_p6) || 0,
            energy_price_p1: Number(row.energy_price_p1) || 0,
            energy_price_p2: Number(row.energy_price_p2) || 0,
            energy_price_p3: Number(row.energy_price_p3) || 0,
            energy_price_p4: Number(row.energy_price_p4) || 0,
            energy_price_p5: Number(row.energy_price_p5) || 0,
            energy_price_p6: Number(row.energy_price_p6) || 0,
            connection_fee: Number(row.connection_fee) || 0,
            fixed_fee: Number(row.fixed_fee) || 0,
            consumption_min_kwh: Number(row.consumption_min_kwh) || 0,
            consumption_max_kwh: Number(row.consumption_max_kwh) || 999999,
            fixed_annual_fee_gas: Number(row.fixed_annual_fee_gas) || 0,
            variable_price_kwh_gas: Number(row.variable_price_kwh_gas) || 0,
            notes: row.notes ?? null,
            is_active: row.is_active !== false,
            updated_at: now,
        })
    })

    let upserted = 0
    if (toUpsert.length > 0) {
        const { data, error } = await supabase
            .from('lv_zinergia_tarifas')
            .upsert(toUpsert, { onConflict: 'company,tariff_name,supply_type', ignoreDuplicates: false })
            .select('id')
        if (error) throw new Error(`Error importando tarifas: ${error.message}`)
        upserted = data?.length ?? 0
    }

    revalidatePath('/dashboard/tariffs')
    return { upserted, errors }
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
    if (error) throw new Error('Error al cargar las comisiones')
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

    if (error) throw new Error('Error al guardar la comisión')
    revalidatePath('/dashboard/tariffs')
    return row as TariffCommissionRow
}

export async function deleteTariffCommission(id: string): Promise<void> {
    await requireServerRole(['admin'])
    const supabase = await createClient()
    const { error } = await supabase.from('tariff_commissions').delete().eq('id', id)
    if (error) throw new Error('Error al eliminar la comisión')
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
    if (error) throw new Error('Error al guardar el porcentaje de colaborador')
    revalidatePath('/dashboard/tariffs')
}
