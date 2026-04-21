'use server';

import { requireServerRole } from '@/lib/auth/permissions';
import { createServiceClient } from '@/lib/supabase/service';
import { z } from 'zod';

const ADMIN_ACTIONS = [
    'clear_commission', 'pay_commission',
    'save_commission_rule',
    'create_offer', 'update_offer', 'delete_offer',
    'create_franchise', 'update_agent',
    'rgpd_deletion', 'rgpd_retention_won_5y', 'rgpd_retention_inactive_12m',
] as const;

export interface AuditEntry {
    id: string;
    user_id: string | null;
    action: string;
    table_name: string;
    record_id: string | null;
    new_data: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    /** Resolved from profiles join */
    actor_email?: string | null;
}

const filtersSchema = z.object({
    action: z.string().optional(),
    table_name: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
});

export type AuditFilters = z.input<typeof filtersSchema>;

export interface AuditResult {
    entries: AuditEntry[];
    total: number;
    actions: string[];
}

/**
 * Returns paginated audit log entries with actor email resolved.
 * Admin only.
 */
export async function getAuditLogAction(rawFilters: AuditFilters = {}): Promise<AuditResult> {
    await requireServerRole(['admin']);

    const filters = filtersSchema.parse(rawFilters);
    const supabase = createServiceClient();

    let query = supabase
        .from('audit_logs')
        .select(`
            id, user_id, action, table_name, record_id,
            new_data, ip_address, user_agent, created_at,
            profiles!audit_logs_user_id_fkey(email)
        `, { count: 'exact' })
        .in('action', ADMIN_ACTIONS)
        .order('created_at', { ascending: false })
        .range(filters.offset, filters.offset + filters.limit - 1);

    if (filters.action) query = query.eq('action', filters.action);
    if (filters.table_name) query = query.eq('table_name', filters.table_name);
    if (filters.from) query = query.gte('created_at', filters.from);
    if (filters.to) query = query.lte('created_at', filters.to);

    const { data, error, count } = await query;

    if (error) throw new Error(`Error cargando audit log: ${error.message}`);

    const entries: AuditEntry[] = (data ?? []).map(row => ({
        id: row.id,
        user_id: row.user_id,
        action: row.action,
        table_name: row.table_name,
        record_id: row.record_id,
        new_data: row.new_data as Record<string, unknown> | null,
        ip_address: row.ip_address as string | null,
        user_agent: row.user_agent as string | null,
        created_at: row.created_at,
        actor_email: (row.profiles as unknown as { email?: string } | null)?.email ?? null,
    }));

    return {
        entries,
        total: count ?? 0,
        actions: [...ADMIN_ACTIONS],
    };
}
