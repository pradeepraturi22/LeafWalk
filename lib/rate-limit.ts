import { NextRequest, NextResponse } from 'next/server'

type RateLimitConfig = {
  limit: number
  windowSec: number
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAtEpochSec: number
  retryAfter: number
}

const DEV_RATE_STORE = new Map<string, { count: number; reset: number }>()

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/check-availability': { limit: 30, windowSec: 60 },
  '/api/auth/send-otp': { limit: 8, windowSec: 60 },
  '/api/auth/verify-otp': { limit: 10, windowSec: 60 },
  '/api/payments/create-order': { limit: 5, windowSec: 60 },
  '/api/payments/verify': { limit: 10, windowSec: 60 },
  '/api/admin/': { limit: 120, windowSec: 60 },
  '/api/': { limit: 100, windowSec: 60 },
}

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || ''
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

export function getRateLimitConfig(pathname: string): RateLimitConfig {
  let config = RATE_LIMITS['/api/']
  for (const [pattern, candidate] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(pattern) && pattern !== '/api/') {
      config = candidate
      break
    }
  }
  return config
}

function buildRateLimitKey(ip: string, pathname: string) {
  return `${ip}:${pathname}`
}

function checkRateLimitDev(ip: string, pathname: string, config: RateLimitConfig): RateLimitResult {
  const key = buildRateLimitKey(ip, pathname)
  const now = Date.now()
  const entry = DEV_RATE_STORE.get(key)

  if (!entry || now > entry.reset) {
    const reset = now + config.windowSec * 1000
    DEV_RATE_STORE.set(key, { count: 1, reset })
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAtEpochSec: Math.ceil(reset / 1000),
      retryAfter: 0,
    }
  }

  entry.count += 1
  const allowed = entry.count <= config.limit
  const retryAfter = allowed ? 0 : Math.max(1, Math.ceil((entry.reset - now) / 1000))

  return {
    allowed,
    remaining: Math.max(config.limit - entry.count, 0),
    resetAtEpochSec: Math.ceil(entry.reset / 1000),
    retryAfter,
  }
}

async function checkRateLimitProd(ip: string, pathname: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const supabaseUrl = getSupabaseUrl()
  const serviceRoleKey = getSupabaseServiceRoleKey()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Durable rate limit backend is not configured')
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_rate_limit`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_key: buildRateLimitKey(ip, pathname),
      p_route: pathname,
      p_limit: config.limit,
      p_window_seconds: config.windowSec,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Durable rate limit RPC failed: ${errorText}`)
  }

  const payload = await response.json()
  const result = Array.isArray(payload) ? payload[0] : payload
  const resetAtMs = Date.parse(String(result.reset_at))
  const retryAfter = result.allowed ? 0 : Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000))

  return {
    allowed: Boolean(result.allowed),
    remaining: Number(result.remaining || 0),
    resetAtEpochSec: Math.ceil(resetAtMs / 1000),
    retryAfter,
  }
}

export async function consumeRateLimit(request: NextRequest): Promise<RateLimitResult> {
  const pathname = request.nextUrl.pathname
  const ip = getClientIp(request)
  const config = getRateLimitConfig(pathname)

  if (process.env.NODE_ENV !== 'production') {
    return checkRateLimitDev(ip, pathname, config)
  }

  return checkRateLimitProd(ip, pathname, config)
}

export function applyRateLimitHeaders(response: NextResponse, result: RateLimitResult) {
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  response.headers.set('X-RateLimit-Reset', String(result.resetAtEpochSec))
  if (!result.allowed && result.retryAfter > 0) {
    response.headers.set('Retry-After', String(result.retryAfter))
  }
  return response
}
