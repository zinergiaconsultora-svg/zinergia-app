'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireServerRole } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { InvoiceStatus, PaymentMethod, UserRole } from '@/types/crm';

type RpcError = { message: string } | null;
type FiscalRpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }>;

const uuid = z.uuid();
const transitionReason = z.string().trim().min(3).max(500);
const fiscalProfileSchema = z.object({
    nif_cif: z.string().trim().toUpperCase().regex(
        /^(\d{8}[A-Z]|[A-Z]\d{7}[A-Z0-9]|[A-Z]{2}\d{6}[A-Z0-9])$/,
        'NIF/CIF no válido',
    ),
    fiscal_address: z.string().trim().min(3).max(240),
    fiscal_city: z.string().trim().min(2).max(120),
    fiscal_province: z.string().trim().min(2).max(120),
    fiscal_postal_code: z.string().trim().min(3).max(16),
    fiscal_country: z.string().trim().min(2).max(80).default('España'),
    iban: z.string().transform((value) => value.replace(/\s/g, '').toUpperCase())
        .refine((value) => /^[A-Z]{2}\d{22}$/.test(value), 'IBAN no válido'),
    company_name: z.string().trim().max(160).optional(),
    company_type: z.enum(['autonomo', 'sociedad_limitada', 'sociedad_anonima', 'cooperativa', 'otros']).optional(),
    retention_percent: z.coerce.number().min(0).max(100).default(0),
    invoice_tax_percent: z.coerce.number().min(0).max(100),
    invoice_prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,12}$/, 'Prefijo no válido'),
});

const createDraftSchema = z.object({
    commercialId: uuid,
    commissionIds: z.array(uuid).min(1).max(100).refine(
        (ids) => new Set(ids).size === ids.length,
        'No se puede incluir dos veces la misma comisión.',
    ),
});

const fiscalOrganizationSchema = z.object({
    legalName: z.string().trim().min(2).max(160),
    nif: z.string().trim().min(3).max(32),
    fiscalAddress: z.string().trim().min(3).max(240),
    fiscalCity: z.string().trim().min(2).max(120),
    fiscalPostalCode: z.string().trim().min(3).max(16),
    fiscalCountry: z.string().trim().min(2).max(80).default('España'),
});

const selfBillingProposalSchema = z.object({
    commercialId: uuid,
    reference: z.string().trim().min(3).max(120),
    scope: z.string().trim().min(3).max(500),
});

const fiscalAdminSetupSchema = z.object({
    organization: z.object({
        id: uuid,
        legal_name: z.string(),
        nif: z.string(),
        fiscal_address: z.string(),
        fiscal_city: z.string(),
        fiscal_postal_code: z.string(),
        fiscal_country: z.string(),
    }).nullable(),
    agreements: z.array(z.object({
        id: uuid,
        commercialId: uuid,
        commercialName: z.string(),
        reference: z.string(),
        scope: z.string(),
        proposedAt: z.string(),
        acceptedAt: z.string().nullable(),
        revokedAt: z.string().nullable(),
        revocationReason: z.string().nullable(),
    })),
});

const selfBillingStatusSchema = z.object({
    id: uuid,
    reference: z.string(),
    scope: z.string(),
    proposedAt: z.string(),
    acceptedAt: z.string().nullable(),
}).nullable();

async function getActor(allowed: UserRole[]) {
    await requireServerRole(allowed);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');
    return user.id;
}

function fiscalRpc(): FiscalRpc {
    const service = createServiceClient();
    return service.rpc.bind(service) as unknown as FiscalRpc;
}

function databaseActionError(error: RpcError, fallback: string) {
    if (!error) return fallback;
    if (error.message.includes('fiscal configuration incomplete')) {
        return 'Completa y verifica los datos fiscales antes de facturar.';
    }
    if (error.message.includes('accepted self-billing agreement required')) {
        return 'El acuerdo de autofacturación todavía no está aceptado.';
    }
    if (error.message.includes('commissions are not eligible')) {
        return 'Alguna comisión ya no está disponible o requiere conciliación.';
    }
    return fallback;
}

function refreshInvoicing(invoiceId?: string) {
    revalidatePath('/dashboard/invoicing');
    revalidatePath('/dashboard/commissions');
    revalidatePath('/admin/commissions');
    if (invoiceId) revalidatePath(`/dashboard/invoicing/${invoiceId}`);
}

export async function updateFiscalProfileAction(formData: FormData) {
    const actorId = await getActor(['admin', 'franchise', 'agent']);
    const parsed = fiscalProfileSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    const { error } = await createServiceClient()
        .from('profiles')
        .update({
            ...parsed.data,
            fiscal_verified: false,
            fiscal_verified_at: null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', actorId);

    if (error) return { success: false, error: 'No se pudieron guardar los datos fiscales.' };
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/invoicing');
    return { success: true };
}

export async function verifyFiscalProfileAction(userId: string) {
    await getActor(['admin']);
    const parsed = uuid.safeParse(userId);
    if (!parsed.success) return { success: false, error: 'Perfil no válido.' };

    const { error } = await createServiceClient()
        .from('profiles')
        .update({ fiscal_verified: true, fiscal_verified_at: new Date().toISOString() })
        .eq('id', parsed.data);

    if (error) return { success: false, error: 'No se pudo verificar el perfil fiscal.' };
    refreshInvoicing();
    revalidatePath('/dashboard/settings');
    return { success: true };
}

export async function createFiscalInvoiceDraftAction(input: {
    commercialId: string;
    commissionIds: string[];
}) {
    const actorId = await getActor(['admin', 'franchise', 'agent']);
    const parsed = createDraftSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    const { data, error } = await fiscalRpc()('create_commission_invoice_draft', {
        p_commercial_id: parsed.data.commercialId,
        p_commission_ids: parsed.data.commissionIds,
        p_actor_id: actorId,
    });
    if (error) return { success: false, error: databaseActionError(error, 'No se pudo crear el borrador fiscal.') };

    const invoiceId = String(data);
    refreshInvoicing(invoiceId);
    return { success: true, invoiceId };
}

export async function generateInvoiceAction(formData: FormData) {
    const actorId = await getActor(['admin', 'franchise', 'agent']);
    let commissionIds: unknown = [];
    try {
        commissionIds = JSON.parse(String(formData.get('commission_ids') ?? '[]'));
    } catch {
        return { success: false, error: 'Selección de comisiones no válida.' };
    }
    const parsed = z.array(uuid).min(1).max(100).safeParse(commissionIds);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    const { data, error } = await fiscalRpc()('create_commission_invoice_draft', {
        p_commercial_id: actorId,
        p_commission_ids: parsed.data,
        p_actor_id: actorId,
    });
    if (error) return { success: false, error: databaseActionError(error, 'No se pudo crear el borrador fiscal.') };
    const invoiceId = String(data);
    refreshInvoicing(invoiceId);
    return { success: true, invoiceId };
}

export async function acceptSelfBilledInvoiceAction(invoiceId: string) {
    const actorId = await getActor(['admin', 'franchise', 'agent']);
    const parsed = uuid.safeParse(invoiceId);
    if (!parsed.success) return { success: false, error: 'Factura no válida.' };
    const { error } = await fiscalRpc()('accept_self_billed_invoice', {
        p_invoice_id: parsed.data,
        p_actor_id: actorId,
    });
    if (error) return { success: false, error: 'No se pudo aceptar la autofactura.' };
    refreshInvoicing(parsed.data);
    return { success: true };
}

export async function configureFiscalOrganizationAction(input: z.input<typeof fiscalOrganizationSchema>) {
    const actorId = await getActor(['admin']);
    const parsed = fiscalOrganizationSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    const { error } = await fiscalRpc()('configure_fiscal_organization', {
        p_actor_id: actorId,
        p_legal_name: parsed.data.legalName,
        p_nif: parsed.data.nif,
        p_fiscal_address: parsed.data.fiscalAddress,
        p_fiscal_city: parsed.data.fiscalCity,
        p_fiscal_postal_code: parsed.data.fiscalPostalCode,
        p_fiscal_country: parsed.data.fiscalCountry,
    });
    if (error) return { success: false, error: 'No se pudo guardar la entidad fiscal.' };
    refreshInvoicing();
    return { success: true };
}

export async function proposeSelfBillingAgreementAction(input: z.input<typeof selfBillingProposalSchema>) {
    const actorId = await getActor(['admin']);
    const parsed = selfBillingProposalSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    const { error } = await fiscalRpc()('propose_self_billing_agreement', {
        p_commercial_id: parsed.data.commercialId,
        p_actor_id: actorId,
        p_agreement_reference: parsed.data.reference,
        p_scope_description: parsed.data.scope,
    });
    if (error) return { success: false, error: 'No se pudo proponer el acuerdo.' };
    refreshInvoicing();
    return { success: true };
}

export async function acceptSelfBillingAgreementAction(agreementId: string) {
    const actorId = await getActor(['admin', 'franchise', 'agent']);
    const parsed = uuid.safeParse(agreementId);
    if (!parsed.success) return { success: false, error: 'Acuerdo no válido.' };
    const { error } = await fiscalRpc()('accept_self_billing_agreement', {
        p_agreement_id: parsed.data,
        p_actor_id: actorId,
    });
    if (error) return { success: false, error: 'No se pudo aceptar el acuerdo.' };
    refreshInvoicing();
    return { success: true };
}

export async function revokeSelfBillingAgreementAction(agreementId: string, reason: string) {
    const actorId = await getActor(['admin', 'franchise', 'agent']);
    const parsed = z.object({ agreementId: uuid, reason: transitionReason }).safeParse({ agreementId, reason });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    const { error } = await fiscalRpc()('revoke_self_billing_agreement', {
        p_agreement_id: parsed.data.agreementId,
        p_actor_id: actorId,
        p_reason: parsed.data.reason,
    });
    if (error) return { success: false, error: 'No se pudo revocar el acuerdo.' };
    refreshInvoicing();
    return { success: true };
}

export async function getFiscalAdminSetupAction() {
    const actorId = await getActor(['admin']);
    const { data, error } = await fiscalRpc()('get_fiscal_admin_setup', { p_actor_id: actorId });
    if (error) throw new Error('No se pudo cargar la configuración fiscal.');
    return fiscalAdminSetupSchema.parse(data);
}

export type FiscalAdminSetup = Awaited<ReturnType<typeof getFiscalAdminSetupAction>>;

async function transitionInvoice(
    invoiceId: string,
    toStatus: 'issued' | 'cancelled' | 'paid',
    reason: string,
    paymentMethod?: PaymentMethod,
    paymentReference?: string,
) {
    const allowed: UserRole[] = toStatus === 'paid' ? ['admin'] : ['admin', 'franchise', 'agent'];
    const actorId = await getActor(allowed);
    const parsed = z.object({ invoiceId: uuid, reason: transitionReason }).safeParse({ invoiceId, reason });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    const { error } = await fiscalRpc()('transition_fiscal_invoice', {
        p_invoice_id: parsed.data.invoiceId,
        p_to_status: toStatus,
        p_actor_id: actorId,
        p_reason: parsed.data.reason,
        p_payment_method: paymentMethod ?? null,
        p_payment_reference: paymentReference?.trim() || null,
    });
    if (error) return { success: false, error: `No se pudo marcar la factura como ${toStatus}.` };
    refreshInvoicing(parsed.data.invoiceId);
    return { success: true };
}

export async function issueInvoiceAction(invoiceId: string, reason = 'Emisión confirmada por el emisor') {
    return transitionInvoice(invoiceId, 'issued', reason);
}

export async function markInvoicePaidAction(
    invoiceId: string,
    paymentMethod: PaymentMethod,
    reference?: string,
    reason = 'Pago conciliado por administración',
) {
    return transitionInvoice(invoiceId, 'paid', reason, paymentMethod, reference);
}

export async function cancelInvoiceAction(invoiceId: string, reason = 'Borrador anulado antes de emisión') {
    return transitionInvoice(invoiceId, 'cancelled', reason);
}

async function loadEligibleCommissions(actorId: string) {
    const { data, error } = await createServiceClient()
        .from('network_commissions')
        .select(`
            id, proposal_id, commercial_net_amount, total_reversed_commercial, created_at,
            proposals (client_id, clients(name), offer_snapshot)
        `)
        .eq('agent_id', actorId)
        .eq('lifecycle_status', 'validated')
        .eq('reconciliation_status', 'ready')
        .is('invoice_id', null)
        .order('created_at', { ascending: false });
    if (error) throw new Error('No se pudieron cargar las comisiones facturables.');

    return (data ?? []).map((commission) => ({
        ...commission,
        agent_commission: Math.max(
            0,
            Number(commission.commercial_net_amount ?? 0) - Number(commission.total_reversed_commercial ?? 0),
        ),
    }));
}

async function loadInvoices(actorId: string, isAdmin: boolean, filters?: {
    status?: InvoiceStatus;
    limit?: number;
    offset?: number;
}) {
    const service = createServiceClient();
    let query = service
        .from('invoices')
        .select('*, profiles:agent_id(full_name, email)')
        .neq('document_kind', 'legacy_unverified')
        .order('created_at', { ascending: false });
    if (!isAdmin) query = query.eq('agent_id', actorId);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.limit) {
        const offset = filters.offset ?? 0;
        query = query.range(offset, offset + filters.limit - 1);
    }
    const { data, error } = await query;
    if (error) throw new Error('No se pudieron cargar las facturas.');
    return data ?? [];
}

export async function getUninvoicedCommissionsAction() {
    const actorId = await getActor(['admin', 'franchise', 'agent']);
    return loadEligibleCommissions(actorId);
}

export async function getIssuedInvoicesAction(filters?: {
    status?: InvoiceStatus;
    limit?: number;
    offset?: number;
}) {
    const actorId = await getActor(['admin', 'franchise', 'agent']);
    const server = await createClient();
    const { data: profile } = await server.from('profiles').select('role').eq('id', actorId).maybeSingle();
    return loadInvoices(actorId, profile?.role === 'admin', filters);
}

export async function getInvoiceStatsAction() {
    const invoices = await getIssuedInvoicesAction({ limit: 500 });
    return {
        total: invoices.length,
        draft: invoices.filter((invoice) => invoice.status === 'draft').length,
        issued: invoices.filter((invoice) => invoice.status === 'issued').length,
        paid: invoices.filter((invoice) => invoice.status === 'paid').length,
        totalAmount: invoices
            .filter((invoice) => invoice.status === 'paid')
            .reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0),
    };
}

export async function getInvoicingWorkspaceAction() {
    const actorId = await getActor(['admin', 'franchise', 'agent']);
    const server = await createClient();
    const { data: profile, error: profileError } = await server
        .from('profiles')
        .select('role, fiscal_verified, invoice_tax_percent, nif_cif, fiscal_address, fiscal_city, fiscal_postal_code, iban')
        .eq('id', actorId)
        .maybeSingle();
    if (profileError || !profile) throw new Error('No se pudo cargar la configuración fiscal.');

    const [invoices, commissions, agreementResult] = await Promise.all([
        loadInvoices(actorId, profile.role === 'admin', { limit: 500 }),
        loadEligibleCommissions(actorId),
        fiscalRpc()('get_my_self_billing_status', { p_actor_id: actorId }),
    ]);
    if (agreementResult.error) throw new Error('No se pudo cargar el acuerdo de autofacturación.');
    const selfBillingAgreement = selfBillingStatusSchema.parse(agreementResult.data);
    const missingFiscalFields = [
        ['NIF/CIF', profile.nif_cif],
        ['Dirección fiscal', profile.fiscal_address],
        ['Ciudad', profile.fiscal_city],
        ['Código postal', profile.fiscal_postal_code],
        ['IBAN', profile.iban],
        ['IVA', profile.invoice_tax_percent],
        ['Verificación fiscal', profile.fiscal_verified],
    ].filter(([, value]) => value === null || value === undefined || value === false || value === '')
        .map(([label]) => String(label));

    return {
        actorId,
        role: profile.role as UserRole,
        invoices,
        commissions,
        selfBillingAgreement,
        missingFiscalFields,
        stats: {
            total: invoices.length,
            draft: invoices.filter((invoice) => invoice.status === 'draft').length,
            issued: invoices.filter((invoice) => invoice.status === 'issued').length,
            paid: invoices.filter((invoice) => invoice.status === 'paid').length,
            totalAmount: invoices
                .filter((invoice) => invoice.status === 'paid')
                .reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0),
        },
    };
}

export type InvoicingWorkspaceData = Awaited<ReturnType<typeof getInvoicingWorkspaceAction>>;
