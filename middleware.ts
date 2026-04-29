import { NextResponse, type NextRequest } from 'next/server'
import { applyRateLimitHeaders, consumeRateLimit } from '@/lib/rate-limit'
import { allowLocalEvalScripts, allowLocalInlineScripts, allowLocalInternalBypass, isLocalRequestLike, isLocalTestMode } from '@/lib/runtime-mode'
import { logDebug } from '@/lib/logger'

const ADMIN_SESSION_COOKIE = 'lw_admin_session'
const PREVIEW_ACCESS_COOKIE = 'lw_preview_access'

const MAINTENANCE_BYPASS = [
  '/maintenance',
  '/api/preview-access',
  '/admin',
  '/api/admin',
  '/_next',
  '/favicon.ico',
]

function hasInternalSecretHeader(request: NextRequest) {
  const expected = process.env.INTERNAL_API_SECRET
  if (!expected) return false
  const provided = request.headers.get('x-internal-secret') || request.headers.get('x-cron-secret') || ''
  return Boolean(provided && provided === expected)
}

function isMaintenanceMode() {
  return process.env.MAINTENANCE_MODE === 'true' || process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
}

function shouldFailClosedOnRateLimitError(pathname: string, method: string) {
  if (pathname.startsWith('/api/admin/')) return true
  if (pathname === '/api/auth/send-otp' || pathname === '/api/auth/verify-otp') return true
  if (pathname.startsWith('/api/payments/')) return true
  if (pathname === '/api/bookings/create' || pathname === '/api/cancel') return true
  if (pathname === '/api/inquiries') return true
  if (pathname === '/api/check-availability') return method !== 'GET'
  return method !== 'GET'
}

function expectsJsonBody(pathname: string) {
  if (pathname === '/api/admin/content-upload') return false
  if (pathname === '/api/payments/webhook') return false
  return true
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

function bytesToBase64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode.apply(null, Array.from(new Uint8Array(bytes)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function verifyAdminSessionCookie(value?: string) {
  if (!value) return false
  const [payload, signature] = value.split('.')
  if (!payload || !signature) return false

  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) return false

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const expected = bytesToBase64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
    if (expected !== signature) return false

    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)))
    const ageMs = Date.now() - Number(session.ts || 0)
    return Boolean(session.userId && ['admin', 'manager'].includes(session.role) && ageMs >= 0 && ageMs <= 8 * 60 * 60 * 1000)
  } catch {
    return false
  }
}

async function verifyPreviewAccessCookie(value?: string) {
  if (!value) return false
  const [payload, signature] = value.split('.')
  if (!payload || !signature) return false

  const secret = process.env.PREVIEW_ACCESS_SECRET
  if (!secret) return false

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const expected = bytesToBase64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
    if (expected !== signature) return false

    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)))
    return Boolean(session.scope === 'preview' && Number(session.exp || 0) > Date.now())
  } catch {
    return false
  }
}

function createNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...Array.from(bytes)))
}

function applySecurityHeaders(response: NextResponse, nonce: string) {
  const scriptDirectives = ["'self'", `'nonce-${nonce}'`, 'https://checkout.razorpay.com', 'https://api.razorpay.com', 'https://cdn.razorpay.com']
  if (allowLocalInlineScripts()) {
    scriptDirectives.splice(2, 0, "'unsafe-inline'")
  }
  if (allowLocalEvalScripts()) {
    scriptDirectives.splice(scriptDirectives.length - 2, 0, "'unsafe-eval'")
  }
  const scriptSrc = `script-src ${scriptDirectives.join(' ')}`

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-site')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      // LOCAL TEST MODE ONLY
      // REMOVE / DISABLE FOR PRODUCTION
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://checkout.razorpay.com https://cdn.razorpay.com https://www.google.com https://maps.gstatic.com",
      "media-src 'self' blob:",
      "connect-src 'self' https://*.supabase.co https://api.razorpay.com https://checkout.razorpay.com https://cdn.razorpay.com https://lumberjack.razorpay.com",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com https://cdn.razorpay.com https://www.google.com https://maps.google.com",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; ')
  )
  response.headers.delete('X-Powered-By')
  response.headers.delete('Server')
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const nonce = createNonce()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  const response = applySecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    nonce
  )
  response.headers.set('x-nonce', nonce)

  if (isMaintenanceMode()) {
    const isBypassed = MAINTENANCE_BYPASS.some((path) => pathname.startsWith(path))
    const hasPreviewAccess = await verifyPreviewAccessCookie(request.cookies.get(PREVIEW_ACCESS_COOKIE)?.value)
    if (!isBypassed && !hasPreviewAccess && pathname !== '/maintenance') {
      return NextResponse.redirect(new URL('/maintenance', request.url))
    }
  }

  const blockedPatterns = [
    /\.(php|asp|aspx|jsp|cgi|env|git|sql|bak|log|conf|yml|yaml|ini|htaccess)$/i,
    /wp-admin|wp-login|wp-content|wordpress/i,
    /\.\.\//,
    /(?:^|\/)\.(git|env|well-known\/acme-challenge\/\.\.)/i,
    /%2e%2e|%252e%252e/i,
    /<script/i,
    /union.*select|drop.*table|insert.*into|exec\(|eval\(/i,
  ]

  if (blockedPatterns.some((pattern) => pattern.test(pathname))) {
    return new NextResponse('Not Found', { status: 404 })
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')

    if (!(await verifyAdminSessionCookie(request.cookies.get(ADMIN_SESSION_COOKIE)?.value))) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  const isInternalAdminNotifyGet = pathname === '/api/admin/notify' && request.method === 'GET'
  const canUseLocalInternalBypass =
    isInternalAdminNotifyGet &&
    allowLocalInternalBypass() &&
    isLocalRequestLike({
      host: request.headers.get('host'),
      origin: request.headers.get('origin'),
      forwardedHost: request.headers.get('x-forwarded-host'),
    })

  if (pathname.startsWith('/api/admin/') && !request.headers.get('authorization')) {
    if (isInternalAdminNotifyGet && hasInternalSecretHeader(request)) {
      return response
    }
    // LOCAL TEST MODE ONLY
    // REMOVE / DISABLE FOR PRODUCTION
    if (canUseLocalInternalBypass) {
      logDebug('LOCAL TEST MODE middleware bypass for /api/admin/notify GET')
      return response
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: response.headers })
  }

  if (pathname.startsWith('/api/')) {
    if (request.method === 'POST' || request.method === 'PATCH' || request.method === 'PUT') {
      const contentType = request.headers.get('content-type') || ''
      if (expectsJsonBody(pathname) && !contentType.includes('application/json')) {
        return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415, headers: response.headers })
      }
    }

    const origin = request.headers.get('origin')
    const allowedOrigins = [
      'https://leafwalk.in',
      'https://www.leafwalk.in',
      isLocalTestMode() ? 'http://localhost:3000' : '',
    ].filter(Boolean)

    if (origin && !allowedOrigins.includes(origin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: response.headers })
    }

    try {
      const result = await consumeRateLimit(request)
      applyRateLimitHeaders(response, result)

      if (!result.allowed) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.', retry_after: result.retryAfter },
          { status: 429, headers: response.headers }
        )
      }
    } catch {
      if (process.env.NODE_ENV === 'production' && shouldFailClosedOnRateLimitError(pathname, request.method)) {
        return NextResponse.json({ error: 'Rate limit service unavailable' }, { status: 503, headers: response.headers })
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo|gallery|videos|images).*)'],
}
