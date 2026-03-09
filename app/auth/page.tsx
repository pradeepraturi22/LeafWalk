'use client'
import React from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense, useEffect } from 'react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import Image from 'next/image'

const COUNTRY_CODES = [
  { code: '+91',  flag: '🇮🇳', name: 'India',      re: /^[6-9]\d{9}$/  },
  { code: '+1',   flag: '🇺🇸', name: 'USA/Canada', re: /^\d{10}$/      },
  { code: '+44',  flag: '🇬🇧', name: 'UK',         re: /^\d{10}$/      },
  { code: '+61',  flag: '🇦🇺', name: 'Australia',  re: /^\d{9}$/       },
  { code: '+971', flag: '🇦🇪', name: 'UAE',        re: /^\d{9}$/       },
  { code: '+65',  flag: '🇸🇬', name: 'Singapore',  re: /^\d{8}$/       },
  { code: '+60',  flag: '🇲🇾', name: 'Malaysia',   re: /^\d{9,10}$/    },
  { code: '+977', flag: '🇳🇵', name: 'Nepal',      re: /^\d{10}$/      },
  { code: '+94',  flag: '🇱🇰', name: 'Sri Lanka',  re: /^\d{9}$/       },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh', re: /^\d{10}$/      },
]

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const digits = (value + '      ').slice(0, 6).split('')
  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input key={i} type="text" inputMode="numeric" maxLength={1}
          value={d.trim()}
          onPaste={e => { e.preventDefault(); const p = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6); onChange(p) }}
          onChange={e => {
            const v = e.target.value.replace(/\D/g,'').slice(0,1)
            const arr = (value+'      ').slice(0,6).split('')
            arr[i] = v
            onChange(arr.join('').trimEnd())
            if (v) (e.currentTarget.parentElement?.children[i+1] as HTMLInputElement)?.focus()
          }}
          onKeyDown={e => { if (e.key==='Backspace' && !d.trim() && i>0) (e.currentTarget.parentElement?.children[i-1] as HTMLInputElement)?.focus() }}
          className="w-11 h-13 text-center text-xl font-bold rounded-xl border border-white/20 bg-white/8 text-white focus:border-[#c9a14a] focus:outline-none transition-colors py-3"
        />
      ))}
    </div>
  )
}

type Step = 'signin' | 'signup' | 'phone_otp' | 'forgot_phone' | 'forgot_otp' | 'forgot_newpwd'

function AuthContent() {
  const router = useRouter()
  const params = useSearchParams()
  const redirectParam = params.get('redirect') || '/'
  const roomParam     = params.get('room')
  const redirectTo    = `${redirectParam}${roomParam ? `?room=${roomParam}` : ''}`

  const [step,    setStep]    = useState<Step>('signin')
  const [loading, setLoading] = useState(false)
  const [initDone, setInitDone] = useState(false)

  // Sign-in
  const [siEmail, setSiEmail]   = useState('')
  const [siPwd,   setSiPwd]     = useState('')
  const [showSiPwd, setShowSiPwd] = useState(false)

  // Sign-up
  const [suName,  setSuName]  = useState('')
  const [suEmail, setSuEmail] = useState('')
  const [suPhone, setSuPhone] = useState('')
  const [suCC,    setSuCC]    = useState('+91')
  const [suPwd,   setSuPwd]   = useState('')
  const [showSuPwd, setShowSuPwd] = useState(false)

  // OTP
  const [otp,      setOtp]      = useState('')
  const [sentOtp,  setSentOtp]  = useState('')
  const [otpPhone, setOtpPhone] = useState('')
  const [timer,    setTimer]    = useState(0)
  const [pendingUserId, setPendingUserId] = useState('')

  // Forgot
  const [fpPhone,  setFpPhone]  = useState('')
  const [fpCC,     setFpCC]     = useState('+91')
  const [fpEmail,  setFpEmail]  = useState('')
  const [fpNewPwd, setFpNewPwd] = useState('')
  const [showFpPwd, setShowFpPwd] = useState(false)

  const INP = 'w-full px-4 py-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#c9a14a] transition-colors text-sm'

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const role = session.user.user_metadata?.role as string
        if (role === 'admin' || role === 'manager') {
          window.location.href = '/admin/dashboard'; return
        }
        // Also check DB for role in case metadata not set
        const { data: u } = await supabase.from('users').select('role').eq('id', session.user.id).single()
        if (u?.role === 'admin' || u?.role === 'manager') {
          window.location.href = '/admin/dashboard'; return
        }
        window.location.href = redirectTo
        return
      }
      setInitDone(true)
    })
  }, [])

  useEffect(() => {
    if (timer <= 0) return
    const t = setTimeout(() => setTimer(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [timer])

  function genOtp(phone: string) {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    setSentOtp(code); setOtp(''); setOtpPhone(phone); setTimer(60)
    // In production: call SMS API here (Twilio / MSG91)
    // For now show in toast for testing:
    toast(`🔐 OTP for ${phone}: ${code}`, { duration: 20000, style: { background: '#1a1200', border: '1px solid #c9a14a', color: '#fff' } })
    return code
  }

  // ── SIGN IN ────────────────────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!siEmail || !siPwd) { toast.error('Enter email and password'); return }
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPwd })
    if (error) { toast.error('Incorrect email or password'); setLoading(false); return }

    // Get role — first from metadata, then from DB
    let role = data.user.user_metadata?.role as string | undefined
    if (!role) {
      const { data: u } = await supabase.from('users').select('role,name').eq('id', data.user.id).single()
      role = u?.role
      // Update metadata for faster future logins
      if (u?.role) await supabase.auth.updateUser({ data: { role: u.role, name: u.name } })
    }

    setLoading(false)
    toast.success('Welcome back!')

    // Hard redirect — avoids Next.js router race condition with session
    if (role === 'admin' || role === 'manager') {
      setTimeout(() => { window.location.href = '/admin/dashboard' }, 600)
    } else {
      setTimeout(() => { window.location.href = redirectTo }, 600)
    }
  }

  // ── SIGN UP ────────────────────────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    const name  = suName.trim()
    const phone = suPhone.replace(/\D/g,'')
    if (!name || !suEmail || !phone || !suPwd) { toast.error('All fields are required'); return }
    if (suPwd.length < 6) { toast.error('Password must be at least 6 characters'); return }

    const cc = COUNTRY_CODES.find(c => c.code === suCC)
    if (cc && !cc.re.test(phone)) { toast.error(`Enter a valid ${cc.name} mobile number`); return }

    setLoading(true)

    // Check duplicates
    const fullPhone = suCC + phone
    const { data: phoneDup } = await supabase.from('users').select('id').eq('phone', fullPhone).maybeSingle()
    if (phoneDup) { toast.error('This mobile number is already registered. Please sign in.'); setLoading(false); return }

    const { data: emailDup } = await supabase.from('users').select('id').ilike('email', suEmail).maybeSingle()
    if (emailDup) { toast.error('This email is already registered. Please sign in.'); setLoading(false); return }

    // Create auth user
    const { data, error } = await supabase.auth.signUp({ email: suEmail, password: suPwd })
    if (error) { toast.error(error.message); setLoading(false); return }

    if (data.user) {
      setPendingUserId(data.user.id)
      // Insert into users table
      await supabase.from('users').upsert({
        id: data.user.id, email: suEmail.toLowerCase(),
        name, phone: fullPhone, role: 'user',
      })
      genOtp(fullPhone)
      setStep('phone_otp')
    }
    setLoading(false)
  }

  // ── VERIFY SIGNUP OTP ──────────────────────────────────────────────────────
  async function verifySignupOtp() {
    if (otp.replace(/\s/g,'').length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    if (otp.replace(/\s/g,'') !== sentOtp)  { toast.error('Incorrect OTP'); return }
    setLoading(true)
    await supabase.from('users').update({ phone_verified: true }).eq('id', pendingUserId)
    toast.success('Mobile verified! Account ready.')
    setTimeout(() => { window.location.href = redirectTo }, 800)
    setLoading(false)
  }

  // ── FORGOT — enter phone ───────────────────────────────────────────────────
  async function handleForgotPhone(e: React.FormEvent) {
    e.preventDefault()
    const phone = fpPhone.replace(/\D/g,'')
    if (!phone) { toast.error('Enter your registered mobile number'); return }
    setLoading(true)
    const fullPhone = fpCC + phone
    const { data: users } = await supabase.from('users').select('id,email').eq('phone', fullPhone).maybeSingle()
    if (!users) { toast.error('No account found with this mobile number'); setLoading(false); return }
    setFpEmail(users.email)
    genOtp(fullPhone)
    setStep('forgot_otp')
    setLoading(false)
  }

  // ── FORGOT — verify OTP ────────────────────────────────────────────────────
  function verifyForgotOtp() {
    if (otp.replace(/\s/g,'').length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    if (otp.replace(/\s/g,'') !== sentOtp)  { toast.error('Incorrect OTP'); return }
    setStep('forgot_newpwd')
  }

  // ── FORGOT — set new password ──────────────────────────────────────────────
  async function handleResetPwd(e: React.FormEvent) {
    e.preventDefault()
    if (fpNewPwd.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fpEmail, new_password: fpNewPwd }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error || 'Reset failed. Try again.'); return }
    toast.success('Password reset! Please sign in.')
    setStep('signin')
    setSiEmail(fpEmail)
  }

  const CCSel = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="px-2 py-3 rounded-xl border border-white/15 text-sm focus:outline-none focus:border-[#c9a14a] bg-white/8 text-white shrink-0"
      style={{ width: '130px' }}>
      {COUNTRY_CODES.map(c => (
        <option key={c.code} value={c.code} style={{ background: '#1a1a1a', color: '#fff' }}>
          {c.flag} {c.code} {c.name}
        </option>
      ))}
    </select>
  )

  const EyeBtn = ({ show, toggle }: { show: boolean; toggle: () => void }) => (
    <button type="button" onClick={toggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {show
          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
        }
      </svg>
    </button>
  )

  if (!initDone) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b0b' }}>
      <div className="w-8 h-8 border-2 border-[#c9a14a] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const TabBar = ({ active }: { active: 'signin' | 'signup' }) => (
    <div className="flex border-b border-white/10">
      {(['signin','signup'] as const).map(t => (
        <button key={t} onClick={() => setStep(t)}
          className={`flex-1 py-4 text-sm font-semibold transition-all ${active===t ? 'text-[#c9a14a] border-b-2 border-[#c9a14a] bg-[#c9a14a]/5' : 'text-white/50 hover:text-white/70'}`}>
          {t === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'radial-gradient(ellipse at top, #1a1200 0%, #0b0b0b 60%)' }}>
      <Toaster position="top-center" toastOptions={{ duration: 5000 }} />

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white overflow-hidden shadow-lg">
              <Image src="/logo/leafwalk-logo.jpeg" alt="LeafWalk" width={48} height={48} className="object-contain p-1" />
            </div>
            <span className="font-playfair text-2xl text-[#c9a14a]">LeafWalk Resort</span>
          </Link>
          {roomParam && <p className="mt-3 text-white/50 text-sm">Sign in to continue with your booking</p>}
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">

          {/* ── SIGN IN ──────────────────────────────────────────────── */}
          {step === 'signin' && (
            <>
              <TabBar active="signin" />
              <form onSubmit={handleSignIn} className="p-8 space-y-4">
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Email Address</label>
                  <input type="email" placeholder="you@example.com" value={siEmail}
                    onChange={e => setSiEmail(e.target.value)} className={INP} required autoFocus />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showSiPwd ? 'text' : 'password'} placeholder="Your password"
                      value={siPwd} onChange={e => setSiPwd(e.target.value)} className={INP} required />
                    <EyeBtn show={showSiPwd} toggle={() => setShowSiPwd(v => !v)} />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2">
                  {loading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <p className="text-center text-xs text-white/30 pt-1">
                  <button type="button" onClick={() => { setStep('forgot_phone'); setFpPhone(''); setFpCC('+91') }}
                    className="text-[#c9a14a] hover:underline">Forgot password?</button>
                  {' — reset via mobile OTP'}
                </p>
              </form>
            </>
          )}

          {/* ── SIGN UP ───────────────────────────────────────────────── */}
          {step === 'signup' && (
            <>
              <TabBar active="signup" />
              <form onSubmit={handleSignUp} className="p-8 space-y-4">
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Full Name <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="Your full name" value={suName}
                    onChange={e => setSuName(e.target.value)} className={INP} required autoFocus />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Email Address <span className="text-red-400">*</span></label>
                  <input type="email" placeholder="you@example.com" value={suEmail}
                    onChange={e => setSuEmail(e.target.value)} className={INP} required />
                  <p className="text-xs text-white/30 mt-1">You can verify email after login</p>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Mobile Number <span className="text-red-400">*</span> <span className="text-white/30">(OTP verification required)</span></label>
                  <div className="flex gap-2">
                    <CCSel value={suCC} onChange={v => { setSuCC(v); setSuPhone('') }} />
                    <input type="tel" inputMode="numeric" value={suPhone}
                      placeholder={suCC === '+91' ? '10-digit number' : 'Mobile number'}
                      onChange={e => setSuPhone(e.target.value.replace(/\D/g,'').slice(0,15))}
                      className={`flex-1 ${INP}`} required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Password <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input type={showSuPwd ? 'text' : 'password'} placeholder="Min 6 characters"
                      value={suPwd} onChange={e => setSuPwd(e.target.value)} className={INP} required minLength={6} />
                    <EyeBtn show={showSuPwd} toggle={() => setShowSuPwd(v => !v)} />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2">
                  {loading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {loading ? 'Creating...' : 'Create Account & Verify Mobile'}
                </button>
              </form>
            </>
          )}

          {/* ── PHONE OTP ────────────────────────────────────────────── */}
          {step === 'phone_otp' && (
            <div className="p-8 space-y-6 text-center">
              <div><div className="text-5xl mb-3">📱</div>
                <h2 className="text-white font-semibold text-lg">Verify Your Mobile</h2>
                <p className="text-white/40 text-sm mt-1">OTP sent to <strong className="text-white">{otpPhone}</strong></p>
              </div>
              <OtpInput value={otp} onChange={setOtp} />
              <button onClick={verifySignupOtp} disabled={loading || otp.replace(/\s/g,'').length < 6}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black font-bold text-sm disabled:opacity-40 transition-all">
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
              {timer > 0
                ? <p className="text-white/30 text-xs">Resend in {timer}s</p>
                : <button onClick={() => genOtp(otpPhone)} className="text-[#c9a14a] text-xs hover:underline">Resend OTP</button>
              }
              <button onClick={() => setStep('signup')} className="text-white/20 text-xs hover:text-white/40">← Back</button>
            </div>
          )}

          {/* ── FORGOT PHONE ──────────────────────────────────────────── */}
          {step === 'forgot_phone' && (
            <div className="p-8 space-y-5">
              <div className="text-center">
                <div className="text-4xl mb-3">🔑</div>
                <h2 className="text-white font-semibold text-lg">Reset Password</h2>
                <p className="text-white/40 text-sm mt-1">Enter your registered mobile number</p>
              </div>
              <form onSubmit={handleForgotPhone} className="space-y-4">
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Mobile Number</label>
                  <div className="flex gap-2">
                    <CCSel value={fpCC} onChange={setFpCC} />
                    <input type="tel" inputMode="numeric" value={fpPhone}
                      placeholder={fpCC === '+91' ? '10-digit number' : 'Mobile number'}
                      onChange={e => setFpPhone(e.target.value.replace(/\D/g,'').slice(0,15))}
                      className={`flex-1 ${INP}`} required />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black font-bold text-sm disabled:opacity-40 transition-all">
                  {loading ? 'Checking...' : 'Send OTP'}
                </button>
              </form>
              <button onClick={() => setStep('signin')} className="w-full text-center text-xs text-white/30 hover:text-white/50">← Back to Sign In</button>
            </div>
          )}

          {/* ── FORGOT OTP ────────────────────────────────────────────── */}
          {step === 'forgot_otp' && (
            <div className="p-8 space-y-6 text-center">
              <div><div className="text-5xl mb-3">📱</div>
                <h2 className="text-white font-semibold text-lg">Enter OTP</h2>
                <p className="text-white/40 text-sm mt-1">OTP sent to <strong className="text-white">{otpPhone}</strong></p>
              </div>
              <OtpInput value={otp} onChange={setOtp} />
              <button onClick={verifyForgotOtp} disabled={otp.replace(/\s/g,'').length < 6}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black font-bold text-sm disabled:opacity-40 transition-all">
                Verify OTP
              </button>
              {timer > 0
                ? <p className="text-white/30 text-xs">Resend in {timer}s</p>
                : <button onClick={() => genOtp(otpPhone)} className="text-[#c9a14a] text-xs hover:underline">Resend OTP</button>
              }
              <button onClick={() => setStep('forgot_phone')} className="text-white/20 text-xs hover:text-white/40">← Back</button>
            </div>
          )}

          {/* ── FORGOT NEW PASSWORD ──────────────────────────────────── */}
          {step === 'forgot_newpwd' && (
            <div className="p-8 space-y-5">
              <div className="text-center">
                <div className="text-4xl mb-3">🔒</div>
                <h2 className="text-white font-semibold text-lg">Set New Password</h2>
                <p className="text-white/40 text-sm mt-1">Choose a strong password</p>
              </div>
              <form onSubmit={handleResetPwd} className="space-y-4">
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">New Password</label>
                  <div className="relative">
                    <input type={showFpPwd ? 'text' : 'password'} placeholder="Min 6 characters"
                      value={fpNewPwd} onChange={e => setFpNewPwd(e.target.value)}
                      className={INP} minLength={6} required autoFocus />
                    <EyeBtn show={showFpPwd} toggle={() => setShowFpPwd(v => !v)} />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black font-bold text-sm disabled:opacity-40 transition-all">
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </div>
          )}

        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          <Link href="/" className="hover:text-white/50 transition-colors">← Back to LeafWalk Resort</Link>
        </p>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b0b' }}>
        <div className="w-8 h-8 border-2 border-[#c9a14a] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AuthContent />
    </Suspense>
  )
}