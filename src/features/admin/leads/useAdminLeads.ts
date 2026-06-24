import { useState, useCallback } from 'react';
import {
    getAdminLeadsAction,
    type AdminLeadFilters,
    type InvoiceRegistryRow,
} from '@/app/actions/invoices';
import { logger } from '@/lib/utils/logger';

const PAGE_SIZE = 30;

export function useAdminLeads(initialData: InvoiceRegistryRow[] = []) {
    const [leads, setLeads] = useState<InvoiceRegistryRow[]>(initialData);
    const [filters, setFilters] = useState<AdminLeadFilters>({ outcome: 'open' });
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [offset, setOffset] = useState(initialData.length);
    const [hasMore, setHasMore] = useState(initialData.length === PAGE_SIZE);

    const load = useCallback(async (f: AdminLeadFilters) => {
        try {
            setLoading(true);
            const data = await getAdminLeadsAction(f, PAGE_SIZE, 0);
            setLeads(data);
            setOffset(data.length);
            setHasMore(data.length === PAGE_SIZE);
        } catch (err) {
            logger.error('Error loading admin leads:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const applyFilters = useCallback(
        (patch: Partial<AdminLeadFilters>) => {
            const next = { ...filters, ...patch };
            setFilters(next);
            load(next);
        },
        [filters, load],
    );

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        try {
            setLoadingMore(true);
            const data = await getAdminLeadsAction(filters, PAGE_SIZE, offset);
            setLeads((prev) => [...prev, ...data]);
            setOffset((prev) => prev + data.length);
            setHasMore(data.length === PAGE_SIZE);
        } catch (err) {
            logger.error('Error loading more admin leads:', err);
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

    return { leads, filters, loading, loadingMore, hasMore, applyFilters, loadMore, patchLead, removeLead };
}
