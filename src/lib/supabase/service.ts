import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client with service role key.
 * Bypasses RLS — use only for server-side operations that require it
 * (e.g., reading public invitation codes before the user is authenticated).
 *
 * NEVER import this from client components.
 */
export function createServiceClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
        throw new Error('Missing Supabase service role environment variables')
    }

    return createSupabaseClient(supabaseUrl, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}
