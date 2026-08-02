'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowRight,
    Building2,
    CalendarDays,
    Check,
    ChevronDown,
    History,
    Network,
    Save,
    ShieldCheck,
    UserRoundPlus,
    Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    assignCommissionPlanAction,
    createCommissionPlanAction,
    type CommissionManagementData,
    type CommissionPlanSummary,
} from '@/app/actions/commissionManagement';
import type { CommissionChannel } from '@/lib/commissions/lifecycle';
import { CommissionModelSetup } from './CommissionModelSetup';
import { DecommissionPolicyManager } from './DecommissionPolicyManager';

const inputClass =
    'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-950';
const labelClass =
    'mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200';

export function CommissionManagementView({
    initialData,
}: {
    initialData: CommissionManagementData;
}) {
    const router = useRouter();
    const initialPlan =
        initialData.plans.find(
            (plan) => plan.channel === 'partner_direct' && plan.isActive,
        ) ?? initialData.plans.find((plan) => plan.isActive);
    const [pending, startTransition] = useTransition();
    const [channel, setChannel] = useState<CommissionChannel>(
        initialPlan?.channel ?? 'partner_direct',
    );
    const [name, setName] = useState(initialPlan?.name ?? 'Socios directos');
    const [commercialPercent, setCommercialPercent] = useState(
        (initialPlan?.commercialShareBps ?? 0) / 100,
    );
    const [franchisePercent, setFranchisePercent] = useState(
        (initialPlan?.franchiseShareBps ?? 0) / 100,
    );
    const [commercialId, setCommercialId] = useState('');
    const [planId, setPlanId] = useState('');
    const [reason, setReason] = useState('Asignación inicial');

    const commercialById = useMemo(
        () =>
            new Map(
                initialData.commercials.map((commercial) => [
                    commercial.id,
                    commercial,
                ]),
            ),
        [initialData.commercials],
    );
    const planById = useMemo(
        () => new Map(initialData.plans.map((plan) => [plan.id, plan])),
        [initialData.plans],
    );
    const activePlans = initialData.plans.filter((plan) => plan.isActive);
    const currentPlan = activePlans.find((plan) => plan.channel === channel);
    const directPlan = activePlans.find(
        (plan) => plan.channel === 'partner_direct',
    );
    const franchisePlan = activePlans.find(
        (plan) => plan.channel === 'franchise_network',
    );
    const centralPercent = roundPercent(
        100 - commercialPercent - franchisePercent,
    );
    const hasChanges =
        !currentPlan ||
        currentPlan.name !== name.trim() ||
        currentPlan.commercialShareBps !==
            Math.round(commercialPercent * 100) ||
        currentPlan.franchiseShareBps !== Math.round(franchisePercent * 100);
    const isValid =
        Boolean(name.trim()) &&
        commercialPercent >= 0 &&
        franchisePercent >= 0 &&
        centralPercent >= 0 &&
        centralPercent <= 100;

    if (!directPlan && !franchisePlan) {
        return (
            <div className="mx-auto w-full max-w-5xl space-y-8">
                <CommissionModelSetup
                    actorId={initialData.actorId}
                    commercials={initialData.commercials}
                />
                <DecommissionPolicyManager policies={initialData.policies} />
            </div>
        );
    }

    function selectChannel(value: CommissionChannel) {
        const selected = activePlans.find((plan) => plan.channel === value);
        setChannel(value);
        setName(
            selected?.name ??
                (value === 'partner_direct'
                    ? 'Socios directos'
                    : 'Red franquiciada'),
        );
        setCommercialPercent((selected?.commercialShareBps ?? 0) / 100);
        setFranchisePercent(
            value === 'partner_direct'
                ? 0
                : (selected?.franchiseShareBps ?? 0) / 100,
        );
    }

    const submitPlan = () =>
        startTransition(async () => {
            const result = await createCommissionPlanAction({
                channel,
                name,
                commercialPercent,
                franchisePercent,
            });
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            toast.success('Nueva versión guardada para operaciones futuras');
            router.refresh();
        });

    const submitAssignment = () =>
        startTransition(async () => {
            const result = await assignCommissionPlanAction({
                commercialId,
                planId,
                reason,
            });
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            toast.success('Plan asignado');
            setCommercialId('');
            setPlanId('');
            router.refresh();
        });

    return (
        <div className="mx-auto w-full max-w-6xl space-y-10">
            <section
                aria-labelledby="current-model-heading"
                className="border-b border-slate-200 pb-9 dark:border-slate-800"
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2
                            id="current-model-heading"
                            className="text-xl font-bold text-slate-950 dark:text-white"
                        >
                            Repartos vigentes
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Define cómo se distribuye la comisión recibida del
                            proveedor en cada canal comercial.
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        <ShieldCheck aria-hidden="true" size={17} />
                        El histórico está protegido
                    </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                    <ChannelOverview
                        channel="partner_direct"
                        plan={directPlan}
                        assignmentCount={countAssignments(
                            directPlan,
                            initialData.assignments,
                        )}
                        selected={channel === 'partner_direct'}
                        onSelect={() => selectChannel('partner_direct')}
                    />
                    <ChannelOverview
                        channel="franchise_network"
                        plan={franchisePlan}
                        assignmentCount={countAssignments(
                            franchisePlan,
                            initialData.assignments,
                        )}
                        selected={channel === 'franchise_network'}
                        onSelect={() => selectChannel('franchise_network')}
                    />
                </div>
            </section>

            <section
                aria-labelledby="editor-heading"
                className="border-b border-slate-200 pb-9 dark:border-slate-800"
            >
                <div className="mb-6">
                    <h2
                        id="editor-heading"
                        className="text-xl font-bold text-slate-950 dark:text-white"
                    >
                        Editar reparto comercial
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Los porcentajes son editables por administración. Al
                        guardar se crea una nueva versión aplicable desde ese
                        momento; las operaciones anteriores conservan su
                        reparto original.
                    </p>
                </div>

                <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(360px,1.15fr)]">
                    <div className="min-w-0 lg:border-r lg:border-slate-200 lg:pr-8 dark:lg:border-slate-800">
                        <span className={labelClass}>
                            Canal que quieres editar
                        </span>
                        <div className="grid grid-cols-2 rounded-md border border-slate-300 p-1 dark:border-slate-700">
                            <ChannelButton
                                active={channel === 'partner_direct'}
                                icon={<Users aria-hidden="true" size={16} />}
                                label="Socios directos"
                                onClick={() => selectChannel('partner_direct')}
                            />
                            <ChannelButton
                                active={channel === 'franchise_network'}
                                icon={<Network aria-hidden="true" size={16} />}
                                label="Red franquiciada"
                                onClick={() =>
                                    selectChannel('franchise_network')
                                }
                            />
                        </div>

                        <div className="mt-7">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                        Versión actual
                                    </p>
                                    <p className="mt-0.5 font-bold text-slate-950 dark:text-white">
                                        {currentPlan
                                            ? `${currentPlan.name} · v${currentPlan.version}`
                                            : 'Sin configurar'}
                                    </p>
                                </div>
                                {currentPlan && (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                        <CalendarDays
                                            aria-hidden="true"
                                            size={14}
                                        />
                                        Desde{' '}
                                        {formatDate(currentPlan.effectiveFrom)}
                                    </span>
                                )}
                            </div>
                            {currentPlan && (
                                <div className="mt-4">
                                    <AllocationBar plan={currentPlan} compact />
                                </div>
                            )}
                        </div>

                        <div className="mt-7 flex items-start gap-3 rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                            <History
                                aria-hidden="true"
                                className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400"
                                size={17}
                            />
                            <p className="leading-5">
                                Guardar crea la versión{' '}
                                <strong>
                                    v{(currentPlan?.version ?? 0) + 1}
                                </strong>
                                . No recalcula comisiones, liquidaciones ni
                                decomisiones ya registradas.
                            </p>
                        </div>
                    </div>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                            <span>Actual</span>
                            <ArrowRight aria-hidden="true" size={15} />
                            <span className="text-indigo-700 dark:text-indigo-300">
                                Nueva propuesta
                            </span>
                        </div>

                        <div className="mt-5 space-y-5">
                            <Field label="Nombre de la versión">
                                <input
                                    className={inputClass}
                                    value={name}
                                    onChange={(event) =>
                                        setName(event.target.value)
                                    }
                                    placeholder="Ej. Red franquiciada 2026"
                                />
                            </Field>
                            <div
                                className={`grid gap-4 ${channel === 'franchise_network' ? 'sm:grid-cols-2' : ''}`}
                            >
                                <PercentField
                                    label={
                                        channel === 'partner_direct'
                                            ? 'Socio comercial'
                                            : 'Comercial'
                                    }
                                    value={commercialPercent}
                                    onChange={setCommercialPercent}
                                />
                                {channel === 'franchise_network' && (
                                    <PercentField
                                        label="Franquicia"
                                        value={franchisePercent}
                                        onChange={setFranchisePercent}
                                    />
                                )}
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        Vista previa del reparto
                                    </span>
                                    <span
                                        className={`text-sm font-bold tabular-nums ${centralPercent < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}
                                    >
                                        {centralPercent < 0
                                            ? 'Supera el 100 %'
                                            : '100 % asignado'}
                                    </span>
                                </div>
                                <AllocationBar
                                    plan={{
                                        commercialShareBps: Math.max(
                                            0,
                                            commercialPercent * 100,
                                        ),
                                        franchiseShareBps: Math.max(
                                            0,
                                            franchisePercent * 100,
                                        ),
                                        centralShareBps: Math.max(
                                            0,
                                            centralPercent * 100,
                                        ),
                                    }}
                                />
                            </div>

                            <div
                                className={`flex items-center justify-between rounded-md px-4 py-3 ${centralPercent < 0 ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200' : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'}`}
                            >
                                <span className="text-sm font-semibold">
                                    Participación de Zinergia
                                </span>
                                <output className="text-base font-bold tabular-nums">
                                    {centralPercent.toFixed(2)} %
                                </output>
                            </div>

                            <button
                                type="button"
                                disabled={pending || !isValid || !hasChanges}
                                onClick={submitPlan}
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Save aria-hidden="true" size={17} />
                                {pending
                                    ? 'Guardando versión…'
                                    : `Guardar como v${(currentPlan?.version ?? 0) + 1}`}
                            </button>
                            {!hasChanges && (
                                <p className="text-center text-xs font-semibold text-slate-500">
                                    Modifica algún dato para crear una nueva
                                    versión.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <PlanHistory plans={initialData.plans} />
            </section>

            <DecommissionPolicyManager policies={initialData.policies} />

            <section
                aria-labelledby="assignments-heading"
                className="border-b border-slate-200 pb-9 dark:border-slate-800"
            >
                <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2
                            id="assignments-heading"
                            className="text-xl font-bold text-slate-950 dark:text-white"
                        >
                            Asignación de perfiles
                        </h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            Indica qué reparto vigente corresponde a cada
                            comercial.
                        </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-500">
                        {initialData.assignments.length} perfiles asignados
                    </span>
                </div>

                <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.22fr)]">
                    <div className="min-w-0 space-y-4 lg:border-r lg:border-slate-200 lg:pr-8 dark:lg:border-slate-800">
                        <Field label="Perfil comercial">
                            <select
                                className={inputClass}
                                value={commercialId}
                                onChange={(event) =>
                                    setCommercialId(event.target.value)
                                }
                            >
                                <option value="">Seleccionar perfil</option>
                                {initialData.commercials.map((commercial) => (
                                    <option
                                        key={commercial.id}
                                        value={commercial.id}
                                        disabled={
                                            commercial.id ===
                                            initialData.actorId
                                        }
                                    >
                                        {commercial.name}
                                        {commercial.id === initialData.actorId
                                            ? ' (tu perfil)'
                                            : ''}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Reparto vigente">
                            <select
                                className={inputClass}
                                value={planId}
                                onChange={(event) =>
                                    setPlanId(event.target.value)
                                }
                            >
                                <option value="">Seleccionar reparto</option>
                                {activePlans.map((plan) => (
                                    <option key={plan.id} value={plan.id}>
                                        {channelLabel(plan.channel)} · v
                                        {plan.version}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Motivo del cambio">
                            <input
                                className={inputClass}
                                value={reason}
                                onChange={(event) =>
                                    setReason(event.target.value)
                                }
                            />
                        </Field>
                        <button
                            type="button"
                            disabled={
                                pending ||
                                !commercialId ||
                                !planId ||
                                reason.trim().length < 3
                            }
                            onClick={submitAssignment}
                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-bold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                        >
                            <UserRoundPlus aria-hidden="true" size={16} />{' '}
                            Asignar reparto
                        </button>
                    </div>

                    <div className="min-w-0 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        {initialData.assignments.map((assignment) => {
                            const commercial = commercialById.get(
                                assignment.commercialId,
                            );
                            const plan = planById.get(assignment.planId);
                            return (
                                <div
                                    key={assignment.id}
                                    className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-slate-950 dark:text-white">
                                            {commercial?.name ??
                                                'Perfil no disponible'}
                                        </p>
                                        <p className="truncate text-sm text-slate-500">
                                            {commercial?.email ??
                                                assignment.reason}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                            {plan
                                                ? channelLabel(plan.channel)
                                                : 'Histórico'}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                            <Check
                                                aria-hidden="true"
                                                size={15}
                                            />{' '}
                                            v{plan?.version ?? '—'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                        {initialData.assignments.length === 0 && (
                            <div className="py-10 text-center">
                                <Users
                                    aria-hidden="true"
                                    className="mx-auto text-slate-400"
                                    size={24}
                                />
                                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Todavía no hay perfiles asignados
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                    Selecciona un perfil y su reparto para
                                    empezar.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <ReconciliationStatus
                items={initialData.reconciliation}
                commercialById={commercialById}
            />
        </div>
    );
}

function ChannelOverview({
    channel,
    plan,
    assignmentCount,
    selected,
    onSelect,
}: {
    channel: CommissionChannel;
    plan: CommissionPlanSummary | undefined;
    assignmentCount: number;
    selected: boolean;
    onSelect: () => void;
}) {
    const isDirect = channel === 'partner_direct';
    const Icon = isDirect ? Users : Building2;

    return (
        <article className="grid gap-5 border-b border-slate-200 p-5 last:border-b-0 md:grid-cols-[minmax(190px,0.72fr)_minmax(300px,1.28fr)_auto] md:items-center md:p-6 dark:border-slate-800">
            <div className="flex items-start gap-3">
                <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${isDirect ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'}`}
                >
                    <Icon aria-hidden="true" size={18} />
                </span>
                <div>
                    <h3 className="font-bold text-slate-950 dark:text-white">
                        {isDirect ? 'Socios directos' : 'Red franquiciada'}
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-500">
                        {plan
                            ? `v${plan.version} · ${assignmentCount} ${assignmentCount === 1 ? 'perfil' : 'perfiles'}`
                            : 'Pendiente de configurar'}
                    </p>
                </div>
            </div>
            <div className="min-w-0">
                {plan ? (
                    <AllocationBar plan={plan} compact />
                ) : (
                    <p className="text-sm text-slate-500">
                        Crea el primer reparto para este canal.
                    </p>
                )}
            </div>
            <button
                type="button"
                onClick={onSelect}
                aria-pressed={selected}
                className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${selected ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
            >
                {selected ? 'Editando' : 'Editar reparto'}
            </button>
        </article>
    );
}

function ChannelButton({
    active,
    icon,
    label,
    onClick,
}: {
    active: boolean;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`inline-flex min-h-9 items-center justify-center gap-2 rounded px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
        >
            {icon}
            {label}
        </button>
    );
}

function AllocationBar({
    plan,
    compact = false,
}: {
    plan: Pick<
        CommissionPlanSummary,
        'commercialShareBps' | 'franchiseShareBps' | 'centralShareBps'
    >;
    compact?: boolean;
}) {
    const commercial = plan.commercialShareBps / 100;
    const franchise = plan.franchiseShareBps / 100;
    const central = plan.centralShareBps / 100;
    const total = Math.max(commercial + franchise + central, 1);

    return (
        <div>
            <div
                className={`${compact ? 'h-2' : 'h-3'} flex w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800`}
                role="img"
                aria-label={`Comercial ${commercial.toFixed(2)} %, franquicia ${franchise.toFixed(2)} %, Zinergia ${central.toFixed(2)} %`}
            >
                <span
                    className="bg-indigo-600"
                    style={{
                        width: `${Math.min(100, (commercial / total) * 100)}%`,
                    }}
                />
                {franchise > 0 && (
                    <span
                        className="bg-sky-500"
                        style={{
                            width: `${Math.min(100, (franchise / total) * 100)}%`,
                        }}
                    />
                )}
                <span
                    className="bg-emerald-500"
                    style={{
                        width: `${Math.min(100, (central / total) * 100)}%`,
                    }}
                />
            </div>
            <div
                className={`mt-2 flex flex-wrap ${compact ? 'gap-x-4 gap-y-1' : 'gap-x-5 gap-y-2'} text-xs font-semibold text-slate-600 dark:text-slate-300`}
            >
                <Legend
                    color="bg-indigo-600"
                    label="Comercial"
                    value={commercial}
                />
                {franchise > 0 && (
                    <Legend
                        color="bg-sky-500"
                        label="Franquicia"
                        value={franchise}
                    />
                )}
                <Legend
                    color="bg-emerald-500"
                    label="Zinergia"
                    value={central}
                />
            </div>
        </div>
    );
}

function Legend({
    color,
    label,
    value,
}: {
    color: string;
    label: string;
    value: number;
}) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${color}`}
            />
            {label}{' '}
            <strong className="tabular-nums text-slate-900 dark:text-white">
                {value.toFixed(2)} %
            </strong>
        </span>
    );
}

function PlanHistory({ plans }: { plans: CommissionPlanSummary[] }) {
    return (
        <details className="group mt-8 border-t border-slate-200 pt-5 dark:border-slate-800">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-2 text-sm font-bold text-slate-700 outline-none hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-slate-200 dark:hover:text-white [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                    <History aria-hidden="true" size={16} /> Historial de
                    versiones ({plans.length})
                </span>
                <ChevronDown
                    aria-hidden="true"
                    className="transition-transform group-open:rotate-180"
                    size={17}
                />
            </summary>
            <div className="mt-3 overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        <tr>
                            <th className="px-4 py-3 font-semibold">
                                Canal y versión
                            </th>
                            <th className="px-4 py-3 text-right font-semibold">
                                Comercial
                            </th>
                            <th className="px-4 py-3 text-right font-semibold">
                                Franquicia
                            </th>
                            <th className="px-4 py-3 text-right font-semibold">
                                Zinergia
                            </th>
                            <th className="px-4 py-3 font-semibold">
                                Vigencia
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {plans.map((plan) => (
                            <tr
                                key={plan.id}
                                className="bg-white dark:bg-slate-950"
                            >
                                <td className="px-4 py-3">
                                    <p className="font-semibold text-slate-950 dark:text-white">
                                        {channelLabel(plan.channel)} · v
                                        {plan.version}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {plan.name}
                                    </p>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    {formatBps(plan.commercialShareBps)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    {formatBps(plan.franchiseShareBps)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    {formatBps(plan.centralShareBps)}
                                </td>
                                <td className="px-4 py-3">
                                    {plan.isActive ? (
                                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                            Vigente
                                        </span>
                                    ) : (
                                        <span className="text-slate-500">
                                            Hasta {formatDate(plan.effectiveTo)}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </details>
    );
}

function ReconciliationStatus({
    items,
    commercialById,
}: {
    items: CommissionManagementData['reconciliation'];
    commercialById: Map<
        string,
        CommissionManagementData['commercials'][number]
    >;
}) {
    if (items.length === 0) {
        return (
            <section aria-labelledby="reconciliation-heading" className="pb-8">
                <div className="flex items-start gap-3 rounded-md bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30">
                    <Check
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300"
                        size={18}
                    />
                    <div>
                        <h2
                            id="reconciliation-heading"
                            className="text-sm font-bold text-emerald-900 dark:text-emerald-100"
                        >
                            Configuración económica al día
                        </h2>
                        <p className="mt-0.5 text-sm text-emerald-800 dark:text-emerald-200">
                            No hay operaciones sin reparto o política aplicable.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section aria-labelledby="reconciliation-heading" className="pb-8">
            <div className="mb-5 flex items-end justify-between gap-3">
                <div>
                    <h2
                        id="reconciliation-heading"
                        className="text-xl font-bold text-slate-950 dark:text-white"
                    >
                        Revisión económica
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Operaciones que necesitan completar su configuración.
                    </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertTriangle aria-hidden="true" size={14} />
                    {items.length}
                </span>
            </div>
            <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {items.map((item) => (
                    <div
                        key={item.commissionId}
                        className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div>
                            <p className="font-semibold text-slate-950 dark:text-white">
                                {commercialById.get(item.commercialId ?? '')
                                    ?.name ?? 'Operación histórica'}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {item.requiredAction}
                            </p>
                        </div>
                        <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
                            {reconciliationLabel(item.reconciliationStatus)}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label>
            <span className={labelClass}>{label}</span>
            {children}
        </label>
    );
}

function PercentField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <Field label={`${label} %`}>
            <div className="relative">
                <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className={`${inputClass} pr-9 tabular-nums`}
                    value={value}
                    onChange={(event) => onChange(Number(event.target.value))}
                />
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-slate-500"
                >
                    %
                </span>
            </div>
        </Field>
    );
}

function countAssignments(
    plan: CommissionPlanSummary | undefined,
    assignments: CommissionManagementData['assignments'],
): number {
    if (!plan) return 0;
    return assignments.filter((assignment) => assignment.planId === plan.id)
        .length;
}

function formatBps(value: number): string {
    return `${(value / 100).toFixed(2)} %`;
}

function formatDate(value: string | null): string {
    if (!value) return 'histórico';
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
}

function channelLabel(channel: CommissionChannel): string {
    return channel === 'partner_direct'
        ? 'Socios directos'
        : 'Red franquiciada';
}

function reconciliationLabel(status: string): string {
    const labels: Record<string, string> = {
        plan_unassigned: 'Sin reparto',
        policy_unmatched: 'Sin política',
        contradictory_legacy: 'Histórico contradictorio',
        pending_review: 'Pendiente de revisión',
    };
    return labels[status] ?? 'Revisar';
}

function roundPercent(value: number): number {
    return Math.round(value * 100) / 100;
}
