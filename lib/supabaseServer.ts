import { createClient, SupabaseClient } from '@supabase/supabase-js'

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// Export a getter function — avoids top-level init crash at build time
let _admin: SupabaseClient | null = null
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) _admin = createAdminClient()
  return _admin
}

// Named export used across codebase — works at runtime (env vars available)
export const supabaseAdmin: SupabaseClient = (() => {
  // Return a lazy proxy that defers real init until first use
  const handler: ProxyHandler<object> = {
    get(_, prop) {
      return (getSupabaseAdmin() as any)[prop]
    }
  }
  return new Proxy({}, handler) as SupabaseClient
})()