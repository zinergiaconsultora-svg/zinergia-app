'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    type: string | null;
    link: string | null;
    read: boolean;
    created_at: string;
}

export type NotificationType =
    | 'proposal_accepted'
    | 'proposal_rejected'
    | 'proposal_sent'
    | 'followup_due'
    | 'commission_earned'
    | 'commission_cleared'
    | 'tariff_update'
    | 'withdrawal_status'
    | 'client_created'
    | 'task_due'
    | 'info';

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getNotificationsAction(): Promise<AppNotification[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, type, link, read, created_at')
        .eq('user_id', user.id)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) return [];
    return (data ?? []).map(n => ({ ...n, read: n.read ?? false })) as AppNotification[];
}

export async function getUnreadCountAction(): Promise<number> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    return count ?? 0;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function markNotificationReadAction(id: string): Promise<void> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', user.id);
}

export async function markAllReadAction(): Promise<void> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
}

// ── Internal (called from other server actions, not exposed as RPC) ────────────

export async function createNotificationInternal(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    data: {
        title: string;
        message: string;
        type: NotificationType;
        link?: string;
    }
): Promise<void> {
    await supabase.from('notifications').insert({
        user_id: userId,
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link ?? null,
        read: false,
    });
}
