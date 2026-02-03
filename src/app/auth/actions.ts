'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    try {
        const supabase = await createClient()

        // Type-casting here for convenience
        // In a production app, you might want to validate this with Zod
        const data = {
            email: formData.get('email') as string,
            password: formData.get('password') as string,
        }

        console.log('Login attempt for:', data.email)
        console.log('Using Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

        if (!data.email || !data.password) {
            return { error: 'Por favor, rellena todos los campos' }
        }

        const { error } = await supabase.auth.signInWithPassword(data)

        if (error) {
            console.error('Supabase Auth Error:', error.message, error.status)
            return { error: `Error de Supabase: ${error.message} (${error.status})` }
        }
    } catch (error: unknown) {
        console.error('Login error:', error)
        if (error instanceof Error && error.message.includes('Missing Supabase environment variables')) {
            return { error: 'Error de configuración del servidor: Faltan variables de entorno.' }
        }
        return { error: 'Error inesperado al iniciar sesión. Inténtelo de nuevo más tarde.' }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}

export async function signup(formData: FormData) {
    let errorRedirect = null;

    try {
        const supabase = await createClient()

        const data = {
            email: formData.get('email') as string,
            password: formData.get('password') as string,
        }

        const { error } = await supabase.auth.signUp(data)

        if (error) {
            console.error('Signup error:', error)
            errorRedirect = '/error?message=Error al registrarse';
        }
    } catch (error: unknown) {
        console.error('Signup exception:', error)
        errorRedirect = '/error?message=Error inesperado del servidor';
    }

    if (errorRedirect) {
        redirect(errorRedirect);
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
}
