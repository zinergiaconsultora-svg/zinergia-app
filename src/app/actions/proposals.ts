'use server'

import { logger } from '@/lib/utils/logger'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { InvoiceData, Proposal } from '@/types/crm'
import { getActiveCommissionRule } from './commissionRules'
import { createNotificationInternal } from './notifications'
import { requireServerRole } from '@/lib/auth/permissions'
import { resolveCommissionAmounts } from '@/lib/commissions/calculator'
import { writeLeadAuditEvent } from '@/lib/audit/leadAuditLog'
import { syncClientStatusFromLeads } from '@/lib/crm/syncClientStatus'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeadProposalSummary } from './invoices'
import { calculateAletheiaSavings } from './simulator'
import {
    buildProposalPricingDefaults,
    buildTariffPriceFingerprint,
    getSourceTariffId,
    isCatalogTariffId,
    mapAletheiaProposalToSavingsResult,
} from '@/lib/proposals/pricing'

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
    source_proposal_id?: string | null;
    proposal_version?: number | null;
    pricing_status?: string | null;
    price_snapshot_at?: string | null;
    repricing_delta_eur?: number | null;
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
        .select('id, created_at, source_proposal_id, proposal_version, pricing_status, price_snapshot_at, repricing_delta_eur, current_annual_cost, offer_annual_cost, annual_savings, savings_percent, offer_snapshot, calculation_data')
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
    const pricingDefaults = buildProposalPricingDefaults({
        offer: offerSnapshot,
        current_annual_cost: parsed.data.currentAnnualCost,
        offer_annual_cost: parsed.data.offerAnnualCost,
        annual_savings: annualSavings,
        savings_percent: savingsPercent,
    }, 'manual');

    const { data: proposal, error } = await supabase
        .from('proposals')
        .insert({
            client_id: job.client_id,
            franchise_id: job.franchise_id,
            agent_id: job.agent_id,
            status: 'draft',
            offer_snapshot: pricingDefaults.offer_snapshot,
            calculation_data: calculationData,
            source_tariff_id: pricingDefaults.source_tariff_id,
            proposal_version: pricingDefaults.proposal_version,
            price_snapshot: pricingDefaults.price_snapshot,
            price_snapshot_at: pricingDefaults.price_snapshot_at,
            pricing_status: 'manual',
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
        .update(status === 'accepted' ? { status, pricing_status: 'locked' } : { status })
        .eq('id', id)

    // Agentes solo pueden modificar sus propias propuestas
    if (profile.role === 'agent') {
        query.eq('agent_id', user.id)
    } else if (profile.role === 'franchise') {
        query.eq('franchise_id', profile.franchise_id)
    }

    const { data: proposal, error } = await query
        .select('id, client_id, franchise_id, agent_id, created_at, updated_at, status, offer_snapshot, calculation_data, source_tariff_id, source_proposal_id, proposal_version, price_snapshot, price_snapshot_at, pricing_status, repriced_at, repricing_delta_eur, current_annual_cost, offer_annual_cost, annual_savings, savings_percent, notes, optimization_result, aletheia_summary')
        .single()

    if (error) throw new Error('Error al actualizar la propuesta');

    // 2. Trigger acceptance side effects only on 'accepted'
    if (status === 'accepted') {
        await finalizeAcceptedProposalSideEffects(supabase, proposal as Proposal, user.id)
    }

    // 3. Create in-app notification for the agent
    await createStatusNotification(supabase, user.id, proposal as Proposal, status)

    // 4. Log activity on the client timeline
    await logProposalActivity(supabase, proposal as Proposal, user.id, status)

    // 5. Auto-generate follow-up tasks & Contracts
    if (proposal.client_id) {
        await generateFollowUpTasks(supabase, {
            clientId: proposal.client_id,
            proposalId: proposal.id,
            franchiseId: profile.franchise_id,
            agentId: user.id,
            status,
        })

    }

    revalidatePath('/dashboard/proposals')
    revalidatePath(`/dashboard/proposals/${id}`)
    revalidatePath('/dashboard')
    return proposal as Proposal
}

export async function finalizeAcceptedProposalSideEffects(
    supabase: Pick<Awaited<ReturnType<typeof createClient>>, 'from'>,
    proposal: Proposal,
    actorId?: string,
): Promise<void> {
    const agentId = proposal.agent_id ?? actorId;
    if (!proposal.client_id || !agentId) return;

    await processCommissions(supabase, proposal);
    await autoCloseLeadOnAcceptance(supabase, proposal, actorId ?? agentId);
    await generateFollowUpTasks(supabase, {
        clientId: proposal.client_id,
        proposalId: proposal.id,
        franchiseId: proposal.franchise_id ?? undefined,
        agentId,
        status: 'accepted',
    });
    await autoCreateContract(supabase, {
        clientId: proposal.client_id,
        proposalId: proposal.id,
        franchiseId: proposal.franchise_id ?? undefined,
        agentId,
        proposal,
    });
}

type PricingReviewStatus = 'current' | 'outdated' | 'manual' | 'locked' | 'missing';

export interface ProposalPricingReview {
    status: PricingReviewStatus;
    message: string;
    proposal_version: number;
    price_snapshot_at: string | null;
    current_catalog_version: number | null;
    current_tariff_label: string | null;
    can_recalculate: boolean;
}

interface TariffCatalogRow {
    id: string;
    company: string;
    tariff_name: string;
    tariff_type: string | null;
    offer_type: string | null;
    fixed_fee: number | null;
    surplus_compensation_price: number | null;
    power_price_p1: number;
    power_price_p2: number;
    power_price_p3: number;
    power_price_p4: number;
    power_price_p5: number;
    power_price_p6: number;
    energy_price_p1: number;
    energy_price_p2: number;
    energy_price_p3: number;
    energy_price_p4: number;
    energy_price_p5: number;
    energy_price_p6: number;
    catalog_version: number | null;
    effective_from: string | null;
    effective_to: string | null;
    price_fingerprint: string | null;
}

export async function getProposalPricingReviewAction(proposalId: string): Promise<ProposalPricingReview> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const idResult = z.uuid().safeParse(proposalId);
    if (!idResult.success) throw new Error('ID de propuesta inválido');

    const supabase = await createClient();
    const { proposal } = await loadScopedProposal(supabase, idResult.data);
    const version = proposal.proposal_version ?? 1;

    if (proposal.status === 'accepted' || proposal.pricing_status === 'locked' || proposal.signed_at) {
        return {
            status: 'locked',
            message: 'Propuesta firmada: precios bloqueados para conservar el histórico.',
            proposal_version: version,
            price_snapshot_at: proposal.price_snapshot_at ?? proposal.created_at ?? null,
            current_catalog_version: proposal.offer_snapshot?.tariff_catalog_version ?? null,
            current_tariff_label: proposal.offer_snapshot ? `${proposal.offer_snapshot.marketer_name} · ${proposal.offer_snapshot.tariff_name}` : null,
            can_recalculate: false,
        };
    }

    const sourceTariffId = proposal.source_tariff_id ?? getSourceTariffId(proposal.offer_snapshot);
    if (!sourceTariffId && !proposal.offer_snapshot?.marketer_name) {
        return {
            status: 'manual',
            message: 'Propuesta manual: no hay tarifa de catálogo asociada.',
            proposal_version: version,
            price_snapshot_at: proposal.price_snapshot_at ?? proposal.created_at ?? null,
            current_catalog_version: null,
            current_tariff_label: null,
            can_recalculate: true,
        };
    }

    const currentTariff = await findCurrentTariffForProposal(supabase, proposal);
    if (!currentTariff) {
        return {
            status: 'missing',
            message: 'No encuentro esta tarifa activa en el catálogo actual.',
            proposal_version: version,
            price_snapshot_at: proposal.price_snapshot_at ?? proposal.created_at ?? null,
            current_catalog_version: null,
            current_tariff_label: null,
            can_recalculate: true,
        };
    }

    const snapshotFingerprint = proposal.offer_snapshot?.price_fingerprint
        ?? buildTariffPriceFingerprint(proposal.offer_snapshot ?? {});
    const currentFingerprint = fingerprintFromTariffRow(currentTariff);
    const status: PricingReviewStatus = snapshotFingerprint === currentFingerprint ? 'current' : 'outdated';

    return {
        status,
        message: status === 'current'
            ? 'La propuesta coincide con el catálogo actual.'
            : 'Hay precios más recientes en el catálogo. Crea una nueva versión antes de enviarla.',
        proposal_version: version,
        price_snapshot_at: proposal.price_snapshot_at ?? proposal.created_at ?? null,
        current_catalog_version: currentTariff.catalog_version ?? null,
        current_tariff_label: `${currentTariff.company} · ${currentTariff.tariff_name}`,
        can_recalculate: true,
    };
}

export async function recalculateProposalWithCurrentTariffsAction(proposalId: string): Promise<{
    proposal: Proposal;
    deltaAnnualSavings: number;
}> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const idResult = z.uuid().safeParse(proposalId);
    if (!idResult.success) throw new Error('ID de propuesta inválido');

    const supabase = await createClient();
    const { proposal, userId, profile } = await loadScopedProposal(supabase, idResult.data);

    if (proposal.status === 'accepted' || proposal.pricing_status === 'locked' || proposal.signed_at) {
        throw new Error('Esta propuesta ya está firmada. Sus precios quedan bloqueados en el histórico.');
    }

    const calculationData = proposal.calculation_data as InvoiceData;
    const currentResult = await calculateAletheiaSavings(calculationData);
    if (!currentResult.success) throw new Error(currentResult.error);

    const bestProposal = currentResult.data.top_proposals[0];
    if (!bestProposal) throw new Error('No hay tarifas activas para recalcular esta propuesta.');

    const savingsResult = mapAletheiaProposalToSavingsResult(bestProposal, currentResult.data);
    const enrichedCalculationData = {
        ...calculationData,
        calculation_audit: savingsResult.calculation_audit,
    } as Proposal['calculation_data'];
    const pricingDefaults = buildProposalPricingDefaults(savingsResult, 'reprice');
    const nextVersion = (proposal.proposal_version ?? 1) + 1;
    const deltaAnnualSavings = round2(savingsResult.annual_savings - (proposal.annual_savings ?? 0));

    const { data: newProposal, error } = await supabase
        .from('proposals')
        .insert({
            client_id: proposal.client_id,
            franchise_id: proposal.franchise_id ?? profile.franchise_id,
            agent_id: proposal.agent_id ?? userId,
            status: 'draft',
            offer_snapshot: pricingDefaults.offer_snapshot,
            calculation_data: enrichedCalculationData,
            current_annual_cost: savingsResult.current_annual_cost,
            offer_annual_cost: savingsResult.offer_annual_cost,
            annual_savings: savingsResult.annual_savings,
            savings_percent: savingsResult.savings_percent,
            optimization_result: savingsResult.optimization_result ?? null,
            aletheia_summary: proposal.aletheia_summary ?? null,
            source_tariff_id: pricingDefaults.source_tariff_id,
            source_proposal_id: proposal.id,
            proposal_version: nextVersion,
            price_snapshot: pricingDefaults.price_snapshot,
            price_snapshot_at: pricingDefaults.price_snapshot_at,
            pricing_status: 'current',
            notes: proposal.notes
                ? `${proposal.notes}\n\nVersión ${nextVersion} recalculada con tarifas actuales.`
                : `Versión ${nextVersion} recalculada con tarifas actuales.`,
        })
        .select('*, clients(name)')
        .single();

    if (error) throw new Error(`Error creando la nueva versión: ${error.message}`);

    await supabase
        .from('proposals')
        .update({
            pricing_status: 'outdated',
            repriced_at: new Date().toISOString(),
            repricing_delta_eur: deltaAnnualSavings,
        })
        .eq('id', proposal.id);

    try {
        await supabase.from('client_activities').insert({
            client_id: proposal.client_id,
            agent_id: userId,
            franchise_id: proposal.franchise_id ?? profile.franchise_id,
            type: 'proposal_created',
            description: `Propuesta v${nextVersion} recalculada con tarifas actuales`,
            metadata: {
                source_proposal_id: proposal.id,
                new_proposal_id: (newProposal as Proposal).id,
                delta_annual_savings: deltaAnnualSavings,
            },
        });
    } catch {
        // Non-critical: the versioned proposal is already created.
    }

    revalidatePath('/dashboard/proposals');
    revalidatePath(`/dashboard/proposals/${proposal.id}`);
    revalidatePath(`/dashboard/proposals/${(newProposal as Proposal).id}`);
    revalidatePath(`/dashboard/clients/${proposal.client_id}`);
    return { proposal: newProposal as Proposal, deltaAnnualSavings };
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

const TARIFF_CATALOG_SELECT = 'id, company, tariff_name, tariff_type, offer_type, fixed_fee, surplus_compensation_price, power_price_p1, power_price_p2, power_price_p3, power_price_p4, power_price_p5, power_price_p6, energy_price_p1, energy_price_p2, energy_price_p3, energy_price_p4, energy_price_p5, energy_price_p6, catalog_version, effective_from, effective_to, price_fingerprint';

async function loadScopedProposal(
    supabase: Awaited<ReturnType<typeof createClient>>,
    proposalId: string,
): Promise<{
    proposal: Proposal;
    userId: string;
    profile: { role: string; franchise_id: string | null };
}> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, franchise_id')
        .eq('id', user.id)
        .single();

    if (!profile) throw new Error('Perfil no encontrado');

    let query = supabase
        .from('proposals')
        .select('*, clients(name)')
        .eq('id', proposalId);

    if (profile.role === 'agent') {
        query = query.eq('agent_id', user.id) as typeof query;
    } else if (profile.role === 'franchise') {
        query = query.eq('franchise_id', profile.franchise_id) as typeof query;
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Error cargando propuesta: ${error.message}`);
    if (!data) throw new Error('Propuesta no encontrada');

    return {
        proposal: data as Proposal,
        userId: user.id,
        profile: profile as { role: string; franchise_id: string | null },
    };
}

async function findCurrentTariffForProposal(
    supabase: Awaited<ReturnType<typeof createClient>>,
    proposal: Proposal,
): Promise<TariffCatalogRow | null> {
    const offer = proposal.offer_snapshot;
    const sourceTariffId = proposal.source_tariff_id ?? getSourceTariffId(offer);

    if (isCatalogTariffId(sourceTariffId)) {
        const { data, error } = await supabase
            .from('lv_zinergia_tarifas')
            .select(TARIFF_CATALOG_SELECT)
            .eq('id', sourceTariffId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
        if (error) throw new Error(`Error consultando tarifa actual: ${error.message}`);
        if (data) return data as TariffCatalogRow;
    }

    if (!offer?.marketer_name || !offer?.tariff_name) return null;

    const { data, error } = await supabase
        .from('lv_zinergia_tarifas')
        .select(TARIFF_CATALOG_SELECT)
        .eq('company', offer.marketer_name)
        .eq('tariff_name', offer.tariff_name)
        .eq('is_active', true)
        .eq('supply_type', 'electricity')
        .order('catalog_version', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(`Error consultando tarifa actual: ${error.message}`);
    return data as TariffCatalogRow | null;
}

function fingerprintFromTariffRow(tariff: TariffCatalogRow): string {
    return tariff.price_fingerprint ?? buildTariffPriceFingerprint({
        id: tariff.id,
        company: tariff.company,
        tariff_name: tariff.tariff_name,
        type: (tariff.offer_type as 'fixed' | 'indexed') || 'fixed',
        fixed_fee: Number(tariff.fixed_fee || 0),
        surplus_compensation_price: Number(tariff.surplus_compensation_price || 0),
        power_price: {
            p1: Number(tariff.power_price_p1 || 0),
            p2: Number(tariff.power_price_p2 || 0),
            p3: Number(tariff.power_price_p3 || 0),
            p4: Number(tariff.power_price_p4 || 0),
            p5: Number(tariff.power_price_p5 || 0),
            p6: Number(tariff.power_price_p6 || 0),
        },
        energy_price: {
            p1: Number(tariff.energy_price_p1 || 0),
            p2: Number(tariff.energy_price_p2 || 0),
            p3: Number(tariff.energy_price_p3 || 0),
            p4: Number(tariff.energy_price_p4 || 0),
            p5: Number(tariff.energy_price_p5 || 0),
            p6: Number(tariff.energy_price_p6 || 0),
        },
        catalog_version: tariff.catalog_version ?? null,
    });
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
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

async function autoCloseLeadOnAcceptance(
    supabase: Pick<Awaited<ReturnType<typeof createClient>>, 'from'>,
    proposal: Proposal,
    actorId: string,
) {
    if (!proposal.client_id) return;
    try {
        const offer = proposal.offer_snapshot as unknown as Record<string, unknown> | null;
        const company = (offer?.marketer_name ?? offer?.marketerName ?? '') as string;
        const tariff = (offer?.tariff_name ?? offer?.tariffName ?? '') as string;

        const { data: openJob } = await supabase
            .from('ocr_jobs')
            .select('id, closed, lost')
            .eq('client_id', proposal.client_id)
            .eq('closed', false)
            .eq('lost', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!openJob) return;

        await supabase
            .from('ocr_jobs')
            .update({
                closed: true,
                closed_at: new Date().toISOString(),
                closed_company: company || null,
                closed_tariff: tariff || null,
                commission_amount: proposal.annual_savings
                    ? Number(proposal.annual_savings)
                    : null,
                lost: false,
                lost_at: null,
                lost_reason: null,
            })
            .eq('id', openJob.id);

        await writeLeadAuditEvent({
            jobId: openJob.id,
            actorId,
            eventType: 'lead_closed_won',
            title: 'Lead cerrado automáticamente por propuesta aceptada',
            detail: `${company} · ${tariff}`,
            metadata: { proposalId: proposal.id, auto: true },
        }).catch(() => undefined);

        await syncClientStatusFromLeads(supabase as unknown as SupabaseClient, proposal.client_id!);
    } catch (err) {
        logger.warn('[autoCloseLeadOnAcceptance] failed', { error: err });
    }
}

async function processCommissions(
    supabase: Pick<Awaited<ReturnType<typeof createClient>>, 'from'>,
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

        const agentId = proposal.agent_id;
        if (!agentId) return

        const { data: profile } = await supabase
            .from('profiles')
            .select('franchise_id')
            .eq('id', agentId)
            .single()

        const franchiseId = proposal.franchise_id ?? profile?.franchise_id;
        if (!franchiseId) return

        // Load active commission rule (falls back to defaults if table missing)
        const baseRule = await getActiveCommissionRule()

        // Per-franchise royalty: the franchise's configured cut of the agent's commission.
        const { data: franchiseCfg } = await supabase
            .from('franchise_config')
            .select('royalty_percent')
            .eq('franchise_id', franchiseId)
            .eq('active', true)
            .maybeSingle()
        const royaltyPercent: number | null = franchiseCfg?.royalty_percent ?? null

        // Commission amount comes from the shared resolver so public and
        // authenticated acceptance paths cannot drift.
        const offer = proposal.offer_snapshot as { estimated_agent_commission?: number | null } | null
        const resolvedCommission = resolveCommissionAmounts({
            annualSavings: proposal.annual_savings,
            estimatedAgentCommission: offer?.estimated_agent_commission,
            baseRule,
            royaltyPercent,
        })

        // Upsert con ignoreDuplicates: si dos requests concurrentes llegan al mismo tiempo,
        // el UNIQUE constraint en proposal_id garantiza que solo uno insertará. El otro
        // fallará silenciosamente. El JS check de arriba es un early-exit barato, no la
        // garantía real.
        await supabase.from('network_commissions').upsert({
            proposal_id: proposal.id,
            agent_id: agentId,
            franchise_id: franchiseId,
            agent_commission: resolvedCommission.agentCommission,
            franchise_commission: resolvedCommission.franchiseCommission,
            status: 'pending',
        }, { onConflict: 'proposal_id', ignoreDuplicates: true })

        // Award gamification points (upsert to handle first-time users)
        const { data: current } = await supabase
            .from('user_points')
            .select('points')
            .eq('user_id', agentId)
            .maybeSingle()

        await supabase.from('user_points').upsert({
            user_id: agentId,
            points: (current?.points || 0) + resolvedCommission.points,
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
    supabase: Pick<Awaited<ReturnType<typeof createClient>>, 'from'>,
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
    supabase: Pick<Awaited<ReturnType<typeof createClient>>, 'from'>,
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
    supabase: Pick<Awaited<ReturnType<typeof createClient>>, 'from'>,
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
