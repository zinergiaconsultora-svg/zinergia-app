'use server';

import { createClient } from '@/lib/supabase/server';
import { hashCups } from '@/lib/crypto/pii';
import { requireServerRole } from '@/lib/auth/permissions';
import { resolveDedupScope } from '@/lib/ocr/invoiceIdentity';

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
    await requireServerRole(['admin', 'franchise', 'agent']);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data: profile } = await supabase
        .from('profiles')
        .select('franchise_id')
        .eq('id', user.id)
        .single();

    // Sin franquicia se devolvía "no es duplicado" sin mirar nada, y quien no
    // tiene franquicia es el administrador: la comprobación se apagaba sola justo
    // para el perfil que más facturas sube. Ahora ese caso busca entre las suyas.
    const scope = resolveDedupScope({ franchiseId: profile?.franchise_id, userId: user.id });

    const { data: byHash } = await supabase
        .from('ocr_jobs')
        .select('id, extracted_data')
        .eq(scope.column, scope.value)
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
        // Los clientes no se agrupan por `agent_id` sino por `owner_id`, así que
        // el ámbito se traduce aquí en vez de complicar el ayudante compartido.
        const clientScope = scope.column === 'franchise_id'
            ? { column: 'franchise_id' as const, value: scope.value }
            : { column: 'owner_id' as const, value: scope.value };

        const cupsHash = hashCups(cups);
        const { data: byCups } = await supabase
            .from('clients')
            .select('id, name')
            .eq(clientScope.column, clientScope.value)
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
    await requireServerRole(['admin', 'franchise', 'agent']);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
        .from('ocr_jobs')
        .update({ file_content_hash: fileContentHash })
        .eq('id', jobId)
        .eq('agent_id', user.id);
}
