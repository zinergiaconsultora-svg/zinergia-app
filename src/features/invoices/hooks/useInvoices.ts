import { useState, useEffect, useCallback } from 'react';
import { getInvoicesAction, type InvoiceRegistryRow } from '@/app/actions/invoices';
import { logger } from '@/lib/utils/logger';

const PAGE_SIZE = 20;

export function useInvoices(initialData?: InvoiceRegistryRow[]) {
    const [invoices, setInvoices] = useState<InvoiceRegistryRow[]>(initialData ?? []);
    const [loading, setLoading] = useState(!initialData);
    const [loadingMore, setLoadingMore] = useState(false);
    const [offset, setOffset] = useState(initialData ? initialData.length : 0);
    const [hasMore, setHasMore] = useState(!initialData || initialData.length === PAGE_SIZE);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getInvoicesAction(PAGE_SIZE, 0);
            setInvoices(data);
            setOffset(data.length);
            setHasMore(data.length === PAGE_SIZE);
        } catch (err) {
            logger.error('Error loading invoices:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        try {
            setLoadingMore(true);
            const data = await getInvoicesAction(PAGE_SIZE, offset);
            setInvoices(prev => [...prev, ...data]);
            setOffset(prev => prev + data.length);
            setHasMore(data.length === PAGE_SIZE);
        } catch (err) {
            logger.error('Error loading more invoices:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, offset]);

    const patchInvoice = useCallback((jobId: string, patch: Partial<InvoiceRegistryRow>) => {
        setInvoices(prev => prev.map(it => (it.job_id === jobId ? { ...it, ...patch } : it)));
    }, []);

    useEffect(() => {
        if (!initialData) load();
    }, [initialData, load]);

    return { invoices, loading, loadingMore, hasMore, load, loadMore, patchInvoice };
}
