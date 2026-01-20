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

        if (!data.email || !data.password) {
            return { error: 'Por favor, rellena todos los campos' }
        }

        const { error } = await supabase.auth.signInWithPassword(data)

        if (error) {
            return { error: 'Credenciales incorrectas o usuario no encontrado' }
        }
    } catch (error: any) {
        console.error('Login error:', error)
        if (error?.message?.includes('Missing Supabase environment variables')) {
            return { error: 'Error de configuración del servidor: Faltan variables de entorno.' }
        }
        return { error: 'Error inesperado al iniciar sesión. Inténtelo de nuevo más tarde.' }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}

export async function signup(formData: FormData) {
    try {
        const supabase = await createClient()

        const data = {
            email: formData.get('email') as string,
            password: formData.get('password') as string,
        }

        const { error } = await supabase.auth.signUp(data)

        if (error) {
            // Instead of redirecting to a generic error page, we could return the error 
            // but the current implementation redirects. We'll keep the redirect pattern for now 
            // but wrap the createClient call.
            console.error('Signup error:', error)
            redirect('/error?message=Error al registrarse')
        }
    } catch (error: any) {
        console.error('Signup exception:', error)
        redirect('/error?message=Error inesperado del servidor')
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
}
