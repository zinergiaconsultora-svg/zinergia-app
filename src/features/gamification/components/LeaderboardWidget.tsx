'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Trophy, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';
import { crmService } from '@/services/crmService';

interface LeaderboardEntry {
    id: string;
    name: string;
    role: string;
    points: number;
    trend: 'up' | 'down' | 'stable';
    avatar_url: string;
    badges?: string[];
}

export const LeaderboardWidget = () => {
    const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaders = async () => {
            try {
                // Ensure data is robust
                const data = await crmService.getLeaderboard();
                setLeaders(data as LeaderboardEntry[]);
            } catch (error) {
                console.error('Error fetching leaderboard:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaders();
    }, []);

    if (loading) {
        return <div className="animate-pulse h-80 bg-slate-100 rounded-[2rem]"></div>;
    }

    if (leaders.length === 0) return null;

    const getRankStyles = (index: number) => {
        switch (index) {
            case 0: return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white shadow-lg shadow-yellow-500/30 border-yellow-300';
            case 1: return 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-800 shadow-lg border-slate-200';
            case 2: return 'bg-gradient-to-r from-amber-700 to-amber-800 text-amber-100 shadow-lg border-amber-600';
            default: return 'bg-slate-800 text-slate-400 border-slate-700';
        }
    };

    return (
        <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden h-full border border-slate-800">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px] pointer-events-none -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-600/10 rounded-full blur-[60px] pointer-events-none -ml-10 -mb-10"></div>

            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-yellow-400 to-amber-600 p-2.5 rounded-xl shadow-lg shadow-yellow-500/20">
                            <Trophy size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight text-white">Ranking</h3>
                            <p className="text-xs text-slate-400 font-medium">Top Agentes del Mes</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                    {leaders.slice(0, 5).map((user, index) => {
                        const rankStyle = getRankStyles(index);
                        const initials = user.name
                            ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                            : 'U';

                        return (
                            <motion.div
                                key={user.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`flex items-center gap-4 p-3 rounded-2xl border transition-all hover:bg-white/5 group ${index === 0 ? 'bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/30' : 'bg-white/5 border-white/5'
                                    }`}
                            >
                                {/* Rank Badge */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 border-2 ${rankStyle}`}>
                                    {index + 1}
                                </div>

                                {/* Avatar */}
                                <div className="relative">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ring-2 ring-offset-2 ring-offset-slate-900 ${index === 0 ? 'bg-yellow-100 text-yellow-700 ring-yellow-500' :
                                        index === 1 ? 'bg-slate-100 text-slate-700 ring-slate-400' :
                                            index === 2 ? 'bg-amber-100 text-amber-800 ring-amber-700' :
                                                'bg-slate-700 text-slate-300 ring-slate-700'
                                        }`}>
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            initials
                                        )}
                                    </div>
                                    {index === 0 && (
                                        <div className="absolute -top-3 -right-1 text-yellow-400 drop-shadow-lg animate-bounce-slow">
                                            <Crown size={14} fill="currentColor" />
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold truncate ${index === 0 ? 'text-yellow-100' : 'text-slate-100'}`}>
                                        {user.name || 'Agente'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <div className="flex items-center gap-1 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                                            <Star size={10} className="text-indigo-400 fill-indigo-400" />
                                            <span className="text-[10px] font-bold text-indigo-200">{user.points} XP</span>
                                        </div>
                                        {/* Badge Icons */}
                                        {user.badges && user.badges.length > 0 && (
                                            <div className="flex -space-x-1">
                                                {user.badges.slice(0, 3).map((badge, i) => (
                                                    <div key={i} className="w-4 h-4 bg-slate-800 rounded-full border border-slate-600 flex items-center justify-center text-[8px]" title={badge}>
                                                        🏅
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Trend */}
                                        <div className="ml-auto">
                                            {user.trend === 'up' && <TrendingUp size={14} className="text-emerald-400" />}
                                            {user.trend === 'down' && <TrendingDown size={14} className="text-rose-400" />}
                                            {user.trend === 'stable' && <Minus size={14} className="text-slate-500" />}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 text-center">
                    <button className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider">
                        Ver Clasificación Completa
                    </button>
                </div>
            </div>
        </div>
    );
};
