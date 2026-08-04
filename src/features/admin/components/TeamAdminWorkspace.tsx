'use client';

import { useState } from 'react';
import type { FranchiseWithAgents, ProfileAuthoritySummary } from '@/app/actions/admin';
import { ManageNetworkView } from '@/features/network/components/ManageNetworkView';
import AgentsManagement from './AgentsManagement';

type TeamSection = 'people' | 'network';

export function TeamAdminWorkspace({
    agents,
    franchises,
}: {
    agents: ProfileAuthoritySummary[];
    franchises: FranchiseWithAgents[];
}) {
    const [section, setSection] = useState<TeamSection>('people');

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-slate-950 dark:text-white">
                    Equipo y red
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                    Personas, franquicias y estructura comercial en un único lugar.
                </p>
            </header>

            <nav
                aria-label="Secciones de equipo"
                className="inline-flex rounded-md border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
            >
                <TeamTab
                    active={section === 'people'}
                    label="Personas"
                    onClick={() => setSection('people')}
                />
                <TeamTab
                    active={section === 'network'}
                    label="Estructura comercial"
                    onClick={() => setSection('network')}
                />
            </nav>

            {section === 'people' ? (
                <AgentsManagement agents={agents} franchises={franchises} />
            ) : (
                <ManageNetworkView />
            )}
        </div>
    );
}

function TeamTab({
    active,
    label,
    onClick,
}: {
    active: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={
                active
                    ? 'h-9 rounded bg-slate-900 px-4 text-sm font-bold text-white dark:bg-white dark:text-slate-950'
                    : 'h-9 rounded px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }
        >
            {label}
        </button>
    );
}
