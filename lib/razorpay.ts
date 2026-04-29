// lib/razorpay.ts - Payment Gateway Integration

import { RazorpayOptions, RazorpayResponse } from '@/types'

declare global {
  interface Window {
    Razorpay: any
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export interface CreateOrderParams {
  booking_id?: string
  booking?: Record<string, unknown>
  amount: number
  currency?: string
  receipt?: string
  notes?: Record<string, string>
}

export interface PaymentSuccessParams {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
  booking_id?: string
}

const LAST_CONFIRMED_BOOKING_KEY = 'leafwalk_last_confirmed_booking'

function cacheConfirmedBooking(booking: any) {
  if (typeof window === 'undefined' || !booking?.id) return
  try {
    window.sessionStorage.setItem(
      LAST_CONFIRMED_BOOKING_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        booking,
      })
    )
  } catch {}
}

export async function createRazorpayOrder(params: CreateOrderParams) {
  try {
    const response = await fetch('/api/payments/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      throw new Error('Failed to create order')
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating Razorpay order:', error)
    throw error
  }
}

export async function verifyPayment(params: PaymentSuccessParams) {
  try {
    const response = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      throw new Error('Payment verification failed')
    }

    const result = await response.json()
    cacheConfirmedBooking(result?.booking)
    return result
  } catch (error) {
    console.error('Error verifying payment:', error)
    throw error
  }
}

export interface InitiatePaymentParams {
  amount: number
  orderId: string
  bookingId?: string
  userDetails: {
    name: string
    email: string
    contact: string
  }
  onSuccess: (response: RazorpayResponse, verificationResult: any) => void
  onFailure: (error: any) => void
}

export async function initiateRazorpayPayment(params: InitiatePaymentParams) {
  const { amount, orderId, bookingId, userDetails, onSuccess, onFailure } = params

  const scriptLoaded = await loadRazorpayScript()
  
  if (!scriptLoaded) {
    onFailure(new Error('Razorpay SDK failed to load'))
    return
  }

  const options: RazorpayOptions = {
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    amount: amount * 100, // Convert to paise
    currency: 'INR',
    name: 'Leafwalk Resort',
    description: `Booking Payment - ${(bookingId || orderId).slice(0, 8)}`,
    order_id: orderId,
    handler: async function (response: RazorpayResponse) {
      try {
        // Verify payment on server
        const verificationResult = await verifyPayment({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
          ...(bookingId ? { booking_id: bookingId } : {})
        })

        if (verificationResult.success) {
          onSuccess(response, verificationResult)
        } else {
          onFailure(new Error('Payment verification failed'))
        }
      } catch (error) {
        onFailure(error)
      }
    },
    prefill: {
      name: userDetails.name,
      email: userDetails.email,
      contact: userDetails.contact
    },
    theme: {
      color: '#c9a14a'
    }
  }

  const razorpay = new window.Razorpay(options)
  
  razorpay.on('payment.failed', function (response: any) {
    onFailure({
      error: response.error,
      code: response.error.code,
      description: response.error.description
    })
  })

  razorpay.open()
}

// Helper function to format amount for display
export function formatPaymentAmount(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount)
}

// Calculate platform fee (if applicable)
export function calculatePlatformFee(amount: number): number {
  // Razorpay charges ~2% + GST
  const razorpayFee = amount * 0.0236 // 2% + 18% GST on fee
  return Math.round(razorpayFee)
}

// Calculate total with taxes
export function calculateTotalWithTaxes(baseAmount: number): {
  baseAmount: number
  subtotal: number
  gst: number
  total: number
} {
  // Hotel GST: 5% inclusive (budget/mid-range hotels <₹7500/night)
  // price shown is inclusive — extract GST from it
  const subtotal = Math.round(baseAmount / 1.05 * 100) / 100
  const gst = Math.round(baseAmount - subtotal)
  const total = baseAmount  // already inclusive

  return {
    baseAmount,
    subtotal,
    gst,
    total
  }
}
