import { getAuditLogAction } from '@/app/actions/auditLog';
import AuditPanel from '@/features/admin/components/AuditPanel';

export const metadata = { title: 'Audit Log — Zinergia Admin' };

export default async function AuditPage() {
    const result = await getAuditLogAction({ limit: 50, offset: 0 });
    return <AuditPanel initialData={result} />;
}
