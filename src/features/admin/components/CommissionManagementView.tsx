'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, CircleDollarSign, Save, UserRoundPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
    assignCommissionPlanAction,
    createCommissionPlanAction,
    type CommissionManagementData,
} from '@/app/actions/commissionManagement';
import type { CommissionChannel } from '@/lib/commissions/lifecycle';
import { CommissionModelSetup } from './CommissionModelSetup';
import { DecommissionPolicyManager } from './DecommissionPolicyManager';

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-950';
const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200';

export function CommissionManagementView({ initialData }: { initialData: CommissionManagementData }) {
    const router = useRouter();
    const initialPlan = initialData.plans.find((plan) => plan.channel === 'partner_direct' && plan.isActive)
        ?? initialData.plans.find((plan) => plan.isActive);
    const [pending, startTransition] = useTransition();
    const [channel, setChannel] = useState<CommissionChannel>(initialPlan?.channel ?? 'partner_direct');
    const [name, setName] = useState(initialPlan?.name ?? 'Socios directos');
    const [commercialPercent, setCommercialPercent] = useState((initialPlan?.commercialShareBps ?? 0) / 100);
    const [franchisePercent, setFranchisePercent] = useState((initialPlan?.franchiseShareBps ?? 0) / 100);
    const [commercialId, setCommercialId] = useState('');
    const [planId, setPlanId] = useState('');
    const [reason, setReason] = useState('Asignación inicial');

    const centralPercent = Math.round((100 - commercialPercent - franchisePercent) * 100) / 100;
    const commercialById = useMemo(
        () => new Map(initialData.commercials.map((commercial) => [commercial.id, commercial])),
        [initialData.commercials],
    );
    const planById = useMemo(
        () => new Map(initialData.plans.map((plan) => [plan.id, plan])),
        [initialData.plans],
    );

    const activePlans = initialData.plans.filter((plan) => plan.isActive);
    const hasDirectPlan = activePlans.some((plan) => plan.channel === 'partner_direct');
    const hasFranchisePlan = activePlans.some((plan) => plan.channel === 'franchise_network');

    if (!hasDirectPlan && !hasFranchisePlan) {
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

    const submitPlan = () => startTransition(async () => {
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

    const submitAssignment = () => startTransition(async () => {
        const result = await assignCommissionPlanAction({ commercialId, planId, reason });
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
        <div className="mx-auto w-full max-w-6xl space-y-8">
            <header className="flex flex-col gap-2 border-b border-slate-200 pb-5 dark:border-slate-800">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <CircleDollarSign aria-hidden="true" size={18} />
                    <span className="text-sm font-semibold">Comisiones</span>
                </div>
                <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Modelo económico</h1>
                <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                    Edita los porcentajes futuros y consulta el histórico aplicado a cada operación.
                </p>
            </header>

            <section aria-labelledby="plans-heading" className="border-b border-slate-200 pb-8 dark:border-slate-800">
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                        <h2 id="plans-heading" className="text-lg font-semibold text-slate-950 dark:text-white">Planes</h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Cada cambio entra en vigor desde su guardado. Lo anterior no se recalcula.</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-500">{activePlans.length} vigentes · {initialData.plans.length} versiones</span>
                </div>

                <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
                    <div className="min-w-0 overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
                        <table className="w-full min-w-[620px] text-left text-sm">
                            <thead className="bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Plan</th>
                                    <th className="px-4 py-3 font-semibold">Canal</th>
                                    <th className="px-4 py-3 text-right font-semibold">Comercial</th>
                                    <th className="px-4 py-3 text-right font-semibold">Franquicia</th>
                                    <th className="px-4 py-3 text-right font-semibold">Zinergia</th>
                                    <th className="px-4 py-3 font-semibold">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {initialData.plans.map((plan) => (
                                    <tr key={plan.id} className="bg-white dark:bg-slate-950">
                                        <td className="px-4 py-3 font-semibold text-slate-950 dark:text-white">{plan.name} <span className="text-slate-500">v{plan.version}</span></td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{channelLabel(plan.channel)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{formatBps(plan.commercialShareBps)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{formatBps(plan.franchiseShareBps)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{formatBps(plan.centralShareBps)}</td>
                                        <td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-bold ${plan.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{plan.isActive ? 'Vigente' : `Hasta ${formatDate(plan.effectiveTo)}`}</span></td>
                                    </tr>
                                ))}
                                {initialData.plans.length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Todavía no hay planes configurados.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="min-w-0 rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                        <h3 className="text-base font-semibold text-slate-950 dark:text-white">Nueva versión</h3>
                        <div className="mt-4 space-y-4">
                            <div>
                                <span className={labelClass}>Canal</span>
                                <div className="grid grid-cols-2 rounded-md border border-slate-300 p-1 dark:border-slate-700">
                                    {(['partner_direct', 'franchise_network'] as const).map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => {
                                                setChannel(value);
                                                const current = activePlans.find((plan) => plan.channel === value);
                                                setName(current?.name ?? (value === 'partner_direct' ? 'Socios directos' : 'Red franquiciada'));
                                                setCommercialPercent((current?.commercialShareBps ?? 0) / 100);
                                                setFranchisePercent(value === 'partner_direct' ? 0 : (current?.franchiseShareBps ?? 0) / 100);
                                            }}
                                            aria-pressed={channel === value}
                                            className={`h-8 rounded text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${channel === value ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                                        >
                                            {value === 'partner_direct' ? 'Socios' : 'Franquicia'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <Field label="Nombre"><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Comercial %"><input type="number" min="0" max="100" step="0.01" className={inputClass} value={commercialPercent} onChange={(event) => setCommercialPercent(Number(event.target.value))} /></Field>
                                <Field label="Franquicia %"><input type="number" min="0" max="100" step="0.01" disabled={channel === 'partner_direct'} className={inputClass} value={franchisePercent} onChange={(event) => setFranchisePercent(Number(event.target.value))} /></Field>
                            </div>
                            <div className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold ${centralPercent < 0 ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
                                <span>Zinergia</span><span className="tabular-nums">{centralPercent.toFixed(2)} %</span>
                            </div>
                            <button type="button" disabled={pending || centralPercent < 0 || !name.trim()} onClick={submitPlan} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                <Save aria-hidden="true" size={16} /> Guardar versión
                            </button>
                            <p className="text-xs leading-5 text-slate-500">Se aplicará a nuevas aceptaciones y conservará automáticamente las asignaciones actuales del canal.</p>
                        </div>
                    </div>
                </div>
            </section>

            <DecommissionPolicyManager policies={initialData.policies} />

            <section aria-labelledby="assignments-heading" className="border-b border-slate-200 pb-8 dark:border-slate-800">
                <div className="mb-5">
                    <h2 id="assignments-heading" className="text-lg font-semibold text-slate-950 dark:text-white">Asignaciones</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Un plan vigente por perfil.</p>
                </div>
                <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
                    <div className="min-w-0 space-y-4 rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                        <Field label="Perfil comercial">
                            <select className={inputClass} value={commercialId} onChange={(event) => setCommercialId(event.target.value)}>
                                <option value="">Seleccionar</option>
                                {initialData.commercials.map((commercial) => <option key={commercial.id} value={commercial.id} disabled={commercial.id === initialData.actorId}>{commercial.name}{commercial.id === initialData.actorId ? ' (tú)' : ''}</option>)}
                            </select>
                        </Field>
                        <Field label="Plan">
                            <select className={inputClass} value={planId} onChange={(event) => setPlanId(event.target.value)}>
                                <option value="">Seleccionar</option>
                                {activePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} v{plan.version}</option>)}
                            </select>
                        </Field>
                        <Field label="Motivo"><input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
                        <button type="button" disabled={pending || !commercialId || !planId || reason.trim().length < 3} onClick={submitAssignment} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                            <UserRoundPlus aria-hidden="true" size={16} /> Asignar plan
                        </button>
                    </div>
                    <div className="min-w-0 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
                        {initialData.assignments.map((assignment) => {
                            const commercial = commercialById.get(assignment.commercialId);
                            const plan = planById.get(assignment.planId);
                            return (
                                <div key={assignment.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div><p className="font-semibold text-slate-950 dark:text-white">{commercial?.name ?? 'Perfil no disponible'}</p><p className="text-sm text-slate-500">{commercial?.email ?? assignment.reason}</p></div>
                                    <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald-800 sm:mt-0 dark:text-emerald-300"><Check aria-hidden="true" size={15} />{plan ? `${plan.name} v${plan.version}` : 'Plan histórico'}</div>
                                </div>
                            );
                        })}
                        {initialData.assignments.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No hay perfiles asignados.</p>}
                    </div>
                </div>
            </section>

            <section aria-labelledby="reconciliation-heading" className="pb-8">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <div><h2 id="reconciliation-heading" className="text-lg font-semibold text-slate-950 dark:text-white">Revisión económica</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Operaciones sin configuración completa.</p></div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${initialData.reconciliation.length > 0 ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'}`}><AlertTriangle aria-hidden="true" size={14} />{initialData.reconciliation.length}</span>
                </div>
                <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
                    {initialData.reconciliation.map((item) => (
                        <div key={item.commissionId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div><p className="font-semibold text-slate-950 dark:text-white">{commercialById.get(item.commercialId ?? '')?.name ?? 'Operación histórica'}</p><p className="text-sm text-slate-600 dark:text-slate-400">{item.requiredAction}</p></div>
                            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">{reconciliationLabel(item.reconciliationStatus)}</span>
                        </div>
                    ))}
                    {initialData.reconciliation.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No hay operaciones pendientes de revisión.</p>}
                </div>
            </section>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <label><span className={labelClass}>{label}</span>{children}</label>;
}

function formatBps(value: number): string {
    return `${(value / 100).toFixed(2)} %`;
}

function formatDate(value: string | null): string {
    if (!value) return 'histórico';
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(value));
}

function channelLabel(channel: CommissionChannel): string {
    return channel === 'partner_direct' ? 'Socio directo' : 'Red franquiciada';
}

function reconciliationLabel(status: string): string {
    const labels: Record<string, string> = {
        plan_unassigned: 'Sin plan',
        policy_unmatched: 'Sin política',
        contradictory_legacy: 'Histórico contradictorio',
        pending_review: 'Pendiente de revisión',
    };
    return labels[status] ?? 'Revisar';
}
