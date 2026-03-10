// lib/supabaseServer.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing Supabase service role env vars. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
  )
}

export const getSupabaseAdmin() = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken:  false,
    persistSession:    false,
  },
})
