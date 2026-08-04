'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

const invitationCodeSchema = z.string().trim().min(8).max(32).regex(/^[A-Z0-9]+$/i)

/**
 * Validates an invitation code publicly (no auth required).
 * Uses service role to bypass RLS — safe because we only return
 * non-sensitive fields needed to render the join form.
 */
export async function validateInvitationCode(
    code: string
): Promise<{ valid: true; emailHint: string; roleLabel: string } | null> {
    const parsedCode = invitationCodeSchema.safeParse(code)
    if (!parsedCode.success) return null

    const supabase = createServiceClient()

    const { data, error } = await supabase
        .from('network_invitations')
        .select('email, role, expires_at')
        .eq('code', parsedCode.data.toUpperCase())
        .eq('used', false)
        .maybeSingle()

    if (error || !data) return null

    // Check expiry only if expires_at is set (null = no expiry)
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null

    const [localPart, domain] = data.email.split('@')
    if (!localPart || !domain) return null
    const roleLabel = data.role === 'agent'
        ? 'Colaborador comercial'
        : data.role === 'franchise'
            ? 'Franquicia'
            : null
    if (!roleLabel) return null

    return {
        valid: true,
        emailHint: `${localPart.slice(0, 1)}***@${domain}`,
        roleLabel,
    }
}
