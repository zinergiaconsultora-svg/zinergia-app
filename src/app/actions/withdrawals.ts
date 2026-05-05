'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import { createNotificationInternal } from './notifications';
import { UserRole, WithdrawalRequest, WithdrawalGrowth } from '@/types/crm';

interface WithdrawalActor {
    id: string;
    role: UserRole;
    franchiseId: string | null;
}

type WithdrawalProfileRelation = { franchise_id?: string | null } | { franchise_id?: string | null }[] | null | undefined;

async function getWithdrawalActor(
    supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<WithdrawalActor | null> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, franchise_id')
        .eq('id', user.id)
        .maybeSingle();

    const role = profile?.role as UserRole | undefined;
    if (!role) return null;

    return {
        id: user.id,
        role,
        franchiseId: profile?.franchise_id ?? null,
    };
}

function getWithdrawalOwnerFranchiseId(profiles: WithdrawalProfileRelation): string | null {
    const profile = Array.isArray(profiles) ? profiles[0] : profiles;
    return profile?.franchise_id ?? null;
}

function canManageWithdrawal(actor: WithdrawalActor, withdrawal: { profiles?: WithdrawalProfileRelation }) {
    if (actor.role === 'admin') return true;
    return !!actor.franchiseId && getWithdrawalOwnerFranchiseId(withdrawal.profiles) === actor.franchiseId;
}

function validateSpanishIBAN(iban: string): boolean {
    const cleaned = iban.replace(/\s/g, '').toUpperCase();
    if (!/^ES\d{22}$/.test(cleaned)) return false;
    const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
    const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let remainder = BigInt(0);
    for (const digit of numeric) {
        remainder = remainder * BigInt(10) + BigInt(digit);
    }
    return remainder % BigInt(97) === BigInt(1);
}

export async function saveIbanAction(iban: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { success: false, error: 'No autenticado' };

    const cleaned = iban.replace(/\s/g, '').toUpperCase();
    if (!validateSpanishIBAN(cleaned)) {
        return { success: false, error: 'IBAN no válido. Debe ser un IBAN español (ES + 22 caracteres)' };
    }

    const { error } = await supabase
        .from('profiles')
        .update({ iban: cleaned })
        .eq('id', user.id);

    if (error) return { success: false, error: 'Error al guardar IBAN' };
    revalidatePath('/dashboard/wallet');
    revalidatePath('/dashboard/settings');
    return { success: true };
}

export async function getIbanAction(): Promise<string | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
        .from('profiles')
        .select('iban')
        .eq('id', user.id)
        .single();

    return data?.iban ?? null;
}

export async function createWithdrawalRequestAction(
    amount: number,
    commissionIds: string[]
): Promise<{ success: boolean; error?: string; withdrawal?: WithdrawalRequest }> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { success: false, error: 'No autenticado' };
    if (amount <= 0) return { success: false, error: 'El importe debe ser mayor que 0' };
    if (commissionIds.length === 0) return { success: false, error: 'Selecciona al menos una comisión' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('iban')
        .eq('id', user.id)
        .single();

    if (!profile?.iban) {
        return { success: false, error: 'Configura tu IBAN antes de solicitar un retiro' };
    }

    const { data: commissions } = await supabase
        .from('network_commissions')
        .select('id, status, agent_commission')
        .in('id', commissionIds)
        .eq('agent_id', user.id);

    if (!commissions || commissions.length === 0) {
        return { success: false, error: 'No se encontraron comisiones válidas' };
    }

    const notCleared = commissions.some(c => c.status !== 'cleared');
    if (notCleared) {
        return { success: false, error: 'Solo puedes retirar comisiones aprobadas (estado: disponible)' };
    }

    const totalAvailable = commissions.reduce((sum, c) => sum + (c.agent_commission || 0), 0);
    if (amount > totalAvailable) {
        return { success: false, error: `El importe solicitado (${amount.toFixed(2)}€) supera el disponible (${totalAvailable.toFixed(2)}€)` };
    }

    const { data, error } = await supabase
        .from('withdrawal_requests')
        .insert({
            user_id: user.id,
            amount,
            iban: profile.iban,
            commission_ids: commissionIds,
            status: 'pending',
        })
        .select()
        .single();

    if (error) return { success: false, error: 'Error al crear la solicitud' };
    revalidatePath('/dashboard/wallet');
    return { success: true, withdrawal: data as WithdrawalRequest };
}

export async function getWithdrawalHistoryAction(): Promise<WithdrawalRequest[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []) as WithdrawalRequest[];
}

export async function getAllWithdrawalsAction(): Promise<(WithdrawalRequest & { profiles?: { full_name: string; email: string } })[]> {
    await requireServerRole(['admin', 'franchise']);
    const supabase = await createClient();
    const actor = await getWithdrawalActor(supabase);
    if (!actor) return [];

    let query = supabase
        .from('withdrawal_requests')
        .select('*, profiles!inner(full_name, email, franchise_id)')
        .order('created_at', { ascending: false });

    if (actor.role === 'franchise') {
        if (!actor.franchiseId) return [];
        query = query.eq('profiles.franchise_id', actor.franchiseId);
    }

    const { data, error } = await query;

    if (error) return [];
    return data as (WithdrawalRequest & { profiles?: { full_name: string; email: string } })[];
}

export async function approveWithdrawalAction(id: string): Promise<{ success: boolean; error?: string }> {
    await requireServerRole(['admin', 'franchise']);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'No autenticado' };

    const { data: withdrawal, error: fetchError } = await supabase
        .from('withdrawal_requests')
        .select('status, commission_ids, user_id, amount, profiles!inner(franchise_id)')
        .eq('id', id)
        .single();

    if (fetchError || !withdrawal) return { success: false, error: 'Solicitud no encontrada' };
    const actor = await getWithdrawalActor(supabase);
    if (!actor || !canManageWithdrawal(actor, withdrawal)) return { success: false, error: 'Solicitud no encontrada' };
    if (withdrawal.status !== 'pending') return { success: false, error: 'La solicitud ya fue procesada' };

    const { error: updateError } = await supabase
        .from('withdrawal_requests')
        .update({
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'pending');

    if (updateError) return { success: false, error: 'Error al aprobar' };

    try {
        await createNotificationInternal(supabase, withdrawal.user_id, {
            title: 'Retiro aprobado',
            message: `Tu solicitud de retiro por ${withdrawal.amount.toFixed(2)}€ ha sido aprobada.`,
            type: 'withdrawal_status',
            link: '/dashboard/wallet',
        });
    } catch { /* non-critical */ }

    revalidatePath('/dashboard/wallet');
    return { success: true };
}

export async function rejectWithdrawalAction(id: string, reason: string): Promise<{ success: boolean; error?: string }> {
    await requireServerRole(['admin', 'franchise']);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'No autenticado' };

    const { data: wr } = await supabase
        .from('withdrawal_requests')
        .select('user_id, amount, profiles!inner(franchise_id)')
        .eq('id', id)
        .single();

    const actor = await getWithdrawalActor(supabase);
    if (!actor || !wr || !canManageWithdrawal(actor, wr)) return { success: false, error: 'Solicitud no encontrada' };

    const { error } = await supabase
        .from('withdrawal_requests')
        .update({
            status: 'rejected',
            rejection_reason: reason,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'pending');

    if (error) return { success: false, error: 'Error al rechazar' };

    if (wr) {
        try {
            await createNotificationInternal(supabase, wr.user_id, {
                title: 'Retiro rechazado',
                message: `Tu solicitud de retiro por ${wr.amount.toFixed(2)}€ ha sido rechazada. Motivo: ${reason}`,
                type: 'withdrawal_status',
                link: '/dashboard/wallet',
            });
        } catch { /* non-critical */ }
    }

    revalidatePath('/dashboard/wallet');
    return { success: true };
}

export async function markWithdrawalPaidAction(id: string): Promise<{ success: boolean; error?: string }> {
    await requireServerRole(['admin', 'franchise']);
    const supabase = await createClient();

    const { data: withdrawal } = await supabase
        .from('withdrawal_requests')
        .select('status, commission_ids, user_id, amount, profiles!inner(franchise_id)')
        .eq('id', id)
        .single();

    if (!withdrawal) return { success: false, error: 'Solicitud no encontrada' };
    const actor = await getWithdrawalActor(supabase);
    if (!actor || !canManageWithdrawal(actor, withdrawal)) return { success: false, error: 'Solicitud no encontrada' };
    if (withdrawal.status !== 'approved') return { success: false, error: 'Solo se pueden pagar solicitudes aprobadas' };

    const commissionIds = withdrawal.commission_ids as string[];
    if (commissionIds.length > 0) {
        const { error: commError } = await supabase
            .from('network_commissions')
            .update({ status: 'paid' })
            .in('id', commissionIds);

        if (commError) return { success: false, error: 'Error al actualizar comisiones' };
    }

    const { error } = await supabase
        .from('withdrawal_requests')
        .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (error) return { success: false, error: 'Error al marcar como pagada' };

    try {
        await createNotificationInternal(supabase, withdrawal.user_id, {
            title: 'Retiro completado',
            message: `Tu retiro de ${withdrawal.amount.toFixed(2)}€ ha sido transferido a tu cuenta bancaria.`,
            type: 'commission_earned',
            link: '/dashboard/wallet',
        });
    } catch { /* non-critical */ }

    revalidatePath('/dashboard/wallet');
    return { success: true };
}

export async function getWithdrawalGrowthAction(): Promise<WithdrawalGrowth> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { current_month_earned: 0, previous_month_earned: 0, growth_percent: 0 };

    const fallback = { current_month_earned: 0, previous_month_earned: 0, growth_percent: 0 };
    try {
        const { data } = await supabase.rpc('get_withdrawal_growth', { p_user_id: user.id });
        if (!data || typeof data !== 'object') return fallback;
        return {
            current_month_earned: data.current_month_earned ?? 0,
            previous_month_earned: data.previous_month_earned ?? 0,
            growth_percent: data.growth_percent ?? 0,
        } as WithdrawalGrowth;
    } catch {
        return fallback;
    }
}
