'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { requireServerRole } from '@/lib/auth/permissions';
import { uuidSchema } from '@/lib/validation/schemas';

export interface ClientExpiringSoon {
    id: string;
    name: string;
    email: string | null;
    status: string;
    updated_at: string;
    purge_date: string;
}

export interface AuditLogEntry {
    id: string;
    action: string;
    table_name: string;
    record_id: string | null;
    new_data: Record<string, unknown> | null;
    created_at: string;
}

export interface RgpdStats {
    expiringSoon: ClientExpiringSoon[];
    recentDeletions: AuditLogEntry[];
    totalPurgedThisYear: number;
}

/**
 * Returns RGPD dashboard data: clients expiring in 30 days + audit log.
 * Admin only.
 */
export async function getRgpdStatsAction(): Promise<RgpdStats> {
    await requireServerRole(['admin']);
    const supabase = createServiceClient();

    const [expiringResult, deletionsResult, countResult] = await Promise.all([
        // Clients that will be purged in the next 30 days
        supabase
            .from('v_clients_expiring_soon')
            .select('*')
            .order('purge_date', { ascending: true })
            .limit(50),

        // Most recent RGPD deletions
        supabase
            .from('audit_logs')
            .select('id, action, table_name, record_id, new_data, created_at')
            .in('action', ['rgpd_deletion', 'rgpd_retention_won_5y', 'rgpd_retention_inactive_12m'])
            .order('created_at', { ascending: false })
            .limit(20),

        // Count of automated purges this calendar year
        supabase
            .from('audit_logs')
            .select('id', { count: 'exact', head: true })
            .in('action', ['rgpd_retention_won_5y', 'rgpd_retention_inactive_12m'])
            .gte('created_at', new Date(new Date().getFullYear(), 0, 1).toISOString()),
    ]);

    return {
        expiringSoon: (expiringResult.data ?? []) as ClientExpiringSoon[],
        recentDeletions: (deletionsResult.data ?? []) as AuditLogEntry[],
        totalPurgedThisYear: countResult.count ?? 0,
    };
}

/**
 * Manually trigger the RGPD purge for a single client (Art. 17 erasure).
 * Writes audit log, then deletes. Admin only.
 */
export async function eraseClientAction(
    clientId: string,
): Promise<{ success: boolean; message: string }> {
    await requireServerRole(['admin']);

    const safeId = uuidSchema.safeParse(clientId);
    if (!safeId.success) {
        return { success: false, message: 'ID de cliente inválido.' };
    }

    const supabase = createServiceClient();

    // Fetch client info for the audit record
    const { data: client, error: fetchErr } = await supabase
        .from('clients')
        .select('id, name, email, status')
        .eq('id', safeId.data)
        .maybeSingle();

    if (fetchErr || !client) {
        return { success: false, message: 'Cliente no encontrado.' };
    }

    // Write audit log before deletion
    const { error: auditErr } = await supabase
        .from('audit_logs')
        .insert({
            action: 'rgpd_deletion',
            table_name: 'clients',
            record_id: client.id,
            new_data: {
                reason: 'rgpd_art17_admin_erasure',
                deleted_at: new Date().toISOString(),
                client_name: client.name,
                client_email: client.email,
                client_status: client.status,
            },
        });

    if (auditErr) {
        return { success: false, message: `Error al registrar en audit log: ${auditErr.message}` };
    }

    // Delete (cascades to proposals, ocr_jobs, etc.)
    const { error: deleteErr } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

    if (deleteErr) {
        return { success: false, message: `Error al eliminar cliente: ${deleteErr.message}` };
    }

    return {
        success: true,
        message: `Cliente "${client.name}" eliminado. Registro de auditoría conservado.`,
    };
}

/**
 * Manually trigger the automated purge (runs the SQL function).
 * Useful for testing and for emergency manual runs. Admin only.
 */
export async function triggerPurgeAction(): Promise<{ success: boolean; deleted: number; message: string }> {
    await requireServerRole(['admin']);
    const supabase = createServiceClient();

    const { data, error } = await supabase.rpc('purge_expired_clients');

    if (error) {
        return { success: false, deleted: 0, message: `Error: ${error.message}` };
    }

    const deleted = (data as number) ?? 0;
    return {
        success: true,
        deleted,
        message: deleted > 0
            ? `${deleted} cliente(s) eliminados según política de retención.`
            : 'No hay clientes que superen el período de retención.',
    };
}
