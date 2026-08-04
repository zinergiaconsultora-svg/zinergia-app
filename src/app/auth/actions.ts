'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { SAFE_LOGIN_ERROR } from '@/lib/auth/safeLoginError'

export async function login(formData: FormData) {
    try {
        const supabase = await createClient()

        // Type-casting here for convenience
        // In a production app, you might want to validate this with Zod
        const data = {
            email: formData.get('email') as string,
            password: formData.get('password') as string,
        }

        if (!data.email || !data.password) {
            return { error: 'Por favor, rellena todos los campos' }
        }

        const { error } = await supabase.auth.signInWithPassword(data)

        if (error) {
            // Provider messages can include account-specific context. Keep the
            // browser response and telemetry deliberately non-enumerable.
            logger.warn({ safeCode: 'invalid_credentials_or_provider_failure' }, '[auth] sign-in rejected')
            return { error: SAFE_LOGIN_ERROR }
        }
    } catch {
        // Do not attach the provider exception: it can contain account or
        // transport data and must never reach application logs or the client.
        logger.error({ safeCode: 'sign_in_unexpected' }, '[auth] sign-in failed')
        return { error: SAFE_LOGIN_ERROR }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
}
