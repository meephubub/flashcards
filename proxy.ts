import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: [
    // Match everything except Next.js internals, favicon, and API routes
    '/((?!_next/static|_next/image|favicon.ico|auth/callback).*)',
  ],
}

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  '/api/wallet/fund': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 requests per minute
  },
  '/api/wallet/create': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3, // 3 requests per minute
  }
}

// In-memory store for rate limiting (use Redis/KV in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean up every minute

function getClientIP(request: NextRequest): string {
  // Try multiple headers to get the real IP
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  if (realIP) {
    return realIP
  }
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  // Fallback to request IP
  return request.ip || '127.0.0.1'
}

function getJA4Digest(request: NextRequest): string {
  // JA4 digest from various possible headers
  const ja4Header = request.headers.get('ja4') || 
                   request.headers.get('x-ja4') || 
                   request.headers.get('cf-ja4')
  
  if (ja4Header) {
    return ja4Header
  }
  
  // If JA4 not available, create a fingerprint from available TLS info
  const userAgent = request.headers.get('user-agent') || ''
  const acceptEncoding = request.headers.get('accept-encoding') || ''
  const acceptLanguage = request.headers.get('accept-language') || ''
  
  // Create a simple hash-like fingerprint
  const fingerprint = `${userAgent}-${acceptEncoding}-${acceptLanguage}`
  return Buffer.from(fingerprint).toString('base64').slice(0, 32)
}

function createRateLimitKey(endpoint: string, ip: string, ja4: string): string {
  return `${endpoint}:${ip}:${ja4}`
}

function isRateLimited(endpoint: string, ip: string, ja4: string): { limited: boolean; resetTime?: number; remaining?: number } {
  const config = RATE_LIMIT_CONFIG[endpoint as keyof typeof RATE_LIMIT_CONFIG]
  if (!config) return { limited: false }
  
  const key = createRateLimitKey(endpoint, ip, ja4)
  const now = Date.now()
  const existing = rateLimitStore.get(key)
  
  if (!existing || now > existing.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    })
    return { limited: false, remaining: config.maxRequests - 1 }
  }
  
  if (existing.count >= config.maxRequests) {
    return { 
      limited: true, 
      resetTime: existing.resetTime,
      remaining: 0 
    }
  }
  
  // Increment count
  existing.count++
  rateLimitStore.set(key, existing)
  
  return { 
    limited: false, 
    remaining: config.maxRequests - existing.count 
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Skip middleware for static assets by extension
  if (
    pathname.match(/\.(txt|json|xml|png|ico|svg|jpg|jpeg|gif|webp|woff2|woff|ttf|eot|html)$/i)
  ) {
    return NextResponse.next()
  }

  // Rate limiting for wallet endpoints
  if (pathname.startsWith('/api/wallet/fund') || pathname.startsWith('/api/wallet/create')) {
    const ip = getClientIP(request)
    const ja4 = getJA4Digest(request)
    
    // Normalize endpoint for rate limiting
    const endpoint = pathname.startsWith('/api/wallet/fund') ? '/api/wallet/fund' : '/api/wallet/create'
    
    const rateLimitResult = isRateLimited(endpoint, ip, ja4)
    
    if (rateLimitResult.limited) {
      const resetTime = rateLimitResult.resetTime!
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
      
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests to ${endpoint}. Please try again later.`,
          retryAfter: retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': RATE_LIMIT_CONFIG[endpoint as keyof typeof RATE_LIMIT_CONFIG].maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
          }
        }
      )
    }
    
    // Add rate limit headers to successful responses
    const response = NextResponse.next()
    const config = RATE_LIMIT_CONFIG[endpoint as keyof typeof RATE_LIMIT_CONFIG]
    response.headers.set('X-RateLimit-Limit', config.maxRequests.toString())
    response.headers.set('X-RateLimit-Remaining', (rateLimitResult.remaining || 0).toString())
    
    // Continue with existing middleware logic for rate-limited endpoints
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
    '/sitemap.xml',
    '/google-sitemap.xml',
    '/verify',
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
