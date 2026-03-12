// middleware.ts — Security middleware + Maintenance mode
import { NextResponse, type NextRequest } from 'next/server'

// ─── Maintenance Mode ─────────────────────────────────────────────────────────
// To enable:  set NEXT_PUBLIC_MAINTENANCE_MODE=true in .env.local  → npm run build
// To disable: set NEXT_PUBLIC_MAINTENANCE_MODE=false (or delete it) → npm run build
const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'false'

// Paths that bypass maintenance mode (admin can still access)
const MAINTENANCE_BYPASS = [
  '/maintenance',
  '/admin',          // admin panel stays accessible
  '/api/admin',      // admin APIs stay accessible
  '/_next',
  '/home',
  '/favicon.ico',
]

// ─── In-memory rate limiter ────────────────────────────────────────────────────
const rateStore = new Map<string, { count: number; reset: number }>()

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

interface RateLimitConfig { limit: number; windowSec: number }

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/check-availability':    { limit: 20,  windowSec: 60 },
  '/api/payments/create-order': { limit: 5,   windowSec: 60 },
  '/api/payments/verify':       { limit: 10,  windowSec: 60 },
  '/api/bookings':              { limit: 30,  windowSec: 60 },
  '/api/notifications':         { limit: 20,  windowSec: 60 },
  '/api/':                      { limit: 100, windowSec: 60 },
}

function checkRateLimit(ip: string, path: string): { allowed: boolean; remaining: number; reset: number } {
  let config = RATE_LIMITS['/api/']
  for (const [pattern, cfg] of Object.entries(RATE_LIMITS)) {
    if (path.startsWith(pattern) && pattern !== '/api/') { config = cfg; break }
  }
  const key  = `${ip}:${path}`
  const now  = Date.now()
  const entry = rateStore.get(key)
  if (!entry || now > entry.reset) {
    const reset = now + config.windowSec * 1000
    rateStore.set(key, { count: 1, reset })
    return { allowed: true, remaining: config.limit - 1, reset }
  }
  if (entry.count >= config.limit) return { allowed: false, remaining: 0, reset: entry.reset }
  entry.count++
  return { allowed: true, remaining: config.limit - entry.count, reset: entry.reset }
}

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    rateStore.forEach((val, key) => { if (now > val.reset) rateStore.delete(key) })
  }, 5 * 60 * 1000)
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()

  // ── 1. Maintenance Mode ──────────────────────────────────────────────────────
  if (MAINTENANCE_MODE) {
    const isBypassed = MAINTENANCE_BYPASS.some(p => pathname.startsWith(p))
    if (!isBypassed) {
      // Already on maintenance page — don't loop
      if (pathname !== '/maintenance') {
        return NextResponse.redirect(new URL('/maintenance', request.url))
      }
    }
  }

  // ── 2. Security Headers ──────────────────────────────────────────────────────
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://api.razorpay.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://checkout.razorpay.com",
      "connect-src 'self' https://*.supabase.co https://api.razorpay.com https://checkout.razorpay.com https://lumberjack.razorpay.com",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com",
      "frame-ancestors 'self'",
    ].join('; ')
  )

  // ── 3. Block Suspicious Paths ────────────────────────────────────────────────
  const BLOCKED_PATTERNS = [
    /\.(php|asp|aspx|jsp|cgi|env|git|sql|bak|log|conf|yml|yaml|ini|htaccess)$/i,
    /wp-admin|wp-login|wp-content|wordpress/i,
    /\.\.\//,
    /<script/i,
    /union.*select|drop.*table|insert.*into|exec\(|eval\(/i,
  ]
  if (BLOCKED_PATTERNS.some(p => p.test(pathname))) {
    return new NextResponse('Not Found', { status: 404 })
  }

  // ── 4. Admin Route Protection ────────────────────────────────────────────────
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  // ── 5. API Rate Limiting ─────────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const ip = getClientIP(request)
    const { allowed, remaining, reset } = checkRateLimit(ip, pathname)

    response.headers.set('X-RateLimit-Remaining', String(remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(reset / 1000)))

    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.', retry_after: Math.ceil((reset - Date.now()) / 1000) }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(reset / 1000)),
          },
        }
      )
    }

    const POST_ONLY = ['/api/check-availability', '/api/payments/create-order', '/api/payments/verify', '/api/notifications']
    if (POST_ONLY.some(p => pathname.startsWith(p)) && request.method !== 'POST') {
      return new NextResponse(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST' },
      })
    }

    if (request.method === 'POST') {
      const contentType = request.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        return new NextResponse(JSON.stringify({ error: 'Content-Type must be application/json' }), {
          status: 415, headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    const origin = request.headers.get('origin')
    const allowedOrigins = [
      'https://leafwalk.in',
      'https://www.leafwalk.in',
      process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '',
    ].filter(Boolean)

    if (origin && !allowedOrigins.includes(origin)) {
      return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      })
    }

    response.headers.delete('X-Powered-By')
    response.headers.delete('Server')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo|gallery|videos|images).*)',
  ],
}
