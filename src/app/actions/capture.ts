'use server';

import { createClient } from '@/lib/supabase/server';
import { hashCups } from '@/lib/crypto/pii';

interface DedupResult {
    isDuplicate: boolean;
    existingJobId?: string;
    existingClientName?: string;
    matchType?: 'file_hash' | 'cups';
}

export async function checkDuplicateAction(
    fileContentHash: string,
    cups?: string,
): Promise<DedupResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data: profile } = await supabase
        .from('profiles')
        .select('franchise_id')
        .eq('id', user.id)
        .single();

    if (!profile?.franchise_id) return { isDuplicate: false };

    const { data: byHash } = await supabase
        .from('ocr_jobs')
        .select('id, extracted_data')
        .eq('franchise_id', profile.franchise_id)
        .eq('file_content_hash', fileContentHash)
        .eq('status', 'completed')
        .limit(1)
        .maybeSingle();

    if (byHash) {
        const clientName = (byHash.extracted_data as Record<string, unknown> | null)?.client_name as string | undefined;
        return {
            isDuplicate: true,
            existingJobId: byHash.id,
            existingClientName: clientName ?? undefined,
            matchType: 'file_hash',
        };
    }

    if (cups) {
        const cupsHash = hashCups(cups);
        const { data: byCups } = await supabase
            .from('clients')
            .select('id, name')
            .eq('franchise_id', profile.franchise_id)
            .eq('cups_hash', cupsHash)
            .maybeSingle();

        if (byCups) {
            return {
                isDuplicate: true,
                existingClientName: byCups.name ?? undefined,
                matchType: 'cups',
            };
        }
    }

    return { isDuplicate: false };
}

export async function saveFileHashAction(
    jobId: string,
    fileContentHash: string,
): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
        .from('ocr_jobs')
        .update({ file_content_hash: fileContentHash })
        .eq('id', jobId)
        .eq('agent_id', user.id);
}
