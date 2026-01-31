import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crmService } from '@/services/crmService';
import { Client, Proposal } from '@/types/crm';

export function useClientDetails(clientId: string) {
    const router = useRouter();
    const [client, setClient] = useState<Client | null>(null);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchClient = useCallback(async () => {
        try {
            setLoading(true);
            const data = await crmService.getClientById(clientId);
            setClient(data);

            const fetchedProposals = await crmService.getProposalsByClient(clientId);
            setProposals(fetchedProposals);
        } catch (err: unknown) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Error al cargar datos del cliente');
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        if (clientId) fetchClient();
    }, [clientId, fetchClient]);

    const handleDeleteClient = async () => {
        setDeleting(true);
        try {
            await crmService.deleteClient(clientId);
            router.push('/dashboard/clients');
        } catch (err: unknown) {
            console.error('Error deleting client:', err);
            setError('Error al eliminar cliente');
            setDeleting(false);
        }
    };

    const handleDeleteProposal = async (id: string) => {
        try {
            await crmService.deleteProposal(id);
            setProposals(prev => prev.filter(p => p.id !== id));
        } catch (err: any) {
            console.error('Error deleting proposal:', err);
            // Optionally set error or handle it via a toast in the UI
            setError('Error al eliminar la propuesta');
        }
    };

    return {
        client,
        proposals,
        loading,
        deleting,
        error,
        refresh: fetchClient,
        handleDeleteClient,
        handleDeleteProposal
    };
}
