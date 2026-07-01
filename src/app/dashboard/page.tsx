import { getUserRole } from '@/lib/auth/permissions'
import DashboardView from '@/features/crm/components/DashboardView'
import FranchiseDashboard from '@/features/franchise/components/FranchiseDashboard'
import { ClientDocumentRedirect } from '@/components/ClientDocumentRedirect'

export default async function DashboardPage() {
    const role = await getUserRole()
    if (role === 'admin') return <ClientDocumentRedirect to="/admin" />
    if (role === 'franchise') return <FranchiseDashboard />
    return <DashboardView />
}
