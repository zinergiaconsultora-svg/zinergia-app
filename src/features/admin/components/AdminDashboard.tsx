'use client';

import dynamic from 'next/dynamic';
import type { AcceptanceIntegrityItem } from '@/app/actions/acceptanceIntegrity';
import type { RenewalDataQualityItem } from '@/app/actions/workQueue';
import RenewalAttentionPanel from '@/features/crm/components/RenewalAttentionPanel';
import AcceptanceIntegrityPanel from './AcceptanceIntegrityPanel';

const ConversionQueuePanel = dynamic(() => import('./ConversionQueuePanel'), {
    ssr: false,
    loading: () => <QueueSkeleton rows={4} />,
});

const AltaPendingPanel = dynamic(() => import('./AltaPendingPanel'), {
    ssr: false,
    loading: () => <QueueSkeleton rows={3} />,
});

export default function AdminDashboard({
    acceptanceIntegrityItems,
    renewalAttention,
}: {
    acceptanceIntegrityItems: AcceptanceIntegrityItem[];
    renewalAttention: RenewalDataQualityItem[];
}) {
    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-2xl font-bold text-slate-950 dark:text-white">
                    Hoy
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                    Operaciones que necesitan revisión o seguimiento.
                </p>
            </header>

            <AcceptanceIntegrityPanel initialItems={acceptanceIntegrityItems} />
            <RenewalAttentionPanel items={renewalAttention} showOwner />

            <section aria-labelledby="conversion-heading" className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4">
                    <h2 id="conversion-heading" className="text-base font-bold text-slate-950 dark:text-white">
                        Preparar propuestas
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Facturas analizadas que todavía no tienen una propuesta.
                    </p>
                </div>
                <ConversionQueuePanel />
            </section>

            <section aria-labelledby="alta-heading" className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4">
                    <h2 id="alta-heading" className="text-base font-bold text-slate-950 dark:text-white">
                        Tramitar altas
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Propuestas aceptadas pendientes de cambio de comercializadora.
                    </p>
                </div>
                <AltaPendingPanel />
            </section>
        </div>
    );
}

function QueueSkeleton({ rows }: { rows: number }) {
    return (
        <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
            ))}
        </div>
    );
}
