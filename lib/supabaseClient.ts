import { createClient } from '@supabase/supabase-js'

export function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

// Lazy proxy — no top-level createClient call
const _handler = {
  get(_: any, prop: string) {
    return (getSupabaseClient() as any)[prop]
  }
}
export const supabase = new Proxy({} as ReturnType<typeof getSupabaseClient>, _handler)