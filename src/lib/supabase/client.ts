import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase Client Error: Missing env variables NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
        // We throw a descriptive error to help debugging instead of passing undefined
        throw new Error('Supabase Configuration Error: Missing environment variables')
    }

    return createBrowserClient(supabaseUrl, supabaseKey)
}
