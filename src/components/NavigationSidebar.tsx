'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home,
    Users,
    BookOpen,
    Briefcase,
    Settings,
    Zap,
    PieChart,
    ChevronRight,
    Wallet,
    Trophy,
    Target,
    LogOut
} from 'lucide-react';
import { ZinergiaLogo } from './ui/ZinergiaLogo';
import { motion } from 'framer-motion';
import { crmService } from '@/services/crmService';
import { logout } from '@/app/auth/actions';

const navItems = [
    { name: 'Inicio', href: '/dashboard', icon: Home },
    { name: 'Mi Red', href: '/dashboard/network', icon: Users },
    { name: 'Mi Cartera', href: '/dashboard/wallet', icon: Wallet },
    { name: 'Academy', href: '/dashboard/academy', icon: BookOpen },
    { name: 'Clientes', href: '/dashboard/clients', icon: Briefcase },
    { name: 'Propuestas', href: '/dashboard/proposals', icon: PieChart },
    { name: 'Tarifas', href: '/dashboard/tariffs', icon: Zap },
    { name: 'Simulador', href: '/dashboard/comparator', icon: Zap },
    { name: 'Configuración', href: '/dashboard/settings', icon: Settings },
];

interface NavSidebarProps {
    isMobile?: boolean; // Prop to force mobile layout
    onItemClick?: () => void;
}

export const NavigationSidebar = ({ isMobile = false, onItemClick }: NavSidebarProps) => {
    const pathname = usePathname();
    const [gamification, setGamification] = useState({
        level: 1,
        xp: 0,
        nextLevelXp: 1000,
        badges: [] as any[]
    });

    useEffect(() => {
        crmService.getUserGamificationStats().then(setGamification);
    }, []);

    const progressPercent = Math.min((gamification.xp / gamification.nextLevelXp) * 100, 100);

    return (
        <aside className={`
            ${isMobile ? 'flex w-full h-full bg-transparent border-none' : 'fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-100 hidden lg:flex'}
            flex-col z-40
        `}>
            {!isMobile && (
                <div className="p-8">
                    <ZinergiaLogo />
                </div>
            )}

            <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar pt-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            onClick={onItemClick}
                            className={`flex items-center justify-between px-4 py-3.5 md:py-3 rounded-xl transition-all group ${isActive
                                ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100/50'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon size={18} className={isActive ? 'text-energy-600' : 'text-slate-400 group-hover:text-slate-600'} />
                                <span className={`text-sm font-semibold ${isActive ? 'text-energy-900' : ''}`}>
                                    {item.name}
                                </span>
                            </div>
                            {isActive && (
                                <motion.div layoutId="activeNav" className="text-energy-400">
                                    <ChevronRight size={16} />
                                </motion.div>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Gamification Widget & Logout */}
            <div className="p-6 border-t border-slate-50 flex flex-col gap-4">
                <button
                    onClick={() => logout()}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-rose-600 transition-all group w-full"
                >
                    <LogOut size={18} className="text-slate-400 group-hover:text-rose-500 transition-colors" />
                    <span className="text-sm font-semibold">Cerrar Sesión</span>
                </button>

                <div className="bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden group shadow-xl shadow-slate-900/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* Header: Level & Badge */}
                    <div className="relative z-10 flex justify-between items-start mb-3">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Nivel {gamification.level}</p>
                            <p className="text-sm font-black text-white">Master Energía</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                            <Trophy size={14} className="text-indigo-300" />
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative z-10 mb-3">
                        <div className="flex justify-between text-[10px] font-medium text-slate-400 mb-1.5">
                            <span>{gamification.xp} XP</span>
                            <span>{gamification.nextLevelXp} XP</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                            />
                        </div>
                    </div>

                    {/* Next Goal Hint */}
                    <div className="relative z-10 flex items-center gap-2 text-[10px] text-slate-400 bg-slate-800/50 p-2 rounded-lg border border-white/5">
                        <Target size={12} className="text-emerald-400" />
                        <span>Próximo: Cierra 2 ventas más</span>
                    </div>
                </div>
            </div>
        </aside>
    );
};
