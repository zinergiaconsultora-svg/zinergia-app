import { useState, useEffect } from 'react';
import { crmService } from '@/services/crmService';
import { Client } from '@/types/crm';

export function useClients() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
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
        loadClients();
    }, []);

    return { clients, loading, error, refresh: loadClients };
}
