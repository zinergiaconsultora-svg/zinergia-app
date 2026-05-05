import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware de Autenticación Zinergia
 * Implementa protección de rutas y refresco de sesión Supabase.
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // 1. Comprobación de variables de entorno
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('Middleware Error: Missing Supabase Environment Variables!')
        return NextResponse.next()
    }

    // 2. Inicializar el cliente Supabase (Server Side)
    let response = NextResponse.next({ request })

    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                        response = NextResponse.next({ request })
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        )
                    },
                },
            }
        )

        // 3. Obtener usuario (refresca sesión si es necesario)
        const { data: { user } } = await supabase.auth.getUser()

        // 4. Lógica de Redirección Proactiva
        const isPublicRoute = pathname === '/' || pathname.startsWith('/join') || pathname.startsWith('/p/') || pathname.startsWith('/auth/callback')

        // Caso A: No autenticado intentando entrar a ruta privada
        if (!user && !isPublicRoute) {
            const redirectUrl = new URL('/', request.url)
            if (pathname !== '/') {
                redirectUrl.searchParams.set('redirect_to', pathname)
            }
            return NextResponse.redirect(redirectUrl)
        }

        // Caso B: Autenticado intentando entrar al login (landing)
        if (user && pathname === '/') {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }

        // Caso C: Rutas de administración protegidas por Rol
        if (user && pathname.startsWith('/admin')) {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            if (error || !profile || profile.role !== 'admin') {
                return NextResponse.redirect(new URL('/dashboard', request.url))
            }
        }
    } catch (e) {
        console.error('Middleware: Supabase auth check failed.', e)
        if (pathname.startsWith('/admin')) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
    }

    return response
}

export const config = {
    // Excluye: assets de Next.js, rutas /api, documentos públicos de auditoría, PWA assets, favicon e imágenes
    matcher: ['/((?!_next|api|auditoria|favicon\\.ico|manifest\\.webmanifest|sw\\.js|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
