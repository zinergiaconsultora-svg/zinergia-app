import React from 'react';
import { NavigationTop } from '@/components/NavigationTop';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 gradient-organic relative selection:bg-indigo-100 dark:selection:bg-indigo-900 text-slate-900 dark:text-slate-100 font-sans pt-16 md:pt-20 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
            {/* New Global Top Navigation */}
            <NavigationTop />

            {/* Main Content Area */}
            <main className="transition-all duration-300">
                <div className="max-w-[1700px] mx-auto p-3 md:p-8 lg:p-12 animate-in fade-in duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
}
