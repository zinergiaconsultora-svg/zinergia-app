'use client';

import { useEffect, useState, useTransition } from 'react';
import {
    Zap, Phone, Send, Clock, CheckCircle2, AlertTriangle,
    TrendingUp, Users, FileSignature, RefreshCw, Target,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import {
    getDailyBriefingAction,
    completeActionAction,
    type DailyBriefing as DailyBriefingType,
    type NextAction,
} from '@/app/actions/copilot';

const FMT_EUR = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const ACTION_CONFIG: Record<string, { icon: typeof Phone; color: string; bg: string }> = {
    call_new_lead:    { icon: Phone,          color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
    resend_proposal:  { icon: Send,           color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    call_interested:  { icon: Phone,          color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    prepare_renewal:  { icon: RefreshCw,      color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
    follow_up_3d:     { icon: Clock,          color: 'text-slate-600 dark:text-slate-400',  bg: 'bg-slate-50 dark:bg-slate-800' },
    follow_up_7d:     { icon: AlertTriangle,  color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
    follow_up_14d:    { icon: AlertTriangle,  color: 'text-rose-600 dark:text-rose-400',    bg: 'bg-rose-50 dark:bg-rose-900/20' },
    welcome_call:     { icon: Phone,          color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    review_stale:     { icon: Clock,          color: 'text-slate-600 dark:text-slate-400',  bg: 'bg-slate-50 dark:bg-slate-800' },
};

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function ActionRow({ action, onComplete, isPending }: {
    action: NextAction;
    onComplete: (id: string) => void;
    isPending: boolean;
}) {
    const cfg = ACTION_CONFIG[action.action_type] ?? ACTION_CONFIG.review_stale;
    const Icon = cfg.icon;

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                <Icon size={14} className={cfg.color} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {action.title}
                </p>
                {action.description && (
                    <p className="text-[10px] text-slate-400 truncate">{action.description}</p>
                )}
            </div>
            <button
                type="button"
                onClick={() => onComplete(action.id)}
                disabled={isPending}
                className="p-1.5 rounded-lg text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
                title="Marcar completado"
            >
                <CheckCircle2 size={16} />
            </button>
        </div>
    );
}

function ForecastGauge({ p10, p50, p90 }: { p10: number; p50: number; p90: number }) {
    return (
        <div className="flex items-end gap-1 text-center">
            <div className="flex-1">
                <p className="text-[10px] text-slate-400 mb-0.5">Pesimista</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{FMT_EUR(p10)}</p>
            </div>
            <div className="flex-1">
                <p className="text-[10px] text-emerald-500 mb-0.5">Esperado</p>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{FMT_EUR(p50)}</p>
            </div>
            <div className="flex-1">
                <p className="text-[10px] text-slate-400 mb-0.5">Optimista</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{FMT_EUR(p90)}</p>
            </div>
        </div>
    );
}

export default function DailyBriefing() {
    const [data, setData] = useState<DailyBriefingType | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        getDailyBriefingAction()
            .then(setData)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    function handleComplete(actionId: string) {
        startTransition(async () => {
            await completeActionAction(actionId);
            setData(prev => prev ? {
                ...prev,
                actions: prev.actions.filter(a => a.id !== actionId),
            } : null);
        });
    }

    if (loading) {
        return (
            <Card variant="elevated" className="p-6">
                <div className="flex items-center gap-2 text-slate-400">
                    <Zap size={14} className="animate-pulse" />
                    <span className="text-sm">Preparando tu briefing…</span>
                </div>
            </Card>
        );
    }

    if (!data) return null;

    const sortedActions = [...data.actions].sort(
        (a, b) => (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 3)
            - (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 3)
    );

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-300/30 dark:shadow-indigo-900/30">
                    <Zap size={16} />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Tu Día</h2>
                    <p className="text-[10px] text-slate-400">
                        {sortedActions.length} accion{sortedActions.length !== 1 ? 'es' : ''} pendiente{sortedActions.length !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-3 gap-3">
                <Card variant="flat" className="p-3 text-center">
                    <Users size={14} className="mx-auto text-indigo-500 mb-1" />
                    <p className="text-lg font-black text-slate-900 dark:text-white">{data.clients_total}</p>
                    <p className="text-[10px] text-slate-400">Clientes</p>
                </Card>
                <Card variant="flat" className="p-3 text-center">
                    <FileSignature size={14} className="mx-auto text-violet-500 mb-1" />
                    <p className="text-lg font-black text-slate-900 dark:text-white">{data.proposals_pending}</p>
                    <p className="text-[10px] text-slate-400">Propuestas</p>
                </Card>
                <Card variant="flat" className="p-3 text-center">
                    <RefreshCw size={14} className="mx-auto text-emerald-500 mb-1" />
                    <p className="text-lg font-black text-slate-900 dark:text-white">{data.renewals_open}</p>
                    <p className="text-[10px] text-slate-400">Renovaciones</p>
                </Card>
            </div>

            {/* Commission forecast */}
            <Card variant="hero" tone="energy" className="p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Target size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Comisión estimada este mes
                    </span>
                </div>
                <ForecastGauge
                    p10={data.forecast.p10}
                    p50={data.forecast.p50}
                    p90={data.forecast.p90}
                />
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400">
                        {data.forecast.won_this_month} ganada{data.forecast.won_this_month !== 1 ? 's' : ''} · {FMT_EUR(data.forecast.won_commission)} confirmado
                    </span>
                    <span className="text-[10px] text-slate-400">
                        {data.forecast.pipeline_count} en pipeline
                    </span>
                </div>
            </Card>

            {/* Actions list */}
            {sortedActions.length === 0 ? (
                <EmptyState
                    icon={CheckCircle2}
                    tone="emerald"
                    compact
                    title="Todo al día"
                    description="No tienes acciones pendientes. ¡Buen trabajo!"
                />
            ) : (
                <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Acciones prioritarias
                    </h3>
                    {sortedActions.map(action => (
                        <ActionRow
                            key={action.id}
                            action={action}
                            onComplete={handleComplete}
                            isPending={isPending}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
