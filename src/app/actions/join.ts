'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Registers a new user and completes their invitation in a single server action.
 *
 * Uses the admin API (service role) to create the user with email_confirm: true,
 * which bypasses Supabase's email confirmation flow entirely — no confirmation
 * email is sent and no rate limit is hit.
 *
 * Returns the new user's ID so the client can sign in immediately.
 */
export async function registerWithInvitationAction(
    invitationId: string,
    email: string,
    fullName: string,
    password: string
): Promise<{ userId: string }> {
    const service = createServiceClient()

    // Validate the invitation before creating any user
    const { data: invitation, error: invError } = await service
        .from('network_invitations')
        .select('id, email, role, creator_id, used, expires_at')
        .eq('id', invitationId)
        .single()

    if (invError || !invitation) throw new Error('Invitación no encontrada')
    if (invitation.used) throw new Error('Esta invitación ya fue utilizada')
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
        throw new Error('Esta invitación ha expirado. Solicita un nuevo enlace.')
    }
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        throw new Error('El email no coincide con la invitación')
    }

    // Create the user via admin API — email_confirm: true skips confirmation email
    const { data: newUser, error: createError } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
    })

    if (createError) {
        if (createError.message.toLowerCase().includes('already been registered') ||
            createError.message.toLowerCase().includes('already registered') ||
            createError.message.toLowerCase().includes('user already exists')) {
            throw new Error('Este email ya tiene una cuenta registrada.')
        }
        throw new Error(`Error al crear la cuenta: ${createError.message}`)
    }

    const userId = newUser.user.id

    // Resolve creator's franchise_id so the new member inherits it
    const { data: creatorProfile } = await service
        .from('profiles')
        .select('franchise_id')
        .eq('id', invitation.creator_id)
        .single()

    // Update the profile that was auto-created by the trigger
    const { error: profileError } = await service
        .from('profiles')
        .update({
            full_name: fullName,
            role: invitation.role,
            parent_id: invitation.creator_id,
            franchise_id: creatorProfile?.franchise_id ?? null,
        })
        .eq('id', userId)

    if (profileError) throw new Error(`Error al configurar el perfil: ${profileError.message}`)

    // Mark invitation as used
    await service
        .from('network_invitations')
        .update({ used: true })
        .eq('id', invitationId)

    return { userId }
}

/**
 * Validates an invitation code publicly (no auth required).
 * Uses service role to bypass RLS — safe because we only return
 * non-sensitive fields needed to render the join form.
 */
export async function validateInvitationCode(
    code: string
): Promise<{ id: string; email: string; role: string; creator_id: string } | null> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
        .from('network_invitations')
        .select('id, email, role, creator_id, expires_at')
        .eq('code', code)
        .eq('used', false)
        .maybeSingle()

    if (error || !data) return null

    // Check expiry only if expires_at is set (null = no expiry)
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null

    return { id: data.id, email: data.email, role: data.role, creator_id: data.creator_id }
}

/**
 * Completes the invitation signup flow server-side.
 * 
 * Validates the invitation is still valid and unexpired for the authenticated
 * user's email, then sets role + parent_id + franchise_id on their profile
 * and marks the invitation as used.
 *
 * Why server-side: Prevents clients from directly calling
 * supabase.from('profiles').update({ role: 'admin' }) from the browser.
 */
export async function completeInvitationAction(
    invitationId: string,
    fullName: string
): Promise<void> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('No autenticado')

    // Re-validate the invitation server-side (defence-in-depth)
    const { data: invitation, error: invError } = await supabase
        .from('network_invitations')
        .select('id, email, role, creator_id, used, expires_at')
        .eq('id', invitationId)
        .single()

    if (invError || !invitation) throw new Error('Invitación no encontrada')
    if (invitation.used) throw new Error('Esta invitación ya fue utilizada')

    // Validate expiration
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
        throw new Error('Esta invitación ha expirado. Solicita un nuevo enlace.')
    }

    if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
        throw new Error('El email de la invitación no coincide con tu cuenta')
    }

    // Resolve the creator's franchise_id so the new agent inherits it
    const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('franchise_id')
        .eq('id', invitation.creator_id)
        .single()

    // Update profile with validated role, parent, and inherited franchise
    const { error: profileError } = await supabase
        .from('profiles')
        .update({
            full_name: fullName,
            role: invitation.role,
            parent_id: invitation.creator_id,
            franchise_id: creatorProfile?.franchise_id ?? null,
        })
        .eq('id', user.id)

    if (profileError) throw profileError

    // Mark invitation as used
    const { error: markError } = await supabase
        .from('network_invitations')
        .update({ used: true })
        .eq('id', invitationId)

    if (markError) throw markError
}
