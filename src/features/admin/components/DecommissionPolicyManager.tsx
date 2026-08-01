'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    createDecommissionPolicyAction,
    type CommissionPolicySummary,
} from '@/app/actions/commissionManagement';
import { validateDecommissionPolicy } from '@/lib/commissions/lifecycle';

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition-colors focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-950';
const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200';

type EditableBand = {
    activeDayTo: number;
    reversalPercent: number;
};

const DEFAULT_BANDS: EditableBand[] = [
    { activeDayTo: 30, reversalPercent: 100 },
    { activeDayTo: 90, reversalPercent: 50 },
    { activeDayTo: 180, reversalPercent: 25 },
];

export function DecommissionPolicyManager({ policies }: { policies: CommissionPolicySummary[] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [marketerName, setMarketerName] = useState('');
    const [productCode, setProductCode] = useState('');
    const [consolidationDays, setConsolidationDays] = useState(30);
    const [clawbackDays, setClawbackDays] = useState(180);
    const [bands, setBands] = useState<EditableBand[]>(DEFAULT_BANDS);

    const normalizedBands = useMemo(() => bands.map((band, index) => ({
        activeDayFrom: index === 0 ? 0 : bands[index - 1].activeDayTo + 1,
        activeDayTo: band.activeDayTo,
        reversalBps: Math.round(band.reversalPercent * 100),
    })), [bands]);
    const validationErrors = validateDecommissionPolicy({
        consolidationDays,
        clawbackDays,
        bands: normalizedBands,
    });
    const canSave = marketerName.trim().length >= 2 && validationErrors.length === 0;

    const changeClawbackDays = (value: number) => {
        setClawbackDays(value);
        setBands((current) => current.map((band, index) => (
            index === current.length - 1 ? { ...band, activeDayTo: value } : band
        )));
    };

    const updateBand = (index: number, update: Partial<EditableBand>) => {
        setBands((current) => current.map((band, candidateIndex) => (
            candidateIndex === index ? { ...band, ...update } : band
        )));
    };

    const addBand = () => {
        setBands((current) => {
            if (current.length >= 12) return current;
            const previousEnd = current.length > 1 ? current[current.length - 2].activeDayTo : -1;
            const last = current[current.length - 1];
            const lastStart = previousEnd + 1;
            if (lastStart >= last.activeDayTo) return current;
            const splitAt = Math.floor((lastStart + last.activeDayTo) / 2);
            return [
                ...current.slice(0, -1),
                { ...last, activeDayTo: splitAt },
                { activeDayTo: clawbackDays, reversalPercent: last.reversalPercent },
            ];
        });
    };

    const removeBand = (index: number) => {
        setBands((current) => {
            if (current.length === 1) return current;
            const next = current.filter((_, candidateIndex) => candidateIndex !== index);
            return next.map((band, candidateIndex) => (
                candidateIndex === next.length - 1 ? { ...band, activeDayTo: clawbackDays } : band
            ));
        });
    };

    const submit = () => startTransition(async () => {
        const result = await createDecommissionPolicyAction({
            marketerName,
            productCode,
            consolidationDays,
            clawbackDays,
            bands: normalizedBands.map((band) => ({
                activeDayFrom: band.activeDayFrom,
                activeDayTo: band.activeDayTo,
                reversalPercent: band.reversalBps / 100,
            })),
        });

        if (!result.success) {
            toast.error(result.error);
            return;
        }

        toast.success('Política de decomisión guardada');
        setMarketerName('');
        setProductCode('');
        router.refresh();
    });

    return (
        <section aria-labelledby="decommission-policies-heading" className="border-b border-slate-200 pb-8 dark:border-slate-800">
            <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                    <h2 id="decommission-policies-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
                        Políticas de decomisión
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Condiciones por comercializadora y producto.</p>
                </div>
                <span className="text-sm font-semibold text-slate-500">{policies.length} versiones</span>
            </div>

            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <div className="min-w-0 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
                    {policies.map((policy) => (
                        <div key={policy.id} className="px-4 py-4">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-950 dark:text-white">
                                        {policy.marketerName}{policy.productCode ? ` · ${policy.productCode}` : ''}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        v{policy.version} · Consolida {policy.consolidationDays} d · Límite {policy.clawbackDays} d
                                    </p>
                                </div>
                                <ShieldCheck aria-label="Política vigente" size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {policy.bands.map((band) => (
                                    <span key={band.id}>
                                        {band.activeDayFrom}-{band.activeDayTo ?? '∞'} d: {(band.reversalBps / 100).toFixed(2)} %
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                    {policies.length === 0 && (
                        <p className="px-4 py-8 text-center text-sm text-slate-500">No hay políticas configuradas.</p>
                    )}
                </div>

                <div className="min-w-0 rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                    <h3 className="text-base font-semibold text-slate-950 dark:text-white">Nueva versión</h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Field label="Comercializadora">
                            <input value={marketerName} onChange={(event) => setMarketerName(event.target.value)} className={inputClass} />
                        </Field>
                        <Field label="Producto (opcional)">
                            <input value={productCode} onChange={(event) => setProductCode(event.target.value)} className={inputClass} />
                        </Field>
                        <NumberField label="Consolidación (días)" value={consolidationDays} onChange={setConsolidationDays} />
                        <NumberField label="Límite devolución (días)" value={clawbackDays} onChange={changeClawbackDays} />
                    </div>

                    <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tramos</span>
                            <button type="button" onClick={addBand} disabled={bands.length >= 12} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 dark:text-indigo-300 dark:hover:bg-indigo-950/40">
                                <Plus aria-hidden="true" size={14} /> Añadir
                            </button>
                        </div>
                        <div className="space-y-2">
                            {bands.map((band, index) => {
                                const activeDayFrom = index === 0 ? 0 : bands[index - 1].activeDayTo + 1;
                                return (
                                    <div key={index} className="grid grid-cols-[minmax(62px,auto)_1fr_1fr_36px] items-end gap-2">
                                        <span className="pb-2.5 text-xs font-semibold text-slate-500">Desde {activeDayFrom}</span>
                                        <NumberField label="Hasta" value={band.activeDayTo} onChange={(value) => updateBand(index, { activeDayTo: value })} />
                                        <DecimalField label="Devolución %" value={band.reversalPercent} onChange={(value) => updateBand(index, { reversalPercent: value })} />
                                        <button type="button" aria-label={`Eliminar tramo ${index + 1}`} disabled={bands.length === 1} onClick={() => removeBand(index)} className="mb-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30 dark:hover:bg-rose-950/40 dark:hover:text-rose-300">
                                            <Trash2 aria-hidden="true" size={16} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {validationErrors.length > 0 && (
                        <p role="alert" className="mt-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
                            Los tramos deben cubrir todos los días y reducir o mantener la devolución.
                        </p>
                    )}

                    <button type="button" disabled={pending || !canSave} onClick={submit} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                        <Save aria-hidden="true" size={16} /> {pending ? 'Guardando...' : 'Guardar política'}
                    </button>
                </div>
            </div>
        </section>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <label><span className={labelClass}>{label}</span>{children}</label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
    return (
        <Field label={label}>
            <input type="number" min="0" max="3650" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} className={inputClass} />
        </Field>
    );
}

function DecimalField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
    return (
        <Field label={label}>
            <input type="number" min="0" max="100" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} className={inputClass} />
        </Field>
    );
}
