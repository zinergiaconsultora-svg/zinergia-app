'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
    Wallet,
    LogOut,
    Trophy,
    Menu,
    X
} from 'lucide-react';
import { ZinergiaLogo } from './ui/ZinergiaLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { crmService } from '@/services/crmService';
import { logout } from '@/app/auth/actions';

const navItems = [
    { name: 'Inicio', href: '/dashboard', icon: Home },
    { name: 'Red', href: '/dashboard/network', icon: Users },
    { name: 'Cartera', href: '/dashboard/wallet', icon: Wallet },
    { name: 'Academy', href: '/dashboard/academy', icon: BookOpen },
    { name: 'Clientes', href: '/dashboard/clients', icon: Briefcase },
    { name: 'Simulador', href: '/dashboard/simulator', icon: Zap },
    { name: 'Propuestas', href: '/dashboard/proposals', icon: PieChart },
    { name: 'Tarifas', href: '/dashboard/tariffs', icon: Zap },
    { name: 'Ajustes', href: '/dashboard/settings', icon: Settings },
] as const;

const DEFAULT_GAMIFICATION = {
    level: 5,
    xp: 2450,
    nextLevelXp: 3000
};

export const NavigationTop = () => {
    const pathname = usePathname();
    const [gamification, setGamification] = useState(DEFAULT_GAMIFICATION);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        let mounted = true;
        crmService.getUserGamificationStats().then(data => {
            if (mounted) setGamification(data);
        }).catch(() => { });
        return () => { mounted = false; };
    }, []);

    const handleLogout = useCallback(() => logout(), []);

    const xpPercent = Math.min((gamification.xp / gamification.nextLevelXp) * 100, 100);

    return (
        <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3 md:px-8 md:py-4">
            <div className="max-w-[1600px] mx-auto">
                <nav className="glass-premium rounded-[2rem] border border-white/40 shadow-floating flex items-center justify-between px-6 py-2 md:px-8">

                    {/* Logo Section */}
                    <div className="flex items-center gap-8">
                        <Link href="/dashboard" className="transition-transform active:scale-95">
                            <ZinergiaLogo className="w-24 md:w-28" />
                        </Link>

                        {/* Desktop Navigation Items */}
                        <div className="hidden lg:flex items-center gap-1.5">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

                                return (
                                    <div
                                        key={item.name}
                                        className="relative group"
                                        onMouseEnter={() => setHoveredItem(item.name)}
                                        onMouseLeave={() => setHoveredItem(null)}
                                    >
                                        <Link
                                            href={item.href}
                                            className={`relative flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-300 ${isActive
                                                ? 'bg-slate-900 text-white shadow-lg'
                                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                                }`}
                                        >
                                            <Icon size={20} />
                                            {isActive && (
                                                <motion.div
                                                    layoutId="navGlow"
                                                    className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"
                                                />
                                            )}
                                        </Link>

                                        {/* Hover Tooltip - PREMIUM DOCK STYLE */}
                                        <AnimatePresence>
                                            {hoveredItem === item.name && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-lg pointer-events-none whitespace-nowrap z-50 shadow-xl"
                                                >
                                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-2 h-2 bg-slate-900 rotate-45" />
                                                    {item.name}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Section: Stats & Profile */}
                    <div className="flex items-center gap-4">
                        {/* Gamification Mini-Widget */}
                        <div className="hidden md:flex items-center gap-4 bg-slate-50/50 border border-slate-100 px-4 py-2 rounded-2xl">
                            <div className="text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">NIVEL {gamification.level}</p>
                                <div className="h-1 w-20 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${xpPercent}%` }}
                                        className="h-full bg-emerald-500"
                                    />
                                </div>
                            </div>
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                                <Trophy size={18} />
                            </div>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-90"
                            title="Cerrar Sesión"
                        >
                            <LogOut size={20} />
                        </button>

                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="lg:hidden w-11 h-11 flex items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg active:scale-95"
                        >
                            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </nav>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="lg:hidden absolute top-24 left-4 right-4 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-[2.5rem] shadow-2xl p-6 z-[60]"
                    >
                        <div className="grid grid-cols-2 gap-4">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-3xl transition-all ${isActive
                                            ? 'bg-slate-900 text-white shadow-lg'
                                            : 'bg-slate-50 text-slate-500 active:bg-slate-100'
                                            }`}
                                    >
                                        <Icon size={24} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{item.name}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
};
