import { SupabaseClient } from '@supabase/supabase-js';

// Simple in-memory cache for client-side
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function getCached<T>(key: string): T | null {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data as T;
    }
    return null;
}

export function setCache<T>(key: string, data: T): void {
    cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(key: string): void {
    cache.delete(key);
}

export async function getFranchiseId(supabase: SupabaseClient) {
    // Sequential: confirm user identity before fetching profile (defense-in-depth over RLS)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('franchise_id')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile) {
        const newProfile = await ensureProfile(supabase, user.id, user.email || 'User');
        return newProfile.franchise_id;
    }

    return profile.franchise_id;
}

export async function ensureProfile(supabase: SupabaseClient, userId: string, email: string) {
    // 1. Check if profile exists
    const { data: profile } = await supabase
        .from('profiles')
        .select('franchise_id, full_name, role')
        .eq('id', userId)
        .maybeSingle();

    if (profile) return profile;

    // 2. Get HQ franchise
    let { data: franchise } = await supabase
        .from('franchises')
        .select('id')
        .eq('slug', 'hq')
        .maybeSingle();

    if (!franchise) {
        const { data: newFranchise } = await supabase
            .from('franchises')
            .insert({ slug: 'hq', name: 'Zinergia Central' })
            .select('id')
            .single();
        franchise = newFranchise;
    }

    // 3. Create User Profile linked to HQ
    const { data: newProfile, error } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            franchise_id: franchise!.id,
            full_name: email.split('@')[0],
            role: 'agent'
        }, { onConflict: 'id' })
        .select('franchise_id, full_name, role')
        .single();

    if (error || !newProfile) {
        return {
            franchise_id: franchise?.id || '00000000-0000-0000-0000-000000000000',
            role: 'agent',
            full_name: email.split('@')[0]
        };
    }
    return newProfile;
}
