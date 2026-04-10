import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/auth/permissions'
import DashboardView from '@/features/crm/components/DashboardView'
import FranchiseDashboard from '@/features/franchise/components/FranchiseDashboard'

export default async function DashboardPage() {
    const role = await getUserRole()
    if (role === 'admin') redirect('/admin')
    if (role === 'franchise') return <FranchiseDashboard />
    return <DashboardView />
}
