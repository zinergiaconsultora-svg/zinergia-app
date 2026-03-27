'use server'

import { createClient } from '@/lib/supabase/server'
import { requireServerRole } from '@/lib/auth/permissions'
import { BillingCycle, WalletBalance, Commission } from '@/types/crm'

/**
 * Cierra el ciclo mensual de una franquicia.
 * Flujo atómico:
 * 1. Verifica que no existe un ciclo 'closed' para ese mes (idempotencia).
 * 2. Selecciona todas las comisiones 'cleared' del mes.
 * 3. Crea el snapshot inmutable en billing_cycles.
 * 4. Marca las comisiones como 'paid' y las vincula al ciclo.
 * 5. Registra en audit_logs.
 */
export async function closeMonthlyBilling(
    franchiseId: string,
    monthYear: string
): Promise<BillingCycle> {
    await requireServerRole(['admin', 'franchise'])
    const supabase = await createClient()

    // Validar formato mes
    if (!/^\d{4}-\d{2}$/.test(monthYear)) {
        throw new Error(`Formato de mes inválido: ${monthYear}. Esperado: YYYY-MM`)
    }

    // 1. Verificar idempotencia: ¿ya existe un ciclo closed?
    const { data: existing } = await supabase
        .from('billing_cycles')
        .select('id, status')
        .eq('franchise_id', franchiseId)
        .eq('month_year', monthYear)
        .maybeSingle()

    if (existing?.status === 'closed') {
        throw new Error(`El ciclo ${monthYear} ya está cerrado para esta franquicia.`)
    }

    // 2. Recoger comisiones cleared del mes
    const monthStart = `${monthYear}-01T00:00:00Z`
    const nextMonth = incrementMonth(monthYear)
    const monthEnd = `${nextMonth}-01T00:00:00Z`

    const { data: commissions, error: fetchError } = await supabase
        .from('network_commissions')
        .select('*')
        .eq('franchise_id', franchiseId)
        .eq('status', 'cleared')
        .gte('created_at', monthStart)
        .lt('created_at', monthEnd)

    if (fetchError) throw fetchError

    const clearedCommissions = (commissions || []) as Commission[]
    const totalCommissions = clearedCommissions.reduce(
        (sum, c) => sum + (c.franchise_profit || 0), 0
    )

    // 3. Crear o actualizar el ciclo con snapshot
    const cyclePayload = {
        franchise_id: franchiseId,
        month_year: monthYear,
        status: 'closed' as const,
        total_commissions: totalCommissions,
        total_proposals: clearedCommissions.length,
        snapshot_data: clearedCommissions,
        closed_at: new Date().toISOString(),
    }

    let cycle: BillingCycle

    if (existing) {
        // Actualizar ciclo existente (ej: estaba 'open' o 'voided')
        const { data, error } = await supabase
            .from('billing_cycles')
            .update(cyclePayload)
            .eq('id', existing.id)
            .select()
            .single()
        if (error) throw error
        cycle = data as BillingCycle
    } else {
        // Crear nuevo ciclo
        const { data, error } = await supabase
            .from('billing_cycles')
            .insert(cyclePayload)
            .select()
            .single()
        if (error) throw error
        cycle = data as BillingCycle
    }

    // 4. Marcar comisiones como paid y vincular al ciclo
    if (clearedCommissions.length > 0) {
        const commissionIds = clearedCommissions.map(c => c.id)
        const { error: updateError } = await supabase
            .from('network_commissions')
            .update({
                status: 'paid',
                billing_cycle_id: cycle.id,
                paid_date: new Date().toISOString().split('T')[0],
            })
            .in('id', commissionIds)

        if (updateError) throw updateError
    }

    // 5. Audit log
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'close_billing_cycle',
            table_name: 'billing_cycles',
            record_id: cycle.id,
            new_data: {
                month_year: monthYear,
                total_commissions: totalCommissions,
                total_proposals: clearedCommissions.length,
            },
        })
    }

    return cycle
}

/**
 * Revierte un cierre mensual (marca como 'voided').
 * Las comisiones vuelven a estado 'cleared' para poder re-procesarlas.
 */
export async function voidBillingCycle(cycleId: string): Promise<BillingCycle> {
    await requireServerRole(['admin'])
    const supabase = await createClient()

    // 1. Verificar que el ciclo existe y está cerrado
    const { data: cycle, error: fetchError } = await supabase
        .from('billing_cycles')
        .select('*')
        .eq('id', cycleId)
        .single()

    if (fetchError || !cycle) throw new Error('Ciclo no encontrado')
    if (cycle.status !== 'closed') throw new Error(`No se puede anular un ciclo en estado '${cycle.status}'`)

    // 2. Revertir comisiones a 'cleared'
    const { error: revertError } = await supabase
        .from('network_commissions')
        .update({ status: 'cleared', billing_cycle_id: null, paid_date: null })
        .eq('billing_cycle_id', cycleId)

    if (revertError) throw revertError

    // 3. Marcar ciclo como voided
    const { data: voided, error: voidError } = await supabase
        .from('billing_cycles')
        .update({ status: 'voided' })
        .eq('id', cycleId)
        .select()
        .single()

    if (voidError) throw voidError

    // 4. Audit log
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'void_billing_cycle',
            table_name: 'billing_cycles',
            record_id: cycleId,
            old_data: { status: 'closed', month_year: cycle.month_year },
            new_data: { status: 'voided' },
        })
    }

    return voided as BillingCycle
}

/**
 * Obtiene el balance del wallet de una franquicia desde la vista SQL.
 */
export async function getWalletBalance(franchiseId: string): Promise<WalletBalance> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('franchise_wallet')
        .select('*')
        .eq('franchise_id', franchiseId)
        .maybeSingle()

    if (error) throw error

    // Si no hay comisiones aún, retornar balance vacío
    if (!data) {
        return {
            franchise_id: franchiseId,
            balance_available: 0,
            balance_paid: 0,
            balance_pending: 0,
            total_earned: 0,
            proposals_cleared: 0,
            proposals_paid: 0,
            proposals_pending: 0,
        }
    }

    return data as WalletBalance
}

/**
 * Historial de ciclos de facturación de una franquicia.
 */
export async function getBillingHistory(franchiseId: string): Promise<BillingCycle[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('billing_cycles')
        .select('*')
        .eq('franchise_id', franchiseId)
        .order('month_year', { ascending: false })

    if (error) throw error
    return (data || []) as BillingCycle[]
}

/**
 * Incrementa un mes en formato 'YYYY-MM'.
 * '2026-03' → '2026-04', '2026-12' → '2027-01'
 */
function incrementMonth(monthYear: string): string {
    const [yearStr, monthStr] = monthYear.split('-')
    let year = parseInt(yearStr, 10)
    let month = parseInt(monthStr, 10)

    month += 1
    if (month > 12) {
        month = 1
        year += 1
    }

    return `${year}-${month.toString().padStart(2, '0')}`
}
