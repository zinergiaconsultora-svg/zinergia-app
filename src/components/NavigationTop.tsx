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
    X,
    Shield
} from 'lucide-react';
import { ZinergiaLogo } from './ui/ZinergiaLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { crmService } from '@/services/crmService';
import { logout } from '@/app/auth/actions';
import { createClient } from '@/lib/supabase/client';

const navItems = [
    { name: 'Inicio',      href: '/dashboard',           icon: LayoutDashboard },
    { name: 'Clientes',    href: '/dashboard/clients',   icon: Contact         },
    { name: 'Propuestas',  href: '/dashboard/proposals', icon: FileSignature   },
    { name: 'Simulador',   href: '/dashboard/simulator', icon: Sparkles        },
    { name: 'Cartera',     href: '/dashboard/wallet',    icon: Briefcase       },
    { name: 'Red',         href: '/dashboard/network',   icon: Network         },
    { name: 'Academy',     href: '/dashboard/academy',   icon: GraduationCap   },
    { name: 'Tarifas',     href: '/dashboard/tariffs',   icon: Receipt         },
    { name: 'Ajustes',     href: '/dashboard/settings',  icon: Settings        },
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
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        let mounted = true;
        crmService.getUserGamificationStats().then(data => {
            if (mounted && data) setGamification(data);
        }).catch(() => { });

        // Check admin role for conditional nav link
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user || !mounted) return;
            supabase.from('profiles').select('role').eq('id', user.id).maybeSingle().then(({ data: profile }) => {
                if (mounted && profile?.role === 'admin') setIsAdmin(true);
            });
        });

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
        <>
            <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-safe pb-0 md:px-8 pointer-events-none">
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

                            {/* Admin Link - Solo visible para admins */}
                            {isAdmin && (
                                <a
                                    href="/admin"
                                    className={`relative flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-300 ${
                                        pathname.startsWith('/admin')
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                            : 'text-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-600'
                                    }`}
                                    title="Admin Panel"
                                >
                                    <Shield size={22} strokeWidth={1.5} />
                                </a>
                            )}
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

                        {/* Mobile Menu Toggle (Oculto en Nuevo Diseño TabBar) */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="hidden w-9 h-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md active:scale-95"
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
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="lg:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-4 right-4 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-2xl p-5 z-[60] overflow-y-auto max-h-[60vh]"
                    >
                        <div className="grid grid-cols-3 gap-2">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-all ${isActive
                                            ? 'bg-energy-500 text-white shadow-lg shadow-energy-500/20'
                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 active:bg-slate-100'
                                            }`}
                                    >
                                        <Icon size={22} strokeWidth={1.5} />
                                        <span className="text-[10px] font-semibold uppercase tracking-wider">{item.name}</span>
                                    </Link>
                                );
                            })}

                            {/* Admin Link - Menú Móvil */}
                            {isAdmin && (
                                <a
                                    href="/admin"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-all ${
                                        pathname.startsWith('/admin')
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                            : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 active:bg-indigo-100'
                                    }`}
                                >
                                    <Shield size={22} strokeWidth={1.5} />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider">Admin</span>
                                </a>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            </header>

            {/* --- MÓVIL: BOTTOM TAB BAR (Estilo iOS) --- */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-3xl border-t border-slate-200/50 dark:border-slate-800/50 pb-safe pt-2 px-2 shadow-[0_-8px_30px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-evenly max-w-md mx-auto relative pt-1 pb-1">
                    {navItems.slice(0, 4).map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="flex flex-col items-center justify-center gap-1 min-w-[3.5rem]"
                            >
                                <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                                    <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                                    {isActive && (
                                        <motion.div layoutId="mobileTabGlow" className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl" />
                                    )}
                                </div>
                                <span className={`text-[10px] font-medium tracking-wide ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                    
                    {/* Botón Menú Expandido */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="flex flex-col items-center justify-center gap-1 min-w-[3.5rem]"
                    >
                        <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${isMobileMenuOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                            {isMobileMenuOpen ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={1.5} />}
                        </div>
                        <span className={`text-[10px] font-medium tracking-wide ${isMobileMenuOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                            Menú
                        </span>
                    </button>
                </div>
            </nav>
        </>
    );
};
