'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, TrendingUp, TrendingDown } from 'lucide-react';
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

    if (loading) return null; // Skeleton handled by parent or empty state
    if (leaders.length === 0) return null;

    const getRankStyles = (index: number) => {
        switch (index) {
            case 0: return 'bg-yellow-50 text-yellow-600 border-yellow-200';
            case 1: return 'bg-slate-50 text-slate-600 border-slate-200';
            case 2: return 'bg-amber-50 text-amber-700 border-amber-200';
            default: return 'bg-white text-slate-400 border-slate-100';
        }
    };

    return (
        <div className="flex flex-col gap-1.5 h-full">
            {leaders.slice(0, 5).map((user, index) => {
                const rankStyle = getRankStyles(index);
                const initials = user.name
                    ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                    : 'U';

                return (
                    <motion.div
                        key={user.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all cursor-pointer group
                            ${index === 0 ? 'bg-yellow-50/50 border-yellow-100' : 'bg-white/40 border-slate-100 hover:border-indigo-100 hover:bg-white/60'}
                        `}
                    >
                        {/* Compact Rank */}
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-medium text-[9px] shrink-0 border ${rankStyle}`}>
                            {index + 1}
                        </div>

                        {/* Compact Avatar */}
                        <div className="relative">
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200 ring-1 ring-white">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[8px] font-normal text-slate-400">
                                        {initials}
                                    </div>
                                )}
                            </div>
                            {index === 0 && (
                                <div className="absolute -top-1.5 -right-1 text-yellow-500 drop-shadow-sm">
                                    <Crown size={8} fill="currentColor" />
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 flex items-center justify-between">
                            <div className="min-w-0">
                                <p className="text-[10px] font-medium text-slate-600 truncate group-hover:text-indigo-600 transition-colors">
                                    {user.name}
                                </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-medium text-indigo-500 bg-indigo-50 px-1 rounded-sm">
                                    {user.points} XP
                                </span>
                                {user.trend === 'up' && <TrendingUp size={10} className="text-emerald-500" />}
                                {user.trend === 'down' && <TrendingDown size={10} className="text-rose-500" />}
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
};
