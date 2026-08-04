import { createServiceClient } from '@/lib/supabase/service';
import { z } from 'zod';

const authoritySnapshotSchema = z.strictObject({
    id: z.uuid(),
    role: z.enum(['admin', 'franchise', 'agent']).nullable(),
    parent_id: z.uuid().nullable(),
    franchise_id: z.uuid().nullable(),
    authority_version: z.number().int().nonnegative(),
});

export async function getProfileAuthoritySnapshot(targetId: string) {
    const parsedId = z.uuid().safeParse(targetId);
    if (!parsedId.success) return null;

    const { data, error } = await createServiceClient()
        .from('profiles')
        .select('id, role, parent_id, franchise_id, authority_version')
        .eq('id', parsedId.data)
        .maybeSingle();
    if (error) return null;

    const parsed = authoritySnapshotSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
}
