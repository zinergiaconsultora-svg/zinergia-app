'use server'

import { logger } from '@/lib/utils/logger'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Proposal } from '@/types/crm'
import { getActiveCommissionRule } from './commissionRules'
import { createNotificationInternal } from './notifications'
import { requireServerRole } from '@/lib/auth/permissions'
import { calculateCommissionSplit, applyFranchiseOverride } from '@/lib/commissions/calculator'
import { writeLeadAuditEvent } from '@/lib/audit/leadAuditLog'
import type { LeadProposalSummary } from './invoices'

/**
 * Updates a proposal's status and, if moving to 'accepted',
 * atomically creates the commission record and awards gamification points.
 *
 * Idempotent: a second call with status='accepted' is a no-op for commissions
 * (checked via existing network_commissions row for the proposal).
 */
export interface ProposalHistoryItem {
    id: string;
    created_at: string;
    current_annual_cost: number;
    offer_annual_cost: number;
    annual_savings: number;
    savings_percent: number;
    offer_snapshot: {
        marketer_name: string;
        tariff_name: string;
    } | null;
    calculation_data: {
        company_name?: string;
        tariff_name?: string;
        cups?: string;
    } | null;
}

const customLeadProposalSchema = z.object({
    marketerName: z.string().trim().min(1, 'La comercializadora es obligatoria').max(120),
    tariffName: z.string().trim().min(1, 'La tarifa es obligatoria').max(160),
    currentAnnualCost: z.coerce.number().positive('El coste actual anual debe ser mayor que 0').max(1_000_000),
    offerAnnualCost: z.coerce.number().nonnegative('El nuevo coste no puede ser negativo').max(1_000_000),
    notes: z.string().trim().max(1200).optional().or(z.literal('')),
});

export type CustomLeadProposalInput = z.input<typeof customLeadProposalSchema>;

/**
 * Returns past proposals for a given CUPS, scoped to the current user's data.
 * Used by the simulator's comparison feature.
 */
export async function getProposalHistoryByCupsAction(cups: string): Promise<ProposalHistoryItem[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, franchise_id')
        .eq('id', user.id)
        .single()

    if (!profile) throw new Error('Perfil no encontrado')

    let query = supabase
        .from('proposals')
        .select('id, created_at, current_annual_cost, offer_annual_cost, annual_savings, savings_percent, offer_snapshot, calculation_data')
        .order('created_at', { ascending: false })
        .limit(20)

    if (profile.role === 'agent') {
        query = query.eq('agent_id', user.id) as typeof query
    } else if (profile.role === 'franchise') {
        query = query.eq('franchise_id', profile.franchise_id) as typeof query
    }

    const { data, error } = await query
    if (error) return []

    // Filter by CUPS client-side (stored in JSONB calculation_data)
    return (data ?? []).filter(p => {
        const cd = p.calculation_data as { cups?: string } | null
        return cd?.cups === cups
    }) as ProposalHistoryItem[]
}

/**
 * Admin-only custom proposal from a lead. This covers the case where the
 * comparator produced no suitable offer or the admin wants to craft a commercial
 * proposal manually and send it to the comercial for follow-up.
 */
export async function createCustomLeadProposalAction(
    jobId: string,
    input: CustomLeadProposalInput,
): Promise<LeadProposalSummary> {
    await requireServerRole(['admin']);

    const idResult = z.uuid().safeParse(jobId);
    if (!idResult.success) throw new Error('ID de lead inválido');

    const parsed = customLeadProposalSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data: job, error: jobError } = await supabase
        .from('ocr_jobs')
        .select('id, client_id, franchise_id, agent_id, extracted_data, compared_at')
        .eq('id', idResult.data)
        .maybeSingle();

    if (jobError) throw new Error(`Error cargando lead: ${jobError.message}`);
    if (!job?.client_id) throw new Error('Este lead no tiene cliente vinculado');

    const annualSavings = Math.max(0, parsed.data.currentAnnualCost - parsed.data.offerAnnualCost);
    const savingsPercent = parsed.data.currentAnnualCost > 0
        ? (annualSavings / parsed.data.currentAnnualCost) * 100
        : 0;

    const offerSnapshot: Proposal['offer_snapshot'] = {
        id: `custom-${idResult.data}`,
        marketer_name: parsed.data.marketerName,
        tariff_name: parsed.data.tariffName,
        logo_color: 'bg-slate-700',
        type: 'fixed',
        power_price: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
        energy_price: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
        contract_duration: 'Propuesta personalizada',
    };

    const calculationData = {
        ...((job.extracted_data as Record<string, unknown> | null) ?? {}),
        custom_proposal: true,
        custom_proposal_notes: parsed.data.notes || null,
    } as unknown as Proposal['calculation_data'];

    const { data: proposal, error } = await supabase
        .from('proposals')
        .insert({
            client_id: job.client_id,
            franchise_id: job.franchise_id,
            agent_id: job.agent_id,
            status: 'draft',
            offer_snapshot: offerSnapshot,
            calculation_data: calculationData,
            current_annual_cost: parsed.data.currentAnnualCost,
            offer_annual_cost: parsed.data.offerAnnualCost,
            annual_savings: annualSavings,
            savings_percent: savingsPercent,
            notes: parsed.data.notes || null,
        })
        .select('id, created_at, status, current_annual_cost, offer_annual_cost, annual_savings, savings_percent, offer_snapshot')
        .single();

    if (error) throw new Error(`Error creando propuesta: ${error.message}`);

    if (!job.compared_at) {
        await supabase.from('ocr_jobs').update({ compared_at: new Date().toISOString() }).eq('id', idResult.data);
    }

    await writeLeadAuditEvent({
        jobId: idResult.data,
        actorId: user.id,
        eventType: 'note_added',
        title: 'Propuesta personalizada creada',
        detail: `${parsed.data.marketerName} · ${parsed.data.tariffName}`,
        metadata: {
            proposalId: proposal.id,
            annualSavings,
            savingsPercent,
        },
    }).catch(() => undefined);

    if (job.agent_id) {
        await createNotificationInternal(supabase, job.agent_id, {
            title: 'Nueva propuesta personalizada',
            message: `Admin ha creado una propuesta para ${parsed.data.marketerName} (${Math.round(annualSavings).toLocaleString('es-ES')} €/año de ahorro).`,
            type: 'info',
            link: `/dashboard/proposals/${proposal.id}`,
        }).catch(() => undefined);
    }

    try {
        const { error: activityError } = await supabase.from('client_activities').insert({
            client_id: job.client_id,
            agent_id: user.id,
            franchise_id: job.franchise_id,
            type: 'proposal_created',
            description: `Propuesta personalizada creada: ${parsed.data.marketerName} · ${parsed.data.tariffName}`,
            metadata: { proposal_id: proposal.id, job_id: idResult.data, annualSavings },
        });
        if (activityError) {
            logger.warn('[createCustomLeadProposalAction] activity log failed', { error: activityError.message });
        }
    } catch {
        // Non-critical: the proposal and lead audit are the primary records.
    }

    revalidatePath('/admin/leads');
    revalidatePath('/dashboard/proposals');
    revalidatePath(`/dashboard/clients/${job.client_id}`);
    return proposal as LeadProposalSummary;
}

export async function updateProposalStatusAction(
    id: string,
    status: Proposal['status']
): Promise<Proposal> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado');

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, franchise_id')
        .eq('id', user.id)
        .single()

    if (!profile) throw new Error('Perfil no encontrado');

    // 1. Update status — filtrar por agent_id excepto para admin/franchise
    const query = supabase
        .from('proposals')
        .update({ status })
        .eq('id', id)

    // Agentes solo pueden modificar sus propias propuestas
    if (profile.role === 'agent') {
        query.eq('agent_id', user.id)
    } else if (profile.role === 'franchise') {
        query.eq('franchise_id', profile.franchise_id)
    }

    const { data: proposal, error } = await query
        .select('id, client_id, franchise_id, created_at, status, offer_snapshot, calculation_data, current_annual_cost, offer_annual_cost, annual_savings, savings_percent, notes, optimization_result, aletheia_summary')
        .single()

    if (error) throw new Error('Error al actualizar la propuesta');

    // 2. Trigger commission processing only on 'accepted'
    if (status === 'accepted') {
        await processCommissions(supabase, proposal as Proposal)
    }

    // 3. Create in-app notification for the agent
    await createStatusNotification(supabase, user.id, proposal as Proposal, status)

    // 4. Log activity on the client timeline
    await logProposalActivity(supabase, proposal as Proposal, user.id, status)

    // 5. Auto-generate follow-up tasks & Contracts
    if (proposal.client_id) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('franchise_id')
            .eq('id', user.id)
            .maybeSingle()

        await generateFollowUpTasks(supabase, {
            clientId: proposal.client_id,
            proposalId: proposal.id,
            franchiseId: profile?.franchise_id,
            agentId: user.id,
            status,
        })

        if (status === 'accepted') {
            await autoCreateContract(supabase, {
                clientId: proposal.client_id,
                proposalId: proposal.id,
                franchiseId: profile?.franchise_id,
                agentId: user.id,
                proposal: proposal as Proposal
            })
        }
    }

    revalidatePath('/dashboard/proposals')
    revalidatePath(`/dashboard/proposals/${id}`)
    revalidatePath('/dashboard')
    return proposal as Proposal
}

/**
 * Registra una venta cerrada: exige una nota que la justifique (constancia),
 * marca la propuesta como aceptada — lo que genera la comisión de la tarifa en
 * el wallet — y deja un rastro explícito en el historial del cliente.
 */
export async function registerSaleAction(proposalId: string, note: string): Promise<Proposal> {
    await requireServerRole(['admin', 'franchise', 'agent'])

    const idResult = z.uuid().safeParse(proposalId)
    if (!idResult.success) throw new Error('ID de propuesta inválido')

    const noteResult = z
        .string()
        .trim()
        .min(3, 'Añade una nota que justifique la venta (cómo se cerró)')
        .max(1000)
        .safeParse(note)
    if (!noteResult.success) throw new Error(noteResult.error.issues[0].message)

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    // Guarda la justificación en la propuesta (RLS aplica).
    await supabase.from('proposals').update({ notes: noteResult.data }).eq('id', idResult.data)

    // Cierra el acuerdo: dispara comisión (según tarifa), contrato, tareas y avisos.
    const proposal = await updateProposalStatusAction(idResult.data, 'accepted')

    // Constancia explícita en el timeline del cliente.
    if (proposal.client_id) {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('franchise_id')
                .eq('id', user.id)
                .maybeSingle()
            await supabase.from('client_activities').insert({
                client_id: proposal.client_id,
                agent_id: user.id,
                franchise_id: profile?.franchise_id ?? null,
                type: 'note_added',
                description: `Venta registrada — ${noteResult.data}`,
                metadata: { proposal_id: proposal.id, kind: 'sale_justification' },
            })
        } catch { /* non-critical */ }
    }

    revalidatePath('/dashboard/wallet')
    return proposal
}

async function createStatusNotification(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    proposal: Proposal,
    status: Proposal['status']
) {
    try {
        const cd = proposal.calculation_data as { client_name?: string } | null
        const clientName = cd?.client_name ?? 'el cliente'
        const savings = proposal.annual_savings
            ? `${Math.round(proposal.annual_savings).toLocaleString('es-ES')} €/año`
            : null

        const map: Record<string, { title: string; message: string; type: string }> = {
            accepted: {
                title: '¡Propuesta firmada!',
                message: `${clientName} ha aceptado la oferta${savings ? ` — ahorro de ${savings}` : ''}.`,
                type: 'proposal_accepted',
            },
            rejected: {
                title: 'Propuesta rechazada',
                message: `${clientName} ha rechazado la propuesta. Puedes intentar una nueva simulación.`,
                type: 'proposal_rejected',
            },
            sent: {
                title: 'Propuesta enviada',
                message: `La propuesta para ${clientName} ha sido enviada y está pendiente de respuesta.`,
                type: 'proposal_sent',
            },
        }

        const notif = map[status]
        if (!notif) return

        await createNotificationInternal(supabase, userId, {
            title: notif.title,
            message: notif.message,
            type: notif.type as never,
            link: `/dashboard/proposals`,
        })
    } catch {
        // Non-critical — don't block the main action
    }
}

async function processCommissions(
    supabase: Awaited<ReturnType<typeof createClient>>,
    proposal: Proposal
) {
    try {
        // Guard: skip if commission already exists for this proposal
        const { data: existing } = await supabase
            .from('network_commissions')
            .select('id')
            .eq('proposal_id', proposal.id)
            .maybeSingle()

        if (existing) return // Already processed — idempotent

        // Get the seller (current user) and their profile
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
            .from('profiles')
            .select('franchise_id, role')
            .eq('id', user.id)
            .single()

        if (!profile?.franchise_id) return

        // Load active commission rule (falls back to defaults if table missing)
        const baseRule = await getActiveCommissionRule()

        // Per-franchise royalty: the franchise's configured cut of the agent's commission.
        const { data: franchiseCfg } = await supabase
            .from('franchise_config')
            .select('royalty_percent')
            .eq('franchise_id', profile.franchise_id)
            .eq('active', true)
            .maybeSingle()
        const royaltyPercent: number | null = franchiseCfg?.royalty_percent ?? null

        // Commission amount comes from the TARIFF (offer.estimated_agent_commission):
        // that fixed € is the agent's commission. The franchise takes its configured
        // % on top. Legacy offers without a tariff commission fall back to the old
        // savings × rule split so nothing is lost.
        const offer = proposal.offer_snapshot as { estimated_agent_commission?: number | null } | null
        const tariffCommission = Number(offer?.estimated_agent_commission ?? 0)
        const round2 = (n: number) => Math.round(n * 100) / 100

        let agentCommission: number
        let franchiseCommission: number
        let pointsToAward: number

        if (tariffCommission > 0) {
            agentCommission = round2(tariffCommission)
            franchiseCommission = round2(tariffCommission * ((royaltyPercent ?? 0) / 100))
            pointsToAward = Math.round(baseRule.points_per_win)
        } else {
            const rule = applyFranchiseOverride(baseRule, royaltyPercent)
            const split = calculateCommissionSplit(proposal.annual_savings || 0, rule)
            agentCommission = split.agent_commission
            franchiseCommission = split.franchise_profit
            pointsToAward = split.points
        }

        // Upsert con ignoreDuplicates: si dos requests concurrentes llegan al mismo tiempo,
        // el UNIQUE constraint en proposal_id garantiza que solo uno insertará. El otro
        // fallará silenciosamente. El JS check de arriba es un early-exit barato, no la
        // garantía real.
        await supabase.from('network_commissions').upsert({
            proposal_id: proposal.id,
            agent_id: user.id,
            franchise_id: profile.franchise_id,
            agent_commission: agentCommission,
            franchise_commission: franchiseCommission,
            status: 'pending',
        }, { onConflict: 'proposal_id', ignoreDuplicates: true })

        // Award gamification points (upsert to handle first-time users)
        const { data: current } = await supabase
            .from('user_points')
            .select('points')
            .eq('user_id', user.id)
            .maybeSingle()

        await supabase.from('user_points').upsert({
            user_id: user.id,
            points: (current?.points || 0) + pointsToAward,
            last_updated: new Date().toISOString(),
        })
    } catch (err) {
        // Commission failure must NOT roll back the proposal status change.
        // Log and continue — commissions can be reprocessed manually if needed.
        logger.error('[updateProposalStatusAction] Commission processing failed', err)
    }
}

const PROPOSAL_ACTIVITY_MAP: Record<string, { type: string; description_template: string }> = {
    sent: { type: 'proposal_sent', description_template: 'Propuesta enviada a {client}' },
    accepted: { type: 'proposal_accepted', description_template: '¡Propuesta aceptada por {client}! Ahorro: {savings}€/año' },
    rejected: { type: 'proposal_rejected', description_template: 'Propuesta rechazada por {client}' },
}

async function logProposalActivity(
    supabase: Awaited<ReturnType<typeof createClient>>,
    proposal: Proposal,
    agentId: string,
    status: Proposal['status']
) {
    const mapping = PROPOSAL_ACTIVITY_MAP[status]
    if (!mapping || !proposal.client_id) return

    const cd = proposal.calculation_data as { client_name?: string } | null
    const clientName = cd?.client_name ?? 'Cliente'

    const description = mapping.description_template
        .replace('{client}', clientName)
        .replace('{savings}', String(Math.round(proposal.annual_savings || 0)))

    try {
        await supabase.from('client_activities').insert({
            client_id: proposal.client_id,
            agent_id: agentId,
            franchise_id: proposal.franchise_id,
            type: mapping.type,
            description,
            metadata: {
                proposal_id: proposal.id,
                savings: proposal.annual_savings,
                marketer: proposal.offer_snapshot?.marketer_name,
            },
        })
    } catch {
        // non-critical
    }
}

async function generateFollowUpTasks(
    supabase: Awaited<ReturnType<typeof createClient>>,
    data: {
        clientId: string;
        proposalId: string;
        franchiseId?: string;
        agentId: string;
        status: Proposal['status'];
    }
) {
    if (!['sent', 'accepted'].includes(data.status)) return;

    const tasks: Array<{
        agent_id: string;
        franchise_id?: string;
        client_id: string;
        proposal_id: string;
        title: string;
        description: string;
        type: string;
        priority: string;
        due_date: string;
        auto_generated: boolean;
        status: string;
    }> = [];

    if (data.status === 'sent') {
        const in3Days = new Date();
        in3Days.setDate(in3Days.getDate() + 3);
        const in7Days = new Date();
        in7Days.setDate(in7Days.getDate() + 7);

        tasks.push({
            agent_id: data.agentId,
            franchise_id: data.franchiseId,
            client_id: data.clientId,
            proposal_id: data.proposalId,
            title: 'Seguimiento propuesta (3 días)',
            description: 'Contactar cliente para conocer su opinión sobre la propuesta enviada.',
            type: 'follow_up',
            priority: 'high',
            due_date: in3Days.toISOString().split('T')[0],
            auto_generated: true,
            status: 'pending',
        });

        tasks.push({
            agent_id: data.agentId,
            franchise_id: data.franchiseId,
            client_id: data.clientId,
            proposal_id: data.proposalId,
            title: 'Seguimiento propuesta (7 días)',
            description: 'Segundo intento de contacto si no hubo respuesta al primer seguimiento.',
            type: 'follow_up',
            priority: 'medium',
            due_date: in7Days.toISOString().split('T')[0],
            auto_generated: true,
            status: 'pending',
        });
    }

    if (data.status === 'accepted') {
        tasks.push({
            agent_id: data.agentId,
            franchise_id: data.franchiseId,
            client_id: data.clientId,
            proposal_id: data.proposalId,
            title: 'Recopilar documentación',
            description: 'Solicitar al cliente la documentación necesaria para el cambio de comercializadora.',
            type: 'documentation',
            priority: 'high',
            due_date: new Date().toISOString().split('T')[0],
            auto_generated: true,
            status: 'pending',
        });
    }

    if (tasks.length === 0) return;

    try {
        await supabase.from('tasks').insert(tasks);
    } catch {
        // non-critical
    }
}

async function autoCreateContract(
    supabase: Awaited<ReturnType<typeof createClient>>,
    data: {
        clientId: string;
        proposalId: string;
        franchiseId?: string;
        agentId: string;
        proposal: Proposal;
    }
) {
    // Evitar duplicados (idempotencia)
    const { data: existing } = await supabase
        .from('contracts')
        .select('id')
        .eq('proposal_id', data.proposalId)
        .maybeSingle()

    if (existing) return;

    const marketerName = data.proposal.offer_snapshot?.marketer_name || 'Comercializadora Desconocida';
    const tariffName = data.proposal.offer_snapshot?.tariff_name;
    const cd = data.proposal.calculation_data as unknown as Record<string, unknown> | null;
    const typeFromCalc = cd?.detected_tariff_type as string;
    
    // Inferir tipo de contrato (muy básico)
    let contractType = 'electricidad';
    if (typeFromCalc === 'gas' || tariffName?.toLowerCase().includes('gas')) contractType = 'gas';

    try {
        await supabase.from('contracts').insert({
            client_id: data.clientId,
            proposal_id: data.proposalId,
            agent_id: data.agentId,
            franchise_id: data.franchiseId,
            marketer_name: marketerName,
            tariff_name: tariffName,
            contract_type: contractType,
            status: 'pending_switch', // Inicia en trámite
            annual_savings: data.proposal.annual_savings,
            start_date: new Date().toISOString().split('T')[0],
        })
    } catch (err) {
        logger.error('[autoCreateContract] Error', err);
    }
}
