/**
 * Low-level lead-audit writer — server-only, tamper-resistant.
 *
 * Writes go through the SERVICE client so the audit log is the single source of
 * truth that only the server can append to. The table grants no INSERT to
 * `authenticated`, so end users can never forge or alter entries directly; they
 * only read (RLS-scoped) via the server actions.
 *
 * This is a plain module (NOT 'use server'): it can be called from server
 * actions (user-attributed events) and from trusted system contexts — the OCR
 * webhook and the Drive archive job (system events with actor_id = null).
 */

import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/utils/logger';

export type LeadAuditEventType =
    | 'note_added'
    | 'lead_closed_won'
    | 'lead_marked_lost'
    | 'lead_reopened'
    | 'closure_updated'
    | 'lost_reason_updated'
    | 'drive_synced'
    | 'ocr_failed'
    | 'lead_reassigned'
    | 'lead_reviewed'
    | 'renewal_alert';

export interface WriteLeadAuditEventInput {
    jobId: string;
    eventType: LeadAuditEventType;
    title: string;
    detail?: string | null;
    metadata?: Record<string, unknown>;
    /** Authenticated user who triggered it, or null for system events. */
    actorId: string | null;
}

export async function writeLeadAuditEvent(
    input: WriteLeadAuditEventInput,
): Promise<{ success: boolean; message?: string }> {
    const admin = createServiceClient();
    const { error } = await admin.from('lead_audit_events').insert({
        job_id: input.jobId,
        actor_id: input.actorId,
        event_type: input.eventType,
        title: input.title.trim().slice(0, 160),
        detail: input.detail?.trim() ? input.detail.trim().slice(0, 2000) : null,
        metadata: input.metadata ?? {},
    });

    if (error) {
        logger.error('[leadAudit] write failed', { error: error.message, eventType: input.eventType });
        return { success: false, message: 'No se pudo guardar la auditoría' };
    }
    return { success: true };
}
