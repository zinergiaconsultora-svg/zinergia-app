import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/auth/permissions'
import DashboardView from '@/features/crm/components/DashboardView'

export default async function DashboardPage() {
    const role = await getUserRole()
    if (role === 'admin') redirect('/admin')
    return <DashboardView />
}
