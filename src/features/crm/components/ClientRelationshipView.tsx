'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    BriefcaseBusiness,
    Building2,
    CalendarClock,
    Clock3,
    Edit3,
    FileText,
    History,
    Mail,
    MapPin,
    MoreHorizontal,
    Phone,
    Trash2,
    UserRound,
    Zap,
} from 'lucide-react';
import { deleteClientAction } from '@/app/actions/clients';
import type { ClientRelationshipRecord } from '@/lib/crm/clientPortfolio';
import type { Client } from '@/types/crm';

const CreateClientModal = dynamic(() => import('./CreateClientModal'), { ssr: false });

const STAGE_LABELS: Record<string, string> = {
    invoice_received: 'Factura recibida',
    data_review: 'Revisar datos',
    proposal_preparation: 'Preparar propuesta',
    proposal_sent: 'Esperando respuesta',
    accepted: 'Aceptada',
    activation: 'En alta',
    won: 'Ganada',
    lost: 'Perdida',
};

function formatDate(value: string | null): string {
    if (!value) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
}

export default function ClientRelationshipView({
    record,
    editableClient,
}: {
    record: ClientRelationshipRecord;
    editableClient?: Client;
}) {
    const router = useRouter();
    const [editOpen, setEditOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    async function removeClient() {
        if (!window.confirm('¿Eliminar este cliente y sus datos relacionados? Esta acción no se puede deshacer.')) return;
        setDeleting(true);
        try {
            await deleteClientAction(record.client.id);
            router.push('/dashboard/clients');
        } finally {
            setDeleting(false);
        }
    }

    return (
        <main className="mx-auto w-full max-w-[1320px] px-4 py-5 md:px-6 md:py-7">
            <Link href="/dashboard/clients" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
                <ArrowLeft aria-hidden="true" size={17} /> Volver a Clientes
            </Link>

            <header className="mt-3 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between dark:border-slate-800">
                <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Ficha de relación</p>
                    <h1 className="mt-1 break-words text-2xl font-bold text-slate-950 dark:text-white md:text-3xl">{record.client.name}</h1>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5"><UserRound aria-hidden="true" size={16} />{record.client.ownerName}</span>
                        <span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden="true" size={16} />Último contacto: {formatDate(record.client.lastContactAt)}</span>
                    </div>
                </div>
                {editableClient && (
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setEditOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                            <Edit3 aria-hidden="true" size={16} /> Editar
                        </button>
                        <details className="relative">
                            <summary aria-label="Más acciones del cliente" title="Más acciones" className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                <MoreHorizontal aria-hidden="true" size={19} />
                            </summary>
                            <div className="absolute right-0 z-20 mt-2 w-52 border border-slate-200 bg-white p-1 shadow-md dark:border-slate-700 dark:bg-slate-900">
                                <button type="button" disabled={deleting} onClick={removeClient} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/30">
                                    <Trash2 aria-hidden="true" size={16} /> Eliminar cliente
                                </button>
                            </div>
                        </details>
                    </div>
                )}
            </header>

            <section className="border-b border-slate-200 py-7 dark:border-slate-800">
                <SectionHeading icon={UserRound} title="Contacto" />
                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                    {record.client.email ? <a href={`mailto:${record.client.email}`} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300"><Mail aria-hidden="true" size={16} />{record.client.email}</a> : <span className="text-sm text-slate-500">Sin correo</span>}
                    {record.client.phone ? <a href={`tel:${record.client.phone}`} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300"><Phone aria-hidden="true" size={16} />{record.client.phone}</a> : <span className="text-sm text-slate-500">Sin teléfono</span>}
                </div>
            </section>

            <section className="border-b border-slate-200 py-7 dark:border-slate-800">
                <SectionHeading icon={Zap} title="Suministros" count={record.supplyPoints.length} />
                {record.supplyPoints.length ? (
                    <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        {record.supplyPoints.map(supply => (
                            <div key={supply.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                <div><p className="text-sm font-bold text-slate-950 dark:text-white">{supply.label}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300"><MapPin aria-hidden="true" size={13} />{supply.address ?? 'Sin dirección'}</p></div>
                                <div><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{supply.marketer ?? 'Compañía sin confirmar'}</p><p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{supply.tariff ?? 'Tarifa sin confirmar'}</p></div>
                            </div>
                        ))}
                    </div>
                ) : <Empty text="Este cliente todavía no tiene suministros." />}
            </section>

            <section className="border-b border-slate-200 py-7 dark:border-slate-800">
                <SectionHeading icon={BriefcaseBusiness} title="Oportunidades abiertas" count={record.openOpportunities.length || undefined} />
                {record.openOpportunities.length ? (
                    <OpportunityList items={record.openOpportunities} showAction />
                ) : <Empty text="No hay oportunidades abiertas." />}
            </section>

            <section className="border-b border-slate-200 py-7 dark:border-slate-800">
                <SectionHeading icon={Building2} title="Contratos" count={record.contracts.length || undefined} />
                {record.contracts.length ? (
                    <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        {record.contracts.map(contract => (
                            <div key={contract.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                                <div><p className="text-sm font-bold text-slate-950 dark:text-white">{contract.marketer}</p><p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{contract.tariff ?? 'Tarifa sin especificar'}</p></div>
                                <div><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{contract.supplyLabel}</p><p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">Desde {formatDate(contract.startDate)}</p></div>
                                <p className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300"><CalendarClock aria-hidden="true" size={14} />{contract.permanenceStatus === 'known' ? `Hasta ${formatDate(contract.endDate)}` : contract.permanenceStatus === 'none' ? 'Sin permanencia' : 'Permanencia sin confirmar'}</p>
                            </div>
                        ))}
                    </div>
                ) : <Empty text="No hay contratos registrados." />}
            </section>

            <section className="border-b border-slate-200 py-7 dark:border-slate-800">
                <SectionHeading icon={History} title="Historial comercial" count={record.history.length || undefined} />
                {record.history.length ? <OpportunityList items={record.history} /> : <Empty text="Todavía no hay oportunidades cerradas." />}
            </section>

            <section className="border-b border-slate-200 py-7 dark:border-slate-800">
                <SectionHeading icon={FileText} title="Documentos" count={record.documents.length || undefined} />
                {record.documents.length ? (
                    <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        {record.documents.map(document => (
                            <div key={document.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div><p className="text-sm font-bold text-slate-950 dark:text-white">{document.name}</p><p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{document.supplyLabel} · {formatDate(document.createdAt)}</p></div>
                                {document.opportunityId ? <Link href={`/dashboard/opportunities/${document.opportunityId}`} className="text-sm font-bold text-indigo-700 hover:underline dark:text-indigo-300">Ver oportunidad</Link> : <span className="text-xs text-slate-500">Sin oportunidad vinculada</span>}
                            </div>
                        ))}
                    </div>
                ) : <Empty text="No hay documentos registrados." />}
            </section>

            <section className="py-7">
                <SectionHeading icon={Clock3} title="Actividad" />
                {record.activities.length ? (
                    <ol className="mt-4 border-l border-slate-300 pl-5 dark:border-slate-700">
                        {record.activities.map(activity => <li key={activity.id} className="relative pb-5 last:pb-0"><span className="absolute -left-[25px] top-1 size-2 rounded-full bg-indigo-700 ring-4 ring-white dark:ring-slate-950" /><p className="text-sm font-semibold text-slate-950 dark:text-white">{activity.description}</p><p className="mt-1 text-xs text-slate-500">{formatDate(activity.createdAt)}</p></li>)}
                    </ol>
                ) : <Empty text="La actividad de relación aparecerá aquí." />}
            </section>

            {editableClient && <CreateClientModal isOpen={editOpen} onClose={() => setEditOpen(false)} onSuccess={() => { setEditOpen(false); router.refresh(); }} clientToEdit={editableClient} />}
        </main>
    );
}

function OpportunityList({ items, showAction = false }: { items: ClientRelationshipRecord['openOpportunities']; showAction?: boolean }) {
    return <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">{items.map(item => <Link key={item.id} href={`/dashboard/opportunities/${item.id}`} className="grid gap-2 py-3 hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center dark:hover:bg-slate-900"><div><p className="text-sm font-bold text-slate-950 dark:text-white">{item.supplyLabel}</p><p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{item.type === 'renewal' ? 'Renovación' : item.type === 'switch' ? 'Cambio de compañía' : 'Nuevo cliente'}</p></div><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{STAGE_LABELS[item.stage] ?? item.stage}</p>{showAction && item.nextActionTitle ? <span className="inline-flex items-center gap-1 text-sm font-bold text-indigo-700 dark:text-indigo-300">{item.nextActionTitle}<ArrowRight aria-hidden="true" size={15} /></span> : <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>}</Link>)}</div>;
}

function SectionHeading({ icon: Icon, title, count }: { icon: typeof Zap; title: string; count?: number }) {
    return <div className="flex items-center gap-2"><Icon aria-hidden="true" size={18} className="text-slate-500" /><h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>{count !== undefined && <span className="text-sm font-semibold text-slate-500">{count}</span>}</div>;
}

function Empty({ text }: { text: string }) {
    return <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{text}</p>;
}
