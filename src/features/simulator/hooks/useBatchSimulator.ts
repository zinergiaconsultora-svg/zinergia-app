'use client';

import { useState, useCallback, useRef } from 'react';
import { InvoiceData } from '@/types/crm';
import { createClient } from '@/lib/supabase/client';

export type BatchItemStatus = 'queued' | 'uploading' | 'processing' | 'completed' | 'failed' | 'duplicate';

export interface BatchItem {
    localId: string;
    file: File;
    status: BatchItemStatus;
    jobId: string | null;
    data: InvoiceData | null;
    error: string | null;
    duplicateOf?: string;
    fileHash?: string;
}

const MAX_CONCURRENT = 2;
const TERMINAL_STATUSES: BatchItemStatus[] = ['completed', 'failed', 'duplicate'];

function makeLocalId() {
    return Math.random().toString(36).slice(2);
}

function extractInvoiceData(raw: Record<string, unknown>): InvoiceData {
    const { _confidence: _c, ...rest } = raw;
    void _c;
    return rest as unknown as InvoiceData;
}

async function computeFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export function useBatchSimulator() {
    const [items, setItems] = useState<BatchItem[]>([]);
    const activeCount = useRef(0);
    const queueRef = useRef<BatchItem[]>([]);

    const updateItem = useCallback((localId: string, patch: Partial<BatchItem>) => {
        setItems(prev => prev.map(it => it.localId === localId ? { ...it, ...patch } : it));
        queueRef.current = queueRef.current.map(it => it.localId === localId ? { ...it, ...patch } : it);
    }, []);

    const processItem = useCallback(async (item: BatchItem) => {
        activeCount.current++;
        updateItem(item.localId, { status: 'uploading' });

        try {
            const fileHash = await computeFileHash(item.file);
            updateItem(item.localId, { fileHash });

            const { checkDuplicateAction, saveFileHashAction } = await import('@/app/actions/capture');
            const dedup = await checkDuplicateAction(fileHash);
            if (dedup.isDuplicate) {
                updateItem(item.localId, {
                    status: 'duplicate',
                    duplicateOf: dedup.existingClientName ?? dedup.existingJobId,
                    error: dedup.matchType === 'file_hash'
                        ? `Factura ya procesada${dedup.existingClientName ? ` (${dedup.existingClientName})` : ''}`
                        : `Cliente ya existe${dedup.existingClientName ? `: ${dedup.existingClientName}` : ''}`,
                });
                return;
            }

            const { analyzeDocumentAction } = await import('@/app/actions/ocr');
            const formData = new FormData();
            formData.append('file', item.file);

            const result = await analyzeDocumentAction(formData);

            saveFileHashAction(result.jobId, fileHash).catch(() => {});

            if (result.isMock || result.data) {
                updateItem(item.localId, {
                    status: 'completed',
                    jobId: result.jobId,
                    data: result.data ?? null,
                });
            } else {
                // Async path — wait via Realtime
                updateItem(item.localId, { status: 'processing', jobId: result.jobId });

                await new Promise<void>((resolve) => {
                    const supabase = createClient();
                    const channel = supabase
                        .channel(`batch_job_${result.jobId}`)
                        .on('postgres_changes', {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'ocr_jobs',
                            filter: `id=eq.${result.jobId}`,
                        }, (payload) => {
                            const row = payload.new as { status: string; extracted_data: Record<string, unknown> | null; error_message: string | null };
                            if (row.status === 'completed') {
                                supabase.removeChannel(channel);
                                updateItem(item.localId, {
                                    status: 'completed',
                                    data: row.extracted_data ? extractInvoiceData(row.extracted_data) : null,
                                });
                                resolve();
                            } else if (row.status === 'failed') {
                                supabase.removeChannel(channel);
                                updateItem(item.localId, {
                                    status: 'failed',
                                    error: row.error_message ?? 'Error desconocido',
                                });
                                resolve();
                            }
                        })
                        .subscribe();

                    // Safety timeout: 6 minutes
                    setTimeout(() => {
                        supabase.removeChannel(channel);
                        updateItem(item.localId, { status: 'failed', error: 'Tiempo de espera agotado' });
                        resolve();
                    }, 360_000);
                });
            }
        } catch (e) {
            updateItem(item.localId, {
                status: 'failed',
                error: e instanceof Error ? e.message : 'Error desconocido',
            });
        } finally {
            activeCount.current--;
            // Dequeue next pending item
            const next = queueRef.current.find(it => it.status === 'queued');
            if (next) processItem(next);
        }
    }, [updateItem]);

    const addFiles = useCallback((files: File[]) => {
        const newItems: BatchItem[] = files.map(file => ({
            localId: makeLocalId(),
            file,
            status: 'queued',
            jobId: null,
            data: null,
            error: null,
        }));

        setItems(prev => [...prev, ...newItems]);
        queueRef.current = [...queueRef.current, ...newItems];

        // Start processing up to MAX_CONCURRENT
        for (const item of newItems) {
            if (activeCount.current < MAX_CONCURRENT) {
                processItem(item);
            }
        }
    }, [processItem]);

    const removeItem = useCallback((localId: string) => {
        setItems(prev => prev.filter(it => it.localId !== localId));
        queueRef.current = queueRef.current.filter(it => it.localId !== localId);
    }, []);

    const clearCompleted = useCallback(() => {
        setItems(prev => prev.filter(it => !TERMINAL_STATUSES.includes(it.status)));
        queueRef.current = queueRef.current.filter(it => !TERMINAL_STATUSES.includes(it.status));
    }, []);

    const completedItems = items.filter(it => it.status === 'completed' && it.data);
    const pendingCount = items.filter(it => it.status === 'queued' || it.status === 'uploading' || it.status === 'processing').length;

    return { items, addFiles, removeItem, clearCompleted, completedItems, pendingCount };
}
