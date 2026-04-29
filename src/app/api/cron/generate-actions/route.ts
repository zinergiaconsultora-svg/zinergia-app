import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';
import { moduleLogger } from '@/lib/logger';

const log = moduleLogger('cron:generate-actions');
const CRON_SECRET = process.env.CRON_SECRET;

interface ActionInsert {
    agent_id: string;
    franchise_id: string;
    client_id?: string;
    proposal_id?: string;
    action_type: string;
    priority: string;
    title: string;
    description: string;
    reason: string;
    due_date: string;
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = createServiceClient();
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        await supabase
            .from('next_actions')
            .delete()
            .is('completed_at', null)
            .lt('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

        const actions: ActionInsert[] = [];

        const { data: newLeads } = await supabase
            .from('clients')
            .select('id, name, owner_id, franchise_id, created_at')
            .eq('status', 'new')
            .lt('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

        for (const client of newLeads ?? []) {
            if (!client.owner_id || !client.franchise_id) continue;
            actions.push({
                agent_id: client.owner_id,
                franchise_id: client.franchise_id,
                client_id: client.id,
                action_type: 'call_new_lead',
                priority: 'high',
                title: `Llamar a ${client.name}`,
                description: 'Lead nuevo sin contactar > 24h',
                reason: 'Lead sin actividad desde su creación',
                due_date: today,
            });
        }

        const { data: sentProposals } = await supabase
            .from('proposals')
            .select('id, client_id, agent_id, franchise_id, created_at, updated_at, clients!inner(name)')
            .eq('status', 'sent');

        for (const prop of sentProposals ?? []) {
            if (!prop.agent_id || !prop.franchise_id) continue;
            const clientName = (prop.clients as unknown as { name: string })?.name ?? 'Cliente';
            const sentAt = new Date(prop.updated_at ?? prop.created_at);
            const daysSinceSent = Math.floor((now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24));

            if (daysSinceSent >= 14) {
                actions.push({
                    agent_id: prop.agent_id,
                    franchise_id: prop.franchise_id,
                    client_id: prop.client_id,
                    proposal_id: prop.id,
                    action_type: 'follow_up_14d',
                    priority: 'critical',
                    title: `Propuesta de ${clientName} lleva ${daysSinceSent} días`,
                    description: 'Propuesta enviada hace más de 2 semanas sin respuesta',
                    reason: 'Alta probabilidad de pérdida si no se actúa',
                    due_date: today,
                });
            } else if (daysSinceSent >= 7) {
                actions.push({
                    agent_id: prop.agent_id,
                    franchise_id: prop.franchise_id,
                    client_id: prop.client_id,
                    proposal_id: prop.id,
                    action_type: 'follow_up_7d',
                    priority: 'high',
                    title: `Seguimiento: ${clientName}`,
                    description: `Propuesta enviada hace ${daysSinceSent} días`,
                    reason: 'Seguimiento de 7 días recomendado',
                    due_date: today,
                });
            } else if (daysSinceSent >= 3) {
                actions.push({
                    agent_id: prop.agent_id,
                    franchise_id: prop.franchise_id,
                    client_id: prop.client_id,
                    proposal_id: prop.id,
                    action_type: 'follow_up_3d',
                    priority: 'medium',
                    title: `Primer seguimiento: ${clientName}`,
                    description: `Propuesta enviada hace ${daysSinceSent} días`,
                    reason: 'Primer recordatorio tras el envío',
                    due_date: today,
                });
            }
        }

        const { data: wonClients } = await supabase
            .from('clients')
            .select('id, name, owner_id, franchise_id, updated_at')
            .eq('status', 'won');

        for (const client of wonClients ?? []) {
            if (!client.owner_id || !client.franchise_id) continue;
            const monthsSinceUpdate = Math.floor(
                (now.getTime() - new Date(client.updated_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
            );

            if (monthsSinceUpdate >= 11) {
                actions.push({
                    agent_id: client.owner_id,
                    franchise_id: client.franchise_id,
                    client_id: client.id,
                    action_type: 'prepare_renewal',
                    priority: 'medium',
                    title: `Preparar renovación: ${client.name}`,
                    description: `Cliente ganado hace ${monthsSinceUpdate} meses`,
                    reason: 'Contrato próximo a cumplir 12 meses',
                    due_date: today,
                });
            }
        }

        if (actions.length > 0) {
            const { error } = await supabase
                .from('next_actions')
                .insert(actions);

            if (error) {
                log.error({ err: error }, 'Failed to insert actions');
            }
        }

        log.info({ generated: actions.length }, 'Actions generation complete');
        return NextResponse.json({ generated: actions.length });

    } catch (error) {
        Sentry.captureException(error);
        log.error({ err: error }, 'Action generation cron failed');
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
