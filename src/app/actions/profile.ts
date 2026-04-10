'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ProfileSettingsInput {
    companyName: string;
    nif: string;
    address: string;
    defaultMargin: number;
    defaultVat: number;
}

export async function saveProfileSettingsAction(input: ProfileSettingsInput): Promise<void> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) throw new Error('No autenticado')

    // Update profile full_name
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: input.companyName })
        .eq('id', user.id)

    if (profileError) throw profileError

    // Upsert franchise_config with fiscal/commercial data
    const { error: configError } = await supabase
        .from('franchise_config')
        .upsert(
            {
                owner_id: user.id,
                company_name: input.companyName,
                nif: input.nif,
                address: input.address,
                default_margin: input.defaultMargin,
                default_vat: input.defaultVat,
            },
            { onConflict: 'owner_id' }
        )

    if (configError) throw configError
    revalidatePath('/dashboard/settings')
}

export interface ProfileSettings {
    companyName: string;
    nif: string;
    address: string;
    defaultMargin: number;
    defaultVat: number;
}

// ── Agent profile (used by onboarding wizard) ─────────────────────────────

export interface AgentProfile {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
}

export async function getAgentProfileAction(): Promise<AgentProfile | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role')
        .eq('id', user.id)
        .maybeSingle()

    return data ?? null
}

export async function updateAgentProfileAction(input: {
    full_name: string;
    phone?: string;
}): Promise<void> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { error } = await supabase
        .from('profiles')
        .update({ full_name: input.full_name, phone: input.phone ?? null })
        .eq('id', user.id)

    if (error) throw error
    revalidatePath('/dashboard', 'layout')
}

export async function getProfileSettingsAction(): Promise<ProfileSettings> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('No autenticado')

    const { data } = await supabase
        .from('franchise_config')
        .select('company_name, nif, address, default_margin, default_vat')
        .eq('owner_id', user.id)
        .maybeSingle()

    return {
        companyName: data?.company_name ?? '',
        nif: data?.nif ?? '',
        address: data?.address ?? '',
        defaultMargin: data?.default_margin ?? 2.5,
        defaultVat: data?.default_vat ?? 21,
    }
}
