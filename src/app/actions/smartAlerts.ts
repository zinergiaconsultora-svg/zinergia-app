'use server';

import { createClient } from '@/lib/supabase/server';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface SmartAlert {
    id: string;
    severity: AlertSeverity;
    title: string;
    description: string;
    count: number;
    href: string;          // where to navigate on CTA click
    cta: string;           // button label
}

export async function getSmartAlertsAction(): Promise<SmartAlert[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const alerts: SmartAlert[] = [];
    const now = new Date();

    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
    const daysFromNow = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

    // ── Run independent queries in parallel ──
    const [
        { count: urgentCount },
        { count: pendingCount },
        { count: expiringCount },
        { data: newClients },
        { data: recentJobs },
        { count: expiringContractsCount },
        { count: expiredContractsCount },
    ] = await Promise.all([
        // 1. Seguimientos URGENTES: propuestas enviadas >7 días sin respuesta
        supabase
            .from('proposals')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', user.id)
            .eq('status', 'sent')
            .lt('updated_at', daysAgo(7))
            .not('public_token', 'is', null),

        // 2. Seguimientos PENDIENTES: propuestas enviadas 3-7 días
        supabase
            .from('proposals')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', user.id)
            .eq('status', 'sent')
            .gte('updated_at', daysAgo(7))
            .lt('updated_at', daysAgo(3))
            .not('public_token', 'is', null),

        // 3. Propuestas próximas a vencer (<5 días)
        supabase
            .from('proposals')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', user.id)
            .eq('status', 'sent')
            .not('public_expires_at', 'is', null)
            .lte('public_expires_at', daysFromNow(5))
            .gte('public_expires_at', now.toISOString()),

        // 4a. Clientes nuevos sin propuesta >7 días
        supabase
            .from('clients')
            .select('id')
            .eq('owner_id', user.id)
            .in('status', ['new', 'contacted'])
            .lt('created_at', daysAgo(7)),

        // 5. Facturas con anomalías críticas recientes (últimos 14 días)
        supabase
            .from('ocr_jobs')
            .select('id, extracted_data, client_id')
            .eq('agent_id', user.id)
            .eq('status', 'completed')
            .gte('created_at', daysAgo(14))
            .not('extracted_data', 'is', null),

        // 6. Contratos activos que expiran en 30 días
        supabase
            .from('contracts')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', user.id)
            .eq('status', 'active')
            .not('end_date', 'is', null)
            .lte('end_date', daysFromNow(30))
            .gte('end_date', now.toISOString().split('T')[0]),

        // 7. Contratos activos cuya fecha fin ya pasó
        supabase
            .from('contracts')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', user.id)
            .eq('status', 'active')
            .not('end_date', 'is', null)
            .lt('end_date', now.toISOString().split('T')[0]),
    ]);

    // ── 1. Urgent followups ──
    if (urgentCount && urgentCount > 0) {
        alerts.push({
            id: 'followup_urgent',
            severity: 'critical',
            title: 'Seguimiento urgente',
            description: `${urgentCount} propuesta${urgentCount > 1 ? 's' : ''} llevan más de 7 días sin respuesta.`,
            count: urgentCount,
            href: '/dashboard/proposals',
            cta: 'Ver propuestas',
        });
    }

    // ── 2. Pending followups ──
    if (pendingCount && pendingCount > 0) {
        alerts.push({
            id: 'followup_pending',
            severity: 'warning',
            title: 'Seguimiento pendiente',
            description: `${pendingCount} propuesta${pendingCount > 1 ? 's' : ''} esperando respuesta (3-7 días).`,
            count: pendingCount,
            href: '/dashboard/proposals',
            cta: 'Revisar',
        });
    }

    // ── 3. Expiring proposals ──
    if (expiringCount && expiringCount > 0) {
        alerts.push({
            id: 'proposals_expiring',
            severity: 'warning',
            title: 'Propuestas por expirar',
            description: `${expiringCount} enlace${expiringCount > 1 ? 's' : ''} de propuesta vence en menos de 5 días.`,
            count: expiringCount,
            href: '/dashboard/proposals',
            cta: 'Renovar enlace',
        });
    }

    // ── 4. New clients without proposal ──
    if (newClients && newClients.length > 0) {
        const clientIds = newClients.map(c => c.id);

        const { data: withProposal } = await supabase
            .from('proposals')
            .select('client_id')
            .in('client_id', clientIds);

        const coveredIds = new Set((withProposal ?? []).map(p => p.client_id));
        const uncoveredCount = clientIds.filter(id => !coveredIds.has(id)).length;

        if (uncoveredCount > 0) {
            alerts.push({
                id: 'clients_without_proposal',
                severity: 'info',
                title: 'Clientes sin auditoría',
                description: `${uncoveredCount} cliente${uncoveredCount > 1 ? 's' : ''} lleva${uncoveredCount === 1 ? '' : 'n'} más de 7 días sin propuesta.`,
                count: uncoveredCount,
                href: '/dashboard/clients',
                cta: 'Ver clientes',
            });
        }
    }

    // ── 5. Critical OCR anomalies (last 14 days) ──

    if (recentJobs && recentJobs.length > 0) {
        // Detect critical anomalies server-side (simple check without full detector)
        const criticalJobs = recentJobs.filter(job => {
            const d = job.extracted_data as Record<string, unknown> | null;
            if (!d) return false;
            // Reactive penalty
            const forensic = d.forensic_details as Record<string, unknown> | null;
            if (forensic?.reactive_penalty) return true;
            // Energy price critical (>0.22€/kWh)
            const price = d.current_energy_price_p1 as number | null;
            if (price && price > 0.22) return true;
            return false;
        });

        if (criticalJobs.length > 0) {
            alerts.push({
                id: 'ocr_critical_anomalies',
                severity: 'critical',
                title: 'Anomalías críticas detectadas',
                description: `${criticalJobs.length} factura${criticalJobs.length > 1 ? 's' : ''} reciente${criticalJobs.length > 1 ? 's' : ''} con energía reactiva o precio crítico.`,
                count: criticalJobs.length,
                href: '/dashboard/simulator',
                cta: 'Comparar tarifa',
            });
        }
    }

    // ── 6. Contracts expiring within 30 days ──
    if (expiringContractsCount && expiringContractsCount > 0) {
        alerts.push({
            id: 'contracts_expiring',
            severity: 'warning',
            title: 'Contratos por vencer',
            description: `${expiringContractsCount} contrato${expiringContractsCount > 1 ? 's' : ''} vence${expiringContractsCount === 1 ? '' : 'n'} en menos de 30 días.`,
            count: expiringContractsCount,
            href: '/dashboard/clients',
            cta: 'Renegociar',
        });
    }

    // ── 7. Contracts already expired ──
    if (expiredContractsCount && expiredContractsCount > 0) {
        alerts.push({
            id: 'contracts_expired',
            severity: 'critical',
            title: 'Contratos expirados',
            description: `${expiredContractsCount} contrato${expiredContractsCount > 1 ? 's' : ''} activo${expiredContractsCount > 1 ? 's' : ''} con fecha de fin pasada.`,
            count: expiredContractsCount,
            href: '/dashboard/clients',
            cta: 'Renegociar ahora',
        });
    }

    // Sort: critical → warning → info, then by count desc
    const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return alerts.sort((a, b) =>
        order[a.severity] !== order[b.severity]
            ? order[a.severity] - order[b.severity]
            : b.count - a.count
    );
}
