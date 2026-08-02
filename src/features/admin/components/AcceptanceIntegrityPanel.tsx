'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
    retryAcceptanceIntegrityAction,
    type AcceptanceIntegrityItem,
} from '@/app/actions/acceptanceIntegrity';

function issueLabels(item: AcceptanceIntegrityItem): string[] {
    const labels: string[] = [];
    if (item.missingOpportunity) labels.push('Sin oportunidad');
    if (item.missingActivation) labels.push('Alta');
    if (item.missingCommission) labels.push('Comisión');
    if (item.missingContract) labels.push('Contrato');
    return labels;
}

export default function AcceptanceIntegrityPanel({ initialItems }: { initialItems: AcceptanceIntegrityItem[] }) {
    const [items, setItems] = useState(initialItems);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    if (items.length === 0) return null;

    const retry = (proposalId: string) => {
        setPendingId(proposalId);
        startTransition(async () => {
            const result = await retryAcceptanceIntegrityAction(proposalId);
            setItems((current) => result.remaining
                ? current.map((item) => item.proposalId === proposalId ? result.remaining! : item)
                : current.filter((item) => item.proposalId !== proposalId));
            setPendingId(null);
        });
    };

    return (
        <section className="border-y border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 px-4 py-3">
                <AlertTriangle size={16} className="text-amber-700" aria-hidden="true" />
                <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Operaciones por reconciliar</h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Aceptaciones registradas con algún efecto durable pendiente.</p>
                </div>
            </div>
            <div className="divide-y divide-amber-200/70 dark:divide-amber-900/50">
                {items.map((item) => {
                    const blocked = item.missingOpportunity;
                    const busy = isPending && pendingId === item.proposalId;
                    return (
                        <div key={item.proposalId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Propuesta {item.proposalId.slice(0, 8)}</p>
                                <p className="text-xs text-slate-500">Pendiente: {issueLabels(item).join(', ')}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => retry(item.proposalId)}
                                disabled={blocked || busy}
                                title={blocked ? 'Requiere asociación manual con una oportunidad' : 'Reintentar solo los efectos pendientes'}
                                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-300"
                            >
                                <RefreshCw size={14} className={busy ? 'animate-spin' : ''} aria-hidden="true" />
                                {blocked ? 'Revisión manual' : 'Reintentar'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
