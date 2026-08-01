'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    BarChart3,
    BookOpen,
    BriefcaseBusiness,
    Building2,
    ChevronDown,
    CircleGauge,
    ClipboardList,
    Contact,
    FileCheck2,
    FileText,
    FolderArchive,
    Gauge,
    ListTodo,
    LogOut,
    Menu,
    Network,
    Receipt,
    Settings,
    ShieldCheck,
    SlidersHorizontal,
    Upload,
    Users,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { logout } from '@/app/auth/actions';
import {
    getAppNavigation,
    isNavigationItemActive,
    type AppNavigationIcon,
    type AppNavigationItem,
} from '@/lib/navigation/appNavigation';
import type { UserRole } from '@/types/crm';
import { NotificationBell } from './ui/NotificationBell';
import { ZinergiaLogo } from './ui/ZinergiaLogo';

const icons: Record<AppNavigationIcon, LucideIcon> = {
    work: ListTodo,
    clients: Contact,
    commissions: BriefcaseBusiness,
    billing: Receipt,
    team: Users,
    admin: SlidersHorizontal,
    settings: Settings,
    invoice: FileText,
    proposal: FileCheck2,
    tariff: Gauge,
    network: Network,
    task: ClipboardList,
    ocr: CircleGauge,
    drive: FolderArchive,
    reporting: BarChart3,
    privacy: ShieldCheck,
    academy: BookOpen,
    metrics: Building2,
};

type NavigationTopProps = {
    role: UserRole;
};

export function NavigationTop({ role }: NavigationTopProps) {
    const pathname = usePathname();
    const navigation = useMemo(() => getAppNavigation(role), [role]);
    const mobileSecondaryItems = useMemo(
        () => [...navigation.primary.slice(4), ...navigation.secondary],
        [navigation],
    );
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const handleLogout = useCallback(() => logout(), []);

    return (
        <>
            <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <div className="mx-auto flex h-16 max-w-[1700px] items-center gap-3 px-4 lg:px-8">
                    <Link
                        href={role === 'admin' ? '/admin' : '/dashboard'}
                        aria-label="Ir al inicio de Zinergia"
                        className="flex shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                    >
                        <ZinergiaLogo className="w-24" />
                    </Link>

                    <nav
                        aria-label="Navegación principal"
                        className="ml-3 hidden min-w-0 flex-1 items-center gap-1 xl:flex"
                    >
                        {navigation.primary.map((item) => (
                            <DesktopNavigationLink
                                key={item.href}
                                item={item}
                                pathname={pathname}
                            />
                        ))}

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsMoreOpen((open) => !open)}
                                aria-expanded={isMoreOpen}
                                aria-controls="desktop-secondary-navigation"
                                className="inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                            >
                                Más
                                <ChevronDown
                                    aria-hidden="true"
                                    size={15}
                                    className={isMoreOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
                                />
                            </button>

                            {isMoreOpen && (
                                <SecondaryNavigationMenu
                                    id="desktop-secondary-navigation"
                                    items={navigation.secondary}
                                    pathname={pathname}
                                    onNavigate={() => setIsMoreOpen(false)}
                                />
                            )}
                        </div>
                    </nav>

                    <div className="ml-auto flex items-center gap-1.5">
                        <Link
                            href="/dashboard/simulator"
                            aria-label="Nueva factura"
                            className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 active:bg-emerald-900"
                        >
                            <Upload aria-hidden="true" size={17} />
                            <span className="hidden sm:inline">Nueva factura</span>
                            <span className="sm:hidden">Factura</span>
                        </Link>
                        <NotificationBell />
                        <button
                            type="button"
                            onClick={handleLogout}
                            aria-label="Cerrar sesión"
                            title="Cerrar sesión"
                            className="hidden h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 sm:inline-flex dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                            <LogOut aria-hidden="true" size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsMobileOpen((open) => !open)}
                            aria-label={isMobileOpen ? 'Cerrar menú' : 'Abrir menú'}
                            aria-expanded={isMobileOpen}
                            aria-controls="mobile-secondary-navigation"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 xl:hidden dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            {isMobileOpen
                                ? <X aria-hidden="true" size={20} />
                                : <Menu aria-hidden="true" size={20} />}
                        </button>
                    </div>
                </div>
            </header>

            {isMobileOpen && (
                <div
                    id="mobile-secondary-navigation"
                    className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] top-16 z-30 overflow-y-auto border-t border-slate-200 bg-white px-4 py-5 xl:hidden dark:border-slate-800 dark:bg-slate-950"
                >
                    <p className="mb-2 text-sm font-bold text-slate-950 dark:text-white">
                        Herramientas
                    </p>
                    <nav aria-label="Herramientas secundarias" className="divide-y divide-slate-100 dark:divide-slate-800">
                        {mobileSecondaryItems.map((item) => (
                            <MobileMenuLink
                                key={item.href}
                                item={item}
                                pathname={pathname}
                                onNavigate={() => setIsMobileOpen(false)}
                            />
                        ))}
                    </nav>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="mt-6 inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    >
                        <LogOut aria-hidden="true" size={17} />
                        Cerrar sesión
                    </button>
                </div>
            )}

            <MobilePrimaryNavigation
                items={navigation.primary}
                pathname={pathname}
                isMoreOpen={isMobileOpen}
                onToggleMore={() => setIsMobileOpen((open) => !open)}
            />
        </>
    );
}

function DesktopNavigationLink({
    item,
    pathname,
}: {
    item: AppNavigationItem;
    pathname: string;
}) {
    const Icon = icons[item.icon];
    const active = isNavigationItemActive(pathname, item.href);

    return (
        <Link
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={
                active
                    ? 'inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:bg-white dark:text-slate-950'
                    : 'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }
        >
            <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
            {item.label}
        </Link>
    );
}

function SecondaryNavigationMenu({
    id,
    items,
    pathname,
    onNavigate,
}: {
    id: string;
    items: AppNavigationItem[];
    pathname: string;
    onNavigate: () => void;
}) {
    return (
        <div
            id={id}
            className="absolute right-0 top-11 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
            {items.map((item) => (
                <MobileMenuLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    onNavigate={onNavigate}
                />
            ))}
        </div>
    );
}

function MobileMenuLink({
    item,
    pathname,
    onNavigate,
}: {
    item: AppNavigationItem;
    pathname: string;
    onNavigate: () => void;
}) {
    const Icon = icons[item.icon];
    const active = isNavigationItemActive(pathname, item.href);

    return (
        <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={
                active
                    ? 'flex min-h-11 items-center gap-3 bg-indigo-50 px-3 py-2.5 text-sm font-bold text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200'
                    : 'flex min-h-11 items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 dark:text-slate-200 dark:hover:bg-slate-800'
            }
        >
            <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
            {item.label}
        </Link>
    );
}

function MobilePrimaryNavigation({
    items,
    pathname,
    isMoreOpen,
    onToggleMore,
}: {
    items: AppNavigationItem[];
    pathname: string;
    isMoreOpen: boolean;
    onToggleMore: () => void;
}) {
    const visibleItems = items.slice(0, 4);

    return (
        <nav
            aria-label="Navegación móvil"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom,0px)] xl:hidden dark:border-slate-800 dark:bg-slate-950"
        >
            <div className="mx-auto flex h-[4.25rem] max-w-lg items-stretch">
                {visibleItems.map((item) => {
                    const Icon = icons[item.icon];
                    const active = isNavigationItemActive(pathname, item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            className={
                                active
                                    ? 'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 dark:text-indigo-300'
                                    : 'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 dark:text-slate-400'
                            }
                        >
                            <Icon aria-hidden="true" size={20} strokeWidth={active ? 2.2 : 1.7} />
                            <span className="max-w-full truncate text-[11px] font-bold">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
                <button
                    type="button"
                    onClick={onToggleMore}
                    aria-label={isMoreOpen ? 'Cerrar herramientas' : 'Abrir herramientas'}
                    aria-expanded={isMoreOpen}
                    aria-controls="mobile-secondary-navigation"
                    className={
                        isMoreOpen
                            ? 'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 dark:text-indigo-300'
                            : 'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 dark:text-slate-400'
                    }
                >
                    <Menu aria-hidden="true" size={20} strokeWidth={isMoreOpen ? 2.2 : 1.7} />
                    <span className="text-[11px] font-bold">Más</span>
                </button>
            </div>
        </nav>
    );
}
