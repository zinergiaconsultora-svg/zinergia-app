'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createUntypedClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';
import { logger } from '@/lib/utils/logger';
import { writeLeadAuditEvent } from '@/lib/audit/leadAuditLog';
import { logAdminAction } from '@/lib/audit/logger';
import { buildLeadsCsv } from '@/features/admin/leads/exportCsv';
import { rateLimit } from '@/lib/rate-limit';
import type { InvoiceRegistryRow } from './invoices';

const MAX_BULK = 200;
const bulkRateLimiter = rateLimit({ windowMs: 60_000, max: 5 });
const jobIdsSchema = z.array(z.uuid()).min(1, 'Selecciona al menos un lead').max(MAX_BULK, 'Demasiados leads seleccionados');

/**
 * Reassigns selected leads to another comercial. Admin only. The lead's
 * franchise follows the new agent to keep agent/franchise consistent, and each
 * move is recorded in the (server-only) audit log.
 */
export async function bulkReassignLeadsAction(
    jobIds: string[],
    newAgentId: string,
): Promise<{ success: boolean; updated: number; message?: string }> {
    await requireServerRole(['admin']);

    const ids = jobIdsSchema.safeParse(jobIds);
    if (!ids.success) return { success: false, updated: 0, message: ids.error.issues[0].message };
    if (!z.uuid().safeParse(newAgentId).success) return { success: false, updated: 0, message: 'Comercial inválido' };

    const supabase = await createUntypedClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { allowed } = bulkRateLimiter.check(user?.id ?? 'anon');
    if (!allowed) return { success: false, updated: 0, message: 'Demasiadas acciones, espera un momento' };

    const { data: agent } = await supabase
        .from('profiles')
        .select('id, full_name, franchise_id')
        .eq('id', newAgentId)
        .maybeSingle();
    if (!agent) return { success: false, updated: 0, message: 'Comercial no encontrado' };

    const { data: updated, error } = await supabase
        .from('ocr_jobs')
        .update({ agent_id: agent.id, franchise_id: agent.franchise_id ?? null })
        .in('id', ids.data)
        .select('id');

    if (error) {
        logger.error('[leadBulk] reassign failed', { error: error.message });
        return { success: false, updated: 0, message: 'No se pudo reasignar' };
    }

    // Server-only audit, one event per lead (best-effort).
    await Promise.all(
        (updated ?? []).map((j) =>
            writeLeadAuditEvent({
                jobId: j.id,
                eventType: 'lead_reassigned',
                title: 'Lead reasignado',
                detail: `Asignado a ${agent.full_name ?? 'comercial'}`,
                metadata: { newAgentId: agent.id },
                actorId: user?.id ?? null,
            }).catch(() => undefined),
        ),
    );

    revalidatePath('/admin/leads');
    return { success: true, updated: updated?.length ?? 0 };
}

/**
 * Marks selected leads as reviewed by the admin (triage inbox). Admin only;
 * each is recorded in the audit log.
 */
export async function markLeadsReviewedAction(
    jobIds: string[],
): Promise<{ success: boolean; updated: number; message?: string }> {
    await requireServerRole(['admin']);

    const ids = jobIdsSchema.safeParse(jobIds);
    if (!ids.success) return { success: false, updated: 0, message: ids.error.issues[0].message };

    const supabase = await createUntypedClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { allowed } = bulkRateLimiter.check(user?.id ?? 'anon');
    if (!allowed) return { success: false, updated: 0, message: 'Demasiadas acciones, espera un momento' };

    const { data: updated, error } = await supabase
        .from('ocr_jobs')
        .update({ reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null })
        .in('id', ids.data)
        .select('id');

    if (error) {
        logger.error('[leadBulk] mark reviewed failed', { error: error.message });
        return { success: false, updated: 0, message: 'No se pudo marcar como revisado' };
    }

    await Promise.all(
        (updated ?? []).map((j) =>
            writeLeadAuditEvent({
                jobId: j.id,
                eventType: 'lead_reviewed',
                title: 'Lead revisado',
                actorId: user?.id ?? null,
            }).catch(() => undefined),
        ),
    );

    revalidatePath('/admin/leads');
    return { success: true, updated: updated?.length ?? 0 };
}

/**
 * Exports the selected leads as a CSV string (Excel-ES, semicolon-delimited).
 * Admin only. Reads through the RLS-scoped registry VIEW.
 */
export async function exportLeadsCsvAction(
    jobIds: string[],
): Promise<{ success: boolean; csv?: string; message?: string }> {
    await requireServerRole(['admin']);

    const ids = jobIdsSchema.safeParse(jobIds);
    if (!ids.success) return { success: false, message: ids.error.issues[0].message };

    const supabase = await createUntypedClient();
    const { data, error } = await supabase
        .from('invoice_registry')
        .select('*')
        .in('job_id', ids.data)
        .order('created_at', { ascending: false });

    if (error) {
        logger.error('[leadBulk] export failed', { error: error.message });
        return { success: false, message: 'No se pudo exportar' };
    }

    // RGPD: registrar la exportación de datos personales (titular/CUPS).
    await logAdminAction('leads_exported_csv', 'ocr_jobs', null, { count: data?.length ?? 0 }).catch(() => {});

    return { success: true, csv: buildLeadsCsv((data ?? []) as InvoiceRegistryRow[]) };
}
