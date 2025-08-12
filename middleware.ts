import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: [
    // Match everything except Next.js internals, favicon, and API routes
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/callback|api/auth/callback).*)',
  ],
}

export const runtime = 'experimental-edge' // 👈 important

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip middleware for static assets by extension
  if (
    pathname.match(/\.(txt|json|xml|png|ico|svg|jpg|jpeg|gif|webp|woff2|woff|ttf|eot|html)$/i)
  ) {
    return NextResponse.next()
  }

  const envCookie = request.cookies.get('ENVIRONMENT')?.value
  const effectiveEnv = (envCookie || process.env.ENVIRONMENT || 'prod').toLowerCase()

  if (effectiveEnv === 'dev') {
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

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const publicRoutes = [
    '/home',
    '/login',
    '/signup',
    '/reset-password',
    '/api/auth/callback',
    '/auth/callback',
    '/install',
    '/home/about-us',
    '/home/contact-us',
    '/home/privacy-policy',
    '/home/terms-of-service',
    '/home/careers',
    '/home/pricing',
  ]
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  const authRoutes = ['/login', '/signup', '/reset-password']
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}