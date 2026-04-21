import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendPushToUser } from '@/lib/push/sendPush';

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
    const results: { day: number; notified: number; errors: number }[] = [];

    for (const days of FOLLOWUP_DAYS) {
        // Ventana de 24h para cada umbral — evitar notificar más de una vez
        const windowStart = new Date(now.getTime() - (days * 24 + 24) * 60 * 60 * 1000).toISOString();
        const windowEnd = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

        // Propuestas en 'sent' que llevan entre N y N+1 días sin respuesta
        // y cuyo token público no ha sido aceptado
        const { data: proposals, error } = await supabaseAdmin
            .from('proposals')
            .select(`
                id,
                client_id,
                annual_savings,
                public_expires_at,
                clients(name),
                profiles!proposals_agent_id_fkey(id, full_name)
            `)
            .eq('status', 'sent')
            .gte('updated_at', windowStart)
            .lt('updated_at', windowEnd)
            .not('public_token', 'is', null); // Solo propuestas con link enviado

        if (error) {
            console.error(`[FollowUp] Error querying ${days}d proposals:`, error.message);
            results.push({ day: days, notified: 0, errors: 1 });
            continue;
        }

        let notified = 0;
        let errors = 0;

        for (const proposal of proposals ?? []) {
            try {
                const agentProfile = proposal.profiles as unknown as { id: string; full_name: string } | null;
                const clientName = (proposal.clients as unknown as { name: string } | null)?.name || 'tu cliente';
                const savings = Math.round(proposal.annual_savings);

                if (!agentProfile?.id) continue;

                await sendPushToUser(agentProfile.id, {
                    title: days === 3
                        ? `Seguimiento — ${clientName}`
                        : `¡Urge respuesta! — ${clientName}`,
                    body: days === 3
                        ? `Llevan 3 días sin aceptar la propuesta de ${savings}€/año. ¿Les das un toque?`
                        : `7 días sin respuesta. La propuesta de ${savings}€/año sigue pendiente.`,
                    url: `/dashboard/proposals`,
                    icon: '/icon-192.png',
                });

                notified++;
            } catch (e) {
                console.warn(`[FollowUp] Push failed for proposal ${proposal.id}:`, e);
                errors++;
            }
        }

        results.push({ day: days, notified, errors });
    }

    console.log('[FollowUp] Results:', JSON.stringify(results));
    return NextResponse.json({ success: true, results, timestamp: now.toISOString() });
}
