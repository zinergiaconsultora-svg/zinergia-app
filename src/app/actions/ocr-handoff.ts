'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireServerRole } from '@/lib/auth/permissions';
import { z } from 'zod';

const uuidSchema = z.uuid();

export interface OcrHandoffContext {
    ocrJobId: string;
    agentId: string;
    franchiseId: string;
    clientId: string | null;
}

export async function resolveOcrHandoffContextAction(ocrJobId?: string | null): Promise<OcrHandoffContext | null> {
    if (!ocrJobId || !uuidSchema.safeParse(ocrJobId).success) return null;
    await requireServerRole(['admin', 'franchise', 'agent']);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, franchise_id')
        .eq('id', user.id)
        .maybeSingle();
    if (!profile) return null;

    const service = createServiceClient();
    const { data: job } = await service
        .from('ocr_jobs')
        .select('id, agent_id, franchise_id, client_id')
        .eq('id', ocrJobId)
        .maybeSingle();

    if (!job?.agent_id || !job.franchise_id) return null;

    const role = profile.role as 'admin' | 'franchise' | 'agent' | null;
    const isAllowed =
        role === 'admin'
        || (role === 'franchise' && profile.franchise_id === job.franchise_id)
        || (role === 'agent' && job.agent_id === user.id);

    if (!isAllowed) return null;

    return {
        ocrJobId: job.id,
        agentId: job.agent_id,
        franchiseId: job.franchise_id,
        clientId: job.client_id ?? null,
    };
}
