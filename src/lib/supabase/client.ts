import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton — one WebSocket connection per tab, avoids per-call instantiation
let _client: SupabaseClient | null = null

export function createClient(): SupabaseClient {
    if (_client) return _client

    // .trim() elimina CRLFs que algunos editores/scripts inyectan en .env.local
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase Configuration Error: Missing environment variables')
    }

    _client = createBrowserClient(supabaseUrl, supabaseKey)
    return _client
}
