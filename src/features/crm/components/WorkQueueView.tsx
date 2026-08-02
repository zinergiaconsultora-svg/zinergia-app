'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    CalendarClock,
    ChevronRight,
    CircleAlert,
    Clock3,
    FileSearch,
    Filter,
    Search,
    Upload,
    UserRound,
    X,
} from 'lucide-react';
import {
    WORK_QUEUE_DUE_GROUPS,
    type OpportunityWorkGroup,
    type OpportunityWorkItem,
    type WorkQueueDueGroup,
} from '@/lib/crm/workQueue';
import {
    OPPORTUNITY_STAGES,
    OPPORTUNITY_TYPES,
    type OpportunityStage,
    type OpportunityType,
} from '@/lib/crm/opportunityState';
import type { UserRole } from '@/types/crm';
import type { RenewalDataQualityItem } from '@/app/actions/workQueue';
import RenewalAttentionPanel from './RenewalAttentionPanel';

type WorkQueueViewProps = {
    groups: OpportunityWorkGroup[];
    role: UserRole;
    renewalAttention?: RenewalDataQualityItem[];
};

const DUE_LABELS: Record<WorkQueueDueGroup, string> = {
    overdue: 'Vencido',
    today: 'Hoy',
    upcoming: 'Próximos',
    no_date: 'Sin fecha',
};

const STAGE_LABELS: Record<OpportunityStage, string> = {
    invoice_received: 'Factura recibida',
    data_review: 'Revisar datos',
    proposal_preparation: 'Preparar propuesta',
    proposal_sent: 'Propuesta enviada',
    accepted: 'Aceptada',
    activation: 'En alta',
    won: 'Cliente activo',
    lost: 'Perdida',
};

const TYPE_LABELS: Record<OpportunityType, string> = {
    new_business: 'Nuevo cliente',
    switch: 'Cambio de compañía',
    renewal: 'Renovación',
};

function uniqueItems(groups: readonly OpportunityWorkGroup[]): OpportunityWorkItem[] {
    const seen = new Set<string>();
    return groups.flatMap(group => group.items).filter((item) => {
        if (seen.has(item.opportunityId)) return false;
        seen.add(item.opportunityId);
        return true;
    });
}

function actionHref(item: OpportunityWorkItem): string {
    return `/dashboard/opportunities/${item.opportunityId}`;
}

function formatDueDate(value: string | null): string {
    if (!value) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

export default function WorkQueueView({ groups, role, renewalAttention = [] }: WorkQueueViewProps) {
    const allItems = useMemo(() => uniqueItems(groups), [groups]);
    const [query, setQuery] = useState('');
    const [dueGroup, setDueGroup] = useState<WorkQueueDueGroup | 'all'>('all');
    const [stage, setStage] = useState<OpportunityStage | 'all'>('all');
    const [type, setType] = useState<OpportunityType | 'all'>('all');
    const [ownerId, setOwnerId] = useState<string | 'all'>('all');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const owners = useMemo(() => {
        const uniqueOwners = new Map<string, string>();
        for (const item of allItems) uniqueOwners.set(item.ownerId, item.ownerName);
        return [...uniqueOwners.entries()].sort((left, right) =>
            left[1].localeCompare(right[1], 'es'),
        );
    }, [allItems]);

    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    const filteredItems = useMemo(() => allItems.filter((item) => {
        const matchesQuery = !normalizedQuery
            || item.clientName.toLocaleLowerCase('es').includes(normalizedQuery)
            || item.supplyLabel.toLocaleLowerCase('es').includes(normalizedQuery);
        return matchesQuery
            && (dueGroup === 'all' || item.dueGroup === dueGroup)
            && (stage === 'all' || item.stage === stage)
            && (type === 'all' || item.type === type)
            && (ownerId === 'all' || item.ownerId === ownerId);
    }), [allItems, dueGroup, normalizedQuery, ownerId, stage, type]);

    const filteredGroups = WORK_QUEUE_DUE_GROUPS.map(key => ({
        key,
        label: DUE_LABELS[key],
        items: filteredItems.filter(item => item.dueGroup === key),
    })).filter(group => group.items.length > 0);

    const selectedItem = filteredItems.find(item => item.opportunityId === selectedId)
        ?? filteredItems[0]
        ?? null;
    const overdueCount = allItems.filter(item => item.dueGroup === 'overdue').length;
    const todayCount = allItems.filter(item => item.dueGroup === 'today').length;
    const activeFilterCount = [
        stage !== 'all',
        type !== 'all',
        ownerId !== 'all',
    ].filter(Boolean).length;

    function clearFilters() {
        setQuery('');
        setDueGroup('all');
        setStage('all');
        setType('all');
        setOwnerId('all');
    }

    return (
        <div className="mx-auto w-full max-w-[1500px] px-4 py-5 md:px-0">
            <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
                <div>
                    <h1 className="text-2xl font-bold text-slate-950 dark:text-white">
                        Trabajo
                    </h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Prioridades de hoy.
                    </p>
                </div>
            </header>

            {renewalAttention.length > 0 && (
                <div className="mt-5">
                    <RenewalAttentionPanel items={renewalAttention} showOwner={role !== 'agent'} />
                </div>
            )}

            {allItems.length > 0 && (
                <>
                    <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Resumen de trabajo">
                        <SummaryButton
                            label="Pendientes"
                            count={allItems.length}
                            active={dueGroup === 'all'}
                            onClick={() => setDueGroup('all')}
                        />
                        <SummaryButton
                            label="Vencidos"
                            count={overdueCount}
                            active={dueGroup === 'overdue'}
                            tone="danger"
                            onClick={() => setDueGroup('overdue')}
                        />
                        <SummaryButton
                            label="Para hoy"
                            count={todayCount}
                            active={dueGroup === 'today'}
                            onClick={() => setDueGroup('today')}
                        />
                    </div>

                    <div className="mt-4 flex gap-2">
                        <label className="relative min-w-0 flex-1">
                            <span className="sr-only">Buscar cliente o suministro</span>
                            <Search
                                aria-hidden="true"
                                size={18}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                            />
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Buscar cliente o suministro"
                                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-indigo-950"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => setFiltersOpen(open => !open)}
                            aria-expanded={filtersOpen}
                            aria-controls="work-queue-filters"
                            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <Filter aria-hidden="true" size={17} />
                            Filtros
                            {activeFilterCount > 0 && (
                                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {filtersOpen && (
                        <div
                            id="work-queue-filters"
                            className="mt-3 flex flex-wrap items-end gap-3 border-y border-slate-200 py-3 dark:border-slate-800"
                        >
                            <QueueSelect
                                label="Etapa"
                                value={stage}
                                onChange={(value) => setStage(value as OpportunityStage | 'all')}
                                options={OPPORTUNITY_STAGES
                                    .filter(item => item !== 'won' && item !== 'lost')
                                    .map(item => ({ value: item, label: STAGE_LABELS[item] }))}
                            />
                            <QueueSelect
                                label="Tipo"
                                value={type}
                                onChange={(value) => setType(value as OpportunityType | 'all')}
                                options={OPPORTUNITY_TYPES.map(item => ({
                                    value: item,
                                    label: TYPE_LABELS[item],
                                }))}
                            />
                            {role !== 'agent' && (
                                <QueueSelect
                                    label="Responsable"
                                    value={ownerId}
                                    onChange={setOwnerId}
                                    options={owners.map(([value, label]) => ({ value, label }))}
                                />
                            )}
                            {(activeFilterCount > 0 || query || dueGroup !== 'all') && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    <X aria-hidden="true" size={16} />
                                    Limpiar
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            {allItems.length === 0 ? (
                <EmptyQueue />
            ) : filteredItems.length === 0 ? (
                <div className="mt-8 border border-slate-200 bg-white px-5 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
                    <FileSearch aria-hidden="true" className="mx-auto text-slate-400" />
                    <h2 className="mt-3 text-base font-bold text-slate-950 dark:text-white">
                        No hay resultados
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Prueba con menos filtros o con otra búsqueda.
                    </p>
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-4 text-sm font-bold text-indigo-700 hover:text-indigo-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-indigo-300"
                    >
                        Limpiar filtros
                    </button>
                </div>
            ) : (
                <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="min-w-0">
                        {filteredGroups.map(group => (
                            <section key={group.key} className="mb-6" aria-labelledby={`queue-${group.key}`}>
                                <div className="mb-2 flex items-center gap-2">
                                    <h2
                                        id={`queue-${group.key}`}
                                        className="text-sm font-bold text-slate-950 dark:text-white"
                                    >
                                        {group.label}
                                    </h2>
                                    <span className="text-xs font-semibold text-slate-500">
                                        {group.items.length}
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                                    {group.items.map(item => (
                                        <WorkQueueRow
                                            key={item.opportunityId}
                                            item={item}
                                            selected={selectedItem?.opportunityId === item.opportunityId}
                                            showOwner={role !== 'agent'}
                                            onSelect={() => setSelectedId(item.opportunityId)}
                                        />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                    {selectedItem && (
                        <WorkQueueDetail item={selectedItem} showOwner={role !== 'agent'} />
                    )}
                </div>
            )}
        </div>
    );
}

function SummaryButton({
    label,
    count,
    active,
    tone = 'default',
    onClick,
}: {
    label: string;
    count: number;
    active: boolean;
    tone?: 'default' | 'danger';
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={
                active
                    ? 'inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:bg-white dark:text-slate-950'
                    : 'inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            }
        >
            {label}
            <span className={tone === 'danger' && count > 0 && !active
                ? 'font-bold text-rose-700 dark:text-rose-400'
                : 'font-bold'}
            >
                {count}
            </span>
        </button>
    );
}

function QueueSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
}) {
    return (
        <label className="min-w-44 flex-1 md:flex-none">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
                {label}
            </span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
                <option value="all">Todos</option>
                {options.map(option => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function WorkQueueRow({
    item,
    selected,
    showOwner,
    onSelect,
}: {
    item: OpportunityWorkItem;
    selected: boolean;
    showOwner: boolean;
    onSelect: () => void;
}) {
    return (
        <article className={selected ? 'bg-indigo-50/70 dark:bg-indigo-950/30' : ''}>
            <button
                type="button"
                onClick={onSelect}
                className="grid w-full min-w-0 gap-2 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
            >
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950 dark:text-white">
                        {item.clientName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
                        {item.supplyLabel} · {TYPE_LABELS[item.type]}
                    </p>
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {item.nextAction?.title ?? 'Revisar expediente'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                        {STAGE_LABELS[item.stage]} · {item.stageAgeDays} d
                    </p>
                </div>
                <div className="flex items-center justify-between gap-3 md:justify-end">
                    <DueLabel item={item} />
                    <ChevronRight aria-hidden="true" size={17} className="hidden text-slate-400 md:block" />
                </div>
                {showOwner && (
                    <p className="flex items-center gap-1 text-xs text-slate-600 md:col-span-3 dark:text-slate-300">
                        <UserRound aria-hidden="true" size={13} />
                        {item.ownerName}
                    </p>
                )}
            </button>
            <div className="px-4 pb-3 md:hidden">
                <Link
                    href={actionHref(item)}
                    className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-indigo-300"
                >
                    {item.nextAction?.title ?? 'Abrir expediente'}
                    <ArrowRight aria-hidden="true" size={16} />
                </Link>
            </div>
        </article>
    );
}

function DueLabel({ item }: { item: OpportunityWorkItem }) {
    const danger = item.dueGroup === 'overdue';
    return (
        <span className={danger
            ? 'inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400'
            : 'inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300'}
        >
            {danger
                ? <CircleAlert aria-hidden="true" size={14} />
                : <Clock3 aria-hidden="true" size={14} />}
            {formatDueDate(item.nextActionDueAt)}
        </span>
    );
}

function WorkQueueDetail({
    item,
    showOwner,
}: {
    item: OpportunityWorkItem;
    showOwner: boolean;
}) {
    return (
        <aside className="sticky top-24 hidden border border-slate-200 bg-white p-5 lg:block dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {TYPE_LABELS[item.type]}
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">
                {item.clientName}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {item.supplyLabel}
            </p>

            <dl className="mt-5 space-y-4 border-y border-slate-200 py-4 text-sm dark:border-slate-800">
                <div>
                    <dt className="text-xs font-bold text-slate-600 dark:text-slate-300">Etapa</dt>
                    <dd className="mt-1 font-semibold text-slate-950 dark:text-white">
                        {STAGE_LABELS[item.stage]}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs font-bold text-slate-600 dark:text-slate-300">Siguiente acción</dt>
                    <dd className="mt-1 font-semibold text-slate-950 dark:text-white">
                        {item.nextAction?.title ?? 'Revisar expediente'}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs font-bold text-slate-600 dark:text-slate-300">Plazo</dt>
                    <dd className="mt-1 flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
                        <CalendarClock aria-hidden="true" size={16} />
                        {formatDueDate(item.nextActionDueAt)}
                    </dd>
                </div>
                {showOwner && (
                    <div>
                        <dt className="text-xs font-bold text-slate-600 dark:text-slate-300">Responsable</dt>
                        <dd className="mt-1 font-semibold text-slate-950 dark:text-white">
                            {item.ownerName}
                        </dd>
                    </div>
                )}
            </dl>

            <Link
                href={actionHref(item)}
                className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-indigo-700 px-4 text-sm font-bold text-white hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
            >
                {item.nextAction?.title ?? 'Abrir expediente'}
                <ArrowRight aria-hidden="true" size={16} />
            </Link>
        </aside>
    );
}

function EmptyQueue() {
    return (
        <div className="mt-8 border border-slate-200 bg-white px-5 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <Clock3 aria-hidden="true" className="mx-auto text-emerald-700" size={28} />
            <h2 className="mt-3 text-lg font-bold text-slate-950 dark:text-white">
                No hay trabajo pendiente
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-300">
                Cuando subas una factura, su expediente aparecerá aquí con la siguiente acción.
            </p>
            <Link
                href="/dashboard/simulator"
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
            >
                <Upload aria-hidden="true" size={17} />
                Subir factura
            </Link>
        </div>
    );
}
