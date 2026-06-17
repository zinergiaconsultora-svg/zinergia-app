'use client';

import { useEffect, useState } from 'react';
import { getProposalActivitiesAction, type ProposalActivity } from '@/app/actions/proposalActivities';
import { Eye, Link2, CheckCircle2, FileText, Clock } from 'lucide-react';
import { logger } from '@/lib/utils/logger';

interface Props {
    proposalId: string;
}

const EVENT_CONFIG: Record<string, { icon: typeof Eye; color: string; label: string }> = {
    proposal_link_sent: { icon: Link2, color: 'text-blue-500 bg-blue-50 border-blue-200', label: 'Enlace enviado' },
    proposal_public_view: { icon: Eye, color: 'text-amber-500 bg-amber-50 border-amber-200', label: 'Vista del cliente' },
    proposal_accepted: { icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50 border-emerald-200', label: 'Aceptada' },
    proposal_created: { icon: FileText, color: 'text-slate-500 bg-slate-50 border-slate-200', label: 'Creada' },
};

const DEFAULT_CONFIG = { icon: Clock, color: 'text-slate-400 bg-slate-50 border-slate-200', label: 'Evento' };

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function ProposalTimeline({ proposalId }: Props) {
    const [activities, setActivities] = useState<ProposalActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const data = await getProposalActivitiesAction(proposalId);
                setActivities(data);
            } catch (err) {
                logger.error('Error loading proposal timeline:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [proposalId]);

    if (loading) {
        return (
            <div className="animate-pulse space-y-3 py-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3 items-center">
                        <div className="w-8 h-8 rounded-full bg-slate-100" />
                        <div className="flex-1 h-4 bg-slate-100 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <p className="text-xs text-slate-400 text-center py-4">
                Sin actividad registrada aún.
            </p>
        );
    }

    return (
        <div className="relative">
            <div className="absolute left-4 top-4 bottom-4 w-px bg-slate-200" />
            <ul className="space-y-0">
                {activities.map((activity) => {
                    const cfg = EVENT_CONFIG[activity.type] || DEFAULT_CONFIG;
                    const Icon = cfg.icon;
                    return (
                        <li key={activity.id} className="relative flex gap-3 py-3 pl-0">
                            <div className={`relative z-10 w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${cfg.color}`}>
                                <Icon size={14} />
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-bold text-slate-700">{cfg.label}</span>
                                    <span className="text-[10px] text-slate-400">{formatDate(activity.created_at)}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{activity.description}</p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
