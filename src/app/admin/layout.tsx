import React from 'react';
import { requireRouteRole } from '@/lib/auth/permissions';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await requireRouteRole(['admin']);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
            {/* Admin Header Bar */}
            <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
                            Z
                        </div>
                        <h1 className="text-sm font-bold text-white tracking-wide hidden sm:block">
                            Zinergia <span className="text-indigo-400 ml-1">SuperAdmin</span>
                        </h1>
                    </div>
                    <nav className="flex items-center gap-1 ml-4 bg-slate-800/40 rounded-lg p-0.5">
                        <a
                            href="/admin"
                            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 transition-all"
                        >
                            📊 Dashboard
                        </a>
                        <a
                            href="/admin/reporting"
                            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 transition-all"
                        >
                            📈 Reporting
                        </a>
                        <a
                            href="/admin/academy"
                            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 transition-all"
                        >
                            🎓 Academy
                        </a>
                    </nav>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-indigo-600/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30 hidden sm:inline">
                        Admin Panel
                    </span>
                    <a
                        href="/dashboard"
                        className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
                    >
                        ← Dashboard
                    </a>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-24 pb-12 px-6 md:px-12 max-w-[1600px] mx-auto">
                {children}
            </main>
        </div>
    );
}
