'use server'

import { createClient } from '@/lib/supabase/server'
import { requireServerRole } from '@/lib/auth/permissions'
import { CommissionRule } from '@/types/crm'

// Hardcoded fallback used when the commission_rules table doesn't exist yet
// or has no active rule. Matches the seeded default.
export const DEFAULT_COMMISSION_RULE: Omit<CommissionRule, 'id' | 'created_at' | 'effective_from'> = {
    name: 'Regla por defecto',
    commission_rate: 0.15,
    agent_share: 0.30,
    franchise_share: 0.50,
    hq_share: 0.20,
    points_per_win: 50,
    is_active: true,
}

/**
 * Returns the currently active commission rule.
 * Falls back to DEFAULT_COMMISSION_RULE if no rule exists in DB.
 * Safe to call from any Server Action — no role check required (read-only).
 */
export async function getActiveCommissionRule(): Promise<typeof DEFAULT_COMMISSION_RULE & { id?: string }> {
    try {
        const supabase = await createClient()
        const { data } = await supabase
            .from('commission_rules')
            .select('*')
            .eq('is_active', true)
            .order('effective_from', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (data) return data as CommissionRule
    } catch {
        // Table may not exist yet — use defaults silently
    }
    return DEFAULT_COMMISSION_RULE
}

/**
 * Returns all commission rules (history), ordered by most recent.
 * Admin/franchise only.
 */
export async function getCommissionRules(): Promise<CommissionRule[]> {
    await requireServerRole(['admin', 'franchise'])
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('commission_rules')
        .select('*')
        .order('effective_from', { ascending: false })

    if (error) throw error
    return (data || []) as CommissionRule[]
}

/**
 * Saves a new commission rule and deactivates all previous ones.
 * Admin/franchise only.
 */
export async function saveCommissionRule(
    rule: Pick<CommissionRule, 'name' | 'commission_rate' | 'agent_share' | 'franchise_share' | 'hq_share' | 'points_per_win'>
): Promise<CommissionRule> {
    await requireServerRole(['admin', 'franchise'])

    const total = rule.agent_share + rule.franchise_share + rule.hq_share
    if (Math.abs(total - 1) > 0.001) {
        throw new Error(`Los porcentajes deben sumar 100%. Suma actual: ${(total * 100).toFixed(1)}%`)
    }
    if (rule.commission_rate <= 0 || rule.commission_rate > 1) {
        throw new Error('El porcentaje sobre el ahorro debe estar entre 1% y 100%')
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Deactivate all existing active rules
    await supabase
        .from('commission_rules')
        .update({ is_active: false })
        .eq('is_active', true)

    // Insert new active rule
    const { data, error } = await supabase
        .from('commission_rules')
        .insert({
            ...rule,
            is_active: true,
            effective_from: new Date().toISOString(),
            created_by: user?.id,
        })
        .select()
        .single()

    if (error) throw error
    return data as CommissionRule
}
