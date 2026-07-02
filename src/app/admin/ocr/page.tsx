import { getOcrObservabilityAction } from '@/app/actions/ocrObservability';
import OcrObservabilityPanel from '@/features/admin/components/OcrObservabilityPanel';

export const metadata = { title: 'OCR Observability — Zinergia Admin' };

export default async function AdminOcrPage() {
    const metrics = await getOcrObservabilityAction();
    return <OcrObservabilityPanel metrics={metrics} />;
}
