import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

export const CUSTOMER_SESSION_COOKIE = 'leafwalk_customer_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const DEFAULT_IDLE_TIMEOUT_MS = 1000 * 60 * 60 * 2

export type CustomerProfile = {
  id: string
  email: string | null
  phone: string | null
  name: string | null
  role: string | null
  email_verified?: boolean | null
  phone_verified?: boolean | null
  created_at?: string
  updated_at?: string
}

type SessionPayload = {
  email: string
  userId?: string | null
  exp: number
  lastActivity?: number
}

const CUSTOMER_PROFILE_SELECT = 'id,email,phone,name,role,email_verified,phone_verified,created_at,updated_at'

function getSessionSecret() {
  const secret = process.env.CUSTOM_AUTH_SECRET || process.env.AUTH_SESSION_SECRET
  if (!secret) {
    throw new Error('CUSTOM_AUTH_SECRET is not configured')
  }
  return secret
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signPayload(encodedPayload: string) {
  return crypto.createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url')
}

function verifySignature(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function getSessionIdleTimeoutMs() {
  const minutes = Number(process.env.CUSTOMER_SESSION_IDLE_MINUTES || 120)
  if (!Number.isFinite(minutes) || minutes <= 0) return DEFAULT_IDLE_TIMEOUT_MS
  return minutes * 60 * 1000
}

export function normalizeEmail(email?: string | null) {
  return String(email || '').trim().toLowerCase() || null
}

export function normalizePhone(phone?: string | null) {
  return String(phone || '').trim() || null
}

export function createCustomerSessionToken(input: { email: string; userId?: string | null }) {
  const email = normalizeEmail(input.email)
  if (!email) throw new Error('Verified email is required to create a session')

  const payload: SessionPayload = {
    email,
    userId: input.userId || null,
    exp: Date.now() + SESSION_TTL_MS,
    lastActivity: Date.now(),
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  return `${encodedPayload}.${signPayload(encodedPayload)}`
}

export function verifyCustomerSessionToken(token?: string | null) {
  if (!token) return null

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  const expectedSignature = signPayload(encodedPayload)
  if (!verifySignature(signature, expectedSignature)) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload
    if (!payload.email || !payload.exp || payload.exp < Date.now()) return null
    if (payload.lastActivity && Date.now() - payload.lastActivity > getSessionIdleTimeoutMs()) return null
    return payload
  } catch {
    return null
  }
}

export function getCustomerSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value || null
  return verifyCustomerSessionToken(token)
}

export function setCustomerSessionCookie(input: { email: string; userId?: string | null }) {
  const token = createCustomerSessionToken(input)
  cookies().set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
  return token
}

export function refreshCustomerSessionCookie(input: { email: string; userId?: string | null }) {
  return setCustomerSessionCookie(input)
}

export function clearCustomerSessionCookie() {
  cookies().set(CUSTOMER_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  })
}

function buildFallbackUser(email: string): CustomerProfile {
  return {
    id: `pending:${email}`,
    email,
    phone: null,
    name: null,
    role: 'user',
    email_verified: true,
    phone_verified: false,
  }
}

export async function getExistingCustomerProfile(input: { userId?: string | null; email?: string | null }) {
  const normalizedEmail = normalizeEmail(input.email)
  const supabase = getSupabaseAdmin()

  if (input.userId) {
    const { data: legacyById } = await supabase
      .from('users')
      .select(CUSTOMER_PROFILE_SELECT)
      .eq('id', input.userId)
      .maybeSingle() as any

    if (legacyById) return legacyById as CustomerProfile
  }

  if (!normalizedEmail) return null

  const { data: byEmail } = await supabase
    .from('users')
    .select(CUSTOMER_PROFILE_SELECT)
    .eq('email', normalizedEmail)
    .maybeSingle() as any

  return (byEmail || null) as CustomerProfile | null
}

export async function getAuthenticatedCustomer(request: NextRequest) {
  const session = getCustomerSessionFromRequest(request)
  if (!session) return null

  const email = normalizeEmail(session.email)
  if (!email) return null

  const profile = await getExistingCustomerProfile({
    email,
  })

  return {
    userId: profile?.id || null,
    session,
    hasProfile: Boolean(profile),
    user: profile || buildFallbackUser(email),
    profile,
  }
}

export async function findCustomerByEmailOrPhone(email?: string | null, phone?: string | null) {
  const normalizedEmail = normalizeEmail(email)
  const normalizedPhone = normalizePhone(phone)

  if (!normalizedEmail && !normalizedPhone) {
    return null
  }

  if (normalizedEmail) {
    const { data, error } = await getSupabaseAdmin()
      .from('users')
      .select(CUSTOMER_PROFILE_SELECT)
      .eq('email', normalizedEmail)
      .maybeSingle() as any

    if (error && error.code !== 'PGRST116') throw new Error(error.message || 'Could not load customer')
    if (data) return data as CustomerProfile
  }

  if (normalizedPhone) {
    const { data, error } = await getSupabaseAdmin()
      .from('users')
      .select(CUSTOMER_PROFILE_SELECT)
      .eq('phone', normalizedPhone)
      .maybeSingle() as any

    if (error && error.code !== 'PGRST116') throw new Error(error.message || 'Could not load customer')
    if (data) return data as CustomerProfile
  }

  return null
}

export async function ensureCustomerAccount(input: {
  name?: string | null
  email?: string | null
  phone?: string | null
  emailVerified?: boolean
  phoneVerified?: boolean
}) {
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedPhone = normalizePhone(input.phone)
  const safeName = String(input.name || '').trim() || null

  if (!normalizedEmail && !normalizedPhone) {
    throw new Error('Email or phone is required to create a customer account')
  }

  const existing = await findCustomerByEmailOrPhone(normalizedEmail, normalizedPhone)
  if (existing) {
    const { data, error } = await getSupabaseAdmin()
      .from('users')
      .update({
        name: safeName ?? existing.name,
        email: existing.email || normalizedEmail,
        phone: normalizedPhone ?? existing.phone,
        email_verified: input.emailVerified ?? existing.email_verified ?? false,
        phone_verified: input.phoneVerified ?? existing.phone_verified ?? false,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', existing.id)
      .select(CUSTOMER_PROFILE_SELECT)
      .single() as any

    if (error || !data) throw new Error(error?.message || 'Could not update customer account')
    return data as CustomerProfile
  }

  const payload = {
    id: crypto.randomUUID(),
    name: safeName,
    email: normalizedEmail,
    phone: normalizedPhone,
    role: 'user',
    email_verified: input.emailVerified ?? false,
    phone_verified: input.phoneVerified ?? false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .insert(payload as any)
    .select(CUSTOMER_PROFILE_SELECT)
    .single() as any

  if (!error && data) return data as CustomerProfile

  if (error?.code === '23505') {
    const retry = await findCustomerByEmailOrPhone(normalizedEmail, normalizedPhone)
    if (retry) return retry
  }

  throw new Error(error?.message || 'Could not create customer account')
}
