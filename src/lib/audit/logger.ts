/**
 * Admin audit logger.
 *
 * Writes a structured entry to the `audit_logs` table after any admin
 * mutation. Designed to be called as **best-effort** (fire-and-forget)
 * so that audit failures never block the main business operation.
 *
 * Usage:
 *   logAdminAction('clear_commission', 'network_commissions', id).catch(() => {})
 *
 * The function reads the current authenticated user via the server Supabase
 * client and IP / User-Agent from Next.js request headers. Both are
 * best-effort: if unavailable, the log entry is still written without them.
 */

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export interface AuditContext {
    /** Actor user ID (resolved automatically if omitted). */
    actorId?: string;
    /** Actor role (resolved automatically if omitted). */
    actorRole?: string;
    /** IP address (resolved from headers automatically if omitted). */
    ip?: string;
    /** User-Agent header (resolved automatically if omitted). */
    userAgent?: string;
}

/**
 * Write an audit log entry to `audit_logs`.
 *
 * This function is safe to call with `.catch(() => {})` — all internal
 * errors are swallowed so as never to interrupt the calling action.
 *
 * @param action       Short verb: e.g. 'clear_commission', 'create_franchise'
 * @param tableName    Target DB table: e.g. 'network_commissions'
 * @param recordId     UUID of the affected row (optional)
 * @param payloadDiff  Before/after data for auditing (stored in new_data)
 * @param ctx          Override resolved context (useful for testing)
 */
export async function logAdminAction(
    action: string,
    tableName: string,
    recordId?: string | null,
    payloadDiff?: Record<string, unknown> | null,
    ctx?: AuditContext,
): Promise<void> {
    try {
        // Resolve actor from current session
        let actorId = ctx?.actorId;
        let actorRole = ctx?.actorRole;

        if (!actorId || !actorRole) {
            try {
                const supabase = await createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    actorId ??= user.id;
                    if (!actorRole) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('role')
                            .eq('id', user.id)
                            .maybeSingle();
                        actorRole = (profile?.role as string | undefined) ?? undefined;
                    }
                }
            } catch {
                // Non-critical — continue without actor info
            }
        }

        // Resolve IP / UA from Next.js headers (available inside Server Actions)
        let ip = ctx?.ip;
        let userAgent = ctx?.userAgent;

        if (!ip || !userAgent) {
            try {
                const { headers } = await import('next/headers');
                const h = await headers();
                ip ??= h.get('x-forwarded-for')?.split(',')[0].trim()
                    ?? h.get('x-real-ip')
                    ?? undefined;
                userAgent ??= h.get('user-agent') ?? undefined;
            } catch {
                // headers() may throw outside of a request context (e.g. tests)
            }
        }

        const adminClient = createServiceClient();
        await adminClient.from('audit_logs').insert({
            user_id: actorId ?? null,
            action,
            table_name: tableName,
            record_id: recordId ?? null,
            new_data: payloadDiff
                ? { ...payloadDiff, actor_role: actorRole ?? 'unknown' }
                : { actor_role: actorRole ?? 'unknown' },
            ip_address: ip ?? null,
            user_agent: userAgent ?? null,
        });
    } catch {
        // Audit failure must never propagate — log silently
        console.warn('[audit] logAdminAction failed silently for action:', action);
    }
}
