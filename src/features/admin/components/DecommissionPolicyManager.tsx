import { CalendarRange, History, ShieldCheck } from 'lucide-react';
import type { CommissionPolicySummary } from '@/app/actions/commissionManagement';

export function DecommissionPolicyManager({ policies }: { policies: CommissionPolicySummary[] }) {
    return (
        <section aria-labelledby="decommission-policies-heading" className="border-b border-slate-200 pb-8 dark:border-slate-800">
            <div className="mb-5">
                <h2 id="decommission-policies-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
                    Regla de decomisión
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Regla única para nuevas operaciones, basada en la permanencia realmente incumplida.
                </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
                <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
                    <div className="flex items-start gap-3">
                        <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" size={21} />
                        <div>
                            <h3 className="font-bold text-slate-950 dark:text-white">Permanencia proporcional · v1</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                                Devolución = días de permanencia pendientes ÷ días totales de permanencia. El servidor calcula el porcentaje con las fechas del contrato y conserva el reparto original.
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <Rule label="Contrato" value="Permanencia conocida" />
                        <Rule label="Baja" value="Anterior al vencimiento" />
                        <Rule label="Control" value="Evidencia + confirmación admin" />
                    </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-start gap-3">
                        <CalendarRange aria-hidden="true" className="mt-0.5 shrink-0 text-indigo-600" size={20} />
                        <div>
                            <h3 className="font-bold text-slate-950 dark:text-white">Qué no hace</h3>
                            <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                <li>No inventa fechas ni permanencias desconocidas.</li>
                                <li>No modifica comisiones históricas ni facturas emitidas.</li>
                                <li>No calcula ni representa una penalización al cliente.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {policies.length > 0 && (
                <details className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                    <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
                        <span className="inline-flex items-center gap-2"><History aria-hidden="true" size={16} /> Políticas históricas ({policies.length})</span>
                    </summary>
                    <p className="mt-2 text-xs text-slate-500">Solo se conservan para explicar operaciones que ya congelaron una versión anterior.</p>
                    <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-700">
                        {policies.map((policy) => (
                            <div key={policy.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:justify-between">
                                <span className="font-semibold text-slate-800 dark:text-slate-100">{policy.marketerName}{policy.productCode ? ` · ${policy.productCode}` : ''}</span>
                                <span className="text-slate-500">v{policy.version} · {policy.clawbackDays} días</span>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </section>
    );
}

function Rule({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded bg-white/80 px-3 py-2 dark:bg-slate-950/60">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
        </div>
    );
}
