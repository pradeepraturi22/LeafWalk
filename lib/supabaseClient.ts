import { createClient } from '@supabase/supabase-js'

export const isSupabaseBrowserConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

const sessionStorageAdapter = {
  getItem(key: string) {
    if (typeof window === 'undefined') return null
    return window.sessionStorage.getItem(key)
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(key, value)
  },
  removeItem(key: string) {
    if (typeof window === 'undefined') return
    window.sessionStorage.removeItem(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-leafwalk-auth',
    storage: sessionStorageAdapter,
  },
})
