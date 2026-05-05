'use client';

import React, { useState, useEffect } from 'react';
import {
    UserPlus,
    RefreshCw,
    Zap,
    Send,
    CheckCircle2,
    XCircle,
    FileText,
    Clock,
    Loader2,
} from 'lucide-react';
import { ClientActivity, ActivityType } from '@/types/crm';
import { activitiesService } from '@/services/crm/activities';

const ACTIVITY_CONFIG: Record<ActivityType, { icon: React.ElementType; color: string; bg: string }> = {
    client_created: { icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    client_updated: { icon: RefreshCw, color: 'text-slate-500', bg: 'bg-slate-50' },
    client_status_changed: { icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50' },
    simulation_completed: { icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
    proposal_created: { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    proposal_sent: { icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
    proposal_accepted: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    proposal_rejected: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    note_added: { icon: FileText, color: 'text-slate-500', bg: 'bg-slate-50' },
};

function formatRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hace ${days}d`;
    return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

interface ActivityTimelineProps {
    clientId: string;
}

export default function ActivityTimeline({ clientId }: ActivityTimelineProps) {
    const [activities, setActivities] = useState<ClientActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const data = await activitiesService.getActivitiesByClient(clientId);
            if (cancelled) return;
            setActivities(data);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [clientId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="text-center py-8 text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Sin actividad registrada</p>
            </div>
        );
    }

    return (
        <div className="space-y-0">
            {activities.map((activity, i) => {
                const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.note_added;
                const Icon = config.icon;
                const isLast = i === activities.length - 1;

                return (
                    <div key={activity.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <div className={`w-7 h-7 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                                <Icon size={13} className={config.color} />
                            </div>
                            {!isLast && (
                                <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-1" />
                            )}
                        </div>
                        <div className={`pb-4 ${isLast ? '' : ''}`}>
                            <p className="text-sm text-slate-800 dark:text-slate-200 leading-snug">
                                {activity.description}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                                {formatRelativeTime(activity.created_at)}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
