'use client';

import React, { useState } from 'react';
import { UserCog, Download, X, CheckCheck } from 'lucide-react';

export interface AgentOption {
    id: string;
    full_name: string | null;
    email: string | null;
}

interface BulkActionsBarProps {
    count: number;
    agents: AgentOption[];
    busy: boolean;
    onReassign: (agentId: string) => void;
    onReview: () => void;
    onExport: () => void;
    onClear: () => void;
}

export function BulkActionsBar({ count, agents, busy, onReassign, onReview, onExport, onClear }: BulkActionsBarProps) {
    const [agentId, setAgentId] = useState('');
    const [confirming, setConfirming] = useState(false);

    const agentLabel = agents.find((a) => a.id === agentId);
    const agentName = agentLabel?.full_name || agentLabel?.email || 'comercial';

    return (
        <div
            role="region"
            aria-label="Acciones masivas"
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,720px)] rounded-2xl border border-slate-200 bg-white shadow-xl p-3"
        >
            {confirming ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-700">
                        ¿Reasignar <strong>{count}</strong> {count === 1 ? 'lead' : 'leads'} a <strong>{agentName}</strong>?
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => { onReassign(agentId); setConfirming(false); }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {busy ? 'Reasignando…' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 mr-1">
                        {count} {count === 1 ? 'seleccionado' : 'seleccionados'}
                    </span>

                    <div className="flex items-center gap-1.5">
                        <UserCog size={15} className="text-slate-400" aria-hidden="true" />
                        <label className="sr-only" htmlFor="bulk-agent">Comercial destino</label>
                        <select
                            id="bulk-agent"
                            value={agentId}
                            onChange={(e) => setAgentId(e.target.value)}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:border-energy-500 focus:ring-1 focus:ring-energy-500 outline-none max-w-[180px]"
                        >
                            <option value="">Reasignar a…</option>
                            {agents.map((a) => (
                                <option key={a.id} value={a.id}>{a.full_name || a.email || a.id.slice(0, 8)}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            disabled={!agentId || busy}
                            onClick={() => setConfirming(true)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                        >
                            Reasignar
                        </button>
                    </div>

                    <button
                        type="button"
                        disabled={busy}
                        onClick={onReview}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <CheckCheck size={15} /> Marcar revisado
                    </button>

                    <button
                        type="button"
                        disabled={busy}
                        onClick={onExport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <Download size={15} /> Exportar CSV
                    </button>

                    <button
                        type="button"
                        onClick={onClear}
                        aria-label="Limpiar selección"
                        className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-100"
                    >
                        <X size={15} /> Limpiar
                    </button>
                </div>
            )}
        </div>
    );
}
