import { useState, useEffect } from 'react';
import { crmService } from '@/services/crmService';
import { Client } from '@/types/crm';

const PAGE_SIZE = 20;

export function useClients(initialData?: Client[]) {
    const [clients, setClients] = useState<Client[]>(initialData || []);
    const [loading, setLoading] = useState(!initialData);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [offset, setOffset] = useState(initialData ? initialData.length : 0);
    const [hasMore, setHasMore] = useState(!initialData || initialData.length === PAGE_SIZE);

    const loadClients = async () => {
        try {
            setLoading(true);
            const data = await crmService.getClients(undefined, PAGE_SIZE, 0);
            setClients(data);
            setOffset(data.length);
            setHasMore(data.length === PAGE_SIZE);
        } catch (err) {
            setError(err as Error);
            console.error('Error loading clients:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        if (loadingMore || !hasMore) return;
        try {
            setLoadingMore(true);
            const data = await crmService.getClients(undefined, PAGE_SIZE, offset);
            setClients(prev => [...prev, ...data]);
            setOffset(prev => prev + data.length);
            setHasMore(data.length === PAGE_SIZE);
        } catch (err) {
            setError(err as Error);
            console.error('Error loading more clients:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        if (!initialData) {
            loadClients();
        }
    }, [initialData]);

    return { clients, loading, loadingMore, hasMore, error, refresh: loadClients, loadMore };
}
