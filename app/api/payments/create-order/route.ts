import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { logDebug, logError, logInfo } from '@/lib/logger'
import { parseJsonBody, sanitizeString } from '@/lib/security'
import { isLocalTestMode, isProduction, isRazorpayTestKey } from '@/lib/runtime-mode'

const createOrderSchema = z.object({
  booking_id: z.string().uuid(),
  amount: z.number().positive().optional(),
  receipt: z.string().max(40).optional(),
  notes: z.record(z.string().max(100)).optional(),
})

function getRazorpayClient() {
  if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Payment gateway not configured')
  }

  // LOCAL TEST MODE ONLY
  // REMOVE / DISABLE FOR PRODUCTION
  if (isProduction() && isRazorpayTestKey(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID)) {
    throw new Error('Razorpay test key is not allowed in production')
  }

  if (isLocalTestMode()) {
    logInfo('LOCAL TEST MODE Razorpay create-order using configured key mode', {
      keyMode: isRazorpayTestKey(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) ? 'test' : 'live',
    })
  }

  return new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  })
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, createOrderSchema)
  if (!parsed.success) {
    return parsed.response
  }

  try {
    const { booking_id, amount, receipt, notes } = parsed.data
    const supabase = getSupabaseAdmin()
    if (isLocalTestMode()) {
      logDebug('LOCAL TEST MODE create-order request', { booking_id })
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, total_amount, payment_status, guest_name, razorpay_order_id')
      .eq('id', booking_id)
      .single() as any

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.payment_status === 'fully_paid') {
      return NextResponse.json({ error: 'Booking is already fully paid' }, { status: 409 })
    }

    const trustedAmount = Number(booking.total_amount)
    if (!trustedAmount || trustedAmount <= 0) {
      return NextResponse.json({ error: 'Booking total is invalid' }, { status: 400 })
    }

    if (amount && Math.abs(Number(amount) - trustedAmount) > 0.01) {
      return NextResponse.json({ error: 'Amount does not match booking total' }, { status: 409 })
    }

    const razorpay = getRazorpayClient()

    if (booking.razorpay_order_id) {
      try {
        const existingOrder = await razorpay.orders.fetch(booking.razorpay_order_id)
        if (
          existingOrder &&
          ['created', 'attempted'].includes(existingOrder.status) &&
          Number(existingOrder.amount) === Math.round(trustedAmount * 100)
        ) {
          await supabase
            .from('bookings')
            .update({
              payment_status: 'payment_processing',
              payment_method: 'razorpay',
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', booking_id)
            .neq('payment_status', 'fully_paid')

          return NextResponse.json({
            success: true,
            booking_id,
            order: {
              id: existingOrder.id,
              amount: existingOrder.amount,
              currency: existingOrder.currency,
              receipt: existingOrder.receipt,
              status: existingOrder.status,
            },
          })
        }
      } catch {}
    }

    const safeReceipt = sanitizeString(receipt || `booking_${booking_id}`, 40)
    const safeNotes = Object.fromEntries(
      Object.entries(notes || {}).map(([key, value]) => [sanitizeString(key, 50), sanitizeString(value, 100)])
    )

    const order = await razorpay.orders.create({
      amount: Math.round(trustedAmount * 100),
      currency: 'INR',
      receipt: safeReceipt,
      notes: {
        booking_id,
        ...safeNotes,
      },
    })

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        razorpay_order_id: order.id,
        payment_status: 'payment_processing',
        payment_method: 'razorpay',
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to link payment order to booking' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      booking_id,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
      },
    })
  } catch (error: any) {
    logError('Error creating Razorpay order:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
