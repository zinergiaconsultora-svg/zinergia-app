import { useState, useEffect, useRef, useCallback } from 'react';
import { getClientsAction, searchClientsAction, getClientKpisAction } from '@/app/actions/clients';
import type { ClientKpis } from '@/app/actions/clients';
import { Client } from '@/types/crm';
import { logger } from '@/lib/utils/logger';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 350;

export function useClients(initialData?: Client[]) {
    const [clients, setClients] = useState<Client[]>(initialData || []);
    const [loading, setLoading] = useState(!initialData);
    const [loadingMore, setLoadingMore] = useState(false);
    const [offset, setOffset] = useState(initialData ? initialData.length : 0);
    const [hasMore, setHasMore] = useState(!initialData || initialData.length === PAGE_SIZE);

    const [searchTerm, setSearchTerm] = useState('');
    const [searching, setSearching] = useState(false);

    const [kpis, setKpis] = useState<ClientKpis>({ total: 0, nuevos: 0, pipelineValue: 0, conversion: 0 });
    const [kpisLoading, setKpisLoading] = useState(true);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestSearchRef = useRef(0);

    const loadClients = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getClientsAction(PAGE_SIZE, 0);
            setClients(data);
            setOffset(data.length);
            setHasMore(data.length === PAGE_SIZE);
        } catch (err) {
            logger.error('Error loading clients:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore || searchTerm) return;
        try {
            setLoadingMore(true);
            const data = await getClientsAction(PAGE_SIZE, offset);
            setClients(prev => [...prev, ...data]);
            setOffset(prev => prev + data.length);
            setHasMore(data.length === PAGE_SIZE);
        } catch (err) {
            logger.error('Error loading more clients:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, offset, searchTerm]);

    const loadKpis = useCallback(async () => {
        try {
            setKpisLoading(true);
            const data = await getClientKpisAction();
            setKpis(data);
        } catch (err) {
            logger.error('Error loading KPIs:', err);
        } finally {
            setKpisLoading(false);
        }
    }, []);

    // Server-side search with debounce
    const search = useCallback((term: string) => {
        setSearchTerm(term);
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!term.trim()) {
            loadClients();
            return;
        }

        debounceRef.current = setTimeout(async () => {
            const seq = ++latestSearchRef.current;
            try {
                setSearching(true);
                const results = await searchClientsAction(term);
                if (seq === latestSearchRef.current) {
                    setClients(results);
                    setHasMore(false);
                }
            } catch (err) {
                logger.error('Error searching clients:', err);
            } finally {
                if (seq === latestSearchRef.current) setSearching(false);
            }
        }, DEBOUNCE_MS);
    }, [loadClients]);

    const refresh = useCallback(async () => {
        setSearchTerm('');
        await Promise.all([loadClients(), loadKpis()]);
    }, [loadClients, loadKpis]);

    useEffect(() => {
        if (!initialData) loadClients();
        loadKpis();
    }, [initialData, loadClients, loadKpis]);

    return {
        clients,
        loading,
        loadingMore,
        hasMore,
        searching,
        searchTerm,
        search,
        refresh,
        loadMore,
        kpis,
        kpisLoading,
    };
}
