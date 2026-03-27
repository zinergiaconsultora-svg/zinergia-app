'use client';

import { useState, useEffect, useTransition } from 'react';
import { BillingCycle } from '@/types/crm';
import { getBillingHistory, closeMonthlyBilling, voidBillingCycle } from '@/app/actions/billing';
import { toast } from 'sonner';

export function useBillingHistory(franchiseId: string | null) {
    const [cycles, setCycles] = useState<BillingCycle[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    const loadHistory = async () => {
        if (!franchiseId) return;
        try {
            setLoading(true);
            const data = await getBillingHistory(franchiseId);
            setCycles(data);
        } catch (error) {
            console.error('[BillingHistory] Error loading:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    // franchiseId es estable después del primer render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [franchiseId]);

    const handleCloseCycle = (monthYear: string) => {
        if (!franchiseId) return;
        startTransition(async () => {
            try {
                await closeMonthlyBilling(franchiseId, monthYear);
                toast.success(`Ciclo ${monthYear} cerrado correctamente`);
                await loadHistory();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Error al cerrar ciclo');
            }
        });
    };

    const handleVoidCycle = (cycleId: string) => {
        startTransition(async () => {
            try {
                await voidBillingCycle(cycleId);
                toast.success('Ciclo anulado correctamente');
                await loadHistory();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Error al anular ciclo');
            }
        });
    };

    // Calcular el mes actual en formato YYYY-MM
    const currentMonth = new Date().toISOString().slice(0, 7);
    const hasCurrentMonthCycle = cycles.some(
        c => c.month_year === currentMonth && c.status === 'closed'
    );

    return {
        cycles,
        loading,
        isPending,
        currentMonth,
        hasCurrentMonthCycle,
        handleCloseCycle,
        handleVoidCycle,
        reloadHistory: loadHistory,
    };
}
