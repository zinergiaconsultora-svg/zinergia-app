import Link from 'next/link';
import {
    ArrowLeft,
    ArrowRight,
    BriefcaseBusiness,
    CheckCircle2,
    CircleDollarSign,
    ClipboardCheck,
    Clock3,
    ExternalLink,
    FileText,
    History,
    Mail,
    MapPin,
    MoreHorizontal,
    Phone,
    ReceiptText,
    UserRound,
    Zap,
} from 'lucide-react';
import {
    getOpportunityWorkspacePrimaryAction,
    type OpportunityWorkspace,
} from '@/lib/crm/opportunityWorkspace';
import { getOpportunityStageAgeDays } from '@/lib/crm/opportunityState';
import type { UserRole } from '@/types/crm';

const STAGE_LABELS: Record<OpportunityWorkspace['stage'], string> = {
    invoice_received: 'Factura recibida',
    data_review: 'Revisar datos',
    proposal_preparation: 'Preparar propuesta',
    proposal_sent: 'Esperando respuesta',
    accepted: 'Aceptada',
    activation: 'En alta',
    won: 'Cliente activo',
    lost: 'Perdida',
};

const TYPE_LABELS: Record<OpportunityWorkspace['type'], string> = {
    new_business: 'Nuevo cliente',
    switch: 'Cambio de compañía',
    renewal: 'Renovación',
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente',
    processing: 'Procesando',
    completed: 'Completado',
    failed: 'Con incidencia',
    draft: 'Borrador',
    sent: 'Enviada',
    accepted: 'Aceptada',
    rejected: 'Rechazada',
    expired: 'Caducada',
    active: 'Activo',
    cancelled: 'Cancelado',
    validated: 'Validada',
    invoiced: 'Facturada',
    paid: 'Pagada',
    reversed: 'Revertida',
};

function formatDate(value: string | null, withTime = false): string {
    if (!value) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(new Date(value));
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 2,
    }).format(value);
}

function statusLabel(value: string | null): string {
    if (!value) return 'Pendiente';
    return STATUS_LABELS[value] ?? value.replaceAll('_', ' ');
}

export default function OpportunityWorkspaceView({
    workspace,
    role,
}: {
    workspace: OpportunityWorkspace;
    role: UserRole;
}) {
    const primaryAction = getOpportunityWorkspacePrimaryAction(workspace);
    const stageAge = getOpportunityStageAgeDays(workspace.stageEnteredAt);
    const showAdminActions = role === 'admin';

    return (
        <main className="mx-auto w-full max-w-[1320px] px-4 py-5 md:px-6 md:py-7">
            <Link
                href="/dashboard"
                className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-slate-300 dark:hover:text-white"
            >
                <ArrowLeft aria-hidden="true" size={17} />
                Volver a Trabajo
            </Link>

            <header className="mt-3 border-b border-slate-200 pb-5 dark:border-slate-800">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                            <span>{TYPE_LABELS[workspace.type]}</span>
                            <span aria-hidden="true">·</span>
                            <span>{workspace.supplyPoint.label}</span>
                        </div>
                        <h1 className="mt-1 break-words text-2xl font-bold text-slate-950 dark:text-white md:text-3xl">
                            {workspace.client.name}
                        </h1>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                            <span className="inline-flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300">
                                <BriefcaseBusiness aria-hidden="true" size={16} />
                                {STAGE_LABELS[workspace.stage]}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                <Clock3 aria-hidden="true" size={16} />
                                {stageAge === 0 ? 'Etapa iniciada hoy' : `${stageAge} días en esta etapa`}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                <UserRound aria-hidden="true" size={16} />
                                {workspace.owner.name}
                            </span>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {primaryAction && (
                            <Link
                                href={primaryAction.href}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-700 px-4 text-sm font-bold text-white hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
                            >
                                {primaryAction.label}
                                <ArrowRight aria-hidden="true" size={17} />
                            </Link>
                        )}
                        {showAdminActions && (
                            <details className="relative">
                                <summary
                                    aria-label="Más acciones"
                                    title="Más acciones"
                                    className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    <MoreHorizontal aria-hidden="true" size={19} />
                                </summary>
                                <div className="absolute right-0 z-20 mt-2 w-56 border border-slate-200 bg-white p-1 shadow-md dark:border-slate-700 dark:bg-slate-900">
                                    <Link
                                        href={`/dashboard/clients/${workspace.client.id}`}
                                        className="block rounded px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        Corregir datos del cliente
                                    </Link>
                                    <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                                        Reasignar, reabrir o cerrar requiere motivo y flujo administrativo.
                                    </p>
                                </div>
                            </details>
                        )}
                    </div>
                </div>
            </header>

            <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 py-2 dark:border-slate-800" aria-label="Secciones del expediente">
                {[
                    ['resumen', 'Resumen'],
                    ['documentos', 'Documentos'],
                    ['propuestas', 'Propuestas'],
                    ['alta-contrato', 'Alta y contrato'],
                    ['economia', 'Economía'],
                    ['actividad', 'Actividad'],
                ].map(([href, label]) => (
                    <a
                        key={href}
                        href={`#${href}`}
                        className="shrink-0 rounded px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                        {label}
                    </a>
                ))}
            </nav>

            <section id="resumen" className="scroll-mt-24 border-b border-slate-200 py-7 dark:border-slate-800">
                <SectionHeading icon={ClipboardCheck} title="Resumen" />
                <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
                    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                        <DataItem label="Suministro" value={workspace.supplyPoint.label} icon={Zap} />
                        <DataItem label="Dirección" value={workspace.supplyPoint.address ?? 'Sin dirección'} icon={MapPin} />
                        <DataItem label="Comercializadora actual" value={workspace.supplyPoint.currentMarketer ?? 'Sin confirmar'} />
                        <DataItem label="Tarifa actual" value={workspace.supplyPoint.currentTariff ?? 'Sin confirmar'} />
                        <DataItem
                            label="Consumo anual"
                            value={workspace.supplyPoint.annualConsumptionKwh
                                ? `${workspace.supplyPoint.annualConsumptionKwh.toLocaleString('es-ES')} kWh`
                                : 'Sin confirmar'}
                        />
                        <DataItem label="Responsable" value={workspace.owner.name} icon={UserRound} />
                    </dl>
                    <div className="border-t border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 dark:border-slate-800">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Contacto</p>
                        <div className="mt-3 space-y-3">
                            {workspace.client.email ? (
                                <a className="flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300" href={`mailto:${workspace.client.email}`}>
                                    <Mail aria-hidden="true" size={16} /> {workspace.client.email}
                                </a>
                            ) : <p className="text-sm text-slate-500">Sin correo</p>}
                            {workspace.client.phone ? (
                                <a className="flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300" href={`tel:${workspace.client.phone}`}>
                                    <Phone aria-hidden="true" size={16} /> {workspace.client.phone}
                                </a>
                            ) : <p className="text-sm text-slate-500">Sin teléfono</p>}
                        </div>
                        <Link
                            href={`/dashboard/clients/${workspace.client.id}`}
                            className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-slate-200 dark:hover:text-white"
                        >
                            Ver cliente <ExternalLink aria-hidden="true" size={15} />
                        </Link>
                    </div>
                </div>
            </section>

            <section id="documentos" className="scroll-mt-24 border-b border-slate-200 py-7 dark:border-slate-800">
                <SectionHeading icon={FileText} title="Documentos" count={workspace.documents.length || undefined} />
                {workspace.documents.length ? (
                    <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        {workspace.documents.map(document => (
                            <div key={document.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-slate-950 dark:text-white">{document.name}</p>
                                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">Subida {formatDate(document.createdAt, true)}</p>
                                </div>
                                <StatusText value={document.confirmedAt ? 'Confirmado' : statusLabel(document.status)} />
                            </div>
                        ))}
                    </div>
                ) : <EmptySection text="Todavía no hay documentos en esta oportunidad." />}
            </section>

            <section id="propuestas" className="scroll-mt-24 border-b border-slate-200 py-7 dark:border-slate-800">
                <SectionHeading icon={ReceiptText} title="Propuestas" count={workspace.proposals.length || undefined} />
                {workspace.proposals.length ? (
                    <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        {workspace.proposals.map(proposal => (
                            <Link key={proposal.id} href={`/dashboard/proposals/${proposal.id}`} className="flex flex-col gap-3 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-slate-900">
                                <div>
                                    <p className="text-sm font-bold text-slate-950 dark:text-white">{proposal.marketer} · {proposal.tariff}</p>
                                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">Ahorro estimado {formatCurrency(proposal.annualSavings)}</p>
                                </div>
                                <StatusText value={statusLabel(proposal.status)} />
                            </Link>
                        ))}
                    </div>
                ) : <EmptySection text="Todavía no hay propuestas" />}
            </section>

            <section id="alta-contrato" className="scroll-mt-24 border-b border-slate-200 py-7 dark:border-slate-800">
                <SectionHeading icon={CheckCircle2} title="Alta y contrato" />
                {workspace.contracts.length ? (
                    <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                        {workspace.contracts.map(contract => (
                            <div key={contract.id} className="border-b border-slate-200 pb-4 dark:border-slate-800">
                                <p className="text-sm font-bold text-slate-950 dark:text-white">{contract.marketer}</p>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{contract.tariff ?? 'Tarifa sin especificar'}</p>
                                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                                    {formatDate(contract.startDate)} → {contract.endDate ? formatDate(contract.endDate) : 'Sin fecha de fin'}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptySection text={workspace.stage === 'accepted' || workspace.stage === 'activation'
                        ? 'El alta está pendiente de completar.'
                        : 'El alta y el contrato aparecerán después de aceptar una propuesta.'}
                    />
                )}
            </section>

            <section id="economia" className="scroll-mt-24 border-b border-slate-200 py-7 dark:border-slate-800">
                <SectionHeading icon={CircleDollarSign} title="Economía" />
                {workspace.commissions.length ? (
                    <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        {workspace.commissions.map(commission => (
                            <div key={commission.id} className="flex items-center justify-between gap-4 py-3">
                                <div>
                                    <p className="text-sm font-bold text-slate-950 dark:text-white">{formatCurrency(commission.agentAmount)}</p>
                                    {role !== 'agent' && commission.franchiseAmount > 0 && (
                                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">Red: {formatCurrency(commission.franchiseAmount)}</p>
                                    )}
                                </div>
                                <StatusText value={statusLabel(commission.status)} />
                            </div>
                        ))}
                    </div>
                ) : <EmptySection text="La parte económica aparecerá cuando exista una comisión." />}
            </section>

            <section id="actividad" className="scroll-mt-24 py-7">
                <SectionHeading icon={History} title="Actividad" />
                {workspace.activity.length ? (
                    <ol className="mt-4 border-l border-slate-300 pl-5 dark:border-slate-700">
                        {workspace.activity.map(item => (
                            <li key={item.id} className="relative pb-5 last:pb-0">
                                <span className="absolute -left-[25px] top-1 size-2 rounded-full bg-indigo-700 ring-4 ring-white dark:ring-slate-950" />
                                <p className="text-sm font-bold text-slate-950 dark:text-white">{item.title}</p>
                                {item.detail && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{item.detail}</p>}
                                <p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt, true)}</p>
                            </li>
                        ))}
                    </ol>
                ) : <EmptySection text="La actividad del expediente aparecerá aquí." />}
            </section>
        </main>
    );
}

function SectionHeading({ icon: Icon, title, count }: {
    icon: typeof FileText;
    title: string;
    count?: number;
}) {
    return (
        <div className="flex items-center gap-2">
            <Icon aria-hidden="true" size={18} className="text-slate-500" />
            <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
            {count !== undefined && <span className="text-sm font-semibold text-slate-500">{count}</span>}
        </div>
    );
}

function DataItem({ label, value, icon: Icon }: {
    label: string;
    value: string;
    icon?: typeof Zap;
}) {
    return (
        <div>
            <dt className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</dt>
            <dd className="mt-1 flex items-start gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                {Icon && <Icon aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-slate-500" />}
                <span className="break-words">{value}</span>
            </dd>
        </div>
    );
}

function StatusText({ value }: { value: string }) {
    return (
        <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {value}
        </span>
    );
}

function EmptySection({ text }: { text: string }) {
    return <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{text}</p>;
}
