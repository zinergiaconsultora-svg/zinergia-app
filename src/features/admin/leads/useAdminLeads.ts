import { useState, useCallback } from 'react';
import {
    getAdminLeadsAction,
    type AdminLeadFilters,
    type InvoiceRegistryRow,
} from '@/app/actions/invoices';
import { logger } from '@/lib/utils/logger';

const PAGE_SIZE = 30;
const LOAD_ERROR = 'No se pudieron cargar los leads. Inténtalo de nuevo.';
const LOAD_MORE_ERROR = 'No se pudieron cargar más leads. Inténtalo de nuevo.';

export function useAdminLeads(
    initialData: InvoiceRegistryRow[] = [],
    initialFilters: AdminLeadFilters = { outcome: 'open' },
) {
    const [leads, setLeads] = useState<InvoiceRegistryRow[]>(initialData);
    const [filters, setFilters] = useState<AdminLeadFilters>(initialFilters);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [offset, setOffset] = useState(initialData.length);
    const [hasMore, setHasMore] = useState(initialData.length === PAGE_SIZE);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (f: AdminLeadFilters) => {
        try {
            setError(null);
            setLoading(true);
            const data = await getAdminLeadsAction(f, PAGE_SIZE, 0);
            setLeads(data);
            setOffset(data.length);
            setHasMore(data.length === PAGE_SIZE);
        } catch (err) {
            logger.error('Error loading admin leads:', err);
            setError(LOAD_ERROR);
        } finally {
            setLoading(false);
        }
    }, []);

    const applyFilters = useCallback(
        (patch: Partial<AdminLeadFilters>) => {
            const next = { ...filters, ...patch };
            setFilters(next);
            return load(next);
        },
        [filters, load],
    );

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        try {
            setError(null);
            setLoadingMore(true);
            const data = await getAdminLeadsAction(filters, PAGE_SIZE, offset);
            setLeads((prev) => [...prev, ...data]);
            setOffset((prev) => prev + data.length);
            setHasMore(data.length === PAGE_SIZE);
        } catch (err) {
            logger.error('Error loading more admin leads:', err);
            setError(LOAD_MORE_ERROR);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, filters, offset]);

    const patchLead = useCallback((jobId: string, patch: Partial<InvoiceRegistryRow>) => {
        setLeads((prev) => prev.map((l) => (l.job_id === jobId ? { ...l, ...patch } : l)));
    }, []);

    const removeLead = useCallback((jobId: string) => {
        setLeads((prev) => prev.filter((l) => l.job_id !== jobId));
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return {
        leads,
        filters,
        loading,
        loadingMore,
        hasMore,
        error,
        applyFilters,
        loadMore,
        patchLead,
        removeLead,
        clearError,
    };
}
