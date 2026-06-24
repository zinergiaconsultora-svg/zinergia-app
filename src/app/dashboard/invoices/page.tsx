import InvoiceRegistryView from '@/features/invoices/components/InvoiceRegistryView';
import { getInvoicesAction } from '@/app/actions/invoices';
import { getUserRole } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
    // RLS (security_invoker on invoice_registry) scopes rows to the session.
    // Only an admin can close a lead (mark the accepted-offer check → CLIENTE).
    const [invoices, role] = await Promise.all([getInvoicesAction(20, 0), getUserRole()]);

    return <InvoiceRegistryView initialData={invoices} isAdmin={role === 'admin'} />;
}
