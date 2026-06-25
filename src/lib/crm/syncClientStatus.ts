import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

type DerivedStatus = 'new' | 'contacted' | 'in_process' | 'won' | 'lost';

interface LeadState {
    closed: boolean | null;
    lost: boolean | null;
}

export async function syncClientStatusFromLeads(
    supabase: SupabaseClient,
    clientId: string,
): Promise<void> {
    try {
        const { data: leads } = await supabase
            .from('ocr_jobs')
            .select('closed, lost')
            .eq('client_id', clientId);

        if (!leads || leads.length === 0) return;

        const status = deriveClientStatus(leads as LeadState[]);

        await supabase
            .from('clients')
            .update({ status })
            .eq('id', clientId);
    } catch (err) {
        logger.warn('[syncClientStatus] failed', { clientId, error: err });
    }
}

function deriveClientStatus(leads: LeadState[]): DerivedStatus {
    const hasWon = leads.some(l => l.closed === true);
    if (hasWon) return 'won';

    const hasOpen = leads.some(l => l.closed !== true && l.lost !== true);
    if (hasOpen) return 'in_process';

    const allLost = leads.every(l => l.lost === true);
    if (allLost) return 'lost';

    return 'new';
}
