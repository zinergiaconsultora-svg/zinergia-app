/**
 * Multiple Invoice Comparison Hook
 * Compare up to 3 invoices simultaneously
 */

'use client';

import { useState, useCallback } from 'react';
import { InvoiceData, SavingsResult } from '@/types/crm';
import { analyzeDocumentWithRetry, calculateSavingsWithRetry } from '@/services/simulatorService';

export interface ComparisonInvoice {
    id: string;
    file: File;
    data?: InvoiceData;
    results?: SavingsResult[];
    status: 'pending' | 'analyzing' | 'analyzed' | 'comparing' | 'completed' | 'error';
    error?: string;
}

export function useMultipleComparison() {
    const [invoices, setInvoices] = useState<ComparisonInvoice[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Intentionally omitting processInvoice from deps - it's defined below and called via setTimeout
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const addInvoice = useCallback((file: File): boolean => {
        if (invoices.length >= 3) {
            return false; // Max 3 invoices
        }

        const newInvoice: ComparisonInvoice = {
            id: `invoice-${Date.now()}-${Math.random()}`,
            file,
            status: 'analyzing',
        };

        setInvoices(prev => [...prev, newInvoice]);
        
        // Process asynchronously - processInvoice is defined below but called via setTimeout
        setTimeout(() => {
            processInvoice(newInvoice.id, file);
        }, 0);
        
        return true;
    }, [invoices.length]);

    const processInvoice = async (id: string, file: File) => {
        try {
            setInvoices(prev => 
                prev.map(inv => 
                    inv.id === id ? { ...inv, status: 'analyzing' } : inv
                )
            );

            const data = await analyzeDocumentWithRetry(file);

            setInvoices(prev => 
                prev.map(inv => 
                    inv.id === id ? { ...inv, data, status: 'analyzed' } : inv
                )
            );

            // Check if all analyzed, then compare all
            setInvoices(prev => {
                const allAnalyzed = prev.every(inv => inv.status === 'analyzed');
                if (allAnalyzed && prev.length > 1) {
                    compareAllInvoices(prev);
                }
                return prev;
            });

        } catch (error) {
            setInvoices(prev => 
                prev.map(inv => 
                    inv.id === id 
                        ? { ...inv, status: 'error', error: error instanceof Error ? error.message : 'Error al analizar' }
                        : inv
                )
            );
        }
    };

    const compareAllInvoices = async (currentInvoices: ComparisonInvoice[]) => {
        setIsProcessing(true);

        try {
            setInvoices(prev => 
                prev.map(inv => ({ ...inv, status: 'comparing' as const }))
            );

            const comparisonResults = await Promise.all(
                currentInvoices.map(async (inv) => {
                    if (!inv.data) return [];
                    return calculateSavingsWithRetry(inv.data);
                })
            );

            setInvoices(prev =>
                prev.map((inv, index) => ({
                    ...inv,
                    results: comparisonResults[index],
                    status: 'completed' as const,
                }))
            );

        } catch (error) {
            console.error('Comparison error:', error);
            setInvoices(prev =>
                prev.map(inv => ({
                    ...inv,
                    status: 'error' as const,
                    error: 'Error en comparación',
                }))
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const removeInvoice = useCallback((id: string) => {
        setInvoices(prev => prev.filter(inv => inv.id !== id));
    }, []);

    const reset = useCallback(() => {
        setInvoices([]);
        setIsProcessing(false);
    }, []);

    return {
        invoices,
        isProcessing,
        addInvoice,
        removeInvoice,
        reset,
        canAddMore: invoices.length < 3,
        isReady: invoices.every(inv => inv.status === 'completed'),
    };
}
