'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Zap, CheckCircle2, XCircle, PenLine, TrendingUp } from 'lucide-react';
import type { AgentLeaderboardEntry } from '@/app/actions/ocr-jobs';

const RANK_CONFIG = [
    { icon: Trophy,  color: 'text-amber-500',  bg: 'bg-amber-50',  ring: 'ring-amber-200' },
    { icon: Medal,   color: 'text-slate-400',   bg: 'bg-slate-50',  ring: 'ring-slate-200' },
    { icon: Medal,   color: 'text-orange-400',  bg: 'bg-orange-50', ring: 'ring-orange-200' },
];

function RateBar({ value, color }: { value: number; color: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(value * 100)}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className={`h-full rounded-full ${color}`}
                />
            </div>
            <span className="text-[10px] font-black tabular-nums text-slate-500 w-7 text-right">
                {Math.round(value * 100)}%
            </span>
        </div>
    );
}

export default function AgentLeaderboard() {
    const [entries, setEntries] = useState<AgentLeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        import('@/app/actions/ocr-jobs').then(({ getAgentPrecisionLeaderboard }) => {
            getAgentPrecisionLeaderboard()
                .then(data => { setEntries(data); setLoading(false); })
                .catch(() => setLoading(false));
        });
    }, []);

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Trophy size={15} className="text-amber-500" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Leaderboard de Agentes</h3>
                    <p className="text-[10px] text-slate-400">Rendimiento OCR · facturas procesadas y validadas</p>
                </div>
            </div>

            {loading ? (
                <div className="space-y-3 p-4">
                    {[1,2,3].map(i => (
                        <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-700 animate-pulse" />
                    ))}
                </div>
            ) : entries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                    <Zap size={20} />
                    <p className="text-xs font-medium">Sin datos de agentes aún</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {entries.map((entry, idx) => {
                        const rankCfg = RANK_CONFIG[idx] ?? { icon: TrendingUp, color: 'text-slate-400', bg: 'bg-slate-50', ring: 'ring-slate-100' };
                        const RankIcon = rankCfg.icon;

                        return (
                            <motion.div
                                key={entry.agentId}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.06 }}
                                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                            >
                                {/* Rank badge */}
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${idx < 3 ? rankCfg.bg + ' ring-1 ' + rankCfg.ring : ''}`}>
                                    {idx < 3
                                        ? <RankIcon size={13} className={rankCfg.color} />
                                        : <span className="text-[10px] font-black text-slate-400">{idx + 1}</span>
                                    }
                                </div>

                                {/* Agent info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{entry.fullName}</span>
                                        <span className="text-[9px] text-slate-400 font-mono hidden sm:inline truncate max-w-[120px]">{entry.email}</span>
                                    </div>
                                    <RateBar value={entry.successRate} color="bg-emerald-500" />
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-center hidden sm:block">
                                        <div className="flex items-center gap-1 justify-center">
                                            <CheckCircle2 size={10} className="text-emerald-500" />
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">{entry.completedJobs}</span>
                                        </div>
                                        <span className="text-[9px] text-slate-400">completados</span>
                                    </div>
                                    {entry.failedJobs > 0 && (
                                        <div className="text-center hidden sm:block">
                                            <div className="flex items-center gap-1 justify-center">
                                                <XCircle size={10} className="text-red-400" />
                                                <span className="text-xs font-bold text-red-500 tabular-nums">{entry.failedJobs}</span>
                                            </div>
                                            <span className="text-[9px] text-slate-400">fallidos</span>
                                        </div>
                                    )}
                                    <div className="text-center">
                                        <div className="flex items-center gap-1 justify-center">
                                            <PenLine size={10} className="text-indigo-400" />
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">{entry.validatedCount}</span>
                                        </div>
                                        <span className="text-[9px] text-slate-400">validados</span>
                                    </div>
                                    <div className="text-center">
                                        <span className="text-sm font-black text-slate-700 dark:text-slate-200 tabular-nums block">{Math.round(entry.successRate * 100)}%</span>
                                        <span className="text-[9px] text-slate-400">éxito</span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
