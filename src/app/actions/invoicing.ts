'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { profileFiscalService } from '@/services/crm/profileFiscal';
import { invoiceService } from '@/services/crm/invoices';
import { PaymentMethod, InvoiceStatus } from '@/types/crm';
import { requireServerRole } from '@/lib/auth/permissions';

const fiscalProfileSchema = z.object({
    nif_cif: z.string().min(1, 'NIF/CIF obligatorio'),
    fiscal_address: z.string().min(1, 'Dirección obligatoria'),
    fiscal_city: z.string().min(1, 'Ciudad obligatoria'),
    fiscal_province: z.string().min(1, 'Provincia obligatoria'),
    fiscal_postal_code: z.string().min(1, 'Código postal obligatorio'),
    fiscal_country: z.string().default('España'),
    iban: z.string().min(1, 'IBAN obligatorio'),
    company_name: z.string().optional(),
    company_type: z.enum(['autonomo', 'sociedad_limitada', 'sociedad_anonima', 'cooperativa', 'otros']).optional(),
    retention_percent: z.coerce.number().min(0).max(100).default(0),
    invoice_prefix: z.string().default('FAC'),
});

export async function updateFiscalProfileAction(formData: FormData) {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const rawData: Record<string, string> = {};
    formData.forEach((value, key) => {
        rawData[key] = value as string;
    });

    const parsed = fiscalProfileSchema.safeParse(rawData);
    if (!parsed.success) {
        const firstError = parsed.error.issues[0];
        return { success: false, error: firstError.message };
    }

    const result = await profileFiscalService.updateFiscalProfile(parsed.data);

    if (result.success) {
        revalidatePath('/dashboard/settings');
    }

    return result;
}

export async function verifyFiscalProfileAction(userId: string) {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const result = await profileFiscalService.verifyFiscalProfile(userId);
    if (result.success) {
        revalidatePath('/dashboard/invoicing');
        revalidatePath('/dashboard/settings');
    }
    return result;
}

const generateInvoiceSchema = z.object({
    commission_ids: z.array(z.string().uuid()).min(1, 'Selecciona al menos una comisión'),
});

export async function generateInvoiceAction(formData: FormData) {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const commissionIdsRaw = formData.get('commission_ids') as string;
    const commissionIds = JSON.parse(commissionIdsRaw || '[]') as string[];

    const parsed = generateInvoiceSchema.safeParse({ commission_ids: commissionIds });
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const result = await invoiceService.generateInvoice(parsed.data.commission_ids);

    if (result.success) {
        revalidatePath('/dashboard/invoicing');
    }

    return result;
}

export async function issueInvoiceAction(invoiceId: string) {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const result = await invoiceService.issueInvoice(invoiceId);
    if (result.success) {
        revalidatePath('/dashboard/invoicing');
        revalidatePath(`/dashboard/invoicing/${invoiceId}`);
    }
    return result;
}

export async function markInvoicePaidAction(invoiceId: string, paymentMethod: PaymentMethod, reference?: string) {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const result = await invoiceService.markAsPaid(invoiceId, paymentMethod, reference);
    if (result.success) {
        revalidatePath('/dashboard/invoicing');
        revalidatePath(`/dashboard/invoicing/${invoiceId}`);
    }
    return result;
}

export async function cancelInvoiceAction(invoiceId: string) {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const result = await invoiceService.cancelInvoice(invoiceId);
    if (result.success) {
        revalidatePath('/dashboard/invoicing');
        revalidatePath(`/dashboard/invoicing/${invoiceId}`);
    }
    return result;
}

export async function getUninvoicedCommissionsAction() {
    await requireServerRole(['admin', 'franchise', 'agent']);
    return invoiceService.getUninvoicedCommissions();
}

export async function getInvoicesAction(filters?: { status?: InvoiceStatus; limit?: number; offset?: number }) {
    await requireServerRole(['admin', 'franchise', 'agent']);
    return invoiceService.getInvoices(filters);
}

export async function getInvoiceStatsAction() {
    await requireServerRole(['admin', 'franchise', 'agent']);
    return invoiceService.getInvoiceStats();
}