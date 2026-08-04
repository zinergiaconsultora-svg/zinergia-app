import { SupabaseClient } from '@supabase/supabase-js';
import { resolveTrustedActor } from '@/lib/profile-authority/trustedActor';

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

export function invalidateCacheByPrefix(prefix: string): void {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) cache.delete(key);
    }
}

export async function getFranchiseId(supabase: SupabaseClient) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return null;

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, parent_id, franchise_id')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError || !profile) return null;

    let franchise = null;
    if (profile.franchise_id) {
        const result = await supabase
            .from('franchises')
            .select('id, is_active')
            .eq('id', profile.franchise_id)
            .maybeSingle();
        if (result.error) return null;
        franchise = result.data;
    }

    try {
        return resolveTrustedActor(profile, franchise).franchiseId;
    } catch {
        return null;
    }
}
