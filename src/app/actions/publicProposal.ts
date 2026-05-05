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

const uuidSchema = z.uuid();
// Token URL-safe base64: 43 chars (32 bytes → btoa → replace)
const tokenSchema = z.string().min(32).max(64).regex(/^[A-Za-z0-9\-_]+$/);

const LINK_TTL_DAYS = 30;
const SIGNATURE_DATA_MAX_BYTES = 250_000;
const acceptLimiter = rateLimit({ windowMs: 10 * 60_000, max: 10 });

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
    const idResult = uuidSchema.safeParse(proposalId);
    if (!idResult.success) throw new Error('ID de propuesta inválido');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const token = generateToken();
    const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
        .from('proposals')
        .update({
            public_token: token,
            public_expires_at: expiresAt,
            status: 'sent', // Al generar el link, la propuesta pasa a enviada
        })
        .eq('id', proposalId)
        .eq('agent_id', user.id);

    if (error) throw new Error(`Error generando link: ${error.message}`);

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

    // Notificar al agente y cliente (best-effort — no bloquear el flujo)
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

        const propData = prop as Record<string, unknown> | null;
        const agentProfile = propData?.profiles as { id: string; email?: string; franchise_id?: string } | null;
        const clientData = propData?.clients as { name?: string; email?: string } | null;
        const clientName = clientData?.name ?? 'Cliente';

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

        // Crear registro de comisión — idempotente (mismo guard que processCommissions)
        if (agentProfile?.id && agentProfile?.franchise_id && propData?.annual_savings) {
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
                await adminClient.from('network_commissions').upsert({
                    proposal_id: proposal.id,
                    agent_id: agentProfile.id,
                    franchise_id: agentProfile.franchise_id,
                    total_revenue: split.pot,
                    agent_commission: split.agent_commission,
                    franchise_profit: split.franchise_profit,
                    hq_royalty: split.hq_royalty,
                    status: 'pending',
                }, { onConflict: 'proposal_id', ignoreDuplicates: true });
            }
        }
    } catch { /* no bloquear */ }

    return { success: true, message: '¡Propuesta aceptada! Tu asesor se pondrá en contacto contigo.' };
}
