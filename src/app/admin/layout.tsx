import React from 'react';
import { requireRouteRole } from '@/lib/auth/permissions';
import { logout } from '@/app/auth/actions';
import { LogOut } from 'lucide-react';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await requireRouteRole(['admin']);

    return (
        <div className="w-full bg-white lg:bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 font-sans min-h-screen transition-colors duration-300">
            {/* Admin Header Bar */}
            <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/50 flex items-center justify-between px-6 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md">
                            Z
                        </div>
                        <h1 className="text-sm font-bold text-slate-800 dark:text-white tracking-wide hidden sm:block">
                            Zinergia <span className="text-indigo-600 dark:text-indigo-400 ml-1">SuperAdmin</span>
                        </h1>
                    </div>
                    <nav className="flex items-center gap-1 ml-4 bg-slate-100 dark:bg-slate-800/40 rounded-lg p-0.5 border border-slate-200 dark:border-transparent">
                        <a
                            href="/admin"
                            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/60 transition-all"
                        >
                            📊 Dashboard
                        </a>
                        <a
                            href="/admin/reporting"
                            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/60 transition-all"
                        >
                            📈 Reporting
                        </a>
                        <a
                            href="/admin/academy"
                            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/60 transition-all"
                        >
                            🎓 Academy
                        </a>
                        <a
                            href="/dashboard/network"
                            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/60 transition-all"
                        >
                            🌐 Red
                        </a>
                    </nav>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-indigo-100 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-500/30 hidden sm:inline">
                        Admin Panel
                    </span>
                    <a
                        href="/dashboard"
                        className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                    >
                        ← Dashboard
                    </a>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700/50 hidden sm:block mx-1" />
                    <form action={logout}>
                        <button
                            type="submit"
                            title="Cerrar sesión"
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors"
                        >
                            <LogOut size={16} />
                        </button>
                    </form>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-24 pb-12 px-6 md:px-12 max-w-[1600px] mx-auto">
                {children}
            </main>
        </div>
    );
}
