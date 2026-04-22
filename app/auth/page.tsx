'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import OtpLogin from '@/components/otp-login'

const EMAIL_RE = /^(?!.*\.\.)([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})$/i

type AuthMeResponse = {
  user: {
    id: string
    email?: string | null
    phone?: string | null
    name?: string | null
  } | null
  has_profile?: boolean
  requires_profile_completion?: boolean
}

function AuthContent() {
  const params = useSearchParams()
  const redirectParam = params.get('redirect') || '/my-bookings'
  const bookingEmail = params.get('bookingEmail') || ''
  const bookingId = params.get('bookingId') || ''
  const forcedProfileStep = params.get('step') === 'profile'

  const [checkingSession, setCheckingSession] = useState(true)
  const [email, setEmail] = useState(bookingEmail)
  const [showProfileStep, setShowProfileStep] = useState(forcedProfileStep)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
  })

  const canUseOtp = useMemo(() => Boolean(email && EMAIL_RE.test(email)), [email])
  const canSaveProfile = useMemo(
    () => profileForm.full_name.trim().length >= 2 && profileForm.phone.trim().length >= 6,
    [profileForm]
  )

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((response) => response.json())
      .then((result: AuthMeResponse) => {
        if (!result?.user) {
          setCheckingSession(false)
          return
        }

        setEmail(result.user.email || bookingEmail)
        setProfileForm({
          full_name: result.user.name || '',
          phone: result.user.phone || '',
        })

        if (result.requires_profile_completion || forcedProfileStep) {
          setShowProfileStep(true)
          setCheckingSession(false)
          return
        }

        window.location.href = redirectParam
      })
      .catch(() => setCheckingSession(false))
  }, [redirectParam, forcedProfileStep, bookingEmail])

  async function saveProfile() {
    if (!canSaveProfile) {
      toast.error('Please fill your full name and phone number')
      return
    }

    setSavingProfile(true)
    try {
      const response = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: profileForm.full_name,
          phone: profileForm.phone,
          redirect: redirectParam,
          bookingId,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result?.error?.message || result?.error || 'Could not save profile')
      }

      toast.success('Profile saved successfully')
      window.location.href = redirectParam
    } catch (error: any) {
      toast.error(error.message || 'Could not save profile')
    } finally {
      setSavingProfile(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#c9a14a] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-12" style={{ background: 'radial-gradient(circle at top, rgba(201,161,74,0.16), transparent 30%), #0b0b0b' }}>
      <Toaster position="top-center" />
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-full bg-white shadow-lg">
              <Image src="/logo/leafwalk-logo.jpeg" alt="LeafWalk" width={56} height={56} className="h-full w-full object-contain p-1" />
            </div>
            <span className="font-playfair text-3xl text-[#c9a14a]">LeafWalk Resort</span>
          </Link>
          <p className="mt-4 text-sm text-white/45">
            Sign in securely with a one-time code sent to your email.
          </p>
        </div>

        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 lg:p-8">
            {showProfileStep ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#c9a14a]">First-Time Guest</p>
                  <h2 className="mt-2 font-playfair text-3xl text-white">Complete Your Profile</h2>
                  <p className="mt-2 text-sm text-white/45">
                    Profile not found. Please complete your details once to continue.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#c9a14a]/15 bg-[#c9a14a]/8 p-4 text-sm text-[#efd8a0]">
                  Signed in as {email || 'your verified email'}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-white/40">Full Name</label>
                  <input
                    type="text"
                    value={profileForm.full_name}
                    onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#c9a14a] focus:outline-none"
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-white/40">Phone</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#c9a14a] focus:outline-none"
                    placeholder="Mobile number"
                  />
                </div>

                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={!canSaveProfile || savingProfile}
                  className="w-full rounded-xl bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile & Continue'}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-white/40">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#c9a14a] focus:outline-none"
                    placeholder="you@example.com"
                  />
                </div>

                {canUseOtp ? (
                  <OtpLogin
                    email={email}
                    bookingId={bookingId}
                    purpose={bookingId ? 'booking_claim' : 'login'}
                    redirectTo={redirectParam}
                    autoSend={Boolean(bookingId && email)}
                    onSuccess={(result) => {
                      if (result?.requires_profile_completion) {
                        setShowProfileStep(true)
                        setProfileForm((current) => ({
                          ...current,
                          full_name: result?.user?.name || '',
                          phone: result?.user?.phone || '',
                        }))
                        toast.success('Profile not found, please complete your profile')
                        return
                      }
                      toast.success('Welcome back')
                    }}
                  />
                ) : (
                  <div className="rounded-2xl border border-[#c9a14a]/15 bg-[#c9a14a]/8 p-5 text-sm text-[#efd8a0]">
                    Enter a valid email address to receive your OTP.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0b0b]" />}>
      <AuthContent />
    </Suspense>
  )
}
