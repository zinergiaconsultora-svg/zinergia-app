'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireServerRole } from '@/lib/auth/permissions';
import { logger } from '@/lib/utils/logger';
import { extractStoragePath } from '@/lib/drive/storagePath';
import { recordLeadAuditEvent, type RecordLeadAuditEventInput } from './leadAudit';

export type InvoiceProcessStatus =
    | 'uploaded'
    | 'ocr_done'
    | 'compared'
    | 'closed_won'
    | 'closed_lost'
    | 'failed';

async function safeRecordLeadAuditEvent(input: RecordLeadAuditEventInput): Promise<void> {
    try {
        const result = await recordLeadAuditEvent(input);
        if (!result.success) logger.error('[invoices] lead audit event failed', { reason: result.message });
    } catch (error) {
        logger.error('[invoices] lead audit event threw', { error: error instanceof Error ? error.message : 'unknown' });
    }
}

interface LeadStateSnapshot {
    closed: boolean | null;
    lost: boolean | null;
    lost_reason: string | null;
}

async function getLeadStateSnapshot(supabase: SupabaseClient, jobId: string): Promise<LeadStateSnapshot | null> {
    const { data, error } = await supabase
        .from('ocr_jobs')
        .select('closed,lost,lost_reason')
        .eq('id', jobId)
        .maybeSingle();

    if (error) {
        logger.error('[invoices] lead state snapshot failed', { error: error.message });
        return null;
    }

    return (data ?? null) as LeadStateSnapshot | null;
}

/** One row of the invoice registry — mirrors the `invoice_registry` VIEW. */
export interface InvoiceRegistryRow {
    job_id: string;
    agent_id: string;
    franchise_id: string | null;
    created_at: string;
    ocr_status: string;
    compared_at: string | null;
    drive_view_link: string | null;
    drive_synced_at: string | null;
    archived_in_drive: boolean;
    process_status: InvoiceProcessStatus;
    titular: string | null;
    comercializadora_actual: string | null;
    cups: string | null;
    importe_total: string | null;
    tarifa_actual: string | null;
    // Cierre (ligero, en el propio job)
    closed: boolean;
    lost: boolean;
    lost_reason: string | null;
    compania_contratada: string | null;
    tarifa_contratada: string | null;
    permanencia_hasta: string | null;
    commission_amount: number | null;
    closed_at: string | null;
    // Enriquecido para el cockpit admin
    agent_name: string | null;
    franchise_name: string | null;
    // Señales de prioridad comercial
    period_days: string | null;
    annual_savings: number | null;
    savings_percent: number | null;
    has_proposal: boolean;
    // Triaje
    reviewed_at: string | null;
}

/**
 * Lists invoices from the registry VIEW. RLS (security_invoker) scopes the rows
 * to the caller: a comercial sees only their own, admin/franchise see more.
 */
export async function getInvoicesAction(limit = 20, offset = 0): Promise<InvoiceRegistryRow[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    // The VIEW isn't in the generated Database types; query via the untyped
    // client (the auth/session context still applies, so RLS is enforced).
    const supabase = (await createClient()) as unknown as SupabaseClient;

    const { data, error } = await supabase
        .from('invoice_registry')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        logger.error('[invoices] getInvoicesAction failed', { error: error.message });
        return [];
    }
    return (data ?? []) as InvoiceRegistryRow[];
}

/**
 * Returns a fresh, short-lived signed URL to open the invoice's stored copy in
 * Supabase (the comercial's own file, RLS-scoped). Null if the file was already
 * purged (lifecycle) or never stored — for archived files, admins use Drive.
 */
export async function getInvoiceFileUrlAction(jobId: string): Promise<string | null> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    if (!z.uuid().safeParse(jobId).success) return null;

    // Authorize via the RLS-gated session client: the caller only resolves jobs
    // they may see (own / franchise / admin-all).
    const supabase = (await createClient()) as unknown as SupabaseClient;
    const { data: job } = await supabase.from('ocr_jobs').select('file_path').eq('id', jobId).single();
    if (!job?.file_path) return null;

    const path = extractStoragePath(job.file_path, 'ocr-invoices');
    if (!path) return null;

    // Sign with the service client so an admin can open a comercial's file too
    // (storage RLS is folder-scoped by owner uid). Authorization already happened above.
    const { data } = await createServiceClient().storage.from('ocr-invoices').createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
}

const closeInvoiceSchema = z.object({
    company: z.string().trim().min(1, 'La compañía es obligatoria').max(120),
    tariff: z.string().trim().max(120).optional().nullable(),
    // ISO date (YYYY-MM-DD) or null when there's no permanence.
    permanenceUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    commission: z.coerce.number().nonnegative('La comisión no puede ser negativa').max(1_000_000),
});

export type CloseInvoiceInput = z.input<typeof closeInvoiceSchema>;

/**
 * Closes a lead → converts it to CLIENTE. Only an admin can confirm the lead
 * accepted the offer (the closing check), capturing the accepted company, tariff,
 * permanence end date (optional → review reminder) and the comercial's commission.
 */
export async function closeInvoiceAction(
    jobId: string,
    input: CloseInvoiceInput,
): Promise<{ success: boolean; message?: string }> {
    await requireServerRole(['admin']);
    if (!z.uuid().safeParse(jobId).success) return { success: false, message: 'ID inválido' };

    const parsed = closeInvoiceSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0].message };
    }

    // Cast to the untyped client: the closure columns aren't in the generated
    // types yet. RLS still applies (session-based).
    const supabase = (await createClient()) as unknown as SupabaseClient;
    const previousState = await getLeadStateSnapshot(supabase, jobId);
    const { error } = await supabase
        .from('ocr_jobs')
        .update({
            closed: true,
            closed_company: parsed.data.company,
            closed_tariff: parsed.data.tariff ?? null,
            permanence_until: parsed.data.permanenceUntil ?? null,
            commission_amount: parsed.data.commission,
            closed_at: new Date().toISOString(),
            // Converting clears any prior "lost" mark so won/lost stay mutually
            // exclusive (otherwise conversion-rate metrics double-count).
            lost: false,
            lost_at: null,
            lost_reason: null,
            permanence_reminded_at: null,
        })
        .eq('id', jobId);

    if (error) {
        logger.error('[invoices] closeInvoiceAction failed', { error: error.message });
        return { success: false, message: 'No se pudo cerrar la factura' };
    }
    const wasAlreadyClosed = previousState?.closed === true;
    await safeRecordLeadAuditEvent({
        jobId,
        eventType: wasAlreadyClosed ? 'closure_updated' : 'lead_closed_won',
        title: wasAlreadyClosed ? 'Cierre actualizado' : 'Lead convertido en cliente',
        detail: parsed.data.company,
        metadata: {
            company: parsed.data.company,
            tariff: parsed.data.tariff ?? null,
            permanenceUntil: parsed.data.permanenceUntil ?? null,
            commission: parsed.data.commission,
        },
    });
    revalidatePath('/dashboard/invoices');
    revalidatePath('/admin/leads');
    return { success: true };
}

/** Reverts a closure or a lost mark (CLIENTE/PERDIDO → LEAD). Admin only. */
export async function reopenInvoiceAction(jobId: string): Promise<{ success: boolean }> {
    await requireServerRole(['admin']);
    if (!z.uuid().safeParse(jobId).success) return { success: false };

    const supabase = (await createClient()) as unknown as SupabaseClient;
    const { error } = await supabase
        .from('ocr_jobs')
        .update({
            closed: false,
            closed_company: null,
            closed_tariff: null,
            permanence_until: null,
            commission_amount: null,
            closed_at: null,
            permanence_reminded_at: null,
            lost: false,
            lost_at: null,
            lost_reason: null,
        })
        .eq('id', jobId);

    if (error) {
        logger.error('[invoices] reopenInvoiceAction failed', { error: error.message });
        return { success: false };
    }
    await safeRecordLeadAuditEvent({
        jobId,
        eventType: 'lead_reopened',
        title: 'Lead reabierto',
        detail: 'Vuelve a estado lead',
        metadata: {},
    });
    revalidatePath('/dashboard/invoices');
    revalidatePath('/admin/leads');
    return { success: true };
}

/** Marks a lead as LOST (did not accept the offer). Admin only. */
export async function markLeadLostAction(
    jobId: string,
    reason?: string | null,
): Promise<{ success: boolean }> {
    await requireServerRole(['admin']);
    if (!z.uuid().safeParse(jobId).success) return { success: false };

    const supabase = (await createClient()) as unknown as SupabaseClient;
    const previousState = await getLeadStateSnapshot(supabase, jobId);
    const { error } = await supabase
        .from('ocr_jobs')
        .update({
            lost: true,
            lost_at: new Date().toISOString(),
            lost_reason: reason?.trim() ? reason.trim().slice(0, 300) : null,
            // Marking lost clears any prior closure.
            closed: false,
            closed_company: null,
            closed_tariff: null,
            permanence_until: null,
            commission_amount: null,
            closed_at: null,
            permanence_reminded_at: null,
        })
        .eq('id', jobId);

    if (error) {
        logger.error('[invoices] markLeadLostAction failed', { error: error.message });
        return { success: false };
    }
    const normalizedReason = reason?.trim() ? reason.trim().slice(0, 300) : null;
    const wasAlreadyLost = previousState?.lost === true;
    await safeRecordLeadAuditEvent({
        jobId,
        eventType: wasAlreadyLost ? 'lost_reason_updated' : 'lead_marked_lost',
        title: wasAlreadyLost ? 'Motivo de pérdida actualizado' : 'Lead marcado como perdido',
        detail: normalizedReason,
        metadata: { previousReason: previousState?.lost_reason ?? null, reason: normalizedReason },
    });
    revalidatePath('/admin/leads');
    return { success: true };
}

export type AdminLeadOutcome = 'open' | 'won' | 'lost' | 'all';
export type AdminLeadQueue = 'drive_pending' | 'ocr_failed' | 'needs_comparison' | 'permanence_due' | 'cooling' | 'needs_review';

export interface AdminLeadFilters {
    outcome?: AdminLeadOutcome;
    queue?: AdminLeadQueue;
    agentId?: string;
    franchiseId?: string;
    search?: string;
}

/**
 * Admin cockpit query over the registry VIEW. RLS (admin_all) gives the admin
 * global visibility; filters narrow the queue.
 */
export async function getAdminLeadsAction(
    filters: AdminLeadFilters = {},
    limit = 30,
    offset = 0,
): Promise<InvoiceRegistryRow[]> {
    await requireServerRole(['admin']);
    const supabase = (await createClient()) as unknown as SupabaseClient;

    let query = supabase.from('invoice_registry').select('*');

    if (filters.queue === 'drive_pending') {
        query = query.eq('archived_in_drive', false);
    } else if (filters.queue === 'ocr_failed') {
        query = query.eq('process_status', 'failed');
    } else if (filters.queue === 'needs_comparison') {
        query = query.eq('process_status', 'ocr_done');
    } else if (filters.queue === 'permanence_due') {
        const dueBefore = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        query = query
            .eq('process_status', 'closed_won')
            .not('permanencia_hasta', 'is', null)
            .lte('permanencia_hasta', dueBefore);
    } else if (filters.queue === 'cooling') {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.eq('closed', false).eq('lost', false).lt('created_at', cutoff);
    } else if (filters.queue === 'needs_review') {
        query = query.eq('closed', false).eq('lost', false).is('reviewed_at', null);
    } else {
        const outcome = filters.outcome ?? 'open';
        if (outcome === 'won') query = query.eq('process_status', 'closed_won');
        else if (outcome === 'lost') query = query.eq('process_status', 'closed_lost');
        else if (outcome === 'open') query = query.not('process_status', 'in', '("closed_won","closed_lost")');
    }

    if (filters.agentId) query = query.eq('agent_id', filters.agentId);
    if (filters.franchiseId) query = query.eq('franchise_id', filters.franchiseId);
    if (filters.search?.trim()) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(`titular.ilike.${term},agent_name.ilike.${term}`);
    }

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        logger.error('[invoices] getAdminLeadsAction failed', { error: error.message });
        return [];
    }
    return (data ?? []) as InvoiceRegistryRow[];
}

export interface LeadFunnel {
    uploaded: number;
    ocr_done: number;
    compared: number;
    won: number;
}

export interface LeadMetrics {
    open_leads: number;
    won_total: number;
    lost_total: number;
    clients_this_month: number;
    commission_total: number;
    commission_this_month: number;
    pending_drive: number;
    permanence_due_30: number;
    funnel: LeadFunnel;
}

export interface LeadAgentRank {
    agent_id: string;
    agent_name: string | null;
    won: number;
    lost: number;
    open_leads: number;
    commission: number;
}

const EMPTY_METRICS: LeadMetrics = {
    open_leads: 0, won_total: 0, lost_total: 0, clients_this_month: 0,
    commission_total: 0, commission_this_month: 0, pending_drive: 0, permanence_due_30: 0,
    funnel: { uploaded: 0, ocr_done: 0, compared: 0, won: 0 },
};

/** Aggregated metrics + per-agent ranking for the admin cockpit. Admin only. */
export async function getLeadMetricsAction(): Promise<{ metrics: LeadMetrics; ranking: LeadAgentRank[] }> {
    await requireServerRole(['admin']);
    const supabase = (await createClient()) as unknown as SupabaseClient;

    const [metricsRes, rankingRes] = await Promise.all([
        supabase.rpc('get_lead_metrics'),
        supabase.rpc('get_lead_agent_ranking'),
    ]);

    if (metricsRes.error) logger.error('[invoices] get_lead_metrics failed', { error: metricsRes.error.message });
    if (rankingRes.error) logger.error('[invoices] get_lead_agent_ranking failed', { error: rankingRes.error.message });

    const metrics = (metricsRes.data as LeadMetrics | null) ?? EMPTY_METRICS;
    const ranking = (rankingRes.data as LeadAgentRank[] | null) ?? [];
    return { metrics, ranking };
}

export interface LeadAlerts {
    drive_pending: number;
    ocr_failed: number;
    needs_comparison: number;
    permanence_due: number;
    cooling: number;
    needs_review: number;
}

export interface FranchiseConversion {
    franchise_name: string | null;
    won: number;
    lost: number;
    open_leads: number;
    commission: number;
}

export interface LossReason {
    reason: string;
    count: number;
}

export interface LeadAnalytics {
    alerts: LeadAlerts;
    by_franchise: FranchiseConversion[];
    loss_reasons: LossReason[];
    pipeline_savings: number;
}

const EMPTY_ANALYTICS: LeadAnalytics = {
    alerts: { drive_pending: 0, ocr_failed: 0, needs_comparison: 0, permanence_due: 0, cooling: 0, needs_review: 0 },
    by_franchise: [],
    loss_reasons: [],
    pipeline_savings: 0,
};

/** Advanced admin analytics: operational alerts, franchise conversion, loss reasons, pipeline value. Admin only. */
export async function getLeadAnalyticsAction(): Promise<LeadAnalytics> {
    await requireServerRole(['admin']);
    const supabase = (await createClient()) as unknown as SupabaseClient;

    const { data, error } = await supabase.rpc('get_lead_analytics');
    if (error) {
        logger.error('[invoices] get_lead_analytics failed', { error: error.message });
        return EMPTY_ANALYTICS;
    }
    return (data as LeadAnalytics | null) ?? EMPTY_ANALYTICS;
}
