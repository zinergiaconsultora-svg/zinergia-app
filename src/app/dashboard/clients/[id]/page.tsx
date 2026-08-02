import { notFound } from 'next/navigation';
import { getClientByIdAction, getClientRelationshipAction } from '@/app/actions/clients';
import ClientRelationshipView from '@/features/crm/components/ClientRelationshipView';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [record, client] = await Promise.all([
        getClientRelationshipAction(id),
        getClientByIdAction(id),
    ]);

    if (!record || !client) notFound();

    return <ClientRelationshipView record={record} editableClient={client} />;
}
