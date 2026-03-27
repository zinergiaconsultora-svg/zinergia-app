import { Proposal } from '@/types/crm';
import { SupabaseClient } from '@supabase/supabase-js';

export const gamificationService = {
    async getLeaderboard() {
        await new Promise(r => setTimeout(r, 800)); 
        return [
            { id: '1', name: 'Carlos Ruiz', role: 'Franquicia', points: 12500, trend: 'up', avatar_url: 'https://i.pravatar.cc/150?u=1', badges: ['Top Seller', 'Club 100k'] },
            { id: '2', name: 'Ana Garcia', role: 'Agente', points: 9800, trend: 'up', avatar_url: 'https://i.pravatar.cc/150?u=2', badges: ['Rising Star'] },
            { id: '3', name: 'Roberto Diaz', role: 'Agente', points: 8400, trend: 'down', avatar_url: 'https://i.pravatar.cc/150?u=3', badges: [] },
            { id: '4', name: 'Elena M.', role: 'Colaborador', points: 7200, trend: 'stable', avatar_url: 'https://i.pravatar.cc/150?u=4', badges: ['First Sale'] },
            { id: '5', name: 'Juan P.', role: 'Agente', points: 5100, trend: 'up', avatar_url: 'https://i.pravatar.cc/150?u=5', badges: [] }
        ];
    },

    async getUserGamificationStats() {
        await new Promise(r => setTimeout(r, 600));
        return {
            level: 5,
            xp: 2450,
            nextLevelXp: 3000,
            progress: 75,
            badges: [
                { id: '1', title: 'Primera Venta', icon: '⚡', color: 'bg-yellow-100 text-yellow-600 border-yellow-200', unlocked: true },
                { id: '2', title: 'Club 100k', icon: '💎', color: 'bg-indigo-100 text-indigo-600 border-indigo-200', unlocked: true },
                { id: '3', title: 'Networker', icon: '🌐', color: 'bg-emerald-100 text-emerald-600 border-emerald-200', unlocked: true },
                { id: '4', title: 'Master Energía', icon: '🔋', color: 'bg-slate-100 text-slate-400 border-slate-200', unlocked: false },
            ]
        };
    },

    async processCommissionsAndPoints(supabase: SupabaseClient, proposal: Proposal) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (!profile) return;

            const pot = (proposal.annual_savings || 1000) * 0.15;
            
            await supabase.from('network_commissions').insert({
                proposal_id: proposal.id,
                agent_id: user.id,
                franchise_id: profile.franchise_id,
                total_revenue: pot,
                agent_commission: pot * 0.30,
                franchise_profit: pot * 0.50,
                hq_royalty: pot * 0.20,
                status: 'pending'
            });

            const { data: current } = await supabase.from('user_points').select('points').eq('user_id', user.id).maybeSingle();
            await supabase.from('user_points').upsert({
                user_id: user.id,
                points: (current?.points || 0) + 50,
                last_updated: new Date().toISOString()
            });
        } catch (err) {
            console.error('Gamification Processing Error:', err);
        }
    }
};
