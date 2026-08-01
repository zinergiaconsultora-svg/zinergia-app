'use client';

import { useState } from 'react';
import { Building2, CircleDollarSign, Settings2, Workflow } from 'lucide-react';
import type { CommissionManagementData } from '@/app/actions/commissionManagement';
import type { FiscalAdminSetup } from '@/app/actions/invoicing';
import { CommissionManagementView } from './CommissionManagementView';
import { CommissionOperationsPanel } from './CommissionOperationsPanel';
import { FiscalAdministrationPanel } from './FiscalAdministrationPanel';

type Section = 'operations' | 'model' | 'fiscal';

export function CommissionAdminWorkspace({ initialData, fiscalData }: { initialData: CommissionManagementData; fiscalData: FiscalAdminSetup }) {
    const [section, setSection] = useState<Section>('operations');
    const operationCount = initialData.operations.validation.length
        + initialData.operations.settlement.length
        + initialData.operations.attentionCount;

    return (
        <div className="mx-auto w-full max-w-[1400px]">
            <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <CircleDollarSign aria-hidden="true" size={18} />
                    <span className="text-sm font-semibold">Control económico</span>
                </div>
                <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">Comisiones</h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                    Valida operaciones, prepara liquidaciones y resuelve diferencias documentadas.
                </p>
            </header>

            <nav aria-label="Secciones de comisiones" className="flex gap-1 border-b border-slate-200 py-3 dark:border-slate-800">
                <button
                    type="button"
                    onClick={() => setSection('operations')}
                    aria-pressed={section === 'operations'}
                    className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${section === 'operations' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                    <Workflow aria-hidden="true" size={17} />
                    Operaciones
                    <span className={`rounded px-1.5 py-0.5 text-xs ${section === 'operations' ? 'bg-white/15 dark:bg-slate-900/10' : 'bg-slate-200 dark:bg-slate-700'}`}>{operationCount}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setSection('model')}
                    aria-pressed={section === 'model'}
                    className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${section === 'model' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                    <Settings2 aria-hidden="true" size={17} />
                    Modelo económico
                </button>
                <button
                    type="button"
                    onClick={() => setSection('fiscal')}
                    aria-pressed={section === 'fiscal'}
                    className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${section === 'fiscal' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                    <Building2 aria-hidden="true" size={17} />
                    Fiscal
                </button>
            </nav>

            {section === 'operations' && <CommissionOperationsPanel queues={initialData.operations} />}
            {section === 'model' && <div className="pt-7"><CommissionManagementView initialData={initialData} /></div>}
            {section === 'fiscal' && <FiscalAdministrationPanel data={fiscalData} commercials={initialData.commercials} />}
        </div>
    );
}
