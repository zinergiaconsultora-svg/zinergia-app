import { getInvoicingWorkspaceAction } from '@/app/actions/invoicing';
import { FiscalInvoicingWorkspace } from '@/features/commissions/components/FiscalInvoicingWorkspace';

export default async function InvoicingPage() {
    const data = await getInvoicingWorkspaceAction();
    return <FiscalInvoicingWorkspace data={data} />;
}
