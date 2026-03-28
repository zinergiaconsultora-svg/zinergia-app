'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import type { ClientStatus } from '@/types/crm';

export async function updateClientStatusBulk(
    clientIds: string[],
    newStatus: ClientStatus
): Promise<{ updated: number }> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('clients')
        .update({ status: newStatus })
        .in('id', clientIds)
        .select('id');

    if (error) throw new Error(`Error actualizando clientes: ${error.message}`);
    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard');
    return { updated: data?.length ?? 0 };
}

export async function updateClientStatus(
    clientId: string,
    newStatus: ClientStatus
): Promise<void> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient();

    const { error } = await supabase
        .from('clients')
        .update({ status: newStatus })
        .eq('id', clientId);

    if (error) throw new Error(`Error actualizando cliente: ${error.message}`);
    revalidatePath('/dashboard/clients');
    revalidatePath(`/dashboard/clients/${clientId}`);
    revalidatePath('/dashboard');
}

export async function deleteClientsBulk(clientIds: string[]): Promise<{ deleted: number }> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('clients')
        .delete()
        .in('id', clientIds)
        .select('id');

    if (error) throw new Error(`Error eliminando clientes: ${error.message}`);
    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard');
    return { deleted: data?.length ?? 0 };
}
