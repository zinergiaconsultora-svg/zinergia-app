'use server'

import { createClient } from '@/lib/supabase/server'

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
