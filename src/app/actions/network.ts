'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireServerRole } from '@/lib/auth/permissions'
import { resend } from '@/lib/resend'

// ─── Types ────────────────────────────────────────────────────────────

interface CreateInvitationResult {
    code: string
    inviteUrl: string
    emailSent: boolean
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
    email: string,
    role: 'agent' | 'franchise'
): Promise<CreateInvitationResult> {
    // Guard: only admin/franchise can invite
    await requireServerRole(['admin', 'franchise'])

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    // Get creator's profile for context in the email
    const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('full_name, franchise_id')
        .eq('id', user.id)
        .single()

    // Generate a short, memorable invitation code
    const code = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()

    const { error: insertError } = await supabase
        .from('network_invitations')
        .insert({
            creator_id: user.id,
            email,
            role,
            code,
        })

    if (insertError) {
        if (insertError.message.includes('chk_valid_invitation_role')) {
            throw new Error(`El rol "${role}" no es válido para invitaciones.`)
        }
        throw new Error(`Error al crear invitación: ${insertError.message}`)
    }

    // Build the invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zinergia.vercel.app'
    const inviteUrl = `${baseUrl}/join/${code}`

    // Send email notification
    let emailSent = false
    try {
        emailSent = await sendInvitationEmail({
            to: email,
            inviteUrl,
            role,
            inviterName: creatorProfile?.full_name ?? 'Zinergia',
        })
    } catch (e) {
        // Non-blocking: log the error but don't fail the invitation creation
        console.error('[createInvitationAction] Email send failed:', e)
    }

    return { code, inviteUrl, emailSent }
}

// ─── Update User ─────────────────────────────────────────────────────

/**
 * Updates basic profile info for a network user.
 * Only admin and franchise roles can update other users' profiles.
 */
export async function updateNetworkUserAction(
    userId: string,
    updates: { full_name?: string; email?: string }
): Promise<void> {
    await requireServerRole(['admin', 'franchise'])

    const supabase = await createClient()

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)

    if (error) throw new Error(`Error al actualizar el perfil: ${error.message}`)
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
export async function deactivateProfileAction(userId: string): Promise<void> {
    await requireServerRole(['admin'])

    const supabase = await createClient()
    const { data: { user: me } } = await supabase.auth.getUser()
    if (me?.id === userId) throw new Error('No puedes desactivar tu propia cuenta')

    const { error } = await supabase
        .from('profiles')
        .update({ role: null })
        .eq('id', userId)

    if (error) throw new Error(`Error al desactivar el perfil: ${error.message}`)
}

/**
 * Reactivates a previously deactivated user by restoring their role.
 * Only admin can reactivate.
 */
export async function reactivateProfileAction(
    userId: string,
    role: 'agent' | 'franchise'
): Promise<void> {
    await requireServerRole(['admin'])

    const supabase = await createClient()

    const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId)

    if (error) throw new Error(`Error al reactivar el perfil: ${error.message}`)
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
        console.warn('[sendInvitationEmail] RESEND_API_KEY not set. Skipping email.')
        return false
    }

    const roleLabel = ROLE_LABELS[role] ?? role
    const subject = `${inviterName} te invita a unirte a Zinergia como ${roleLabel}`

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
    <strong>${inviterName}</strong> quiere que te unas como <strong style="color:#4f46e5;">${roleLabel}</strong>
  </p>

  <!-- Info Card -->
  <div style="background:#f8fafc;border-radius:14px;padding:20px;margin:0 0 28px;border:1px solid #f1f5f9;">
    <table style="width:100%;font-size:13px;border-collapse:collapse;">
      <tr>
        <td style="color:#94a3b8;padding:4px 0;">Tu email</td>
        <td style="font-weight:600;color:#0f172a;text-align:right;">${to}</td>
      </tr>
      <tr>
        <td style="color:#94a3b8;padding:4px 0;">Rol asignado</td>
        <td style="font-weight:600;color:#4f46e5;text-align:right;">${roleLabel}</td>
      </tr>
      <tr>
        <td style="color:#94a3b8;padding:4px 0;">Válida durante</td>
        <td style="font-weight:600;color:#0f172a;text-align:right;">7 días</td>
      </tr>
    </table>
  </div>

  <!-- CTA Button -->
  <div style="text-align:center;margin:0 0 28px;">
    <a href="${inviteUrl}" style="display:inline-block;padding:14px 40px;background:#4f46e5;color:#ffffff;border-radius:14px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 14px rgba(79,70,229,0.25);">
      Unirme a Zinergia
    </a>
  </div>

  <!-- Fallback link -->
  <p style="text-align:center;font-size:11px;color:#94a3b8;word-break:break-all;margin:0 0 28px;">
    Si el botón no funciona, copia este enlace: <br/>
    <a href="${inviteUrl}" style="color:#6366f1;">${inviteUrl}</a>
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
        console.error('[sendInvitationEmail] Resend error:', error)
        return false
    }

    return true
}
