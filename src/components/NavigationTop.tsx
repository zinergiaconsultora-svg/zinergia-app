'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useScroll, useTransform } from 'framer-motion';
import {
    LayoutDashboard,
    Contact,
    Network,
    Briefcase,
    GraduationCap,
    FileSignature,
    Sparkles,
    Receipt,
    Settings,
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
    { name: 'Inicio', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Red', href: '/dashboard/network', icon: Network },
    { name: 'Cartera', href: '/dashboard/wallet', icon: Briefcase },
    { name: 'Academy', href: '/dashboard/academy', icon: GraduationCap },
    { name: 'Clientes', href: '/dashboard/clients', icon: Contact },
    { name: 'Simulador', href: '/dashboard/simulator', icon: Sparkles },
    { name: 'Propuestas', href: '/dashboard/proposals', icon: FileSignature },
    { name: 'Tarifas', href: '/dashboard/tariffs', icon: Receipt },
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

    const { scrollY } = useScroll();
    const headerOpacity = useTransform(scrollY, [0, 50], [0.8, 1]);
    const headerBlur = useTransform(scrollY, [0, 50], [8, 16]);
    const headerScale = useTransform(scrollY, [0, 50], [1, 0.98]);
    const progressWidth = useTransform(scrollY, [0, 1000], ["0%", "100%"]);

    const xpPercent = Math.min((gamification.xp / gamification.nextLevelXp) * 100, 100);

    return (
        <header className="fixed top-0 left-0 right-0 z-50 px-4 py-1.5 md:px-8 md:py-2 pointer-events-none">
            <motion.div
                style={{ width: progressWidth }}
                className="fixed top-0 left-0 h-[1px] bg-indigo-500 z-[60] shadow-[0_0_8px_rgba(99,102,241,0.3)]"
            />

            <div className="max-w-[1600px] mx-auto pointer-events-auto">
                <motion.nav
                    style={{
                        opacity: headerOpacity,
                        backdropFilter: `blur(${headerBlur}px)`,
                        scale: headerScale
                    }}
                    className="glass-premium rounded-3xl border border-white/20 shadow-floating flex items-center justify-between px-5 py-1.5 md:px-7 bg-white/30"
                >

                    {/* Logo Section */}
                    <div className="flex items-center gap-8">
                        <Link href="/dashboard" className="transition-transform active:scale-95">
                            <ZinergiaLogo className="w-16 md:w-20" />
                        </Link>

                        {/* Desktop Navigation Items */}
                        <div className="hidden lg:flex items-center gap-1">
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
                                        <motion.div
                                            whileHover={{ scale: 1.1, rotate: 2 }}
                                            whileTap={{ scale: 0.9 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                        >
                                            <Link
                                                href={item.href}
                                                className={`relative flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-300 ${isActive
                                                    ? 'bg-energy-500 text-white shadow-lg shadow-energy-500/20'
                                                    : 'text-slate-500 hover:bg-slate-100/50 hover:text-slate-900'
                                                    }`}
                                            >
                                                <Icon size={22} strokeWidth={1.5} />
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="navGlow"
                                                        className="absolute inset-0 bg-energy-500/20 blur-2xl rounded-full"
                                                    />
                                                )}
                                            </Link>
                                        </motion.div>

                                        {/* Hover Tooltip - PREMIUM DOCK STYLE */}
                                        <AnimatePresence>
                                            {hoveredItem === item.name && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                                    className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-2.5 py-1 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-md pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10"
                                                >
                                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-2 h-2 bg-slate-900 rotate-45 border-l border-t border-white/10" />
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
                    <div className="flex items-center gap-3">
                        {/* Gamification Mini-Widget */}
                        <div className="hidden md:flex items-center gap-2 bg-slate-50/50 border border-slate-100/50 px-2 py-1.5 rounded-2xl relative overflow-hidden group/shimmer">
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full"
                                animate={{ x: ["-100%", "100%"] }}
                                transition={{ repeat: Infinity, duration: 4, ease: "linear", repeatDelay: 6 }}
                            />
                            <div className="text-right">
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">NIVEL {gamification.level}</p>
                                <div className="h-1 w-16 bg-slate-200 rounded-full mt-0.5 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${xpPercent}%` }}
                                        className="h-full bg-emerald-500"
                                    />
                                </div>
                            </div>
                            <motion.div
                                whileHover={{ scale: 1.1, rotate: -5 }}
                                className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-md relative z-10"
                            >
                                <Trophy size={14} />
                                <motion.div
                                    className="absolute inset-0 bg-white/20 blur-md rounded-lg opacity-0 hover:opacity-100 transition-opacity"
                                />
                            </motion.div>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 transition-all active:scale-90"
                            title="Cerrar Sesión"
                        >
                            <LogOut size={18} />
                        </button>

                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-slate-900 text-white shadow-md active:scale-95"
                        >
                            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </motion.nav>
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
                                        className={`flex flex-col items-center justify-center gap-3 p-5 rounded-[2rem] transition-all ${isActive
                                            ? 'bg-energy-500 text-white shadow-xl shadow-energy-500/20 scale-[1.02]'
                                            : 'bg-slate-50 text-slate-500 active:bg-slate-100'
                                            }`}
                                    >
                                        <Icon size={28} strokeWidth={1.5} />
                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{item.name}</span>
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
