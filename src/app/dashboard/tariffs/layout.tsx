import { requireRouteRole } from '@/lib/auth/permissions'

export default async function TariffsLayout({ children }: { children: React.ReactNode }) {
    await requireRouteRole(['admin', 'franchise'])
    return <>{children}</>
}
