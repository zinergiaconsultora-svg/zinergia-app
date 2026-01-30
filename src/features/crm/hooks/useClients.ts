import { useState, useEffect } from 'react';
import { crmService } from '@/services/crmService';
import { Client } from '@/types/crm';

export function useClients(initialData?: Client[]) {
    const [clients, setClients] = useState<Client[]>(initialData || []);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState<Error | null>(null);

    const loadClients = async () => {
        try {
            setLoading(true);
            const data = await crmService.getClients();
            setClients(data);
        } catch (err) {
            setError(err as Error);
            console.error('Error loading clients:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!initialData) {
            loadClients();
        }
    }, [initialData]);

    return { clients, loading, error, refresh: loadClients };
}
