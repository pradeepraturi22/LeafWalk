import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// getSupabaseAdmin() is NOT exported as a constant to avoid build-time init
// Use getSupabaseAdmin() directly in your route handlers
export const supabaseAdmin = getSupabaseAdmin
