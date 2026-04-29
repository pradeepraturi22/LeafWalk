'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'
import { initiateRazorpayPayment, formatPaymentAmount } from '@/lib/razorpay'
import { calculateNights, formatDate, toLocalDateString } from '@/lib/utils'

type CheckoutRoom = {
  id: string
  name: string
  category: string
  display_price_from: number | null
}

type BookingSummary = {
  room_id: string
  check_in: Date
  check_out: Date
  nights: number
  rooms: number
  meal_plan: string
  pricePerRoom: number
  subtotal: number
  cgst: number
  sgst: number
  gst: number
  total: number
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [bookingData, setBookingData] = useState<BookingSummary | null>(null)
  const [room, setRoom] = useState<CheckoutRoom | null>(null)
  const [user, setUser] = useState<any>(null)
  const [hasUserProfile, setHasUserProfile] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    special_requests: '',
  })

  useEffect(() => {
    loadCheckoutData()
  }, [])

  async function loadCheckoutData() {
    try {
      const roomId = searchParams.get('roomId')
      const checkIn = searchParams.get('checkIn')
      const checkOut = searchParams.get('checkOut')
      const qty = searchParams.get('qty')
      const meal = searchParams.get('meal') || 'CP'

      if (!roomId || !checkIn || !checkOut) {
        toast.error('Invalid booking data')
        router.push('/rooms')
        return
      }

      const [{ data: roomData, error: roomError }, authResponse] = await Promise.all([
        supabase
          .from('rooms')
          .select('id,name,category,display_price_from')
          .eq('id', roomId)
          .single(),
        fetch('/api/auth/me', { cache: 'no-store' }),
      ])

      const authPayload = await authResponse.json()

      if (roomError || !roomData) {
        toast.error('Room not found')
        router.push('/rooms')
        return
      }

      setRoom(roomData as CheckoutRoom)

      const authUser = authPayload?.user
      if (authUser && !authPayload?.requires_profile_completion) {
        setUser(authUser)
        setHasUserProfile(true)
        setFormData({
          name: authUser.name || '',
          email: authUser.email || '',
          phone: authUser.phone || '',
          special_requests: '',
        })
      }

      const checkInDate = new Date(checkIn)
      const checkOutDate = new Date(checkOut)
      const nights = calculateNights(checkInDate, checkOutDate)
      const roomsBooked = parseInt(qty || '1', 10)

      const pricingResponse = await fetch('/api/get-room-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          room_category: roomData.category,
          checkInDate: toLocalDateString(checkInDate),
          checkOutDate: toLocalDateString(checkOutDate),
        }),
      })
      const pricingPayload = await pricingResponse.json()
      if (!pricingResponse.ok || !pricingPayload.total?.[meal]) {
        throw new Error(pricingPayload.error || 'No website tariff found for the selected dates')
      }

      const subtotalPerRoom = Number(pricingPayload.total[meal] || 0)
      const pricePerRoom = nights > 0 ? Math.round((subtotalPerRoom / nights) * 100) / 100 : 0
      const subtotal = Math.round(subtotalPerRoom * roomsBooked * 100) / 100
      const cgst = Math.round(subtotal * 0.025 * 100) / 100
      const sgst = Math.round(subtotal * 0.025 * 100) / 100
      const gst = cgst + sgst
      const total = Math.round((subtotal + gst) * 100) / 100

      setBookingData({
        room_id: roomId,
        check_in: checkInDate,
        check_out: checkOutDate,
        nights,
        rooms: roomsBooked,
        meal_plan: meal,
        pricePerRoom,
        subtotal,
        cgst,
        sgst,
        gst,
        total,
      })

      setLoading(false)
    } catch (error) {
      console.error('Error loading checkout:', error)
      toast.error('Failed to load booking details')
      setLoading(false)
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  function validateForm() {
    if (!formData.name.trim()) {
      toast.error('Please enter your name')
      return false
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error('Please enter a valid email')
      return false
    }
    if (!formData.phone.trim() || !/^[6-9]\d{9}$/.test(formData.phone.replace(/\D/g, ''))) {
      toast.error('Please enter a valid 10-digit phone number')
      return false
    }
    return true
  }

  async function resolvePostPaymentRedirect(bookingId: string) {
    if (hasUserProfile) return '/my-bookings'

    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' })
      const result = await response.json()
      if (result?.user && !result?.requires_profile_completion) return '/my-bookings'
    } catch {}

    return `/booking-confirmation?id=${bookingId}`
  }

  async function handlePayment() {
    if (!validateForm() || !bookingData || !room) return

    setProcessing(true)

    try {
      const orderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: bookingData.total,
          receipt: `lwweb_${Date.now()}`,
          notes: { room_name: room.name },
          booking: {
            room_id: bookingData.room_id,
            check_in: toLocalDateString(bookingData.check_in),
            check_out: toLocalDateString(bookingData.check_out),
            nights: bookingData.nights,
            rooms_booked: bookingData.rooms,
            adults: 2,
            children_below_5: 0,
            children_5_to_12: 0,
            children_above_12: 0,
            extra_beds: 0,
            meal_plan: bookingData.meal_plan,
            booking_source: 'website',
            special_requests: formData.special_requests || null,
            guest_name: formData.name,
            guest_email: formData.email,
            guest_phone: formData.phone,
            guest_phone_country: '+91',
            discount_amount: 0,
            discount_percent: 0,
            discount_reason: null,
            promo_code: null,
          },
        }),
      })

      const orderData = await orderResponse.json()
      if (!orderResponse.ok || !orderData.success) {
        throw new Error(orderData.error || 'Failed to create payment order')
      }

      await initiateRazorpayPayment({
        amount: Number(orderData.total_amount || bookingData.total),
        orderId: orderData.order.id,
        userDetails: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone,
        },
        onSuccess: async (_response, verificationResult) => {
          const bookingId = verificationResult?.booking?.id
          if (!bookingId) {
            throw new Error('Booking confirmation did not complete')
          }
          toast.success('Payment successful! Redirecting...')
          const redirectTo = await resolvePostPaymentRedirect(bookingId)
          setTimeout(() => router.push(redirectTo), 2000)
        },
        onFailure: (error) => {
          console.error('Payment failed:', error)
          toast.error('If amount was deducted, please do not pay again immediately. We are verifying your payment.')
          setProcessing(false)
        },
      })
    } catch (error: any) {
      console.error('Checkout error:', error)
      toast.error(error.message || 'Something went wrong')
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-[#c9a14a]" />
      </div>
    )
  }

  if (!bookingData || !room) return null

  return (
    <div className="min-h-screen bg-[#0b0b0b] px-4 py-12">
      <Toaster position="top-center" />

      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-center font-playfair text-4xl text-[#c9a14a]">
          Complete Your Booking
        </h1>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h2 className="mb-6 font-playfair text-2xl text-white">Guest Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-white/70">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white focus:border-[#c9a14a] focus:outline-none"
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-white/70">Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white focus:border-[#c9a14a] focus:outline-none"
                      placeholder="your@email.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-white/70">Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white focus:border-[#c9a14a] focus:outline-none"
                      placeholder="10-digit mobile number"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/70">Special Requests (Optional)</label>
                  <textarea
                    name="special_requests"
                    value={formData.special_requests}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white focus:border-[#c9a14a] focus:outline-none"
                    placeholder="Any special requests or preferences..."
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="mb-3 text-lg font-semibold text-white">Cancellation Policy & Important Information</h3>
              <ul className="space-y-2 text-sm text-white/70">
                <li>• Free cancellation up to 7 days before check-in</li>
                <li>• 50% refund for cancellations 3–7 days before check-in</li>
                <li>• No refund for cancellations within 3 days of check-in</li>
                <li>• Full payment required at the time of booking</li>
                <li className="font-semibold text-red-400">• During Yatra Season — No cancellation & No refund under any condition</li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h2 className="mb-4 font-playfair text-xl text-white">Booking Summary</h2>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-white/50">Room Type</p>
                  <p className="font-medium text-white">{room.name}</p>
                </div>

                <div>
                  <p className="text-sm text-white/50">Meal Plan</p>
                  <p className="text-white">{bookingData.meal_plan}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-white/50">Check-in</p>
                    <p className="text-white">{formatDate(bookingData.check_in)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/50">Check-out</p>
                    <p className="text-white">{formatDate(bookingData.check_out)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-white/50">Nights</p>
                    <p className="text-white">{bookingData.nights}</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/50">Rooms</p>
                    <p className="text-white">{bookingData.rooms}</p>
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-4">
                  <div className="flex justify-between text-white/70">
                    <span>₹{bookingData.pricePerRoom.toLocaleString()} × {bookingData.nights}N × {bookingData.rooms}R</span>
                    <span>{formatPaymentAmount(bookingData.total)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-white/50">
                    <span>Subtotal (excl. GST 5%)</span>
                    <span>{formatPaymentAmount(bookingData.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-white/50">
                    <span>CGST @ 2.5%</span>
                    <span>{formatPaymentAmount(bookingData.cgst)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-white/50">
                    <span>SGST @ 2.5%</span>
                    <span>{formatPaymentAmount(bookingData.sgst)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2 text-lg font-semibold text-[#c9a14a]">
                    <span>Total (GST 5% incl.)</span>
                    <span>{formatPaymentAmount(bookingData.total)}</span>
                  </div>
                </div>

                <button
                  onClick={handlePayment}
                  disabled={processing}
                  className="w-full rounded-full bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] py-4 font-semibold text-black transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Proceed to Payment'}
                </button>

                <p className="mt-4 text-center text-xs text-white/50">
                  Secure payment powered by Razorpay
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckoutPageInner() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-[#c9a14a]" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<></>}>
      <CheckoutPageInner />
    </Suspense>
  )
}
