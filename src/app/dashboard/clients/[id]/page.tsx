import ClientDetailsView from '@/features/crm/components/ClientDetailsView';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <ClientDetailsView clientId={id} />;
}
