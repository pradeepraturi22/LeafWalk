import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { allowLocalInternalBypass, isLocalRequestLike, isLocalTestMode } from '@/lib/runtime-mode'
import { logDebug, logWarn } from '@/lib/logger'

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function hasValidInternalSecret(request: NextRequest, envKey = 'INTERNAL_API_SECRET') {
  // LOCAL TEST MODE ONLY
  // REMOVE / DISABLE FOR PRODUCTION
  if (
    allowLocalInternalBypass() &&
    isLocalRequestLike({
      host: request.headers.get('host'),
      origin: request.headers.get('origin'),
      forwardedHost: request.headers.get('x-forwarded-host'),
    })
  ) {
    logDebug('LOCAL TEST MODE internal route bypass allowed for local request')
    return true
  }

  const expected = process.env[envKey]
  if (!expected) return false

  const provided =
    request.headers.get('x-internal-secret') ||
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    ''

  if (!provided) return false
  return secureEqual(provided, expected)
}

export function requireInternalSecret(request: NextRequest, envKey = 'INTERNAL_API_SECRET') {
  if (!hasValidInternalSecret(request, envKey)) {
    if (isLocalTestMode()) {
      logWarn('Internal secret check failed in local test mode')
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
