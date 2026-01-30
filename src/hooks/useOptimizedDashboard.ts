'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { crmService } from '@/services/crmService';
import { Client } from '@/types/crm';

interface DashboardStats {
    user?: {
        full_name: string;
        role: string;
        avatar_url?: string;
    };
    total: number;
    active: number;
    pending: number;
    new: number;
    growth: string;
    recent: Client[];
    recentProposals: {
        id: string;
        client_name: string;
        annual_savings: number;
        status: string;
        created_at: string;
    }[];
    pendingActions: {
        id: string;
        client_name: string;
        type: 'documentation_needed';
    }[];
    financials: {
        total_detected: number;
        pipeline: number;
        secured: number;
        conversion_rate: number;
        month_savings: number;
    };
}

const DEFAULT_STATS: DashboardStats = {
    user: { full_name: 'Consultor', role: 'agent' },
    total: 0,
    active: 0,
    pending: 0,
    new: 0,
    growth: '0%',
    recent: [],
    recentProposals: [],
    pendingActions: [],
    financials: {
        total_detected: 0,
        pipeline: 0,
        secured: 0,
        conversion_rate: 0,
        month_savings: 0
    }
};

let statsCache: DashboardStats | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000;

export function useOptimizedDashboard() {
    const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const loadStats = useCallback(async (forceRefresh = false) => {
        const now = Date.now();
        
        if (!forceRefresh && statsCache && (now - cacheTimestamp) < CACHE_TTL) {
            setStats(statsCache);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const data = await crmService.getDashboardStats();
            
            const mergedStats = { ...DEFAULT_STATS, ...data } as DashboardStats;
            statsCache = mergedStats;
            cacheTimestamp = now;
            setStats(mergedStats);
        } catch (err) {
            console.warn('Dashboard stats partial load:', err);
            setError(err instanceof Error ? err : new Error('Failed to load stats'));
        } finally {
            setLoading(false);
        }
    }, []);

    const refetch = useCallback(() => loadStats(true), [loadStats]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const goalProgress = useMemo(() => {
        const MONTHLY_GOAL = 10000;
        return Math.min(Math.round((stats.financials.month_savings / MONTHLY_GOAL) * 100), 100);
    }, [stats.financials.month_savings]);

    const firstName = useMemo(() => {
        return stats.user?.full_name?.split(' ')[0] || 'Consultor';
    }, [stats.user?.full_name]);

    const proposalStats = useMemo(() => {
        const wonDeals = stats.recentProposals.filter(p => p.status === 'accepted').length;
        const activeDeals = stats.recentProposals.filter(p => p.status === 'sent' || p.status === 'draft').length;
        const lostDeals = stats.recentProposals.filter(p => p.status === 'rejected').length;
        
        return { wonDeals, activeDeals, lostDeals };
    }, [stats.recentProposals]);

    return {
        stats,
        loading,
        error,
        refetch,
        goalProgress,
        firstName,
        proposalStats
    };
}
