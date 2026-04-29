import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { ZodType } from 'zod'

export const ADMIN_SESSION_COOKIE = 'lw_admin_session'

export function sanitizeString(value: string, maxLength = 500) {
  return value
    .replace(/[<>'"`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function sanitizeEmail(value: string, maxLength = 254) {
  return sanitizeString(value, maxLength).toLowerCase()
}

export function sanitizePhone(value: string, maxLength = 20) {
  return value.replace(/[^\d+]/g, '').slice(0, maxLength)
}

export function sanitizeUnknown<T>(input: T): T {
  if (typeof input === 'string') {
    return sanitizeString(input) as T
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeUnknown(item)) as T
  }
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => [key, sanitizeUnknown(value)])
    ) as T
  }
  return input
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return { success: false as const, response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  }

  const sanitizedPayload = sanitizeUnknown(payload)
  const result = schema.safeParse(sanitizedPayload)

  if (!result.success) {
    return {
      success: false as const,
      response: NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.flatten(),
        },
        { status: 400 }
      ),
    }
  }

  return { success: true as const, data: result.data }
}

export function createAdminSessionValue(userId: string, role: string) {
  const payload = Buffer.from(JSON.stringify({ userId, role, ts: Date.now() })).toString('base64url')
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) throw new Error('Admin session secret is not configured')
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function clearAdminSession(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}

export function setAdminSession(response: NextResponse, userId: string, role: string) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: createAdminSessionValue(userId, role),
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return response
}

export function hasAdminSession(request: NextRequest) {
  return Boolean(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)
}
