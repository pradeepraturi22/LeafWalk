'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

type OtpLoginProps = {
  name?: string
  email?: string
  phone?: string
  bookingId?: string
  purpose?: 'login' | 'booking_claim' | 'email_fallback'
  autoSend?: boolean
  redirectTo?: string
  onSuccess?: (result: any) => void
  compact?: boolean
}

function maskTarget(target: string) {
  const [local, domain] = target.split('@')
  return `${local.slice(0, 2)}***@${domain}`
}

function OtpBoxes({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = (value + '      ').slice(0, 6).split('')

  return (
    <div className="flex items-center justify-center gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => { refs.current[index] = node }}
          value={digit.trim()}
          inputMode="numeric"
          maxLength={1}
          onPaste={(event) => {
            event.preventDefault()
            const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
            onChange(pasted)
            refs.current[Math.min(pasted.length, 5)]?.focus()
          }}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, '').slice(0, 1)
            const chars = (value + '      ').slice(0, 6).split('')
            chars[index] = next
            onChange(chars.join('').trimEnd())
            if (next) refs.current[index + 1]?.focus()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !digit.trim() && index > 0) refs.current[index - 1]?.focus()
          }}
          className="h-12 w-11 rounded-xl border border-white/15 bg-white/5 text-center text-lg font-bold text-white focus:border-[#c9a14a] focus:outline-none"
        />
      ))}
    </div>
  )
}

export default function OtpLogin({
  email = '',
  bookingId,
  purpose = 'login',
  autoSend = false,
  redirectTo = '/my-bookings',
  onSuccess,
  compact = false,
}: OtpLoginProps) {
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [otpSent, setOtpSent] = useState(false)

  const displayTarget = useMemo(() => (email ? maskTarget(email) : ''), [email])

  useEffect(() => {
    if (!autoSend || !email) return
    void sendOtp()
  }, [autoSend, email])

  useEffect(() => {
    if (!countdown) return
    const timer = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [countdown])

  async function sendOtp() {
    if (!email) {
      toast.error('Email unavailable for OTP')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          bookingId,
          purpose,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result?.error?.message || result?.error || 'Could not send OTP')
      }

      setOtpSent(true)
      setCountdown(30)
      toast.success(result.message || 'If the account exists, an OTP has been sent.')
    } catch (error: any) {
      toast.error(error.message || 'Could not send OTP')
    } finally {
      setSending(false)
    }
  }

  async function verifyOtp() {
    if (otp.replace(/\s/g, '').length !== 6) {
      toast.error('Enter the 6-digit OTP')
      return
    }

    setVerifying(true)
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp: otp.replace(/\s/g, ''),
          bookingId,
          purpose,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result?.error?.message || result?.error || 'OTP verification failed')
      }

      if (result.profile_created) {
        toast.success('Profile created successfully')
      }
      toast.success('Login successful')
      onSuccess?.(result)
      if (!result?.requires_profile_completion) {
        window.location.href = redirectTo
      }
    } catch (error: any) {
      toast.error(error.message || 'OTP verification failed')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.04] ${compact ? 'p-5' : 'p-6'} space-y-5`}>
      <div>
        <h3 className="font-playfair text-2xl text-white">Secure Email OTP Login</h3>
        <p className="mt-1 text-sm text-white/45">
          Use the one-time code sent to your email to continue securely without a password.
        </p>
      </div>

      <div className="rounded-xl border border-[#c9a14a]/15 bg-[#c9a14a]/8 px-4 py-3 text-sm text-[#efd8a0]">
        {displayTarget ? `OTP will be sent to ${displayTarget}` : 'Add a valid email address to receive OTP.'}
      </div>

      <OtpBoxes value={otp} onChange={setOtp} />

      {otpSent && (
        <p className="text-center text-xs text-white/45">
          Enter the 6-digit code sent to your inbox. If it expires, request a new one.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={sendOtp}
          disabled={sending || countdown > 0 || !email}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {sending ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : otpSent ? 'Resend OTP' : 'Send OTP'}
        </button>
        <button
          type="button"
          onClick={verifyOtp}
          disabled={verifying || otp.replace(/\s/g, '').length !== 6 || !email}
          className="flex-1 rounded-xl bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
        >
          {verifying ? 'Verifying...' : 'Verify & Continue'}
        </button>
      </div>
    </div>
  )
}
