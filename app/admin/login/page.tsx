// app/admin/login/page.tsx
'use client'
import React from 'react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import toast, { Toaster } from 'react-hot-toast'

export default function AdminLogin() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [checking, setChecking] = useState(true)
  const [showPwd,  setShowPwd]  = useState(false)

  // If already logged in as admin, skip login page
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.access_token) { setChecking(false); return }
      try {
        const res = await fetch('/api/admin/verify', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        })
        if (res.ok) { window.location.href = '/admin/dashboard'; return }
      } catch {}
      setChecking(false)
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Enter email and password'); return }
    setLoading(true)

    // Step 1: Sign in with Supabase auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      toast.error('Incorrect email or password')
      setLoading(false); return
    }

    // Step 2: Verify role via server-side API (service role, no RLS issues)
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.session?.access_token}`,
      },
    })

    if (res.status === 401 || res.status === 404) {
      toast.error('User profile not found. Contact system administrator.')
      await supabase.auth.signOut()
      setLoading(false); return
    }
    if (res.status === 403) {
      const d = await res.json()
      toast.error(`Access denied. Your role is "${d.role || 'user'}" — Admin/Manager only.`)
      await supabase.auth.signOut()
      setLoading(false); return
    }
    if (!res.ok) {
      toast.error('Verification failed. Please try again.')
      await supabase.auth.signOut()
      setLoading(false); return
    }

    const { role, name } = await res.json()
    toast.success(`Welcome back, ${name || email.split('@')[0]}!`)
    // Hard redirect after short delay (let toast show)
    setTimeout(() => { window.location.href = '/admin/dashboard' }, 700)
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b0b' }}>
      <div className="w-8 h-8 border-2 border-[#c9a14a] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b0b0b] via-[#1a1200] to-[#0b0b0b] px-4">
      <Toaster position="top-center" />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-playfair text-[#c9a14a] mb-2">LeafWalk Resort</h1>
          <p className="text-white/50">Admin &amp; Manager Portal</p>
        </div>

        <form onSubmit={handleLogin}
          className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl space-y-5">
          <div>
            <h2 className="text-2xl font-semibold text-white mb-1">Welcome Back</h2>
            <p className="text-white/40 text-sm">Sign in to access the admin panel</p>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">Email Address</label>
            <input type="email" placeholder="admin@leafwalk.in" value={email}
              onChange={e => setEmail(e.target.value)} required autoFocus
              className="w-full px-4 py-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#c9a14a] transition-colors" />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">Password</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} placeholder="Your password" value={password}
                onChange={e => setPassword(e.target.value)} required
                className="w-full px-4 py-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#c9a14a] transition-colors pr-10" />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                {showPwd
                  ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black font-bold py-3.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {loading ? 'Signing in...' : 'Login to Admin Panel'}
          </button>

          <p className="text-center text-white/30 text-xs">
            Forgot password? <a href="/auth" className="text-[#c9a14a] hover:underline">Reset via mobile OTP</a>
          </p>
        </form>

        <p className="text-center text-white/30 text-xs mt-6 flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Secure Admin Access
        </p>
      </div>
    </div>
  )
}