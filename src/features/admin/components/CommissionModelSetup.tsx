'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, History, Save, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
    setupCommissionModelAction,
    type CommissionCommercialSummary,
} from '@/app/actions/commissionManagement';

const inputClass =
    'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition-colors focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-950';
const labelClass =
    'mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200';

type CommissionModelSetupProps = {
    actorId: string;
    commercials: CommissionCommercialSummary[];
};

export function CommissionModelSetup({
    actorId,
    commercials,
}: CommissionModelSetupProps) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [directName, setDirectName] = useState('Socios directos');
    const [directCommercialPercent, setDirectCommercialPercent] = useState(75);
    const [franchiseName, setFranchiseName] = useState('Red franquiciada');
    const [franchiseCommercialPercent, setFranchiseCommercialPercent] =
        useState(45);
    const [franchisePercent, setFranchisePercent] = useState(15);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const directCentralPercent = roundPercent(100 - directCommercialPercent);
    const franchiseCentralPercent = roundPercent(
        100 - franchiseCommercialPercent - franchisePercent,
    );
    const isBalanced =
        directCentralPercent > 0 &&
        franchiseCentralPercent > 0 &&
        directCommercialPercent > franchiseCommercialPercent &&
        directCentralPercent < franchiseCentralPercent;
    const availableCommercials = commercials;

    const toggleCommercial = (id: string) => {
        setSelectedIds((current) => {
            if (current.includes(id))
                return current.filter((candidate) => candidate !== id);
            if (current.length >= 5) return current;
            return [...current, id];
        });
    };

    const submit = () =>
        startTransition(async () => {
            const result = await setupCommissionModelAction({
                directName,
                directCommercialPercent,
                franchiseName,
                franchiseCommercialPercent,
                franchisePercent,
                directCommercialIds: selectedIds,
            });

            if (!result.success) {
                toast.error(result.error);
                return;
            }

            toast.success('Modelo económico configurado');
            router.refresh();
        });

    return (
        <div className="mx-auto w-full max-w-5xl space-y-9">
            <header className="border-b border-slate-200 pb-7 dark:border-slate-800">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                            Configuración inicial
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Define el reparto de la comisión del proveedor para
                            cada canal. Podrás crear nuevas versiones cuando
                            cambien los porcentajes.
                        </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        <History aria-hidden="true" size={16} /> Histórico
                        protegido
                    </span>
                </div>
            </header>

            <section
                aria-labelledby="initial-splits-heading"
                className="border-b border-slate-200 pb-9 dark:border-slate-800"
            >
                <div className="mb-6">
                    <h2
                        id="initial-splits-heading"
                        className="text-xl font-bold text-slate-950 dark:text-white"
                    >
                        Repartos de partida
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Ambos deben asignar exactamente el 100 %.
                    </p>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                    <div className="p-5 sm:p-6">
                        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                                    <Users aria-hidden="true" size={18} />
                                </span>
                                <div>
                                    <h3
                                        id="direct-model-heading"
                                        className="font-bold text-slate-950 dark:text-white"
                                    >
                                        Socios directos
                                    </h3>
                                    <p className="mt-0.5 text-sm text-slate-500">
                                        Sin intermediación de franquicia.
                                    </p>
                                </div>
                            </div>
                            <BalanceBadge valid={directCentralPercent > 0} />
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <Field label="Nombre del modelo">
                                <input
                                    value={directName}
                                    onChange={(event) =>
                                        setDirectName(event.target.value)
                                    }
                                    className={inputClass}
                                />
                            </Field>
                            <PercentField
                                label="Socio %"
                                value={directCommercialPercent}
                                onChange={setDirectCommercialPercent}
                            />
                            <ReadonlyPercent
                                label="Zinergia %"
                                value={directCentralPercent}
                            />
                        </div>
                        <SetupAllocationBar
                            commercial={directCommercialPercent}
                            franchise={0}
                            central={directCentralPercent}
                        />
                    </div>

                    <div className="border-t border-slate-200 p-5 sm:p-6 dark:border-slate-800">
                        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                                    <Building2 aria-hidden="true" size={18} />
                                </span>
                                <div>
                                    <h3
                                        id="franchise-model-heading"
                                        className="font-bold text-slate-950 dark:text-white"
                                    >
                                        Red franquiciada
                                    </h3>
                                    <p className="mt-0.5 text-sm text-slate-500">
                                        Reparto entre comercial, franquicia y
                                        Zinergia.
                                    </p>
                                </div>
                            </div>
                            <BalanceBadge
                                valid={franchiseCentralPercent > 0}
                            />
                        </div>
                        <div className="grid gap-4 md:grid-cols-4">
                            <Field label="Nombre del modelo">
                                <input
                                    value={franchiseName}
                                    onChange={(event) =>
                                        setFranchiseName(event.target.value)
                                    }
                                    className={inputClass}
                                />
                            </Field>
                            <PercentField
                                label="Comercial %"
                                value={franchiseCommercialPercent}
                                onChange={setFranchiseCommercialPercent}
                            />
                            <PercentField
                                label="Franquicia %"
                                value={franchisePercent}
                                onChange={setFranchisePercent}
                            />
                            <ReadonlyPercent
                                label="Zinergia %"
                                value={franchiseCentralPercent}
                            />
                        </div>
                        <SetupAllocationBar
                            commercial={franchiseCommercialPercent}
                            franchise={franchisePercent}
                            central={franchiseCentralPercent}
                        />
                        {!isBalanced && (
                            <p
                                role="alert"
                                className="mt-3 text-sm font-semibold text-rose-700 dark:text-rose-300"
                            >
                                El socio directo debe recibir más y Zinergia
                                debe conservar más en franquicia.
                            </p>
                        )}
                    </div>
                </div>
            </section>

            <section
                aria-labelledby="partners-heading"
                className="border-b border-slate-200 pb-9 dark:border-slate-800"
            >
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2
                            id="partners-heading"
                            className="text-xl font-bold text-slate-950 dark:text-white"
                        >
                            Perfiles de socios
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Asigna ahora los socios directos; el resto puede
                            configurarse después.
                        </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-500">
                        {selectedIds.length} de 5 seleccionados
                    </span>
                </div>
                <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
                    {availableCommercials.map((commercial) => {
                        const selected = selectedIds.includes(commercial.id);
                        const isActor = commercial.id === actorId;
                        const disabled =
                            isActor || (!selected && selectedIds.length >= 5);
                        return (
                            <label
                                key={commercial.id}
                                className={`flex min-h-14 items-center gap-3 px-4 py-3 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected}
                                    disabled={disabled}
                                    onChange={() =>
                                        toggleCommercial(commercial.id)
                                    }
                                    className="h-4 w-4 accent-indigo-600"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">
                                        {commercial.name}
                                    </span>
                                    <span className="block truncate text-xs text-slate-500">
                                        {isActor
                                            ? 'Tu perfil requiere asignación por otro administrador'
                                            : (commercial.email ??
                                              roleLabel(commercial.role))}
                                    </span>
                                </span>
                                {selected && (
                                    <Check
                                        aria-label="Seleccionado"
                                        size={17}
                                        className="text-emerald-600"
                                    />
                                )}
                            </label>
                        );
                    })}
                    {availableCommercials.length === 0 && (
                        <div className="px-4 py-9 text-center">
                            <Users
                                aria-hidden="true"
                                className="mx-auto text-slate-400"
                                size={23}
                            />
                            <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                No hay perfiles disponibles
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                Puedes guardar los repartos y asignarlos más
                                adelante.
                            </p>
                        </div>
                    )}
                </div>
            </section>

            <div className="flex flex-col-reverse gap-3 pb-8 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-sm leading-5 text-slate-500">
                    Esta configuración será la versión inicial. Los cambios
                    posteriores no afectarán a operaciones anteriores.
                </p>
                <button
                    type="button"
                    disabled={
                        pending ||
                        !isBalanced ||
                        !directName.trim() ||
                        !franchiseName.trim()
                    }
                    onClick={submit}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Save aria-hidden="true" size={17} />
                    {pending
                        ? 'Guardando configuración…'
                        : 'Guardar configuración'}
                </button>
            </div>
        </div>
    );
}

function SetupAllocationBar({
    commercial,
    franchise,
    central,
}: {
    commercial: number;
    franchise: number;
    central: number;
}) {
    const safeCommercial = Math.max(0, commercial);
    const safeFranchise = Math.max(0, franchise);
    const safeCentral = Math.max(0, central);
    const total = Math.max(safeCommercial + safeFranchise + safeCentral, 1);

    return (
        <div className="mt-5">
            <div
                className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                role="img"
                aria-label={`Comercial ${safeCommercial.toFixed(2)} %, franquicia ${safeFranchise.toFixed(2)} %, Zinergia ${safeCentral.toFixed(2)} %`}
            >
                <span
                    className="bg-indigo-600"
                    style={{
                        width: `${Math.min(100, (safeCommercial / total) * 100)}%`,
                    }}
                />
                {safeFranchise > 0 && (
                    <span
                        className="bg-sky-500"
                        style={{
                            width: `${Math.min(100, (safeFranchise / total) * 100)}%`,
                        }}
                    />
                )}
                <span
                    className="bg-emerald-500"
                    style={{
                        width: `${Math.min(100, (safeCentral / total) * 100)}%`,
                    }}
                />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <SetupLegend
                    color="bg-indigo-600"
                    label="Comercial"
                    value={safeCommercial}
                />
                {safeFranchise > 0 && (
                    <SetupLegend
                        color="bg-sky-500"
                        label="Franquicia"
                        value={safeFranchise}
                    />
                )}
                <SetupLegend
                    color="bg-emerald-500"
                    label="Zinergia"
                    value={safeCentral}
                />
            </div>
        </div>
    );
}

function SetupLegend({
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
        <Field label={label}>
            <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                className={inputClass}
            />
        </Field>
    );
}

function ReadonlyPercent({ label, value }: { label: string; value: number }) {
    return (
        <div>
            <span className={labelClass}>{label}</span>
            <output
                className={`flex h-10 items-center rounded-md border px-3 text-sm font-semibold tabular-nums ${value > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'}`}
            >
                {value.toFixed(2)} %
            </output>
        </div>
    );
}

function BalanceBadge({ valid }: { valid: boolean }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 text-sm font-semibold ${valid ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}
        >
            {valid && <Check aria-hidden="true" size={15} />}
            {valid ? '100 %' : 'Revisar'}
        </span>
    );
}

function roundPercent(value: number): number {
    return Math.round(value * 100) / 100;
}

function roleLabel(role: string | null): string {
    const labels: Record<string, string> = {
        admin: 'Administrador',
        franchise: 'Franquicia',
        agent: 'Comercial',
    };
    return labels[role ?? ''] ?? 'Perfil';
}
