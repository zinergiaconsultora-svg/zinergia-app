import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserRole } from '@/types/crm'

// Roles that can write to shared catalog resources (tariffs, commission rules, etc.)
const ADMIN_ROLES: UserRole[] = ['admin', 'franchise']

export function canManageTariffs(role: UserRole): boolean {
    return ADMIN_ROLES.includes(role)
}

export function canConfigureCommissions(role: UserRole): boolean {
    return ADMIN_ROLES.includes(role)
}

export function canManageNetwork(role: UserRole): boolean {
    return ADMIN_ROLES.includes(role)
}

/**
 * Server-side helper: returns the current user's role from their profile.
 * Always uses the server Supabase client (cookie-based, session validated).
 */
export async function getUserRole(): Promise<UserRole | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

    return (profile?.role as UserRole) ?? null
}

/**
 * Server Action guard: throws a 403 error if the current user lacks the required role.
 * Use at the top of any Server Action that mutates admin-only resources.
 *
 * @example
 * export async function deleteOfferAction(id: string) {
 *   await requireServerRole(['admin', 'franchise'])
 *   ...
 * }
 */
export async function requireServerRole(allowed: UserRole[]): Promise<void> {
    const role = await getUserRole()
    if (!role || !allowed.includes(role)) {
        throw new Error(`Forbidden: requires one of [${allowed.join(', ')}], got '${role ?? 'unauthenticated'}'`)
    }
}

/**
 * Route guard for Server Components / layouts.
 * Redirects to /dashboard if the user's role is not in the allowed list.
 */
export async function requireRouteRole(allowed: UserRole[], redirectTo = '/dashboard'): Promise<void> {
    const role = await getUserRole()
    if (!role || !allowed.includes(role)) {
        redirect(redirectTo)
    }
}
