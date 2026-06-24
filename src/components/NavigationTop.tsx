'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Contact,
    Network,
    Briefcase,
    FileSignature,
    FileText,
    Sparkles,
    Receipt,
    Settings,
    LogOut,
    Menu,
    X,
    Shield
} from 'lucide-react';
import { ZinergiaLogo } from './ui/ZinergiaLogo';
import { NotificationBell } from './ui/NotificationBell';
import { motion, AnimatePresence } from 'framer-motion';
import { logout } from '@/app/auth/actions';
import { createClient } from '@/lib/supabase/client';

const navItems = [
    { name: 'Inicio',      href: '/dashboard',           icon: LayoutDashboard },
    { name: 'Clientes',    href: '/dashboard/clients',   icon: Contact         },
    { name: 'Facturas',    href: '/dashboard/invoices',  icon: FileText        },
    { name: 'Propuestas',  href: '/dashboard/proposals', icon: FileSignature   },
    { name: 'Simulador',   href: '/dashboard/simulator', icon: Sparkles        },
    { name: 'Cartera',     href: '/dashboard/wallet',    icon: Briefcase       },
    { name: 'Ajustes',     href: '/dashboard/settings',  icon: Settings        },
] as const;


export const NavigationTop = () => {
    const pathname = usePathname();
    const router = useRouter();
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        let mounted = true;
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user || !mounted) return;
            supabase.from('profiles').select('role').eq('id', user.id).maybeSingle().then(({ data: profile }) => {
                if (!mounted) return;
                if (profile?.role === 'admin') setIsAdmin(true);
            });
        });

        return () => { mounted = false; };
    }, []);

    const handleLogout = useCallback(() => logout(), []);
    const handleMobileNavigation = useCallback((event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        event.preventDefault();
        setIsMobileMenuOpen(false);
        router.push(href);
    }, [router]);

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">

            {/* Mobile top bar — iOS Native Glass Style */}
            <div className="lg:hidden bg-white/85 backdrop-blur-xl border-b border-[#e5e5ea]/50 pointer-events-auto flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),16px)] pb-3">
                <Link href="/dashboard" className="active:opacity-70 transition-opacity">
                    <ZinergiaLogo className="w-24 mt-1" />
                </Link>
                <div className="flex items-center gap-1 mt-1">
                    <NotificationBell />
                    <button
                        type="button"
                        onClick={handleLogout}
                        aria-label="Cerrar sesión"
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 active:bg-slate-200/60 transition-colors"
                        title="Cerrar Sesión"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            {/* Desktop floating nav */}
            <div className="hidden lg:block max-w-[1600px] mx-auto px-8 pointer-events-auto">
                <nav className="rounded-2xl border border-slate-200 flex items-center justify-between px-5 py-1.5 md:px-7 bg-white/90 backdrop-blur-lg shadow-sm">

                    {/* Logo Section */}
                    <div className="flex items-center gap-8">
                        <Link href="/dashboard" className="transition-transform active:scale-95 flex flex-col items-start">
                            <ZinergiaLogo className="w-16 md:w-20" />
                            <span className="text-[9px] text-slate-400/70 font-mono tracking-tight leading-none -mt-0.5 pl-0.5">
                                {process.env.NEXT_PUBLIC_APP_VERSION}
                            </span>
                        </Link>

                        {/* Desktop Navigation Items */}
                        <div className="hidden lg:flex items-center gap-1">
                            {/* Admin: nav simplificado — solo Tarifas y Admin Panel */}
                            {isAdmin ? (
                                <>
                                    <NavIconLink href="/dashboard/tariffs" label="Tarifas" icon={Receipt} pathname={pathname} hoveredItem={hoveredItem} setHoveredItem={setHoveredItem} />
                                    <NavIconLink href="/dashboard/network" label="Red" icon={Network} pathname={pathname} hoveredItem={hoveredItem} setHoveredItem={setHoveredItem} />
                                    <a
                                        href="/admin"
                                        aria-label="Admin Panel"
                                        className={`relative flex items-center justify-center w-11 h-11 rounded-2xl transition-colors duration-300 ${
                                            pathname.startsWith('/admin')
                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                                : 'text-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-600'
                                        }`}
                                        title="Admin Panel"
                                    >
                                        <Shield size={22} strokeWidth={1.5} />
                                    </a>
                                </>
                            ) : (
                                <>
                                    {/* Comercial: todos los navItems + Tarifas */}
                                    {navItems.map((item) => (
                                        <NavIconLink key={item.name} href={item.href} label={item.name} icon={item.icon} pathname={pathname} hoveredItem={hoveredItem} setHoveredItem={setHoveredItem} />
                                    ))}
                                    <NavIconLink href="/dashboard/tariffs" label="Tarifas" icon={Receipt} pathname={pathname} hoveredItem={hoveredItem} setHoveredItem={setHoveredItem} />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right Section */}
                    <div className="flex items-center gap-3">
                        <NotificationBell />

                        {/* Logout Button */}
                        <button
                            type="button"
                            onClick={handleLogout}
                            aria-label="Cerrar sesión"
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 transition-colors active:scale-90"
                            title="Cerrar Sesión"
                        >
                            <LogOut size={18} />
                        </button>

                        {/* Mobile Menu Toggle (Oculto en Nuevo Diseño TabBar) */}
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
                            aria-expanded={isMobileMenuOpen}
                            aria-controls="mobile-menu-sheet"
                            className="hidden w-9 h-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md active:scale-95"
                        >
                            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </nav>
            </div>

            {/* Mobile Bottom Sheet Menu — iOS action sheet style */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="lg:hidden fixed inset-0 bg-black/30 z-[55] pointer-events-auto"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        {/* Sheet */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            id="mobile-menu-sheet"
                            className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#f2f2f7] rounded-t-3xl z-[60] pb-safe overflow-hidden pointer-events-auto"
                        >
                            {/* Handle bar */}
                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-[#c7c7cc]" />
                            </div>
                            <div className="px-4 pb-4">
                                <div className="grid grid-cols-3 gap-2 pt-2">
                                    {isAdmin ? (
                                        /* Admin: solo sus herramientas */
                                        <>
                                            <Link href="/admin" onClick={(event) => handleMobileNavigation(event, '/admin')} className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl transition-colors active:scale-95 ${pathname.startsWith('/admin') ? 'bg-white text-indigo-600 shadow-sm' : 'bg-white text-slate-500 active:bg-slate-50'}`}>
                                                <Shield size={22} strokeWidth={1.5} />
                                                <span className="text-[11px] font-medium">Admin</span>
                                            </Link>
                                            <Link href="/dashboard/tariffs" onClick={(event) => handleMobileNavigation(event, '/dashboard/tariffs')} className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl transition-colors active:scale-95 ${pathname.startsWith('/dashboard/tariffs') ? 'bg-white text-energy-500 shadow-sm' : 'bg-white text-slate-500 active:bg-slate-50'}`}>
                                                <Receipt size={22} strokeWidth={1.5} />
                                                <span className="text-[11px] font-medium">Tarifas</span>
                                            </Link>
                                            <Link href="/dashboard/network" onClick={(event) => handleMobileNavigation(event, '/dashboard/network')} className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl transition-colors active:scale-95 ${pathname.startsWith('/dashboard/network') ? 'bg-white text-energy-500 shadow-sm' : 'bg-white text-slate-500 active:bg-slate-50'}`}>
                                                <Network size={22} strokeWidth={1.5} />
                                                <span className="text-[11px] font-medium">Red</span>
                                            </Link>
                                            <Link href="/dashboard/settings" onClick={(event) => handleMobileNavigation(event, '/dashboard/settings')} className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl transition-colors active:scale-95 ${pathname.startsWith('/dashboard/settings') ? 'bg-white text-energy-500 shadow-sm' : 'bg-white text-slate-500 active:bg-slate-50'}`}>
                                                <Settings size={22} strokeWidth={1.5} />
                                                <span className="text-[11px] font-medium">Ajustes</span>
                                            </Link>
                                        </>
                                    ) : (
                                        /* Comercial: todos los items + Tarifas */
                                        <>
                                            {navItems.map((item) => {
                                                const Icon = item.icon;
                                                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                                                return (
                                                    <Link key={item.name} href={item.href} onClick={(event) => handleMobileNavigation(event, item.href)} className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl transition-colors active:scale-95 ${isActive ? 'bg-white text-energy-500 shadow-sm' : 'bg-white text-slate-500 active:bg-slate-50'}`}>
                                                        <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                                                        <span className="text-[11px] font-medium">{item.name}</span>
                                                    </Link>
                                                );
                                            })}
                                            <Link href="/dashboard/tariffs" onClick={(event) => handleMobileNavigation(event, '/dashboard/tariffs')} className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl transition-colors active:scale-95 ${pathname.startsWith('/dashboard/tariffs') ? 'bg-white text-energy-500 shadow-sm' : 'bg-white text-slate-500 active:bg-slate-50'}`}>
                                                <Receipt size={22} strokeWidth={1.5} />
                                                <span className="text-[11px] font-medium">Tarifas</span>
                                            </Link>
                                        </>
                                    )}
                                </div>
                                <p className="text-center text-[10px] text-slate-400/60 font-mono mt-3">
                                    {process.env.NEXT_PUBLIC_APP_VERSION}
                                </p>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            </header>

            {/* --- MÓVIL: BOTTOM TAB BAR iOS PURO --- */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-[#e5e5ea] pb-[max(env(safe-area-inset-bottom),12px)] pt-1">
                <div className="flex items-stretch justify-evenly max-w-md mx-auto">
                    {isAdmin ? (
                        /* Admin: tabs simplificados */
                        <>
                            <Link href="/admin" onClick={(event) => handleMobileNavigation(event, '/admin')} className="flex flex-col items-center justify-center gap-0.5 py-2 flex-1 active:bg-slate-50 transition-colors">
                                <Shield size={24} strokeWidth={pathname.startsWith('/admin') ? 2 : 1.5} className={pathname.startsWith('/admin') ? 'text-indigo-600' : 'text-[#8e8e93]'} />
                                <span className={`text-[10px] font-medium ${pathname.startsWith('/admin') ? 'text-indigo-600' : 'text-[#8e8e93]'}`}>Admin</span>
                            </Link>
                            <Link href="/dashboard/tariffs" onClick={(event) => handleMobileNavigation(event, '/dashboard/tariffs')} className="flex flex-col items-center justify-center gap-0.5 py-2 flex-1 active:bg-slate-50 transition-colors">
                                <Receipt size={24} strokeWidth={pathname.startsWith('/dashboard/tariffs') ? 2 : 1.5} className={pathname.startsWith('/dashboard/tariffs') ? 'text-energy-500' : 'text-[#8e8e93]'} />
                                <span className={`text-[10px] font-medium ${pathname.startsWith('/dashboard/tariffs') ? 'text-energy-500' : 'text-[#8e8e93]'}`}>Tarifas</span>
                            </Link>
                            <Link href="/dashboard/network" onClick={(event) => handleMobileNavigation(event, '/dashboard/network')} className="flex flex-col items-center justify-center gap-0.5 py-2 flex-1 active:bg-slate-50 transition-colors">
                                <Network size={24} strokeWidth={pathname.startsWith('/dashboard/network') ? 2 : 1.5} className={pathname.startsWith('/dashboard/network') ? 'text-energy-500' : 'text-[#8e8e93]'} />
                                <span className={`text-[10px] font-medium ${pathname.startsWith('/dashboard/network') ? 'text-energy-500' : 'text-[#8e8e93]'}`}>Red</span>
                            </Link>
                            <Link href="/dashboard/settings" onClick={(event) => handleMobileNavigation(event, '/dashboard/settings')} className="flex flex-col items-center justify-center gap-0.5 py-2 flex-1 active:bg-slate-50 transition-colors">
                                <Settings size={24} strokeWidth={pathname.startsWith('/dashboard/settings') ? 2 : 1.5} className={pathname.startsWith('/dashboard/settings') ? 'text-energy-500' : 'text-[#8e8e93]'} />
                                <span className={`text-[10px] font-medium ${pathname.startsWith('/dashboard/settings') ? 'text-energy-500' : 'text-[#8e8e93]'}`}>Ajustes</span>
                            </Link>
                        </>
                    ) : (
                        /* Comercial: tabs habituales */
                        navItems.slice(0, 4).map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={(event) => handleMobileNavigation(event, item.href)}
                                className="flex flex-col items-center justify-center gap-0.5 py-2 flex-1 active:bg-slate-50 transition-colors"
                            >
                                <Icon size={24} strokeWidth={isActive ? 2 : 1.5} className={isActive ? 'text-energy-500' : 'text-[#8e8e93]'} />
                                <span className={`text-[10px] font-medium ${isActive ? 'text-energy-500' : 'text-[#8e8e93]'}`}>
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })
                    )}

                    {/* Botón Más — solo para comerciales */}
                    {!isAdmin && <button
                        type="button"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
                        aria-expanded={isMobileMenuOpen}
                        aria-controls="mobile-menu-sheet"
                        className="flex flex-col items-center justify-center gap-0.5 py-2 flex-1 active:bg-slate-50 transition-colors"
                    >
                        <div className={`flex items-center justify-center ${isMobileMenuOpen ? 'text-energy-500' : 'text-[#8e8e93]'}`}>
                            {isMobileMenuOpen ? <X size={24} strokeWidth={2} /> : <Menu size={24} strokeWidth={1.5} />}
                        </div>
                        <span className={`text-[10px] font-medium ${isMobileMenuOpen ? 'text-energy-500' : 'text-[#8e8e93]'}`}>
                            Menú
                        </span>
                    </button>}
                </div>
            </nav>
        </>
    );
};

// ─── Helper: icono de navegación desktop con tooltip ─────────────────────────
function NavIconLink({ href, label, icon: Icon, pathname, hoveredItem, setHoveredItem }: {
    href: string
    label: string
    icon: React.ElementType
    pathname: string
    hoveredItem: string | null
    setHoveredItem: (v: string | null) => void
}) {
    const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    const isSimulador = label === 'Simulador';

    const containerClass = isSimulador
        ? `relative flex items-center justify-center w-12 h-12 rounded-[18px] transition-colors ${isActive ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-500 hover:bg-rose-100'}`
        : `relative flex items-center justify-center w-11 h-11 rounded-[16px] transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`;

    return (
        <div className="relative group" onMouseEnter={() => setHoveredItem(label)} onMouseLeave={() => setHoveredItem(null)}>
            <Link
                href={href}
                aria-label={label}
                className={containerClass}
                onFocus={() => setHoveredItem(label)}
                onBlur={() => setHoveredItem(null)}
            >
                <Icon size={isSimulador ? 24 : 22} strokeWidth={isSimulador ? 2 : 1.5} />
            </Link>
            <AnimatePresence>
                {hoveredItem === label && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-2.5 py-1 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-md pointer-events-none whitespace-nowrap z-50"
                    >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-2 h-2 rotate-45 bg-slate-900" />
                        {label}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
