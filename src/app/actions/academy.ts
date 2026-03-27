'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';

export interface AcademyResource {
    id: string;
    title: string;
    description: string | null;
    category: string;
    file_url: string;
    file_type: string | null;
    role_restriction: string;
    is_published: boolean;
    created_at: string;
}

export async function getAcademyResourcesAdmin(): Promise<AcademyResource[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('academy_resources')
        .select('id, title, description, category, file_url, file_type, role_restriction, is_published, created_at')
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Error obteniendo recursos: ${error.message}`);
    return (data ?? []) as AcademyResource[];
}

export async function createAcademyResource(payload: {
    title: string;
    description: string;
    category: string;
    file_url: string;
    file_type: string;
    role_restriction: string;
    is_published: boolean;
}): Promise<AcademyResource> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('academy_resources')
        .insert(payload)
        .select('id, title, description, category, file_url, file_type, role_restriction, is_published, created_at')
        .single();

    if (error) throw new Error(`Error creando recurso: ${error.message}`);
    revalidatePath('/admin/academy');
    revalidatePath('/dashboard/academy');
    return data as AcademyResource;
}

export async function updateAcademyResource(
    id: string,
    payload: Partial<{
        title: string;
        description: string;
        category: string;
        file_url: string;
        file_type: string;
        role_restriction: string;
        is_published: boolean;
    }>
): Promise<void> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { error } = await supabase
        .from('academy_resources')
        .update(payload)
        .eq('id', id);

    if (error) throw new Error(`Error actualizando recurso: ${error.message}`);
    revalidatePath('/admin/academy');
    revalidatePath('/dashboard/academy');
}

export async function deleteAcademyResource(id: string): Promise<void> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { error } = await supabase
        .from('academy_resources')
        .delete()
        .eq('id', id);

    if (error) throw new Error(`Error eliminando recurso: ${error.message}`);
    revalidatePath('/admin/academy');
    revalidatePath('/dashboard/academy');
}
