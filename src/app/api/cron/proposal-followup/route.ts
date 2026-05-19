import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';
import { sendPushToUser } from '@/lib/push/sendPush';
import { moduleLogger } from '@/lib/logger';
import { buildProposalFollowupPlan, type ProposalFollowupStage } from '@/lib/proposals/followup';

const log = moduleLogger('cron:proposal-followup');

// Proteger con secret — llamado por Vercel Cron o pg_cron via HTTP
const CRON_SECRET = process.env.CRON_SECRET;

// Días sin respuesta para cada recordatorio
const FOLLOWUP_DAYS = [3, 7] as const;

export async function GET(request: Request) {
    // Verificar el secret del cron
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createServiceClient();

    const now = new Date();
    const { data: proposals, error } = await supabaseAdmin
        .from('proposals')
        .select(`
            id,
            client_id,
            annual_savings,
            public_expires_at,
            sent_date,
            updated_at,
            created_at,
            followup_3d_at,
            followup_7d_at,
            clients(name),
            profiles!proposals_agent_id_fkey(id, full_name)
        `)
        .eq('status', 'sent')
        .not('public_token', 'is', null)
        .limit(300);

    if (error) {
        Sentry.captureException(error);
        log.error({ err: error }, 'Error querying followup proposals');
        return NextResponse.json({ success: false, error: 'query_failed' }, { status: 500 });
    }

    const results: { day: number; notified: number; errors: number }[] = FOLLOWUP_DAYS.map(day => ({
        day,
        notified: 0,
        errors: 0,
    }));

    for (const proposal of proposals ?? []) {
        const stage = getDueStage(proposal, now);
        if (!stage) continue;

        const bucket = results.find(result => result.day === stage);
        try {
            const agentProfile = proposal.profiles as unknown as { id: string; full_name: string } | null;
            const clientName = (proposal.clients as unknown as { name: string } | null)?.name || 'tu cliente';
            if (!agentProfile?.id || !proposal.client_id) continue;

            const { data: view } = await supabaseAdmin
                .from('client_activities')
                .select('id')
                .eq('client_id', proposal.client_id)
                .eq('type', 'proposal_public_view')
                .contains('metadata', { proposal_id: proposal.id })
                .limit(1)
                .maybeSingle();

            const plan = buildProposalFollowupPlan({
                stage,
                clientName,
                annualSavings: Number(proposal.annual_savings || 0),
                opened: Boolean(view),
            });

            await supabaseAdmin.from('notifications').insert({
                user_id: agentProfile.id,
                ...plan.notification,
                read: false,
                expires_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            });

            try {
                await sendPushToUser(agentProfile.id, plan.push);
            } catch (pushError) {
                log.warn({ err: pushError, proposalId: proposal.id, stage }, 'Proposal followup push failed');
            }

            await supabaseAdmin
                .from('proposals')
                .update(stage === 3
                    ? { followup_3d_at: now.toISOString() }
                    : { followup_7d_at: now.toISOString() })
                .eq('id', proposal.id);

            if (bucket) bucket.notified++;
        } catch (e) {
            log.warn({ err: e, proposalId: proposal.id, stage }, 'Proposal followup failed');
            if (bucket) bucket.errors++;
        }
    }

    log.info({ results }, 'Proposal followup done');
    return NextResponse.json({ success: true, results, timestamp: now.toISOString() });
}

function getDueStage(
    proposal: {
        sent_date?: string | null;
        updated_at?: string | null;
        created_at?: string | null;
        followup_3d_at?: string | null;
        followup_7d_at?: string | null;
        public_expires_at?: string | null;
    },
    now: Date,
): ProposalFollowupStage | null {
    if (proposal.public_expires_at && new Date(proposal.public_expires_at) < now) return null;

    const sentAt = proposal.sent_date || proposal.updated_at || proposal.created_at;
    if (!sentAt) return null;

    const ageDays = (now.getTime() - new Date(sentAt).getTime()) / (24 * 60 * 60 * 1000);
    if (ageDays >= 7 && !proposal.followup_7d_at) return 7;
    if (ageDays >= 3 && !proposal.followup_3d_at) return 3;
    return null;
}
