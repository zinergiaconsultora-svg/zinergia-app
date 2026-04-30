import { getRgpdStatsAction } from '@/app/actions/rgpd';
import RgpdPanel from '@/features/admin/components/RgpdPanel';

export const metadata = { title: 'RGPD — Zinergia Admin' };

export default async function RgpdPage() {
    const stats = await getRgpdStatsAction();
    return <RgpdPanel stats={stats} />;
}
