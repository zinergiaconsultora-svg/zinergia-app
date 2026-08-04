'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireServerRole } from '@/lib/auth/permissions'
import { z } from 'zod'
import { updateOwnProfileCommand } from '@/lib/profile-authority/commands'
import { ownProfileInputSchema, type OwnProfileInput } from '@/lib/profile-authority/schemas'

interface ProfileSettingsInput {
    companyName: string;
    nif: string;
    address: string;
    defaultMargin: number;
    defaultVat: number;
}

const profileSettingsSchema = z.object({
    companyName: z.string().trim().min(1).max(200),
    nif: z.string().trim().max(40),
    address: z.string().trim().max(500),
    defaultMargin: z.coerce.number().min(0).max(100),
    defaultVat: z.coerce.number().min(0).max(100),
});

const agentProfileSchema = z.strictObject({
    full_name: z.string().trim().min(1).max(200),
    phone: z.string().trim().max(40).optional().or(z.literal('')),
});

type ProfileActionResult =
    | { success: true; data: null }
    | { success: false; error: string };

async function getAuthenticatedUserId() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return user.id
}

export async function updateOwnProfileAction(input: OwnProfileInput): Promise<ProfileActionResult> {
    const parsed = ownProfileInputSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: 'Los datos del perfil no son válidos.' }
    }

    await requireServerRole(['admin', 'franchise', 'agent'])
    const actorId = await getAuthenticatedUserId()
    if (!actorId) return { success: false, error: 'No se pudo actualizar el perfil.' }

    const { error } = await updateOwnProfileCommand(actorId, parsed.data)
    if (error) return { success: false, error: 'No se pudo actualizar el perfil.' }

    revalidatePath('/dashboard', 'layout')
    revalidatePath('/dashboard/settings')
    return { success: true, data: null }
}

export async function saveProfileSettingsAction(input: ProfileSettingsInput): Promise<void> {
    await requireServerRole(['admin', 'franchise', 'agent'])

    const clean = profileSettingsSchema.parse(input)
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) throw new Error('No autenticado')

    // Upsert franchise_config with fiscal/commercial data
    const { error: configError } = await supabase
        .from('franchise_config')
        .upsert(
            {
                owner_id: user.id,
                company_name: clean.companyName,
                nif: clean.nif,
                address: clean.address,
                default_margin: clean.defaultMargin,
                default_vat: clean.defaultVat,
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
    await requireServerRole(['admin', 'franchise', 'agent'])
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
    await requireServerRole(['admin', 'franchise', 'agent'])

    const clean = agentProfileSchema.parse(input)
    const actorId = await getAuthenticatedUserId()
    if (!actorId) throw new Error('No autenticado')

    const { error } = await updateOwnProfileCommand(actorId, {
        fullName: clean.full_name,
        phone: clean.phone ?? '',
    })

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
