'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { Proposal } from '@/types/crm';
import { getActiveCommissionRule } from './commissionRules';
import { calculateCommissionSplit, applyFranchiseOverride } from '@/lib/commissions/calculator';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { requireServerRole } from '@/lib/auth/permissions';
import { moduleLogger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

const log = moduleLogger('public-proposal');

const uuidSchema = z.uuid();
// Token URL-safe base64: 43 chars (32 bytes → btoa → replace)
const tokenSchema = z.string().min(32).max(64).regex(/^[A-Za-z0-9\-_]+$/);

const LINK_TTL_DAYS = 30;
const SIGNATURE_DATA_MAX_BYTES = 250_000;
const acceptLimiter = rateLimit({ windowMs: 10 * 60_000, max: 10 });
const viewLimiter = rateLimit({ windowMs: 60_000, max: 20 });

function generateToken(): string {
    // Token URL-safe de 32 bytes → 43 chars base64url
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function getServerActionClientKey(): Promise<string> {
    try {
        const h = await headers();
        return h.get('x-forwarded-for')?.split(',')[0]?.trim()
            || h.get('x-real-ip')?.trim()
            || 'unknown';
    } catch {
        return 'unknown';
    }
}

function isValidSignatureData(signatureData: string): boolean {
    if (signatureData.length > SIGNATURE_DATA_MAX_BYTES) return false;
    return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signatureData);
}

/**
 * Genera (o regenera) el link público de una propuesta.
 * Solo el agente propietario puede llamar esto.
 */
export async function generatePublicLinkAction(proposalId: string): Promise<{ token: string; url: string; expiresAt: string }> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const idResult = uuidSchema.safeParse(proposalId);
    if (!idResult.success) throw new Error('ID de propuesta inválido');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const token = generateToken();
    const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: proposalCtx } = await supabase
        .from('proposals')
        .select('client_id, franchise_id')
        .eq('id', proposalId)
        .eq('agent_id', user.id)
        .maybeSingle();

    if (!proposalCtx) throw new Error('Propuesta no encontrada o sin permisos');

    const { error } = await supabase
        .from('proposals')
        .update({
            public_token: token,
            public_expires_at: expiresAt,
            sent_date: new Date().toISOString(),
            status: 'sent',
        })
        .eq('id', proposalId)
        .eq('agent_id', user.id);

    if (error) throw new Error(`Error generando link: ${error.message}`);

    const adminClient = createServiceClient();
    await adminClient.from('client_activities').insert({
        client_id: proposalCtx.client_id,
        agent_id: user.id,
        franchise_id: proposalCtx.franchise_id,
        type: 'proposal_link_sent',
        description: 'Se ha generado y compartido el enlace público de la propuesta.',
        metadata: { proposal_id: proposalId },
    });

    revalidatePath(`/dashboard/proposals/${proposalId}`);
    revalidatePath('/dashboard/proposals');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zinergia.vercel.app';
    return { token, url: `${baseUrl}/p/${token}`, expiresAt };
}

/**
 * Obtiene una propuesta por token público — sin autenticación.
 * Usa el cliente anon (respeta RLS pública).
 */
export async function getPublicProposalAction(token: string): Promise<Proposal & { client_name?: string } | null> {
    if (!tokenSchema.safeParse(token).success) return null;

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('proposals')
        .select(`
            id, status, created_at, public_expires_at, public_accepted_at,
            offer_snapshot, calculation_data,
            current_annual_cost, offer_annual_cost, annual_savings, savings_percent,
            notes, optimization_result, aletheia_summary,
            clients(name)
        `)
        .eq('public_token', token)
        .maybeSingle();

    if (error || !data) return null;

    return {
        ...data,
        client_name: (data.clients as unknown as { name: string } | null)?.name,
    } as unknown as Proposal & { client_name?: string };
}

/**
 * Registra una apertura del portal público sin guardar IP ni user-agent.
 * Es best-effort: nunca debe bloquear la lectura ni revelar si el token existe.
 */
export async function trackPublicProposalViewAction(token: string): Promise<void> {
    if (!tokenSchema.safeParse(token).success) return;

    const rl = viewLimiter.check(`${await getServerActionClientKey()}:${token}`);
    if (!rl.allowed) return;

    const adminClient = createServiceClient();
    const { data: proposal } = await adminClient
        .from('proposals')
        .select('id, client_id, agent_id, franchise_id, status, public_expires_at, public_accepted_at, annual_savings')
        .eq('public_token', token)
        .maybeSingle();

    if (!proposal || proposal.status !== 'sent' || proposal.public_accepted_at) return;
    if (proposal.public_expires_at && new Date(proposal.public_expires_at) < new Date()) return;
    if (!proposal.client_id || !proposal.agent_id) return;

    const recentCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data: recentView } = await adminClient
        .from('client_activities')
        .select('id')
        .eq('client_id', proposal.client_id)
        .eq('type', 'proposal_public_view')
        .contains('metadata', { proposal_id: proposal.id })
        .gte('created_at', recentCutoff)
        .maybeSingle();

    if (recentView) return;

    await adminClient.from('client_activities').insert({
        client_id: proposal.client_id,
        agent_id: proposal.agent_id,
        franchise_id: proposal.franchise_id,
        type: 'proposal_public_view',
        description: 'El cliente ha abierto la propuesta publica.',
        metadata: {
            proposal_id: proposal.id,
            source: 'public_portal',
        },
    });

    await adminClient.from('notifications').insert({
        user_id: proposal.agent_id,
        title: 'Propuesta abierta',
        message: `El cliente ha abierto la propuesta de ${Math.round(Number(proposal.annual_savings || 0))} €/año.`,
        type: 'info',
        link: '/dashboard/proposals',
        read: false,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
}

/**
 * El cliente acepta la propuesta desde el link público.
 * Usa service role para bypassar RLS (la política UPDATE del anon es restrictiva).
 */
export async function acceptPublicProposalAction(
    token: string,
    signatureData?: string,
    signedName?: string,
): Promise<{ success: boolean; message: string }> {
    if (!tokenSchema.safeParse(token).success) {
        return { success: false, message: 'Enlace inválido.' };
    }
    const rl = acceptLimiter.check(`${await getServerActionClientKey()}:${token}`);
    if (!rl.allowed) {
        return { success: false, message: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' };
    }

    const cleanSignedName = signedName?.trim();
    if (cleanSignedName !== undefined && cleanSignedName.length > 200) {
        return { success: false, message: 'Nombre demasiado largo.' };
    }
    if (signatureData !== undefined && !isValidSignatureData(signatureData)) {
        return { success: false, message: 'Firma inválida o demasiado grande.' };
    }

    const adminClient = createServiceClient();

    // Verificar que el token es válido y la propuesta está en 'sent'
    const { data: proposal, error: fetchError } = await adminClient
        .from('proposals')
        .select('id, status, public_expires_at, public_accepted_at')
        .eq('public_token', token)
        .maybeSingle();

    if (fetchError || !proposal) {
        return { success: false, message: 'Propuesta no encontrada o enlace inválido.' };
    }
    if (proposal.public_accepted_at) {
        return { success: true, message: 'Esta propuesta ya fue aceptada anteriormente.' };
    }
    if (proposal.status !== 'sent') {
        return { success: false, message: 'Esta propuesta no está disponible para aceptar.' };
    }
    if (new Date(proposal.public_expires_at) < new Date()) {
        return { success: false, message: 'El enlace ha expirado. Contacta con tu asesor.' };
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
        status: 'accepted',
        public_accepted_at: now,
        signed_at: now,
    };
    if (signatureData) updatePayload.signature_data = signatureData;
    if (cleanSignedName) updatePayload.signed_name = cleanSignedName;

    const { error } = await adminClient
        .from('proposals')
        .update(updatePayload)
        .eq('id', proposal.id);

    if (error) return { success: false, message: 'Error al procesar la aceptación.' };

    // Log the acceptance event
    try {
        const { data: propForActivity } = await adminClient
            .from('proposals')
            .select('client_id, agent_id, franchise_id')
            .eq('id', proposal.id)
            .maybeSingle();
        if (propForActivity?.client_id && propForActivity?.agent_id) {
            await adminClient.from('client_activities').insert({
                client_id: propForActivity.client_id,
                agent_id: propForActivity.agent_id,
                franchise_id: propForActivity.franchise_id,
                type: 'proposal_accepted',
                description: signedName
                    ? `El cliente ${signedName} ha aceptado y firmado la propuesta.`
                    : 'El cliente ha aceptado la propuesta.',
                metadata: { proposal_id: proposal.id },
            });
        }
    } catch (actErr) {
        log.warn({ err: actErr, proposalId: proposal.id }, 'failed to log acceptance activity');
    }

    // Cargar contexto de la propuesta (necesario para comisión y notificaciones).
    let propData: Record<string, unknown> | null = null;
    let agentProfile: { id: string; email?: string; franchise_id?: string } | null = null;
    let clientData: { name?: string; email?: string } | null = null;
    try {
        const { data: prop } = await adminClient
            .from('proposals')
            .select(`
                annual_savings, savings_percent, offer_annual_cost, offer_snapshot,
                clients(name, email),
                profiles!proposals_agent_id_fkey(id, email, franchise_id)
            `)
            .eq('id', proposal.id)
            .maybeSingle();

        propData = prop as Record<string, unknown> | null;
        agentProfile = propData?.profiles as { id: string; email?: string; franchise_id?: string } | null;
        clientData = propData?.clients as { name?: string; email?: string } | null;
    } catch (err) {
        Sentry.captureException(err, { extra: { stage: 'accept-fetch-context', proposalId: proposal.id } });
        log.error({ err, proposalId: proposal.id }, 'failed to load proposal context after accept');
    }

    const clientName = clientData?.name ?? 'Cliente';

    // Comisión — NO es best-effort: debe registrarse. Si falla, se reporta a
    // Sentry y se loguea (la propuesta ya está aceptada). Idempotente vía el
    // UNIQUE constraint en proposal_id.
    if (agentProfile?.id && agentProfile?.franchise_id && propData?.annual_savings) {
        try {
            const { data: existingComm } = await adminClient
                .from('network_commissions')
                .select('id')
                .eq('proposal_id', proposal.id)
                .maybeSingle();

            if (!existingComm) {
                const baseRule = await getActiveCommissionRule();

                // Apply per-franchise royalty override if configured
                const { data: franchiseCfg } = await adminClient
                    .from('franchise_config')
                    .select('royalty_percent')
                    .eq('franchise_id', agentProfile.franchise_id)
                    .eq('active', true)
                    .maybeSingle();

                const rule = applyFranchiseOverride(baseRule, franchiseCfg?.royalty_percent ?? null);
                const split = calculateCommissionSplit(propData.annual_savings as number, rule);
                // ignoreDuplicates: el UNIQUE constraint en proposal_id actúa como guardia atómica
                const { error: commError } = await adminClient.from('network_commissions').upsert({
                    proposal_id: proposal.id,
                    agent_id: agentProfile.id,
                    franchise_id: agentProfile.franchise_id,
                    total_revenue: split.pot,
                    agent_commission: split.agent_commission,
                    franchise_profit: split.franchise_profit,
                    hq_royalty: split.hq_royalty,
                    status: 'pending',
                }, { onConflict: 'proposal_id', ignoreDuplicates: true });
                if (commError) throw commError;
            }
        } catch (err) {
            // La propuesta ya está aceptada; no revertimos, pero NO lo silenciamos:
            // la comisión es dinero del agente y debe poder reconciliarse.
            Sentry.captureException(err, {
                extra: { stage: 'accept-create-commission', proposalId: proposal.id, agentId: agentProfile.id },
            });
            log.error({ err, proposalId: proposal.id, agentId: agentProfile.id }, 'commission creation failed after proposal accept');
        }
    }

    // Notificaciones (push + emails) — best-effort, seguro ignorar fallos.
    try {
        // Push al agente
        if (agentProfile?.id) {
            const { sendPushToUser } = await import('@/lib/push/sendPush');
            await sendPushToUser(agentProfile.id, {
                title: '¡Propuesta aceptada!',
                body: `${clientName} ha firmado la propuesta`,
                url: '/dashboard/proposals',
            });
        }

        // Email al agente
        if (agentProfile?.email && propData) {
            const { sendAgentAcceptanceEmail } = await import('./email');
            await sendAgentAcceptanceEmail(agentProfile.email, clientName, {
                annual_savings: propData.annual_savings as number,
                offer_snapshot: propData.offer_snapshot as { marketer_name: string },
                id: proposal.id,
            });
        }

        // Email al cliente (si tiene email registrado)
        if (clientData?.email && propData) {
            const { sendClientAcceptanceEmail } = await import('./email');
            await sendClientAcceptanceEmail(
                clientData.email,
                clientName,
                {
                    annual_savings: propData.annual_savings as number,
                    savings_percent: propData.savings_percent as number,
                    offer_annual_cost: propData.offer_annual_cost as number,
                    offer_snapshot: propData.offer_snapshot as { marketer_name: string; tariff_name: string },
                },
                signedName,
            );
        }
    } catch (err) {
        log.warn({ err, proposalId: proposal.id }, 'acceptance notifications failed (non-blocking)');
    }

    return { success: true, message: '¡Propuesta aceptada! Tu asesor se pondrá en contacto contigo.' };
}
