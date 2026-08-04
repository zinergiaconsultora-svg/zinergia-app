import { createClient } from '@/lib/supabase/server'
import { redirect, unstable_rethrow } from 'next/navigation'
import { UserRole } from '@/types/crm'
import {
    ACCOUNT_NOT_ACTIVE,
    resolveTrustedActor,
    type TrustedActor,
} from '@/lib/profile-authority/trustedActor'

// Roles that can write to shared catalog resources (tariffs, commission rules, etc.)
const ADMIN_ROLES: UserRole[] = ['admin', 'franchise']

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
export async function getTrustedActorProfile(): Promise<TrustedActor> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error(ACCOUNT_NOT_ACTIVE)

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role, parent_id, franchise_id')
        .eq('id', user.id)
        .maybeSingle()

    if (error || !profile) throw new Error(ACCOUNT_NOT_ACTIVE)

    if (profile.role === 'admin') return resolveTrustedActor(profile, null)

    let franchise = null
    if (profile.franchise_id) {
        const result = await supabase
            .from('franchises')
            .select('id, is_active')
            .eq('id', profile.franchise_id)
            .maybeSingle()
        if (result.error) throw new Error(ACCOUNT_NOT_ACTIVE)
        franchise = result.data
    }

    return resolveTrustedActor(profile, franchise)
}

export async function getUserRole(): Promise<UserRole | null> {
    try {
        return (await getTrustedActorProfile()).role
    } catch (error) {
        unstable_rethrow(error)
        return null
    }
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
    let role: UserRole | null = null
    try {
        role = (await getTrustedActorProfile()).role
    } catch (error) {
        unstable_rethrow(error)
        // Fail closed with the same public guard error used for a disallowed role.
    }
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
