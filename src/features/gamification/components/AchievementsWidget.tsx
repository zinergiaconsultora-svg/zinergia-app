'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
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

    if (loading) return null;
    if (!stats) return null;

    return (
        <div className="flex flex-col gap-3 h-full px-1">
            {/* XP Progress - Ultra Minimal */}
            <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1.5">
                    <div className="flex justify-between items-end">
                        <span className="text-[9px] font-medium uppercase tracking-widest text-slate-400">Nivel {stats.level}</span>
                        <span className="text-[9px] font-medium text-slate-600">{stats.progress}%</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.progress}%` }}
                            transition={{ duration: 1.5, ease: "circOut" }}
                            className="h-full bg-indigo-500/80"
                        />
                    </div>
                </div>
                <div className="text-[9px] font-medium text-indigo-500 bg-indigo-50/50 px-2 py-0.5 rounded-full border border-indigo-100/50">
                    {stats.xp} XP
                </div>
            </div>

            {/* Badges - Floating Jewels */}
            <div className="grid grid-cols-4 gap-2">
                {stats.badges.map((badge, idx) => (
                    <motion.div
                        key={badge.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`
                            aspect-square rounded-full flex items-center justify-center relative group cursor-pointer transition-all duration-300
                            ${badge.unlocked
                                ? 'bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                                : 'bg-slate-50/50 border border-slate-100/50 opacity-60 grayscale'}
                        `}
                    >
                        <span className="text-base filter drop-shadow-sm transform group-hover:scale-110 transition-transform">
                            {badge.unlocked ? badge.icon : <Lock size={10} className="text-slate-300" />}
                        </span>

                        {/* Elegant Tooltip */}
                        <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 bg-slate-800/90 backdrop-blur-sm text-white text-[9px] font-medium px-2 py-1 rounded-md shadow-xl whitespace-nowrap pointer-events-none transition-all z-20">
                            {badge.title}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800/90"></div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
