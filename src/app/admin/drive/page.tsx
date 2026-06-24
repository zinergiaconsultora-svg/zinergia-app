import DriveHealthPanel from '@/features/admin/drive/DriveHealthPanel';
import { getDriveHealthAction } from '@/app/actions/driveHealth';

export const dynamic = 'force-dynamic';

export default async function AdminDrivePage() {
    // Admin gate comes from the /admin layout (requireRouteRole(['admin'])).
    const health = await getDriveHealthAction();
    return <DriveHealthPanel health={health} />;
}
