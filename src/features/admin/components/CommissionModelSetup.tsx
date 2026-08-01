'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleDollarSign, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
    setupCommissionModelAction,
    type CommissionCommercialSummary,
} from '@/app/actions/commissionManagement';

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition-colors focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-950';
const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200';

type CommissionModelSetupProps = {
    actorId: string;
    commercials: CommissionCommercialSummary[];
};

export function CommissionModelSetup({ actorId, commercials }: CommissionModelSetupProps) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [directName, setDirectName] = useState('Socios directos');
    const [directCommercialPercent, setDirectCommercialPercent] = useState(75);
    const [franchiseName, setFranchiseName] = useState('Red franquiciada');
    const [franchiseCommercialPercent, setFranchiseCommercialPercent] = useState(45);
    const [franchisePercent, setFranchisePercent] = useState(15);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const directCentralPercent = roundPercent(100 - directCommercialPercent);
    const franchiseCentralPercent = roundPercent(
        100 - franchiseCommercialPercent - franchisePercent,
    );
    const isBalanced = directCentralPercent > 0
        && franchiseCentralPercent > 0
        && directCommercialPercent > franchiseCommercialPercent
        && directCentralPercent < franchiseCentralPercent;
    const availableCommercials = commercials;

    const toggleCommercial = (id: string) => {
        setSelectedIds((current) => {
            if (current.includes(id)) return current.filter((candidate) => candidate !== id);
            if (current.length >= 5) return current;
            return [...current, id];
        });
    };

    const submit = () => startTransition(async () => {
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
        <div className="mx-auto w-full max-w-5xl space-y-8">
            <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <CircleDollarSign aria-hidden="true" size={18} />
                    <span className="text-sm font-semibold">Comisiones</span>
                </div>
                <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                    Configuración inicial
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Modelo vigente y socios directos.
                </p>
            </header>

            <section aria-labelledby="direct-model-heading" className="border-b border-slate-200 pb-8 dark:border-slate-800">
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                        <h2 id="direct-model-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
                            Socios directos
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">Sin participación de franquicia.</p>
                    </div>
                    <BalanceBadge valid={directCentralPercent > 0} />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Nombre del modelo">
                        <input value={directName} onChange={(event) => setDirectName(event.target.value)} className={inputClass} />
                    </Field>
                    <PercentField label="Socio %" value={directCommercialPercent} onChange={setDirectCommercialPercent} />
                    <ReadonlyPercent label="Zinergia %" value={directCentralPercent} />
                </div>
            </section>

            <section aria-labelledby="franchise-model-heading" className="border-b border-slate-200 pb-8 dark:border-slate-800">
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                        <h2 id="franchise-model-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
                            Red franquiciada
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">Reparto entre comercial, franquicia y Zinergia.</p>
                    </div>
                    <BalanceBadge valid={franchiseCentralPercent > 0} />
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                    <Field label="Nombre del modelo">
                        <input value={franchiseName} onChange={(event) => setFranchiseName(event.target.value)} className={inputClass} />
                    </Field>
                    <PercentField label="Comercial %" value={franchiseCommercialPercent} onChange={setFranchiseCommercialPercent} />
                    <PercentField label="Franquicia %" value={franchisePercent} onChange={setFranchisePercent} />
                    <ReadonlyPercent label="Zinergia %" value={franchiseCentralPercent} />
                </div>
                {!isBalanced && (
                    <p role="alert" className="mt-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
                        El socio directo debe recibir más y Zinergia debe conservar más en franquicia.
                    </p>
                )}
            </section>

            <section aria-labelledby="partners-heading" className="border-b border-slate-200 pb-8 dark:border-slate-800">
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                        <h2 id="partners-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
                            Perfiles de socios
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">Seleccionados: {selectedIds.length} de 5.</p>
                    </div>
                </div>
                <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
                    {availableCommercials.map((commercial) => {
                        const selected = selectedIds.includes(commercial.id);
                        const isActor = commercial.id === actorId;
                        const disabled = isActor || (!selected && selectedIds.length >= 5);
                        return (
                            <label key={commercial.id} className={`flex min-h-14 items-center gap-3 px-4 py-3 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
                                <input
                                    type="checkbox"
                                    checked={selected}
                                    disabled={disabled}
                                    onChange={() => toggleCommercial(commercial.id)}
                                    className="h-4 w-4 accent-indigo-600"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">{commercial.name}</span>
                                    <span className="block truncate text-xs text-slate-500">
                                        {isActor ? 'Tu perfil requiere asignación por otro administrador' : (commercial.email ?? roleLabel(commercial.role))}
                                    </span>
                                </span>
                                {selected && <Check aria-label="Seleccionado" size={17} className="text-emerald-600" />}
                            </label>
                        );
                    })}
                    {availableCommercials.length === 0 && (
                        <p className="px-4 py-8 text-center text-sm text-slate-500">
                            No hay otros perfiles disponibles. Puedes guardar los modelos y asignarlos más adelante.
                        </p>
                    )}
                </div>
            </section>

            <div className="flex flex-col-reverse gap-3 pb-8 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">Los cambios posteriores crearán una nueva versión.</p>
                <button
                    type="button"
                    disabled={pending || !isBalanced || !directName.trim() || !franchiseName.trim()}
                    onClick={submit}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Save aria-hidden="true" size={17} />
                    {pending ? 'Guardando...' : 'Guardar configuración'}
                </button>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <label><span className={labelClass}>{label}</span>{children}</label>;
}

function PercentField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
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
            <output className={`flex h-10 items-center rounded-md border px-3 text-sm font-semibold tabular-nums ${value > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'}`}>
                {value.toFixed(2)} %
            </output>
        </div>
    );
}

function BalanceBadge({ valid }: { valid: boolean }) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${valid ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
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
