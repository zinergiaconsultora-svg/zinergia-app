'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireServerRole } from '@/lib/auth/permissions';
import { createUntypedClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import {
    writeLeadAuditEvent,
    type LeadAuditEventType,
    type WriteLeadAuditEventInput,
} from '@/lib/audit/leadAuditLog';
import { rateLimit } from '@/lib/rate-limit';

const noteRateLimiter = rateLimit({ windowMs: 60_000, max: 10 });

export interface LeadAuditEvent {
    id: string;
    job_id: string;
    actor_id: string | null;
    event_type: LeadAuditEventType;
    title: string;
    detail: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    actor_name: string | null;
    actor_email: string | null;
}

interface LeadAuditRow {
    id: string;
    job_id: string;
    actor_id: string | null;
    event_type: LeadAuditEventType;
    title: string;
    detail: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    profiles?: { full_name?: string | null; email?: string | null } | null;
}

const jobIdSchema = z.uuid();
const noteSchema = z.string().trim().min(1, 'La nota no puede estar vacía').max(2000, 'La nota es demasiado larga');

export type RecordLeadAuditEventInput = Omit<WriteLeadAuditEventInput, 'actorId'>;

/**
 * Authorizes that the current user may act on `jobId` (RLS-scoped read) and
 * returns their id. Null result = not authenticated or not allowed to see it.
 */
async function authorizeActor(supabase: SupabaseClient, jobId: string): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    // RLS returns the job only if the user can see it (own / franchise / admin).
    const { data: job } = await supabase.from('ocr_jobs').select('id').eq('id', jobId).maybeSingle();
    return job ? user.id : null;
}

/**
 * Records a user-attributed audit event. Authorization is enforced via the
 * session client (RLS); the row is written via the service client so the log
 * stays append-only and unforgeable. Used by the invoice close/lost/reopen flow.
 */
export async function recordLeadAuditEvent(input: RecordLeadAuditEventInput): Promise<{ success: boolean; message?: string }> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    if (!jobIdSchema.safeParse(input.jobId).success) return { success: false, message: 'ID inválido' };
    if (!input.title.trim()) return { success: false, message: 'El título de auditoría es obligatorio' };

    const supabase = await createUntypedClient();
    const actorId = await authorizeActor(supabase, input.jobId);
    if (!actorId) return { success: false, message: 'Lead no accesible' };

    const result = await writeLeadAuditEvent({ ...input, actorId });
    if (result.success) revalidatePath('/admin/leads');
    return result;
}

export async function addLeadNoteAction(jobId: string, rawNote: string): Promise<{ success: boolean; message?: string }> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    if (!jobIdSchema.safeParse(jobId).success) return { success: false, message: 'ID inválido' };

    const parsed = noteSchema.safeParse(rawNote);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };

    const supabase = await createUntypedClient();
    const actorId = await authorizeActor(supabase, jobId);
    if (!actorId) return { success: false, message: 'Lead no accesible' };

    const { allowed } = noteRateLimiter.check(actorId);
    if (!allowed) return { success: false, message: 'Demasiadas notas, espera un momento' };

    const result = await writeLeadAuditEvent({
        jobId,
        eventType: 'note_added',
        title: 'Nota interna',
        detail: parsed.data,
        actorId,
    });
    if (result.success) revalidatePath('/admin/leads');
    return result;
}

export async function getLeadAuditEventsAction(jobId: string): Promise<LeadAuditEvent[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    if (!jobIdSchema.safeParse(jobId).success) return [];

    const supabase = await createUntypedClient();
    const { data, error } = await supabase
        .from('lead_audit_events')
        .select(`
            id, job_id, actor_id, event_type, title, detail, metadata, created_at,
            profiles!lead_audit_events_actor_id_fkey(full_name, email)
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

    if (error) {
        logger.error('[leadAudit] load failed', { error: error.message });
        return [];
    }

    return ((data ?? []) as LeadAuditRow[]).map((event) => ({
        id: event.id,
        job_id: event.job_id,
        actor_id: event.actor_id,
        event_type: event.event_type,
        title: event.title,
        detail: event.detail,
        metadata: event.metadata ?? {},
        created_at: event.created_at,
        actor_name: event.profiles?.full_name ?? null,
        actor_email: event.profiles?.email ?? null,
    }));
}
