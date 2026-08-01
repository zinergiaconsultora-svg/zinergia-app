'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, FileSignature, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
    configureFiscalOrganizationAction,
    proposeSelfBillingAgreementAction,
    revokeSelfBillingAgreementAction,
    type FiscalAdminSetup,
} from '@/app/actions/invoicing';
import type { CommissionCommercialSummary } from '@/app/actions/commissionManagement';

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100';
const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700';

export function FiscalAdministrationPanel({
    data,
    commercials,
}: {
    data: FiscalAdminSetup;
    commercials: CommissionCommercialSummary[];
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [organization, setOrganization] = useState({
        legalName: data.organization?.legal_name ?? '',
        nif: data.organization?.nif ?? '',
        fiscalAddress: data.organization?.fiscal_address ?? '',
        fiscalCity: data.organization?.fiscal_city ?? '',
        fiscalPostalCode: data.organization?.fiscal_postal_code ?? '',
        fiscalCountry: data.organization?.fiscal_country ?? 'España',
    });
    const [commercialId, setCommercialId] = useState('');
    const [reference, setReference] = useState('');
    const [scope, setScope] = useState('Comisiones energéticas gestionadas por Zinergia');
    const [revokingAgreementId, setRevokingAgreementId] = useState<string | null>(null);
    const [revocationReason, setRevocationReason] = useState('');

    function saveOrganization() {
        startTransition(async () => {
            const result = await configureFiscalOrganizationAction(organization);
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            toast.success('Entidad fiscal guardada.');
            router.refresh();
        });
    }

    function proposeAgreement() {
        startTransition(async () => {
            const result = await proposeSelfBillingAgreementAction({ commercialId, reference, scope });
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            toast.success('Acuerdo enviado al comercial.');
            setCommercialId('');
            setReference('');
            router.refresh();
        });
    }

    function revokeAgreement() {
        if (!revokingAgreementId || revocationReason.trim().length < 3) return;
        startTransition(async () => {
            const result = await revokeSelfBillingAgreementAction(revokingAgreementId, revocationReason.trim());
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            toast.success('Acuerdo revocado.');
            setRevokingAgreementId(null);
            setRevocationReason('');
            router.refresh();
        });
    }

    return (
        <div className="grid gap-8 pt-7 lg:grid-cols-2">
            <section aria-labelledby="fiscal-organization-title" className="border-b border-slate-200 pb-8 lg:border-b-0 lg:border-r lg:pr-8">
                <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-indigo-700" />
                    <h2 id="fiscal-organization-title" className="text-lg font-bold text-slate-950">Entidad fiscal Zinergia</h2>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Razón social" value={organization.legalName} onChange={(legalName) => setOrganization({ ...organization, legalName })} />
                    <Field label="NIF" value={organization.nif} onChange={(nif) => setOrganization({ ...organization, nif: nif.toUpperCase() })} />
                    <div className="sm:col-span-2"><Field label="Dirección fiscal" value={organization.fiscalAddress} onChange={(fiscalAddress) => setOrganization({ ...organization, fiscalAddress })} /></div>
                    <Field label="Ciudad" value={organization.fiscalCity} onChange={(fiscalCity) => setOrganization({ ...organization, fiscalCity })} />
                    <Field label="Código postal" value={organization.fiscalPostalCode} onChange={(fiscalPostalCode) => setOrganization({ ...organization, fiscalPostalCode })} />
                    <Field label="País" value={organization.fiscalCountry} onChange={(fiscalCountry) => setOrganization({ ...organization, fiscalCountry })} />
                </div>
                <button type="button" onClick={saveOrganization} disabled={pending} className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar entidad
                </button>
            </section>

            <section aria-labelledby="self-billing-title">
                <div className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5 text-indigo-700" />
                    <h2 id="self-billing-title" className="text-lg font-bold text-slate-950">Autofacturación</h2>
                </div>
                <div className="mt-5 grid gap-4">
                    <div>
                        <label className={labelClass} htmlFor="self-billing-commercial">Comercial</label>
                        <select id="self-billing-commercial" value={commercialId} onChange={(event) => setCommercialId(event.target.value)} className={inputClass}>
                            <option value="">Seleccionar</option>
                            {commercials.map((commercial) => <option key={commercial.id} value={commercial.id}>{commercial.name}</option>)}
                        </select>
                    </div>
                    <Field label="Referencia del acuerdo" value={reference} onChange={setReference} />
                    <div>
                        <label className={labelClass} htmlFor="self-billing-scope">Alcance</label>
                        <textarea id="self-billing-scope" value={scope} onChange={(event) => setScope(event.target.value)} rows={3} className="w-full rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" />
                    </div>
                    <button type="button" onClick={proposeAgreement} disabled={pending || !commercialId || !reference.trim()} className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                        Proponer acuerdo
                    </button>
                </div>

                <div className="mt-7 divide-y divide-slate-200 border-t border-slate-200">
                    {data.agreements.map((agreement) => (
                        <div key={agreement.id} className="flex items-center justify-between gap-4 py-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{agreement.commercialName}</p>
                                <p className="text-xs text-slate-500">{agreement.reference} · {agreement.revokedAt ? 'Revocado' : agreement.acceptedAt ? 'Aceptado' : 'Pendiente'}</p>
                            </div>
                            {!agreement.revokedAt && (
                                <button type="button" onClick={() => setRevokingAgreementId(agreement.id)} className="h-8 rounded-md px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50">Revocar</button>
                            )}
                        </div>
                    ))}
                </div>
            </section>
            {revokingAgreementId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="revoke-agreement-title" className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
                        <h3 id="revoke-agreement-title" className="text-base font-bold text-slate-950">Revocar acuerdo</h3>
                        <label htmlFor="revocation-reason" className={`${labelClass} mt-5`}>Motivo</label>
                        <textarea id="revocation-reason" value={revocationReason} onChange={(event) => setRevocationReason(event.target.value)} rows={3} className="w-full rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" autoFocus />
                        <div className="mt-5 flex justify-end gap-2">
                            <button type="button" onClick={() => setRevokingAgreementId(null)} className="h-9 rounded-md px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
                            <button type="button" onClick={revokeAgreement} disabled={pending || revocationReason.trim().length < 3} className="h-9 rounded-md bg-rose-700 px-3 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-45">Confirmar revocación</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    const id = `fiscal-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return (
        <div>
            <label className={labelClass} htmlFor={id}>{label}</label>
            <input id={id} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} required />
        </div>
    );
}
