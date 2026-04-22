'use client'

import { useEffect, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { formatDate, formatDateTime } from '@/lib/utils'

interface Booking {
  id: string
  booking_number?: string | null
  invoice_number?: string | null
  check_in: string
  check_out: string
  nights: number
  rooms_booked: number
  adults: number
  meal_plan: string
  total_amount: number
  discount_amount: number
  promo_code: string | null
  booking_status: string
  payment_status: string
  subtotal?: number
  cgst?: number
  sgst?: number
  gst_total?: number
  payment_id?: string | null
  guest_name: string
  guest_email: string
  guest_phone: string
  razorpay_payment_id: string | null
  created_at: string
  special_requests: string | null
  room?: any | null
}

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-green-500/15 text-green-400 border-green-500/25',
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/25',
  completed: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  checked_in: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  checked_out: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
}

const PAY_STYLE: Record<string, string> = {
  fully_paid: 'bg-green-500/15 text-green-400',
  partially_paid: 'bg-yellow-500/15 text-yellow-400',
  pending: 'bg-yellow-500/15 text-yellow-400',
  failed: 'bg-red-500/15 text-red-400',
  refunded: 'bg-blue-500/15 text-blue-400',
}

const MEAL_LABELS: Record<string, string> = {
  EP: 'Room Only',
  CP: 'With Breakfast',
  MAP: 'Breakfast + Dinner',
  AP: 'All Meals',
}

export default function MyBookingsPage() {
  const [user, setUser] = useState<any>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    void loadPage()
  }, [])

  async function loadPage() {
    try {
      const response = await fetch('/api/my-bookings', { cache: 'no-store' })

      if (response.status === 401) {
        window.location.href = '/auth?redirect=/my-bookings'
        return
      }

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result?.error?.message || result.error || 'Could not load bookings')
      }

      setUser(result.user)
      setBookings(result.bookings || [])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  async function downloadReceipt(booking: Booking) {
    setDownloading(booking.id)
    try {
      const { generateBookingReceipt } = await import('@/lib/booking-receipt-generator')
      generateBookingReceipt(booking)
      toast.success('Invoice opened successfully')
    } catch (error) {
      console.error(error)
      toast.error('Failed to generate receipt. Please try again.')
    } finally {
      setDownloading(null)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/auth?redirect=/my-bookings'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b]">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#c9a14a] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] px-4 py-12">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a14a]">My Account</p>
            <h1 className="font-playfair text-3xl text-white">My Bookings</h1>
            {user && (
              <p className="mt-2 text-sm text-white/40">
                Signed in as {user.name || user.email}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <a href="/rooms" className="rounded-xl bg-[#c9a14a] px-5 py-3 text-sm font-semibold text-black">
              New Booking
            </a>
            <button onClick={logout} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70">
              Logout
            </button>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="rounded-3xl border border-white/8 bg-white/[0.03] py-24 text-center">
            <div className="mb-5 text-6xl">Stay</div>
            <h2 className="font-playfair text-2xl text-white">No bookings yet</h2>
            <p className="mt-3 text-sm text-white/40">Your booking history will appear here after your first reservation.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {bookings.map((booking) => {
              const isPast = new Date(booking.check_out) < new Date()
              const isExpanded = expanded === booking.id
              const canDownload = ['confirmed', 'completed', 'checked_in', 'checked_out'].includes(booking.booking_status) && booking.payment_status !== 'failed'

              return (
                <div key={booking.id} className={`overflow-hidden rounded-2xl border ${isPast ? 'border-white/5 opacity-80' : 'border-white/10'} bg-white/[0.03]`}>
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl">
                        {booking.room?.featured_image ? (
                          <Image src={booking.room.featured_image} alt={booking.room.name || 'Room'} fill className="object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-white/5 text-2xl">Stay</div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-white">{booking.room?.name || 'Room'}</h3>
                            <p className="mt-0.5 text-xs text-white/40">
                              {formatDate(`${booking.check_in}T12:00:00`)}
                              {' -> '}
                              {formatDate(`${booking.check_out}T12:00:00`)}
                              {' · '}{booking.nights} night{booking.nights > 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-[#c9a14a]">INR {booking.total_amount.toLocaleString()}</div>
                            <div className="text-xs text-white/30">Total paid</div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[booking.booking_status] || 'bg-white/10 text-white/50'}`}>
                            {booking.booking_status.replace(/_/g, ' ')}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PAY_STYLE[booking.payment_status] || 'bg-white/10 text-white/50'}`}>
                            {booking.payment_status.replace(/_/g, ' ')}
                          </span>
                          {booking.promo_code && (
                            <span className="rounded-full border border-[#c9a14a]/20 bg-[#c9a14a]/15 px-2.5 py-1 text-xs font-semibold text-[#c9a14a]">
                              {booking.promo_code}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
                      <button onClick={() => setExpanded(isExpanded ? null : booking.id)} className="text-xs font-semibold text-white/45 hover:text-[#c9a14a]">
                        {isExpanded ? 'Less details' : 'View details'}
                      </button>
                      <div className="flex flex-wrap justify-end gap-2">
                        {canDownload && (
                          <button
                            onClick={() => downloadReceipt(booking)}
                            disabled={downloading === booking.id}
                            className="rounded-xl border border-[#c9a14a]/25 bg-[#c9a14a]/12 px-4 py-2 text-xs font-semibold text-[#c9a14a] disabled:opacity-50"
                          >
                            {downloading === booking.id ? 'Generating...' : 'Receipt / Invoice'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-white/5 px-5 pb-5 pt-1">
                      <div className="grid gap-4 text-sm sm:grid-cols-2">
                        <div className="space-y-2">
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Stay Details</h4>
                          {[
                            ['Rooms', `${booking.rooms_booked} room${booking.rooms_booked > 1 ? 's' : ''}`],
                            ['Guests', `${booking.adults} adult${booking.adults > 1 ? 's' : ''}`],
                            ['Meal Plan', `${booking.meal_plan} — ${MEAL_LABELS[booking.meal_plan] || booking.meal_plan}`],
                            ['Email', booking.guest_email],
                            ['Phone', booking.guest_phone],
                            booking.special_requests ? ['Special Request', booking.special_requests] : null,
                          ].filter(Boolean).map(([label, value]) => (
                            <div key={String(label)} className="flex justify-between gap-4">
                              <span className="text-white/40">{label}</span>
                              <span className="text-right text-xs text-white">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Payment Details</h4>
                          {[
                            ['Booking ID', `${booking.id.slice(0, 8).toUpperCase()}...`],
                            booking.razorpay_payment_id ? ['Payment ID', `${booking.razorpay_payment_id.slice(0, 16)}...`] : null,
                            booking.promo_code ? ['Promo Code', booking.promo_code] : null,
                            booking.discount_amount > 0 ? ['Discount', `INR ${booking.discount_amount.toLocaleString()}`] : null,
                            ['Subtotal', `INR ${(booking.subtotal || 0).toLocaleString()}`],
                            ['CGST', `INR ${(booking.cgst || 0).toLocaleString()}`],
                            ['SGST', `INR ${(booking.sgst || 0).toLocaleString()}`],
                            ['Total Amount', `INR ${booking.total_amount.toLocaleString()}`],
                            ['Booked On', formatDateTime(booking.created_at)],
                          ].filter(Boolean).map(([label, value]) => (
                            <div key={String(label)} className="flex justify-between gap-4">
                              <span className="text-white/40">{label}</span>
                              <span className="text-right font-mono text-xs text-white">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
