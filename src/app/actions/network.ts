'use server'

import { logger } from '@/lib/utils/logger'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getTrustedActorProfile, requireServerRole } from '@/lib/auth/permissions'
import { resend } from '@/lib/resend'
import { z } from 'zod'
import { changeProfileAuthorityCommand, updateTeamMemberNameCommand } from '@/lib/profile-authority/commands'
import { teamMemberNameInputSchema } from '@/lib/profile-authority/schemas'
import { getProfileAuthoritySnapshot } from '@/lib/profile-authority/authoritySnapshot'

// ─── Types ────────────────────────────────────────────────────────────

interface CreateInvitationResult {
    invitationId: string
    code: string
    inviteUrl: string
    emailSent: boolean
}

type InvitationActionResult =
    | { success: true; data: CreateInvitationResult }
    | { success: false; error: string }

const createInvitationSchema = z.object({
    email: z.string().trim().email().max(200).transform((value) => value.toLowerCase()),
    role: z.enum(['agent', 'franchise']),
    targetFranchiseId: z.uuid().optional(),
}).strict()

export type InvitationCreationContext =
    | {
        role: 'admin'
        activeFranchises: Array<{ id: string; name: string }>
    }
    | {
        role: 'franchise'
        activeFranchises: []
    }

export async function getInvitationCreationContextAction(): Promise<
    | { success: true; data: InvitationCreationContext }
    | { success: false; error: string }
> {
    try {
        await requireServerRole(['admin', 'franchise'])
        const actor = await getTrustedActorProfile()
        if (actor.role === 'franchise') {
            return { success: true, data: { role: 'franchise', activeFranchises: [] } }
        }
        if (actor.role !== 'admin') {
            return { success: false, error: 'No puedes crear invitaciones con esta cuenta.' }
        }

        const service = createServiceClient()
        const { data, error } = await service
            .from('franchises')
            .select('id, name')
            .eq('is_active', true)
            .order('name')
        if (error) {
            return { success: false, error: 'No se pudieron cargar las franquicias activas.' }
        }
        return {
            success: true,
            data: {
                role: 'admin',
                activeFranchises: (data ?? []).map((item) => ({ id: item.id, name: item.name })),
            },
        }
    } catch {
        return { success: false, error: 'No puedes crear invitaciones con esta cuenta.' }
    }
}

// ─── Server Actions ───────────────────────────────────────────────────

/**
 * Creates a network invitation with role validation and sends email notification.
 * 
 * Security: Only admin and franchise roles can create invitations.
 * Constraint: The CHECK constraint on the DB prevents role escalation to 'admin'.
 * Email: Automatically sends an invitation email via Resend.
 */
export async function createInvitationAction(
    inputOrEmail: { email: string; role: 'agent' | 'franchise'; targetFranchiseId?: string } | string,
    legacyRole?: 'agent' | 'franchise'
): Promise<InvitationActionResult> {
    const parsed = createInvitationSchema.safeParse(
        typeof inputOrEmail === 'string'
            ? { email: inputOrEmail, role: legacyRole }
            : inputOrEmail,
    )
    if (!parsed.success) {
        const attemptedRole: unknown = typeof inputOrEmail === 'object'
            ? (inputOrEmail as { role?: unknown }).role
            : legacyRole
        return {
            success: false,
            error: attemptedRole === 'admin'
                ? 'El tipo de invitación no es válido.'
                : 'Revisa los datos de la invitación.',
        }
    }

    await requireServerRole(['admin', 'franchise'])

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No puedes crear invitaciones con esta cuenta.' }

    const service = createServiceClient()

    const { data: creatorProfile } = await service
        .from('profiles')
        .select('id, full_name, role, parent_id, franchise_id')
        .eq('id', user.id)
        .maybeSingle()

    if (!creatorProfile) {
        return { success: false, error: 'No puedes crear invitaciones con esta cuenta.' }
    }

    let targetFranchiseId: string | null = null
    if (
        creatorProfile.role === 'admin'
        && creatorProfile.parent_id === null
        && creatorProfile.franchise_id === null
    ) {
        if (!parsed.data.targetFranchiseId) {
            return { success: false, error: 'Selecciona una franquicia activa.' }
        }
        targetFranchiseId = parsed.data.targetFranchiseId
    } else if (
        creatorProfile.role === 'franchise'
        && creatorProfile.parent_id
        && creatorProfile.franchise_id
    ) {
        if (parsed.data.role !== 'agent') {
            return { success: false, error: 'Una franquicia solo puede invitar colaboradores.' }
        }
        targetFranchiseId = creatorProfile.franchise_id
    } else {
        return { success: false, error: 'No puedes crear invitaciones con esta cuenta.' }
    }

    const { data: activeFranchise } = await service
        .from('franchises')
        .select('id, is_active')
        .eq('id', targetFranchiseId)
        .eq('is_active', true)
        .maybeSingle()
    if (!activeFranchise || activeFranchise.is_active !== true) {
        return creatorProfile.role === 'admin'
            ? { success: false, error: 'Selecciona una franquicia activa.' }
            : { success: false, error: 'No puedes crear invitaciones con esta cuenta.' }
    }

    const code = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()
    const invitationId = crypto.randomUUID()

    const { error: insertError } = await service
        .from('network_invitations')
        .insert({
            id: invitationId,
            creator_id: user.id,
            email: parsed.data.email,
            role: parsed.data.role,
            code,
            target_franchise_id: creatorProfile.role === 'admin' ? targetFranchiseId : null,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })

    if (insertError) {
        return { success: false, error: 'No se pudo crear la invitación.' }
    }

    // Build the invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zinergia.vercel.app'
    const inviteUrl = `${baseUrl}/join/${code}`

    // Send email notification
    let emailSent = false
    try {
        emailSent = await sendInvitationEmail({
            to: parsed.data.email,
            inviteUrl,
            role: parsed.data.role,
            inviterName: creatorProfile?.full_name ?? 'Zinergia',
        })
    } catch {
        // The durable invitation remains usable; never include recipient data in telemetry.
        logger.error('[createInvitationAction] Email delivery failed')
    }

    return { success: true, data: { invitationId, code, inviteUrl, emailSent } }
}

// ─── Update User ─────────────────────────────────────────────────────

/**
 * Updates basic profile info for a network user.
 * Only admin and franchise roles can update other users' profiles.
 */
export async function updateNetworkUserAction(
    userId: string,
    updates: { full_name?: string; email?: string }
): Promise<{ success: true; data: null } | { success: false; error: string }> {
    if (updates.email !== undefined) {
        return { success: false, error: 'El email no se puede editar desde la red.' }
    }
    if (typeof updates.full_name !== 'string') {
        return { success: false, error: 'La corrección de nombre no es válida.' }
    }
    return updateTeamMemberNameAction({ targetId: userId, fullName: updates.full_name })
}

export async function updateTeamMemberNameAction(
    input: { targetId: string; fullName: string },
): Promise<{ success: true; data: null } | { success: false; error: string }> {
    const parsed = teamMemberNameInputSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: 'La corrección de nombre no es válida.' }
    }

    await requireServerRole(['admin', 'franchise'])
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'No se pudo actualizar el nombre.' }
    }

    const { error } = await updateTeamMemberNameCommand(user.id, parsed.data)
    if (error) {
        return { success: false, error: 'No se pudo actualizar el nombre.' }
    }

    return { success: true, data: null }
}

// ─── Delete / Deactivate User ────────────────────────────────────────

/**
 * Permanently deletes a user's auth account and profile.
 * Only admin can delete. Cannot delete yourself.
 */
export async function deleteProfileAction(userId: string): Promise<void> {
    await requireServerRole(['admin'])

    const supabase = await createClient()
    const { data: { user: me } } = await supabase.auth.getUser()
    if (me?.id === userId) throw new Error('No puedes eliminar tu propia cuenta')

    // Use service role to delete the auth user (cascades to profile via FK)
    const service = createServiceClient()
    const { error } = await service.auth.admin.deleteUser(userId)
    if (error) throw new Error(`Error al eliminar el usuario: ${error.message}`)
}

/**
 * Deactivates a user by removing their role (keeps data intact).
 * Only admin can deactivate.
 */
export async function deactivateProfileAction(
    userId: string,
): Promise<{ success: true; data: { eventId: string } } | { success: false; error: string }> {
    await requireServerRole(['admin'])

    const supabase = await createClient()
    const { data: { user: me }, error: authError } = await supabase.auth.getUser()
    const target = await getProfileAuthoritySnapshot(userId)
    if (authError || !me || me.id === userId || !target) {
        return { success: false, error: 'No se pudo desactivar el perfil.' }
    }

    const result = await changeProfileAuthorityCommand(me.id, {
        targetId: target.id,
        desiredRole: null,
        parentId: null,
        franchiseId: null,
        expectedAuthorityVersion: target.authority_version,
        reasonCode: 'deactivation',
        requestId: crypto.randomUUID(),
    })
    return mapLegacyAuthorityResult(result.data, result.error)
}

/**
 * Reactivates a previously deactivated user by restoring their role.
 * Only admin can reactivate.
 */
export async function reactivateProfileAction(
    userId: string,
    authority: {
        desiredRole: 'agent' | 'franchise'
        parentId: string
        franchiseId: string
    } | 'agent' | 'franchise'
): Promise<{ success: true; data: { eventId: string } } | { success: false; error: string }> {
    const parsed = z.strictObject({
        desiredRole: z.enum(['agent', 'franchise']),
        parentId: z.uuid(),
        franchiseId: z.uuid(),
    }).safeParse(authority)
    if (!parsed.success) {
        return { success: false, error: 'La reactivación requiere una autoridad completa.' }
    }

    await requireServerRole(['admin'])
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    const target = await getProfileAuthoritySnapshot(userId)
    if (authError || !user || !target) {
        return { success: false, error: 'No se pudo reactivar el perfil.' }
    }

    const result = await changeProfileAuthorityCommand(user.id, {
        targetId: target.id,
        desiredRole: parsed.data.desiredRole,
        parentId: parsed.data.parentId,
        franchiseId: parsed.data.franchiseId,
        expectedAuthorityVersion: target.authority_version,
        reasonCode: 'reactivation',
        requestId: crypto.randomUUID(),
    })
    return mapLegacyAuthorityResult(result.data, result.error)
}

function mapLegacyAuthorityResult(
    data: unknown,
    error: { message?: string } | null,
): { success: true; data: { eventId: string } } | { success: false; error: string } {
    if (error) {
        return { success: false, error: 'No se pudo actualizar la autoridad.' }
    }
    const eventId = data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>).event_id
        : undefined
    return typeof eventId === 'string'
        ? { success: true, data: { eventId } }
        : { success: false, error: 'No se pudo actualizar la autoridad.' }
}

// ─── Email Template ───────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
    agent: 'Colaborador Comercial',
    franchise: 'Franquicia',
}

interface InvitationEmailParams {
    to: string
    inviteUrl: string
    role: string
    inviterName: string
}

async function sendInvitationEmail({ to, inviteUrl, role, inviterName }: InvitationEmailParams): Promise<boolean> {
    if (!process.env.RESEND_API_KEY) {
        logger.warn('[sendInvitationEmail] RESEND_API_KEY not set. Skipping email.')
        return false
    }

    const roleLabel = ROLE_LABELS[role] ?? role
    const safeInviterName = escapeHtml(inviterName)
    const safeRecipient = escapeHtml(to)
    const safeInviteUrl = escapeHtml(inviteUrl)
    const safeRoleLabel = escapeHtml(roleLabel)
    const subject = `${inviterName.replace(/[\r\n]+/g, ' ').slice(0, 120)} te invita a unirte a Zinergia como ${roleLabel}`

    const html = `
<div style="font-family:'Segoe UI',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;">
  
  <!-- Logo Badge -->
  <div style="text-align:center;margin-bottom:28px;">
    <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:#4f46e5;color:#fff;font-size:22px;font-weight:900;line-height:48px;text-align:center;">Z</div>
  </div>

  <!-- Header -->
  <h1 style="text-align:center;color:#0f172a;font-size:22px;font-weight:700;margin:0 0 8px;">
    Te han invitado a la Red Zinergia
  </h1>
  <p style="text-align:center;color:#64748b;font-size:14px;margin:0 0 32px;">
    <strong>${safeInviterName}</strong> quiere que te unas como <strong style="color:#4f46e5;">${safeRoleLabel}</strong>
  </p>

  <!-- Info Card -->
  <div style="background:#f8fafc;border-radius:14px;padding:20px;margin:0 0 28px;border:1px solid #f1f5f9;">
    <table style="width:100%;font-size:13px;border-collapse:collapse;">
      <tr>
        <td style="color:#94a3b8;padding:4px 0;">Tu email</td>
        <td style="font-weight:600;color:#0f172a;text-align:right;">${safeRecipient}</td>
      </tr>
      <tr>
        <td style="color:#94a3b8;padding:4px 0;">Rol asignado</td>
        <td style="font-weight:600;color:#4f46e5;text-align:right;">${safeRoleLabel}</td>
      </tr>
      <tr>
        <td style="color:#94a3b8;padding:4px 0;">Válida durante</td>
        <td style="font-weight:600;color:#0f172a;text-align:right;">7 días</td>
      </tr>
    </table>
  </div>

  <!-- CTA Button -->
  <div style="text-align:center;margin:0 0 28px;">
    <a href="${safeInviteUrl}" style="display:inline-block;padding:14px 40px;background:#4f46e5;color:#ffffff;border-radius:14px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 14px rgba(79,70,229,0.25);">
      Unirme a Zinergia
    </a>
  </div>

  <!-- Fallback link -->
  <p style="text-align:center;font-size:11px;color:#94a3b8;word-break:break-all;margin:0 0 28px;">
    Si el botón no funciona, copia este enlace: <br/>
    <a href="${safeInviteUrl}" style="color:#6366f1;">${safeInviteUrl}</a>
  </p>

  <!-- Footer -->
  <div style="border-top:1px solid #f1f5f9;padding-top:16px;text-align:center;">
    <p style="font-size:11px;color:#cbd5e1;margin:0;">
      Zinergia Consultora · Plataforma de Gestión Energética<br/>
      Este enlace es personal e intransferible.
    </p>
  </div>
</div>`

    const { error } = await resend.emails.send({
        from: 'Zinergia <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
    })

    if (error) {
        logger.error('[sendInvitationEmail] Provider rejected delivery')
        return false
    }

    return true
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character]!)
}
