import { createClient } from '@/lib/supabase/client';
import { Invoice, InvoiceLine, InvoiceStatus, InvoiceWithAgent, PaymentMethod } from '@/types/crm';
import { profileFiscalService } from './profileFiscal';

const ISSUER_DATA = {
    name: 'Zinergia Consultora Energética S.L.',
    nif: 'B-12345678',
    address: 'C/ Gran Vía 45, 3ºA',
    city: 'Madrid',
    postal_code: '28013'
};

interface CommissionBase {
    id: string;
    proposal_id: string;
    agent_commission: number;
    proposals?: {
        client_id: string;
        clients?: { name: string }[] | { name: string };
        offer_snapshot?: { marketer_name?: string } | { marketer_name?: string }[];
    };
}

interface CommissionRow extends CommissionBase {
    total_revenue: number;
    created_at: string;
}

export const invoiceService = {

    async getUninvoicedCommissions(): Promise<CommissionRow[]> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('network_commissions')
            .select(`
                id,
                proposal_id,
                agent_commission,
                total_revenue,
                created_at,
                proposals (
                    client_id,
                    current_annual_cost,
                    offer_annual_cost,
                    annual_savings,
                    clients ( name ),
                    offer_snapshot
                )
            `)
            .eq('agent_id', user.id)
            .eq('status', 'cleared')
            .eq('invoiced', false)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[invoiceService] Error fetching uninvoiced:', error);
            return [];
        }
        return (data || []) as unknown as CommissionRow[];
    },

    async generateInvoice(commissionIds: string[]): Promise<{ success: boolean; invoice?: Invoice; error?: string }> {
        if (commissionIds.length === 0) {
            return { success: false, error: 'Selecciona al menos una comisión' };
        }

        const readiness = await profileFiscalService.getFiscalReadiness();
        if (!readiness.ready) {
            return { success: false, error: `Faltan datos fiscales: ${readiness.missing.join(', ')}` };
        }

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'No autenticado' };

        const fiscalProfile = await profileFiscalService.getFiscalProfile();
        if (!fiscalProfile) return { success: false, error: 'Perfil fiscal no encontrado' };

        const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, franchise_id, invoice_prefix')
            .eq('id', user.id)
            .single();

        const { data: commissions } = await supabase
            .from('network_commissions')
            .select(`
                id,
                proposal_id,
                agent_commission,
                proposals (
                    client_id,
                    offer_snapshot,
                    clients ( name )
                )
            `)
            .in('id', commissionIds)
            .eq('agent_id', user.id);

        if (!commissions || commissions.length === 0) {
            return { success: false, error: 'No se encontraron las comisiones' };
        }

        const invoiceLines: InvoiceLine[] = (commissions as unknown as CommissionBase[]).map((c) => {
            const clientRaw = c.proposals?.clients;
            const clientName = (Array.isArray(clientRaw) ? clientRaw[0]?.name : clientRaw?.name) || 'Cliente';
            const offerRaw = c.proposals?.offer_snapshot;
            const marketer = (Array.isArray(offerRaw) ? offerRaw[0]?.marketer_name : offerRaw?.marketer_name) || 'Comercializadora';
            const baseAmount = c.agent_commission || 0;
            const retention = baseAmount * ((fiscalProfile.retention_percent || 0) / 100);

            return {
                description: `Comisión ${marketer} - ${clientName}`,
                commission_id: c.id,
                client_name: clientName,
                proposal_id: c.proposal_id,
                marketer_name: marketer,
                base_amount: baseAmount,
                retention: Math.round(retention * 100) / 100,
                total_line: Math.round((baseAmount - retention) * 100) / 100
            };
        });

        const subtotal = invoiceLines.reduce((sum, l) => sum + l.base_amount, 0);
        const retentionTotal = invoiceLines.reduce((sum, l) => sum + l.retention, 0);
        const taxBase = subtotal - retentionTotal;
        const taxPercent = 21;
        const taxAmount = Math.round(taxBase * (taxPercent / 100) * 100) / 100;
        const total = Math.round((taxBase + taxAmount) * 100) / 100;

        const { data: invoiceNumberData, error: rpcError } = await supabase
            .rpc('generate_invoice_number', { p_agent_id: user.id });

        if (rpcError || !invoiceNumberData) {
            return { success: false, error: 'Error generando número de factura' };
        }

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        const recipientName = fiscalProfile.company_name || profileData?.full_name || 'N/A';

        const { data: invoice, error: insertError } = await supabase
            .from('invoices')
            .insert({
                invoice_number: invoiceNumberData,
                agent_id: user.id,
                franchise_id: profileData?.franchise_id,

                issuer_name: ISSUER_DATA.name,
                issuer_nif: ISSUER_DATA.nif,
                issuer_address: ISSUER_DATA.address,
                issuer_city: ISSUER_DATA.city,
                issuer_postal_code: ISSUER_DATA.postal_code,

                recipient_name: recipientName,
                recipient_nif: fiscalProfile.nif_cif!,
                recipient_address: fiscalProfile.fiscal_address,
                recipient_city: fiscalProfile.fiscal_city,
                recipient_postal_code: fiscalProfile.fiscal_postal_code,

                issue_date: new Date().toISOString().split('T')[0],
                due_date: dueDate.toISOString().split('T')[0],

                invoice_lines: invoiceLines,
                subtotal,
                retention_total: retentionTotal,
                retention_percent: fiscalProfile.retention_percent || 0,
                tax_base: taxBase,
                tax_type: 'IVA',
                tax_percent: taxPercent,
                tax_amount: taxAmount,
                total,
                status: 'draft'
            })
            .select()
            .single();

        if (insertError) {
            console.error('[invoiceService] Error creating invoice:', insertError);
            return { success: false, error: insertError.message };
        }

        await supabase
            .from('network_commissions')
            .update({ invoiced: true, invoice_id: invoice.id })
            .in('id', commissionIds);

        return { success: true, invoice: invoice as Invoice };
    },

    async getInvoices(filters?: { status?: InvoiceStatus; limit?: number; offset?: number }): Promise<InvoiceWithAgent[]> {
        const supabase = createClient();
        let query = supabase
            .from('invoices')
            .select('*, profiles:agent_id(full_name, email)')
            .order('created_at', { ascending: false });

        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.limit) query = query.limit(filters.limit);
        if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);

        const { data, error } = await query;
        if (error) {
            console.error('[invoiceService] Error fetching invoices:', error);
            return [];
        }
        return (data || []) as InvoiceWithAgent[];
    },

    async getInvoice(id: string): Promise<Invoice | null> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return data as Invoice;
    },

    async issueInvoice(id: string): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();
        const { error } = await supabase
            .from('invoices')
            .update({ status: 'issued' })
            .eq('id', id)
            .in('status', ['draft']);

        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    async markAsPaid(id: string, paymentMethod: PaymentMethod, reference?: string): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();
        const { error } = await supabase
            .from('invoices')
            .update({
                status: 'paid',
                paid_date: new Date().toISOString().split('T')[0],
                payment_method: paymentMethod,
                payment_reference: reference
            })
            .eq('id', id);

        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    async cancelInvoice(id: string): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        const { data: invoice } = await supabase
            .from('invoices')
            .select('invoice_lines')
            .eq('id', id)
            .single();

        if (invoice?.invoice_lines) {
            const commissionIds = (invoice.invoice_lines as InvoiceLine[]).map(l => l.commission_id);
            await supabase
                .from('network_commissions')
                .update({ invoiced: false, invoice_id: null })
                .in('id', commissionIds);
        }

        const { error } = await supabase
            .from('invoices')
            .update({ status: 'cancelled' })
            .eq('id', id);

        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    async getInvoiceStats(): Promise<{ total: number; draft: number; issued: number; paid: number; totalAmount: number }> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('invoices')
            .select('status, total');

        if (error || !data) return { total: 0, draft: 0, issued: 0, paid: 0, totalAmount: 0 };

        return {
            total: data.length,
            draft: data.filter(i => i.status === 'draft').length,
            issued: data.filter(i => i.status === 'issued').length,
            paid: data.filter(i => i.status === 'paid').length,
            totalAmount: data.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0)
        };
    }
};