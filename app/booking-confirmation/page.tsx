'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { formatDate, formatCurrency } from '@/lib/utils'

// Booking confirmation page — reads booking via public API (no RLS issue)
// Booking UUID is unguessable, so public read is safe for confirmation page

interface Booking {
  id: string
  booking_number: string
  guest_name: string
  guest_email: string
  guest_phone: string
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
  booking_status: string
  payment_status: string
  razorpay_payment_id: string
  special_requests: string
  room: { name: string; category: string; featured_image: string }
}

export default function BookingConfirmationPage() {
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const [booking, setBooking]   = useState<Booking | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => { loadBooking() }, [])

  async function loadBooking() {
    const bookingId = searchParams.get('id')
    if (!bookingId) { router.push('/'); return }
    try {
      // Use public API endpoint — booking UUID is unguessable (safe)
      const res = await fetch(`/api/booking-status?id=${encodeURIComponent(bookingId)}`)
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      if (!data?.id) { router.push('/'); return }
      setBooking(data)
    } catch { router.push('/') }
    finally { setLoading(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b]">
      <div className="w-10 h-10 border-2 border-[#c9a14a] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!booking) return null

  const isConfirmed = ['confirmed','checked_in','checked_out','completed'].includes(booking.booking_status)

  return (
    <div className="min-h-screen bg-[#0b0b0b] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Status Banner */}
        <div className={`rounded-2xl p-6 mb-8 text-center ${isConfirmed ? 'bg-green-900/30 border border-green-500/30' : 'bg-yellow-900/30 border border-yellow-500/30'}`}>
          <div className="text-4xl mb-3">{isConfirmed ? '✅' : '⏳'}</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {isConfirmed ? 'Booking Confirmed!' : 'Booking Received'}
          </h1>
          <p className="text-white/60 text-sm">
            Booking #{booking.booking_number}
          </p>
        </div>

        {/* Booking Details */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-6">
          <h2 className="text-white font-semibold text-lg mb-4">Booking Details</h2>
          <div className="space-y-3 text-sm">
            <Row label="Guest Name"   value={booking.guest_name} />
            <Row label="Room"         value={`${booking.room?.name || ''} (${booking.room?.category || ''})`} />
            <Row label="Check-in"     value={formatDate(booking.check_in)} />
            <Row label="Check-out"    value={formatDate(booking.check_out)} />
            <Row label="Nights"       value={`${booking.nights} night${booking.nights > 1 ? 's' : ''}`} />
            <Row label="Rooms"        value={`${booking.rooms_booked} room${booking.rooms_booked > 1 ? 's' : ''}`} />
            <Row label="Adults"       value={`${booking.adults}`} />
            <Row label="Meal Plan"    value={booking.meal_plan} />
            <Row label="Total Amount" value={formatCurrency(booking.total_amount)} gold />
            {booking.payment_status === 'fully_paid' && (
              <Row label="Payment"    value="Paid ✓" green />
            )}
            {booking.razorpay_payment_id && (
              <Row label="Payment ID" value={booking.razorpay_payment_id} />
            )}
          </div>
        </div>

        {/* Contact + CTA */}
        <div className="bg-[#c9a14a]/10 border border-[#c9a14a]/20 rounded-2xl p-5 mb-6 text-center">
          <p className="text-white/80 text-sm mb-1">A confirmation has been sent to</p>
          <p className="text-[#c9a14a] font-medium">{booking.guest_email || booking.guest_phone}</p>
          <p className="text-white/50 text-xs mt-2">For any queries, WhatsApp us at +91 94305 XXXXX</p>
        </div>

        <div className="flex gap-3">
          <Link href="/" className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 text-center text-sm hover:bg-white/5 transition-colors">
            Back to Home
          </Link>
          <Link href="/my-bookings" className="flex-1 py-3 rounded-xl bg-[#c9a14a] text-black font-semibold text-center text-sm hover:bg-[#e0b86a] transition-colors">
            My Bookings
          </Link>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, gold, green }: { label: string; value: string; gold?: boolean; green?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/50">{label}</span>
      <span className={`text-right font-medium ${gold ? 'text-[#c9a14a]' : green ? 'text-green-400' : 'text-white'}`}>
        {value}
      </span>
    </div>
  )
}
