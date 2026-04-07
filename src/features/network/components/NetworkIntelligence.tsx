'use client';

import React, { useEffect, useState } from 'react';
import { crmService } from '@/services/crmService';
import { getActiveCommissionRule } from '@/app/actions/commissionRules';
import { createClient } from '@/lib/supabase/client';
import {
    Trophy,
    TrendingUp,
    Medal,
    Wallet,
    PieChart as PieIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
    BarChart,
    Bar,
    XAxis,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

interface LeaderboardEntry {
    id?: string;
    name: string;
    role: string;
    points: number;
    badges: string[];
    trend: 'up' | 'down' | 'stable';
    avatar_url: string;
}

const REFERENCE_AMOUNT = 1000;

export const NetworkIntelligence: React.FC = () => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [commissionData, setCommissionData] = useState([
        { name: 'Venta Total', value: REFERENCE_AMOUNT, color: '#f8fafc' },
        { name: 'Agente', value: 300, color: '#10b981' },
        { name: 'Franquicia', value: 500, color: '#6366f1' },
        { name: 'Zinergia', value: 200, color: '#f43f5e' },
    ]);
    const [commissionRule, setCommissionRule] = useState({ agent_share: 0.30, franchise_share: 0.50, hq_share: 0.20 });
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        async function loadIntelligence() {
            try {
                const [lb, rule, { data: { user } }] = await Promise.all([
                    crmService.getLeaderboard(),
                    getActiveCommissionRule(),
                    createClient().auth.getUser(),
                ]);
                setLeaderboard(lb as unknown as LeaderboardEntry[]);
                setCurrentUserId(user?.id ?? null);
                setCommissionRule({ agent_share: rule.agent_share, franchise_share: rule.franchise_share, hq_share: rule.hq_share });
                setCommissionData([
                    { name: 'Venta Total', value: REFERENCE_AMOUNT, color: '#f8fafc' },
                    { name: `Agente (${Math.round(rule.agent_share * 100)}%)`, value: Math.round(REFERENCE_AMOUNT * rule.agent_share), color: '#10b981' },
                    { name: `Franquicia (${Math.round(rule.franchise_share * 100)}%)`, value: Math.round(REFERENCE_AMOUNT * rule.franchise_share), color: '#6366f1' },
                    { name: `Zinergia (${Math.round(rule.hq_share * 100)}%)`, value: Math.round(REFERENCE_AMOUNT * rule.hq_share), color: '#f43f5e' },
                ]);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadIntelligence();
    }, []);

    if (loading) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* 1. Money Flow - Commission Waterfall */}
            <div className="lg:col-span-8 flex flex-col gap-8">
                <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Wallet size={24} className="text-indigo-600" />
                                Motor de Comisiones
                            </h2>
                            <p className="text-sm text-slate-500 font-light">Reparto transparente por cada 1.000€ de facturación</p>
                        </div>
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                            <PieIcon size={24} />
                        </div>
                    </div>

                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={commissionData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="value" radius={[12, 12, 12, 12]} barSize={60}>
                                    {commissionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke={index === 0 ? '#e2e8f0' : 'none'} strokeWidth={1} />
                                    ))}
                                </Bar>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500, fill: '#64748b' }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-8">
                        <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 mb-1">Agente</p>
                            <p className="text-2xl font-bold text-emerald-900">{Math.round(REFERENCE_AMOUNT * commissionRule.agent_share)}€</p>
                        </div>
                        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-600 mb-1">Franquicia</p>
                            <p className="text-2xl font-bold text-indigo-900">{Math.round(REFERENCE_AMOUNT * commissionRule.franchise_share)}€</p>
                        </div>
                        <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-rose-600 mb-1">Zinergia</p>
                            <p className="text-2xl font-bold text-rose-900">{Math.round(REFERENCE_AMOUNT * commissionRule.hq_share)}€</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 bg-indigo-500/20 blur-3xl rounded-full -mr-20 -mt-20 group-hover:bg-indigo-500/30 transition-colors duration-500" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <TrendingUp size={20} className="text-indigo-400" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">AI Sales Coach</span>
                        </div>
                        {leaderboard.length > 0 ? (
                            <>
                                <h3 className="text-2xl font-bold mb-4 italic">
                                    &quot;{leaderboard[0].name ?? 'El top agente'} lidera la red con {leaderboard[0].points} puntos.&quot;
                                </h3>
                                <p className="text-slate-400 font-light max-w-lg mb-8">
                                    {leaderboard.length} agente{leaderboard.length !== 1 ? 's' : ''} activo{leaderboard.length !== 1 ? 's' : ''} en el ranking.
                                    La comisión por agente está configurada al {Math.round(commissionRule.agent_share * 100)}% de cada venta cerrada.
                                </p>
                            </>
                        ) : (
                            <>
                                <h3 className="text-2xl font-bold mb-4 italic">&quot;Empieza a cerrar propuestas para aparecer en el ranking.&quot;</h3>
                                <p className="text-slate-400 font-light max-w-lg mb-8">
                                    El ranking se actualiza automáticamente con cada propuesta aceptada. La comisión por agente está al {Math.round(commissionRule.agent_share * 100)}%.
                                </p>
                            </>
                        )}
                        <button onClick={() => window.location.href = '/dashboard/wallet'} className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:scale-105 transition-transform">
                            Ver mis comisiones
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Leaderboard - Gamification */}
            <div className="lg:col-span-4">
                <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 shadow-sm h-full">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Trophy size={24} className="text-amber-500" />
                                Top Performers
                            </h2>
                            <p className="text-sm text-slate-500 font-light">Los agentes más destacados</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {leaderboard.map((entry, idx) => (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                key={idx}
                                className={`flex items-center justify-between p-4 rounded-[2rem] border transition-all hover:scale-[1.02] ${idx === 0 ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50/30 border-slate-100 hover:border-slate-200'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-amber-400 text-white' :
                                        idx === 1 ? 'bg-slate-300 text-slate-700' :
                                            idx === 2 ? 'bg-orange-300 text-white' :
                                                'bg-slate-100 text-slate-400'
                                        }`}>
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 text-sm leading-none mb-1">{entry.name || 'Agente Anónimo'}</p>
                                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{entry.role || 'Agente'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-slate-900">{entry.points}</p>
                                    <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-[0.1em]">Puntos</p>
                                </div>
                            </motion.div>
                        ))}

                        {leaderboard.length === 0 && (
                            <div className="py-20 text-center text-slate-400 italic">
                                Calentando motores... el ranking se actualizará pronto.
                            </div>
                        )}
                    </div>

                    {(() => {
                        const myPos = currentUserId ? leaderboard.findIndex(e => e.id === currentUserId) : -1;
                        const myEntry = myPos >= 0 ? leaderboard[myPos] : null;
                        const nextEntry = myPos > 0 ? leaderboard[myPos - 1] : null;
                        const pointsToNext = nextEntry && myEntry ? nextEntry.points - myEntry.points : null;
                        return (
                            <div className="mt-8 p-6 bg-gradient-to-tr from-amber-500 to-orange-400 rounded-3xl text-white shadow-xl shadow-amber-500/20">
                                <div className="flex items-center gap-3 mb-2">
                                    <Medal size={20} />
                                    <span className="text-xs font-bold uppercase tracking-wider">Tu Posición</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <h4 className="text-2xl font-bold">
                                        {myPos >= 0 ? `#${myPos + 1} en la Red` : 'Sin ranking aún'}
                                    </h4>
                                    {pointsToNext !== null && pointsToNext > 0 ? (
                                        <div className="text-right">
                                            <p className="text-xs font-medium opacity-80">Faltan {pointsToNext} puntos</p>
                                            <p className="text-xs font-bold underline">Subir al #{myPos}</p>
                                        </div>
                                    ) : myPos === 0 ? (
                                        <p className="text-xs font-bold">Líder del ranking</p>
                                    ) : (
                                        <p className="text-xs font-medium opacity-80">Cierra propuestas para entrar</p>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

        </div>
    );
};
