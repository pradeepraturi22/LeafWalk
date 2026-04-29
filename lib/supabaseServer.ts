import { createClient } from '@supabase/supabase-js'
import { isDevelopment } from '@/lib/runtime-mode'

export function hasSupabaseAnonEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function hasSupabaseServerEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function applyLocalSupabaseTlsWorkaround() {
  // LOCAL DEVELOPMENT ONLY
  // REMOVE / DISABLE FOR PRODUCTION
  // Some Windows/local Node installs do not trust the local issuer chain used when
  // calling Supabase from server routes, causing UNABLE_TO_GET_ISSUER_CERT_LOCALLY.
  // Browser auth can still work, but server-side auth.getUser/fetch fails. This is
  // intentionally blocked in production.
  if (!isDevelopment()) return
  if (process.env.DISABLE_LOCAL_SUPABASE_TLS_WORKAROUND === 'true') return
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') return
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

export function getSupabaseAnon() {
  applyLocalSupabaseTlsWorkaround()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!hasSupabaseAnonEnv() || !supabaseUrl || !anonKey) {
    throw new Error('Supabase anon environment variables are not configured')
  }

  return createClient(
    supabaseUrl,
    anonKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export function getSupabaseAdmin() {
  applyLocalSupabaseTlsWorkaround()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!hasSupabaseServerEnv() || !supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase server environment variables are not configured')
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// getSupabaseAdmin() is NOT exported as a constant to avoid build-time init
// Use getSupabaseAdmin() directly in your route handlers
export const supabaseAdmin = getSupabaseAdmin
