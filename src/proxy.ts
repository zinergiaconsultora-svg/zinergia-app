import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveTrustedActor } from '@/lib/profile-authority/trustedActor'

/**
 * Proxy de Autenticación Zinergia
 * Implementa protección de rutas y refresco de sesión Supabase.
 */
export async function proxy(request: NextRequest) {
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
        const isPendingRoute = pathname === '/account-pending'

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

        // Caso C: una cuenta no canónica nunca llega a cargar rutas de tenant.
        let trustedRole: 'admin' | 'franchise' | 'agent' | null = null
        if (user && !isPublicRoute && !isPendingRoute) {
            const profileResult = await supabase
                .from('profiles')
                .select('id, role, parent_id, franchise_id')
                .eq('id', user.id)
                .maybeSingle()
            let franchise = null
            if (profileResult.data?.franchise_id) {
                const franchiseResult = await supabase
                    .from('franchises')
                    .select('id, is_active')
                    .eq('id', profileResult.data.franchise_id)
                    .maybeSingle()
                if (franchiseResult.error) {
                    return NextResponse.redirect(new URL('/account-pending', request.url))
                }
                franchise = franchiseResult.data
            }

            try {
                if (profileResult.error) throw profileResult.error
                trustedRole = resolveTrustedActor(profileResult.data, franchise).role
            } catch {
                return NextResponse.redirect(new URL('/account-pending', request.url))
            }
        }

        // Caso D: Rutas de administración protegidas por autoridad canónica.
        if (user && pathname.startsWith('/admin')) {
            if (trustedRole !== 'admin') {
                return NextResponse.redirect(new URL('/dashboard', request.url))
            }
        }
    } catch {
        // An Auth/provider exception may embed request or account data. Keep
        // the edge log diagnostic but never serialize the raw error object.
        console.error('Middleware: Supabase auth check failed.')
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
