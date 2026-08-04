import React from 'react';
import { NavigationTop } from '@/components/NavigationTop';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { requireRouteRole } from '@/lib/auth/permissions';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await requireRouteRole(['admin']);

    return (
        <NotificationProvider>
            <div className="min-h-[100dvh] bg-slate-50 pt-16 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] font-sans text-slate-900 xl:pb-0 xl:pl-64 dark:bg-slate-950 dark:text-slate-100">
                <NavigationTop role="admin" />
                <main className="mx-auto max-w-[1700px] px-4 py-5 md:px-6 lg:px-8 lg:py-6">
                    {children}
                </main>
            </div>
        </NotificationProvider>
    );
}
