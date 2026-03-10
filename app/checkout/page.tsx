// app/checkout/page.tsx - UPDATED VERSION WITH SERVER-SIDE BOOKING CREATION

'use client'
import React from 'react'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { initiateRazorpayPayment, calculateTotalWithTaxes, formatPaymentAmount } from '@/lib/razorpay'
import { calculateNights, formatDate } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [bookingData, setBookingData] = useState<any>(null)
  const [room, setRoom] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    special_requests: ''
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

      if (!roomId || !checkIn || !checkOut) {
        toast.error('Invalid booking data')
        router.push('/rooms')
        return
      }

      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single() as any

      if (roomError || !roomData) {
        toast.error('Room not found')
        router.push('/rooms')
        return
      }

      setRoom(roomData)

      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (authUser) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single() as any

        if (userData) {
          setUser(userData)
          setFormData({
            name: userData.name || '',
            email: userData.email || '',
            phone: userData.phone || '',
            special_requests: ''
          })
        }
      }

      const checkInDate = new Date(checkIn)
      const checkOutDate = new Date(checkOut)
      const nights = calculateNights(checkInDate, checkOutDate)
      const rooms = parseInt(qty || '1')
      const baseAmount = roomData.price * nights * rooms
      const { gst, total } = calculateTotalWithTaxes(baseAmount)

      setBookingData({
        room_id: roomId,
        check_in: checkInDate,
        check_out: checkOutDate,
        nights,
        rooms,
        baseAmount,
        gst,
        total
      })

      setLoading(false)
    } catch (error) {
      console.error('Error loading checkout:', error)
      toast.error('Failed to load booking details')
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const validateForm = () => {
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

  const handlePayment = async () => {
    if (!validateForm()) return
    if (!bookingData || !room) return

    setProcessing(true)

    try {
      // Create booking via SERVER-SIDE API (bypasses RLS issues)
      const bookingResponse = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id || null,
          room_id: bookingData.room_id,
          check_in: bookingData.check_in.toISOString().split('T')[0],
          check_out: bookingData.check_out.toISOString().split('T')[0],
          nights: bookingData.nights,
          guests: 2,
          rooms_booked: bookingData.rooms,
          total_amount: bookingData.total,
          booking_status: 'pending',
          payment_status: 'pending',
          booking_source: 'direct',
          special_requests: formData.special_requests || null,
          guest_name: formData.name,
          guest_email: formData.email,
          guest_phone: formData.phone
        })
      })

      const bookingResult = await bookingResponse.json()

      if (!bookingResult.success) {
        throw new Error(bookingResult.error || 'Failed to create booking')
      }

      const booking = bookingResult.booking

      // Create Razorpay order
      const orderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: bookingData.total,
          receipt: `booking_${booking.id}`,
          notes: {
            booking_id: booking.id,
            room_name: room.name
          }
        })
      })

      const orderData = await orderResponse.json()

      if (!orderData.success) {
        throw new Error('Failed to create payment order')
      }

      // Initiate Razorpay payment
      await initiateRazorpayPayment({
        amount: bookingData.total,
        orderId: orderData.order.id,
        bookingId: booking.id,
        userDetails: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone
        },
        onSuccess: async (response) => {
          toast.success('Payment successful! Redirecting...')
          setTimeout(() => {
            router.push(`/booking-confirmation?id=${booking.id}`)
          }, 2000)
        },
        onFailure: (error) => {
          console.error('Payment failed:', error)
          toast.error('Payment failed. Please try again.')
          setProcessing(false)
        }
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#c9a14a]"></div>
      </div>
    )
  }

  if (!bookingData || !room) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] py-12 px-4">
      <Toaster position="top-center" />
      
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-playfair text-[#c9a14a] mb-8 text-center">
          Complete Your Booking
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Guest Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
              <h2 className="text-2xl font-playfair text-white mb-6">Guest Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/70 mb-2">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]"
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]"
                      placeholder="your@email.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-white/70 mb-2">Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]"
                      placeholder="10-digit mobile number"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/70 mb-2">Special Requests (Optional)</label>
                  <textarea
                    name="special_requests"
                    value={formData.special_requests}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]"
                    placeholder="Any special requests or preferences..."
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-3">Cancellation Policy</h3>
              <ul className="text-sm text-white/70 space-y-2">
                <li>• Free cancellation up to 7 days before check-in</li>
                <li>• 50% refund for cancellations 3-7 days before check-in</li>
                <li>• No refund for cancellations within 3 days of check-in</li>
                <li>• Full payment required at the time of booking</li>
              </ul>
            </div>
          </div>

          {/* Right Column - Booking Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 sticky top-24">
              <h2 className="text-xl font-playfair text-white mb-4">Booking Summary</h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-white/50">Room Type</p>
                  <p className="text-white font-medium">{room.name}</p>
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

                <div className="border-t border-white/10 pt-4 space-y-2">
                  <div className="flex justify-between text-white/70">
                    <span>Room charges</span>
                    <span>{formatPaymentAmount(bookingData.baseAmount)}</span>
                  </div>
                  <div className="flex justify-between text-white/70">
                    <span>GST (12%)</span>
                    <span>{formatPaymentAmount(bookingData.gst)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold text-[#c9a14a] pt-2 border-t border-white/10">
                    <span>Total Amount</span>
                    <span>{formatPaymentAmount(bookingData.total)}</span>
                  </div>
                </div>

                <button
                  onClick={handlePayment}
                  disabled={processing}
                  className="w-full bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black font-semibold py-4 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {processing ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Proceed to Payment'
                  )}
                </button>

                <p className="text-xs text-center text-white/50 mt-4">
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#c9a14a]"></div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={}>
      <CheckoutPageInner />
    </Suspense>
  )
}