'use client';

import type { AgentRankingEntry } from '@/app/actions/admin';

interface Props {
    data: AgentRankingEntry[];
}

function getMedalEmoji(index: number): string {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}`;
}

export default function AgentRankingTable({ data }: Props) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Ranking de Agentes</h3>
            </div>

            {data.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 text-slate-600">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                    </svg>
                    <p className="text-sm">Sin agentes registrados aún</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                <th className="text-left py-3 px-2 text-slate-400 font-medium w-10">#</th>
                                <th className="text-left py-3 px-2 text-slate-400 font-medium">Agente</th>
                                <th className="text-left py-3 px-2 text-slate-400 font-medium hidden md:table-cell">Franquicia</th>
                                <th className="text-right py-3 px-2 text-slate-400 font-medium">Propuestas</th>
                                <th className="text-right py-3 px-2 text-slate-400 font-medium hidden sm:table-cell">Aceptadas</th>
                                <th className="text-right py-3 px-2 text-slate-400 font-medium">Conversión</th>
                                <th className="text-right py-3 px-2 text-slate-400 font-medium">Comisiones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((agent, i) => (
                                <tr key={agent.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                    <td className="py-3 px-2 text-center text-lg">{getMedalEmoji(i)}</td>
                                    <td className="py-3 px-2">
                                        <div className="font-medium text-white">{agent.full_name}</div>
                                        <div className="text-xs text-slate-500">{agent.email}</div>
                                    </td>
                                    <td className="py-3 px-2 text-slate-400 hidden md:table-cell">
                                        {agent.franchise_name ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-700/50 text-slate-300">
                                                {agent.franchise_name}
                                            </span>
                                        ) : (
                                            <span className="text-slate-600 text-xs">Sin asignar</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-2 text-right text-white font-mono">{agent.proposals_total}</td>
                                    <td className="py-3 px-2 text-right text-emerald-400 font-mono hidden sm:table-cell">{agent.proposals_accepted}</td>
                                    <td className="py-3 px-2 text-right">
                                        <ConversionBadge rate={agent.conversion_rate} />
                                    </td>
                                    <td className="py-3 px-2 text-right text-white font-mono font-semibold">
                                        {agent.total_commission.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function ConversionBadge({ rate }: { rate: number }) {
    let colorClasses = 'bg-slate-700/50 text-slate-400';
    if (rate >= 50) colorClasses = 'bg-emerald-500/20 text-emerald-400';
    else if (rate >= 25) colorClasses = 'bg-amber-500/20 text-amber-400';
    else if (rate > 0) colorClasses = 'bg-orange-500/20 text-orange-400';

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono ${colorClasses}`}>
            {rate}%
        </span>
    );
}
