'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Medal, Lock, Trophy } from 'lucide-react';
import { crmService } from '@/services/crmService';

interface Achievement {
    id: string;
    title: string;
    icon: string;
    color: string;
    unlocked: boolean;
}

interface GamificationStats {
    level: number;
    xp: number;
    nextLevelXp: number;
    progress: number;
    badges: Achievement[];
}

export const AchievementsWidget = () => {
    const [stats, setStats] = useState<GamificationStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadStats = async () => {
            try {
                const data = await crmService.getUserGamificationStats();
                setStats(data);
            } catch (error) {
                console.error('Error loading gamification stats:', error);
            } finally {
                setLoading(false);
            }
        };
        loadStats();
    }, []);

    if (loading) {
        return <div className="h-full w-full bg-white/20 animate-pulse rounded-[2.5rem]"></div>;
    }

    if (!stats) return null;

    return (
        <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] p-6 border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative overflow-hidden group hover:bg-white/50 transition-all h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
                        <Medal size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg leading-tight text-slate-800">Logros</h3>
                        <p className="text-xs text-slate-400 font-medium">Nivel {stats.level} • {stats.xp} XP</p>
                    </div>
                </div>
            </div>

            {/* XP Progress */}
            <div className="mb-6">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    <span>Nivel {stats.level}</span>
                    <span>{stats.progress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.progress}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]"
                    />
                </div>
            </div>

            {/* Badges Grid */}
            <div className="grid grid-cols-4 gap-2">
                {stats.badges.map((badge, idx) => (
                    <motion.div
                        key={badge.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`
                            aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border cursor-pointer relative group/badge
                            ${badge.unlocked ? badge.color : 'bg-slate-50 border-slate-100 text-slate-300'}
                        `}
                    >
                        {badge.unlocked ? (
                            <>
                                <span className="text-xl filter drop-shadow-sm transform group-hover/badge:scale-110 transition-transform">{badge.icon}</span>
                            </>
                        ) : (
                            <Lock size={16} />
                        )}

                        {/* Tooltip */}
                        <div className="absolute opacity-0 group-hover/badge:opacity-100 bottom-full mb-2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none transition-opacity z-20">
                            {badge.title}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-auto pt-6 text-center">
                <button className="text-xs font-bold text-indigo-500 hover:text-indigo-600 transition-colors uppercase tracking-wider flex items-center justify-center gap-1">
                    Ver todos <Trophy size={12} />
                </button>
            </div>
        </div>
    );
};
