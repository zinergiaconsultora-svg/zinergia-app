import React from 'react';
import { NavigationTop } from '@/components/NavigationTop';
import { OnboardingWizard } from '@/features/onboarding/OnboardingWizard';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { getUserRole } from '@/lib/auth/permissions';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const role = await getUserRole();

    return (
        <NotificationProvider>
            <div className="relative min-h-[100dvh] bg-slate-50 pt-16 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] font-sans text-slate-900 selection:bg-indigo-100 xl:pb-0 dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-indigo-900">
                <NavigationTop role={role ?? 'agent'} />
                <OnboardingWizard />
                <main>
                    <div className="mx-auto max-w-[1700px] px-0 py-0 md:px-6 md:py-5 lg:px-8 lg:py-6">
                        {children}
                    </div>
                </main>
            </div>
        </NotificationProvider>
    );
}
