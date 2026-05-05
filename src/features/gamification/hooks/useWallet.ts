
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { crmService } from '@/services/crmService';
import { simulateSaleAction } from '@/app/actions/demo';
import { Commission, WithdrawalRequest, WithdrawalGrowth } from '@/types/crm';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import {
    createWithdrawalRequestAction,
    getWithdrawalHistoryAction,
    getWithdrawalGrowthAction,
} from '@/app/actions/withdrawals';

export function useWallet() {
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
    const [growth, setGrowth] = useState<WithdrawalGrowth>({ current_month_earned: 0, previous_month_earned: 0, growth_percent: 0 });
    const [iban, setIban] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<'agent' | 'franchise'>('agent');
    const [userId, setUserId] = useState<string>('');

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setUserId(user.id);
                const { data: profile } = await supabase.from('profiles').select('role, iban').eq('id', user.id).single();
                if (profile) {
                    setUserRole(profile.role as 'agent' | 'franchise');
                    setIban(profile.iban ?? null);
                }
            }

            const [data, withdrawalData, growthData] = await Promise.all([
                crmService.getNetworkCommissions(),
                getWithdrawalHistoryAction(),
                getWithdrawalGrowthAction(),
            ]);
            setCommissions(data as Commission[]);
            setWithdrawals(withdrawalData);
            setGrowth(growthData);
        } catch (error) {
            console.error('Error loading wallet:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const calculateTotal = (comms: Commission[]) => {
        return comms.reduce((sum, c) => {
            let val = 0;
            if (userRole === 'agent') {
                val += (c.agent_commission || 0);
            } else {
                val += (c.franchise_commission || 0);
                if (c.agent_id === userId) {
                    val += (c.agent_commission || 0);
                }
            }
            return sum + val;
        }, 0);
    };

    const handleSimulateSale = async () => {
        if (confirm('Simular una venta de 2.500 euros de ahorro?')) {
            setLoading(true);
            try {
                await simulateSaleAction(2500);
                await loadData();
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#ea580c', '#10b981', '#f59e0b']
                });
            } catch {
                toast.error('Error en simulacion');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleWithdraw = async (amount: number, commissionIds: string[]) => {
        const result = await createWithdrawalRequestAction(amount, commissionIds);
        if (result.success) {
            toast.success('Solicitud de retiro creada');
            await loadData();
        } else {
            toast.error(result.error || 'Error al crear solicitud');
        }
        return result;
    };

    const pendingBalance = calculateTotal(commissions.filter(c => c.status === 'pending'));
    const availableBalance = calculateTotal(commissions.filter(c => c.status === 'cleared'));
    const totalEarned = calculateTotal(commissions);
    const totalWithdrawn = withdrawals
        .filter(w => w.status === 'paid')
        .reduce((sum, w) => sum + (w.amount || 0), 0);

            const franchisePersonal = userRole === 'franchise'
        ? commissions.filter(c => c.agent_id === userId).reduce((sum, c) => sum + (c.agent_commission || 0), 0)
        : 0;
    const franchiseNetwork = userRole === 'franchise'
        ? commissions.reduce((sum, c) => sum + (c.franchise_commission ?? 0), 0)
        : 0;

    const clearedCommissions = commissions.filter(c => c.status === 'cleared');

    return {
        commissions,
        withdrawals,
        growth,
        iban,
        loading,
        userRole,
        userId,
        pendingBalance,
        availableBalance,
        totalEarned,
        totalWithdrawn,
        franchisePersonal,
        franchiseNetwork,
        clearedCommissions,
        handleSimulateSale,
        handleWithdraw,
        reloadCommissions: loadData,
    };
}
