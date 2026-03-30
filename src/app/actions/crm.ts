'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import type { ClientStatus } from '@/types/crm';
import { z } from 'zod';

const CLIENT_STATUSES = ['new', 'contacted', 'in_process', 'won', 'lost'] as const;

const bulkIdsSchema = z.array(z.uuid()).min(1, 'Se requiere al menos un cliente');
const clientStatusSchema = z.enum(CLIENT_STATUSES);

export async function updateClientStatusBulk(
    clientIds: string[],
    newStatus: ClientStatus
): Promise<{ updated: number }> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const idsResult = bulkIdsSchema.safeParse(clientIds);
    if (!idsResult.success) throw new Error(`IDs inválidos: ${idsResult.error.issues[0].message}`);
    const statusResult = clientStatusSchema.safeParse(newStatus);
    if (!statusResult.success) throw new Error(`Estado inválido: ${newStatus}`);

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('clients')
        .update({ status: statusResult.data })
        .in('id', idsResult.data)
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

    const idResult = z.uuid().safeParse(clientId);
    if (!idResult.success) throw new Error(`ID de cliente inválido`);
    const statusResult = clientStatusSchema.safeParse(newStatus);
    if (!statusResult.success) throw new Error(`Estado inválido: ${newStatus}`);

    const supabase = await createClient();

    const { error } = await supabase
        .from('clients')
        .update({ status: statusResult.data })
        .eq('id', idResult.data);

    if (error) throw new Error(`Error actualizando cliente: ${error.message}`);
    revalidatePath('/dashboard/clients');
    revalidatePath(`/dashboard/clients/${idResult.data}`);
    revalidatePath('/dashboard');
}

export async function deleteClientsBulk(clientIds: string[]): Promise<{ deleted: number }> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const idsResult = bulkIdsSchema.safeParse(clientIds);
    if (!idsResult.success) throw new Error(`IDs inválidos: ${idsResult.error.issues[0].message}`);

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('clients')
        .delete()
        .in('id', idsResult.data)
        .select('id');

    if (error) throw new Error(`Error eliminando clientes: ${error.message}`);
    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard');
    return { deleted: data?.length ?? 0 };
}
