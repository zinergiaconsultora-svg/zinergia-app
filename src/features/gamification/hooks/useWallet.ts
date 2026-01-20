
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { crmService } from '@/services/crmService';
import { Commission } from '@/types/crm';
import confetti from 'canvas-confetti';

export function useWallet() {
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<'agent' | 'franchise'>('agent');
    const [userId, setUserId] = useState<string>('');

    const loadData = async () => {
        try {
            setLoading(true);
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setUserId(user.id);
                // Move direct DB call to service in a real app, but for now we encapsulate it here
                // or better yet, add getUserRole to crmService? 
                // Let's stick to the pattern: component shouldn't know about tables.
                // We'll trust crmService.ensureProfile handles this or we add a helper.
                // For this refactor, we just move existing logic to the hook first.
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                if (profile) setUserRole(profile.role as 'agent' | 'franchise');
            }

            const data = await crmService.getNetworkCommissions();
            setCommissions(data as Commission[]);
        } catch (error) {
            console.error('Error loading commissions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const calculateTotal = (comms: Commission[]) => {
        return comms.reduce((sum, c) => {
            let val = 0;
            if (userRole === 'agent') {
                val += (c.agent_commission || 0);
            } else {
                // Franchise Logic
                val += (c.franchise_profit || 0);
                if (c.agent_id === userId) {
                    val += (c.agent_commission || 0);
                }
            }
            return sum + val;
        }, 0);
    };

    const handleSimulateSale = async () => {
        if (confirm('¿Simular una venta de 2.500€ de ahorro? Esto generará comisiones y puntos.')) {
            setLoading(true);
            try {
                await crmService.simulateSale(2500);
                await loadData();
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#ea580c', '#10b981', '#f59e0b'] // Updated to energy orange
                });
            } catch (e) {
                console.error(e);
                alert('Error en simulación');
            } finally {
                setLoading(false);
            }
        }
    };

    const pendingBalance = calculateTotal(commissions.filter(c => c.status === 'pending'));
    const availableBalance = calculateTotal(commissions.filter(c => c.status === 'cleared' || c.status === 'paid'));
    const totalEarned = calculateTotal(commissions);

    // Breakdown for Franchise
    const franchisePersonal = userRole === 'franchise' ? commissions.filter(c => c.agent_id === userId).reduce((sum, c) => sum + (c.agent_commission || 0), 0) : 0;
    const franchiseNetwork = userRole === 'franchise' ? commissions.reduce((sum, c) => sum + (c.franchise_profit || 0), 0) : 0;

    return {
        commissions,
        loading,
        userRole,
        userId,
        pendingBalance,
        availableBalance,
        totalEarned,
        franchisePersonal,
        franchiseNetwork,
        handleSimulateSale
    };
}
