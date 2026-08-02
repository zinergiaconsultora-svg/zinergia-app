import {
    Calculator,
    CalendarRange,
    Check,
    History,
    ShieldCheck,
} from 'lucide-react';
import type { CommissionPolicySummary } from '@/app/actions/commissionManagement';

export function DecommissionPolicyManager({
    policies,
}: {
    policies: CommissionPolicySummary[];
}) {
    return (
        <section
            aria-labelledby="decommission-policies-heading"
            className="border-b border-slate-200 pb-9 dark:border-slate-800"
        >
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2
                        id="decommission-policies-heading"
                        className="text-xl font-bold text-slate-950 dark:text-white"
                    >
                        Política de decomisión
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                        Recupera únicamente la parte de la comisión
                        correspondiente a la permanencia no cumplida.
                    </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck aria-hidden="true" size={17} /> Regla vigente ·
                    v1
                </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
                    <div className="p-5 sm:p-6 lg:border-r lg:border-slate-200 dark:lg:border-slate-800">
                        <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                <Calculator aria-hidden="true" size={19} />
                            </span>
                            <div>
                                <h3 className="font-bold text-slate-950 dark:text-white">
                                    Cálculo proporcional por días
                                </h3>
                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    El porcentaje a devolver se calcula con las
                                    fechas reales del contrato. El reparto entre
                                    las partes conserva los porcentajes de la
                                    operación original.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 rounded-md bg-slate-100 px-4 py-3 text-center dark:bg-slate-900">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                Devolución = días pendientes{' '}
                                <span className="px-1 text-slate-400">÷</span>{' '}
                                días totales de permanencia
                            </p>
                        </div>

                        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-3">
                            <Rule
                                label="Requisito"
                                value="Permanencia conocida"
                            />
                            <Rule
                                label="Activación"
                                value="Baja antes del vencimiento"
                            />
                            <Rule
                                label="Validación"
                                value="Evidencia y aprobación admin"
                            />
                        </dl>
                    </div>

                    <div className="bg-slate-50 p-5 sm:p-6 dark:bg-slate-900/50">
                        <div className="flex items-center gap-2">
                            <CalendarRange
                                aria-hidden="true"
                                className="text-indigo-600 dark:text-indigo-300"
                                size={19}
                            />
                            <h3 className="font-bold text-slate-950 dark:text-white">
                                Salvaguardas
                            </h3>
                        </div>
                        <ul className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                            <Safeguard>
                                No aplica si la permanencia o la fecha de baja
                                son desconocidas.
                            </Safeguard>
                            <Safeguard>
                                No modifica facturas ni comisiones históricas ya
                                consolidadas.
                            </Safeguard>
                            <Safeguard>
                                No representa una penalización económica al
                                cliente.
                            </Safeguard>
                        </ul>
                    </div>
                </div>
            </div>

            {policies.length > 0 && (
                <details className="group mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-2 text-sm font-bold text-slate-700 outline-none hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-slate-200 dark:hover:text-white [&::-webkit-details-marker]:hidden">
                        <span className="inline-flex items-center gap-2">
                            <History aria-hidden="true" size={16} /> Políticas
                            anteriores ({policies.length})
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                            Consulta histórica
                        </span>
                    </summary>
                    <p className="mt-1 text-xs text-slate-500">
                        Se conservan para explicar operaciones que congelaron
                        una política anterior.
                    </p>
                    <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        {policies.map((policy) => (
                            <div
                                key={policy.id}
                                className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                            >
                                <span className="font-semibold text-slate-800 dark:text-slate-100">
                                    {policy.marketerName}
                                    {policy.productCode
                                        ? ` · ${policy.productCode}`
                                        : ''}
                                </span>
                                <span className="text-slate-500">
                                    v{policy.version} · ventana de{' '}
                                    {policy.clawbackDays} días
                                </span>
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
        <div>
            <dt className="text-xs font-semibold text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm font-bold leading-5 text-slate-900 dark:text-white">
                {value}
            </dd>
        </div>
    );
}

function Safeguard({ children }: { children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-2.5">
            <Check
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300"
                size={16}
            />
            <span className="leading-5">{children}</span>
        </li>
    );
}
