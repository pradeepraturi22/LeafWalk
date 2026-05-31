import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isProduction } from '@/lib/runtime-mode'

const PREVIEW_ACCESS_COOKIE = 'lw_preview_access'
const PREVIEW_ACCESS_TTL_SECONDS = 12 * 60 * 60

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getGrantSecret() {
  return process.env.PREVIEW_ACCESS_SECRET || ''
}

function getSigningSecret() {
  return process.env.PREVIEW_ACCESS_SECRET || ''
}

function safeEquals(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function toBase64Url(value: string) {
  return Buffer.from(value).toString('base64url')
}

function signPayload(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function createPreviewToken(secret: string) {
  const payload = toBase64Url(
    JSON.stringify({
      scope: 'preview',
      exp: Date.now() + PREVIEW_ACCESS_TTL_SECONDS * 1000,
    })
  )
  return `${payload}.${signPayload(payload, secret)}`
}

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  if (value.startsWith('/api/preview-access')) return '/'
  return value
}

function getPreviewCookieDomain(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase()
  if (hostname === 'leafwalk.in' || hostname === 'www.leafwalk.in') {
    return '.leafwalk.in'
  }
  return undefined
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const nextPath = getSafeNextPath(url.searchParams.get('next'))
  const grantSecret = getGrantSecret()
  const signingSecret = getSigningSecret()
  const providedSecret = url.searchParams.get('secret') || request.headers.get('x-preview-secret') || ''
  const cookieDomain = getPreviewCookieDomain(request)

  if (url.searchParams.get('debug') === '1') {
    if (isProduction()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!grantSecret || !providedSecret || !safeEquals(providedSecret, grantSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      previewAccessSecretConfigured: Boolean(process.env.PREVIEW_ACCESS_SECRET),
      internalApiSecretConfigured: Boolean(process.env.INTERNAL_API_SECRET),
      customAuthSecretConfigured: Boolean(process.env.CUSTOM_AUTH_SECRET),
      authSessionSecretConfigured: Boolean(process.env.AUTH_SESSION_SECRET),
      grantSecretConfigured: Boolean(grantSecret),
      signingSecretConfigured: Boolean(signingSecret),
      maintenanceModeConfigured: process.env.MAINTENANCE_MODE === 'true' || process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true',
      nodeEnv: process.env.NODE_ENV || null,
      vercelEnv: process.env.VERCEL_ENV || null,
    })
  }

  if (url.searchParams.get('clear') === '1') {
    const response = NextResponse.redirect(new URL('/maintenance', request.url))
    response.cookies.set({
      name: PREVIEW_ACCESS_COOKIE,
      value: '',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
      domain: cookieDomain,
    })
    return response
  }

  if (!grantSecret || !signingSecret) {
    return NextResponse.json({ error: 'Preview access is not configured' }, { status: 500 })
  }

  if (!providedSecret || !safeEquals(providedSecret, grantSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url))
  response.cookies.set({
    name: PREVIEW_ACCESS_COOKIE,
    value: createPreviewToken(signingSecret),
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PREVIEW_ACCESS_TTL_SECONDS,
    domain: cookieDomain,
  })

  return response
}
