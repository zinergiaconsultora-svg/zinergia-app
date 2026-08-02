'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowRight,
    Building2,
    CalendarClock,
    FileUp,
    MoreHorizontal,
    Plus,
    Search,
    UserRound,
    UsersRound,
    Zap,
} from 'lucide-react';
import type { ClientPortfolioItem } from '@/lib/crm/clientPortfolio';
import type { UserRole } from '@/types/crm';

const CreateClientModal = dynamic(() => import('./CreateClientModal'), { ssr: false });
const CsvImportModal = dynamic(() => import('./CsvImportModal'), { ssr: false });

function formatDate(value: string | null): string {
    if (!value) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
}

function supplyCountLabel(count: number): string {
    return `${count} ${count === 1 ? 'suministro' : 'suministros'}`;
}

export default function ClientPortfolioView({
    items,
    role,
}: {
    items: ClientPortfolioItem[];
    role: UserRole;
}) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    const filteredItems = useMemo(() => items.filter(item => {
        if (!normalizedQuery) return true;
        return [
            item.name,
            item.email,
            item.phone,
            item.ownerName,
            item.currentContract?.marketer,
        ].some(value => value?.toLocaleLowerCase('es').includes(normalizedQuery));
    }), [items, normalizedQuery]);

    function refresh() {
        setCreateOpen(false);
        setImportOpen(false);
        router.refresh();
    }

    return (
        <main className="mx-auto w-full max-w-[1500px] px-4 py-5 md:px-0">
            <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
                <div>
                    <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Clientes</h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Relación, suministros y trabajo pendiente.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setCreateOpen(true)}
                        className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-700 px-4 text-sm font-bold text-white hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
                    >
                        <Plus aria-hidden="true" size={17} />
                        Nuevo cliente
                    </button>
                    <details className="relative">
                        <summary
                            aria-label="Más opciones de clientes"
                            title="Más opciones"
                            className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <MoreHorizontal aria-hidden="true" size={19} />
                        </summary>
                        <div className="absolute right-0 z-20 mt-2 w-52 border border-slate-200 bg-white p-1 shadow-md dark:border-slate-700 dark:bg-slate-900">
                            <button
                                type="button"
                                onClick={() => setImportOpen(true)}
                                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <FileUp aria-hidden="true" size={16} />
                                Importar CSV
                            </button>
                        </div>
                    </details>
                </div>
            </header>

            {items.length === 0 ? (
                <div className="py-16 text-center">
                    <UsersRound aria-hidden="true" className="mx-auto text-slate-400" size={30} />
                    <h2 className="mt-3 text-lg font-bold text-slate-950 dark:text-white">Todavía no hay clientes</h2>
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-300">
                        Sube una factura o crea el primer cliente para empezar la cartera.
                    </p>
                </div>
            ) : (
                <>
                    <label className="relative mt-5 block max-w-xl">
                        <span className="sr-only">Buscar clientes</span>
                        <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="search"
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="Buscar cliente, contacto o compañía"
                            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-indigo-950"
                        />
                    </label>

                    {filteredItems.length === 0 ? (
                        <div className="py-14 text-center">
                            <Search aria-hidden="true" className="mx-auto text-slate-400" size={26} />
                            <h2 className="mt-3 text-base font-bold text-slate-950 dark:text-white">No hay clientes que coincidan</h2>
                            <button type="button" onClick={() => setQuery('')} className="mt-3 text-sm font-bold text-indigo-700 hover:underline dark:text-indigo-300">
                                Limpiar búsqueda
                            </button>
                        </div>
                    ) : (
                        <div className="mt-5 overflow-hidden border-y border-slate-200 dark:border-slate-800">
                            <div className="hidden grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_140px_minmax(180px,1fr)_150px] gap-4 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 lg:grid dark:bg-slate-900 dark:text-slate-300">
                                <span>Cliente</span>
                                <span>Trabajo</span>
                                <span>Suministros</span>
                                <span>Contrato</span>
                                <span>{role === 'agent' ? 'Último contacto' : 'Responsable'}</span>
                            </div>
                            <div className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredItems.map(item => (
                                    <ClientPortfolioRow key={item.id} item={item} role={role} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            <CreateClientModal
                isOpen={createOpen}
                onClose={() => setCreateOpen(false)}
                onSuccess={refresh}
            />
            {importOpen && <CsvImportModal onClose={() => setImportOpen(false)} onSuccess={refresh} />}
        </main>
    );
}

function ClientPortfolioRow({ item, role }: { item: ClientPortfolioItem; role: UserRole }) {
    return (
        <article className="grid gap-4 bg-white px-4 py-4 lg:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_140px_minmax(180px,1fr)_150px] lg:items-center dark:bg-slate-950">
            <div className="min-w-0">
                <Link href={`/dashboard/clients/${item.id}`} className="font-bold text-slate-950 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-white dark:hover:text-indigo-300">
                    {item.name}
                </Link>
                <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
                    {item.email ?? item.phone ?? 'Sin datos de contacto'}
                </p>
            </div>

            <div>
                <p className="mb-1 text-xs font-bold text-slate-500 lg:hidden">Trabajo</p>
                {item.nextAction ? (
                    <Link
                        href={`/dashboard/opportunities/${item.nextAction.opportunityId}`}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-indigo-300"
                    >
                        {item.nextAction.title}
                        <ArrowRight aria-hidden="true" size={15} />
                    </Link>
                ) : (
                    <span className="text-sm text-slate-500">Sin trabajo pendiente</span>
                )}
                {item.openOpportunityCount > 1 && (
                    <p className="mt-0.5 text-xs text-slate-500">{item.openOpportunityCount} abiertas</p>
                )}
            </div>

            <div>
                <p className="mb-1 text-xs font-bold text-slate-500 lg:hidden">Suministros</p>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <Zap aria-hidden="true" size={15} className="text-slate-500" />
                    {supplyCountLabel(item.supplyPointCount)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{item.activeSupplyCount} activos</p>
            </div>

            <div>
                <p className="mb-1 text-xs font-bold text-slate-500 lg:hidden">Contrato</p>
                {item.currentContract ? (
                    <>
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                            <Building2 aria-hidden="true" size={15} className="text-slate-500" />
                            {item.currentContract.marketer}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                            <CalendarClock aria-hidden="true" size={13} />
                            {item.nearestPermanenceDate ? `Hasta ${formatDate(item.nearestPermanenceDate)}` : 'Sin permanencia'}
                        </p>
                    </>
                ) : <span className="text-sm text-slate-500">Sin contrato activo</span>}
            </div>

            <div>
                <p className="mb-1 text-xs font-bold text-slate-500 lg:hidden">
                    {role === 'agent' ? 'Último contacto' : 'Responsable'}
                </p>
                {role === 'agent' ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300">{formatDate(item.lastContactAt)}</p>
                ) : (
                    <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                        <UserRound aria-hidden="true" size={15} />
                        {item.ownerName}
                    </p>
                )}
            </div>
        </article>
    );
}
