'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import OtpLogin from '@/components/otp-login'
import { formatCurrency, formatDate } from '@/lib/utils'

const LAST_CONFIRMED_BOOKING_KEY = 'leafwalk_last_confirmed_booking'

interface Booking {
  id: string
  booking_number: string
  guest_name: string
  guest_email: string
  guest_phone: string
  guest_phone_country?: string
  room_id: string
  check_in: string
  check_out: string
  nights: number
  adults: number
  rooms_booked: number
  meal_plan: string
  total_amount: number
  advance_amount: number
  balance_amount: number
  subtotal?: number
  cgst?: number
  sgst?: number
  gst_total?: number
  booking_status: string
  payment_status: string
  payment_id?: string
  razorpay_payment_id: string
  special_requests: string
  room: { name: string; category: string; featured_image: string }
}

function BookingConfirmationInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [loadTimedOut, setLoadTimedOut] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    void loadBooking()
    void loadSession()
    const timeout = window.setTimeout(() => setLoadTimedOut(true), 10000)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (sessionChecked && loggedIn && booking) {
      router.replace('/my-bookings')
    }
  }, [booking, loggedIn, router, sessionChecked])

  async function loadSession() {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' })
      const result = await response.json()
      setLoggedIn(Boolean(result?.user && !result?.requires_profile_completion))
    } catch {
      setLoggedIn(false)
    } finally {
      setSessionChecked(true)
    }
  }

  async function loadBooking() {
    const bookingId = searchParams.get('id')
    if (!bookingId) {
      setLoadError('Booking reference missing.')
      setLoading(false)
      return
    }

    try {
      const cached = window.sessionStorage.getItem(LAST_CONFIRMED_BOOKING_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed?.booking?.id === bookingId) {
          setBooking(parsed.booking)
          setLoading(false)
          return
        }
      }
    } catch {}

    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, { cache: 'no-store' })
      if (!response.ok) {
        setLoadError('We could not reload your booking details right now.')
        return
      }
      const data = await response.json()
      if (!data?.id) {
        setLoadError('Booking details are temporarily unavailable.')
        return
      }
      setBooking(data)
    } catch {
      setLoadError('Booking details are temporarily unavailable.')
    } finally {
      setLoading(false)
    }
  }

  async function downloadReceipt() {
    if (!booking) return
    setDownloading(true)
    try {
      const { generateBookingReceipt } = await import('@/lib/booking-receipt-generator')
      generateBookingReceipt(booking)
      toast.success('Receipt opened. Print or save as PDF.')
    } catch (error) {
      console.error(error)
      toast.error('Receipt generate nahi hui')
    } finally {
      setDownloading(false)
    }
  }

  async function recoverPaymentStatus() {
    if (!booking) return
    setRecovering(true)
    try {
      const response = await fetch('/api/payments/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.id }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || result?.message || 'Could not verify payment status')
      }
      if (result?.booking?.id) {
        setBooking((current) => current ? { ...current, ...result.booking } : result.booking)
      }
      if (result?.success) {
        toast.success('Payment status refreshed successfully.')
      } else {
        toast(result?.message || 'Payment is still being verified. Please do not pay again immediately.', { icon: 'ℹ️' })
      }
    } catch (error: any) {
      toast.error(error.message || 'Could not verify payment status right now')
    } finally {
      setRecovering(false)
    }
  }

  const loginUrl = useMemo(() => {
    if (!booking) return '/auth?redirect=/my-bookings'
    const params = new URLSearchParams({
      redirect: '/my-bookings',
      bookingId: booking.id,
      bookingEmail: booking.guest_email || '',
      bookingPhone: `${booking.guest_phone_country || ''}${booking.guest_phone || ''}`,
      bookingName: booking.guest_name || '',
    })
    return `/auth?${params.toString()}`
  }, [booking])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b]">
        <div className="text-center space-y-4">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#c9a14a] border-t-transparent" />
          <p className="text-sm text-white/55">Preparing your booking confirmation...</p>
          {loadTimedOut && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-[#c9a14a] px-4 py-2 text-sm font-semibold text-black"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="font-playfair text-3xl text-white">Booking confirmation</h1>
          <p className="mt-3 text-sm text-white/60">{loadError || 'Your payment was received, but the confirmation details are not available yet.'}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                setLoadError('')
                void loadBooking()
              }}
              className="rounded-xl bg-[#c9a14a] px-5 py-3 text-sm font-semibold text-black"
            >
              Retry
            </button>
            <Link href="/" className="rounded-xl border border-white/15 px-5 py-3 text-sm text-white/75">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isConfirmed = ['confirmed', 'checked_in', 'checked_out', 'completed'].includes(booking.booking_status)

  if (loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b] px-4">
        <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#c9a14a] border-t-transparent" />
          <h1 className="font-playfair text-2xl text-white">Opening My Bookings...</h1>
          <p className="mt-2 text-sm text-white/60">Your session is active, so no OTP is needed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] px-4 py-12">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className={`rounded-3xl border p-6 text-center ${isConfirmed ? 'border-green-500/30 bg-green-500/10' : 'border-yellow-500/30 bg-yellow-500/10'}`}>
          <div className="mb-3 text-4xl">{isConfirmed ? 'OK' : '...'}</div>
          <h1 className="font-playfair text-3xl text-white">{isConfirmed ? 'Booking Confirmed' : 'Booking Received'}</h1>
          <p className="mt-2 text-sm text-white/55">Reference {booking.booking_number}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="font-playfair text-2xl text-white">Booking Details</h2>
              <div className="mt-5 space-y-3 text-sm">
                <Row label="Guest Name" value={booking.guest_name} />
                <Row label="Email" value={booking.guest_email} />
                <Row label="Mobile" value={booking.guest_phone} />
                <Row label="Room" value={`${booking.room?.name || ''} (${booking.room?.category || ''})`} />
                <Row label="Check-in" value={formatDate(booking.check_in)} />
                <Row label="Check-out" value={formatDate(booking.check_out)} />
                <Row label="Nights" value={`${booking.nights}`} />
                <Row label="Rooms" value={`${booking.rooms_booked}`} />
                <Row label="Adults" value={`${booking.adults}`} />
                <Row label="Meal Plan" value={booking.meal_plan} />
                <Row label="Total Amount" value={formatCurrency(booking.total_amount)} accent />
                {booking.payment_status === 'fully_paid' && <Row label="Payment" value="Paid in full" green />}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h3 className="font-playfair text-2xl text-white">Invoice & Documents</h3>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={downloadReceipt}
                  disabled={downloading}
                  className="rounded-xl bg-[#c9a14a] px-5 py-3 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {downloading
                    ? 'Generating...'
                    : booking.payment_status === 'fully_paid'
                      ? 'Receipt / Invoice'
                      : 'Download Booking Receipt'}
                </button>
                {booking.payment_status !== 'fully_paid' && (
                  <>
                    <button
                      type="button"
                      onClick={recoverPaymentStatus}
                      disabled={recovering}
                      className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {recovering ? 'Checking...' : 'Check Payment Status'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {!sessionChecked ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#c9a14a] border-t-transparent" />
                <h3 className="font-playfair text-2xl text-white">Checking your session</h3>
                <p className="mt-2 text-sm text-white/60">Please wait while we connect this booking to your account.</p>
              </div>
            ) : (
              <OtpLogin
                name={booking.guest_name}
                email={booking.guest_email}
                phone={`${booking.guest_phone_country || ''}${booking.guest_phone || ''}`}
                bookingId={booking.id}
                purpose="booking_claim"
                redirectTo="/my-bookings"
                autoSend
                onSuccess={() => setLoggedIn(true)}
              />
            )}

            <div className="rounded-3xl border border-[#c9a14a]/15 bg-[#c9a14a]/8 p-5">
              <p className="text-sm text-[#efd8a0]">
                We have sent your confirmation to {booking.guest_email}. If you need help, contact the LeafWalk team on WhatsApp.
              </p>
            </div>

            <div className="flex gap-3">
              <Link href="/" className="flex-1 rounded-xl border border-white/15 px-4 py-3 text-center text-sm text-white/70">
                Back to Home
              </Link>
              <a href={loginUrl} className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-center text-sm text-white">
                Open Login Page
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, accent, green }: { label: string; value: string; accent?: boolean; green?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/45">{label}</span>
      <span className={`text-right font-medium ${accent ? 'text-[#c9a14a]' : green ? 'text-green-400' : 'text-white'}`}>{value}</span>
    </div>
  )
}

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0b0b]" />}>
      <BookingConfirmationInner />
    </Suspense>
  )
}
