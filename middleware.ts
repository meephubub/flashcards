import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/callback|api/auth/callback).*)',
  ],
}

export const runtime = 'experimental-edge' // 👈 important

export async function middleware(request: NextRequest) {
  if (process.env.ENVIRONMENT === 'dev') {
    return NextResponse.next()
  }

  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUB_API!,
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          const cookieOptions = {
            ...options,
            sameSite: 'lax' as const,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
          }
          response.cookies.set({ name, value, ...cookieOptions })
        },
        remove: (name: string, options: CookieOptions) => {
          const cookieOptions = {
            ...options,
            sameSite: 'lax' as const,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
          }
          response.cookies.delete({ name, ...cookieOptions })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const publicRoutes = ['/home', '/login', '/signup', '/reset-password', '/api/auth/callback', '/auth/callback']
  const isPublicRoute = publicRoutes.some(route =>
    request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/')
  )

  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  const authRoutes = ['/login', '/signup', '/reset-password', '/home']
  const isAuthRoute = authRoutes.some(route =>
    request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/')
  )

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}
