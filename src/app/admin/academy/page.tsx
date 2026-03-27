import { getAcademyResourcesAdmin } from '@/app/actions/academy';
import AcademyAdmin from '@/features/admin/components/AcademyAdmin';

export default async function AcademyAdminPage() {
    const resources = await getAcademyResourcesAdmin();
    return <AcademyAdmin initialResources={resources} />;
}
