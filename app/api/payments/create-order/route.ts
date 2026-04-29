import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { z } from 'zod'
import { getAuthenticatedCustomer } from '@/lib/customer-auth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { logDebug, logError, logInfo } from '@/lib/logger'
import { parseJsonBody, sanitizeString } from '@/lib/security'
import { isLocalTestMode, isProduction, isRazorpayTestKey } from '@/lib/runtime-mode'
import { prepareWebsiteBookingDraft, websiteBookingDraftSchema } from '@/lib/website-booking'

const createOrderSchema = z.object({
  booking_id: z.string().uuid().optional(),
  booking: websiteBookingDraftSchema.optional(),
  amount: z.number().positive().optional(),
  receipt: z.string().max(40).optional(),
  notes: z.record(z.string().max(100)).optional(),
}).superRefine((value, ctx) => {
  if (!value.booking_id && !value.booking) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'booking_id or booking is required',
      path: ['booking_id'],
    })
  }
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
    const { booking_id, booking, amount, receipt, notes } = parsed.data
    const supabase = getSupabaseAdmin()
    if (isLocalTestMode()) {
      logDebug('LOCAL TEST MODE create-order request', { booking_id })
    }
    const razorpay = getRazorpayClient()

    if (booking) {
      const auth = await getAuthenticatedCustomer(request)
      const preparedDraft = await prepareWebsiteBookingDraft(booking, {
        userId: auth?.userId || null,
        email: auth?.user?.email || null,
      })

      if (amount && Math.abs(Number(amount) - preparedDraft.totalAmount) > 0.01) {
        return NextResponse.json({ error: 'Amount does not match booking total' }, { status: 409 })
      }

      const safeReceipt = sanitizeString(receipt || `lwweb_${Date.now()}`, 40)
      const safeNotes = Object.fromEntries(
        Object.entries(notes || {}).map(([key, value]) => [sanitizeString(key, 50), sanitizeString(value, 100)])
      )

      const order = await razorpay.orders.create({
        amount: Math.round(preparedDraft.totalAmount * 100),
        currency: 'INR',
        receipt: safeReceipt,
        notes: {
          source: 'website',
          room_name: sanitizeString(preparedDraft.roomName || '', 100),
          ...safeNotes,
        },
      })

      const { error: draftError } = await supabase
        .from('processed_payment_events')
        .insert({
          event_key: `booking_draft:${order.id}`,
          event_type: 'booking_draft',
          razorpay_order_id: order.id,
          payload_json: {
            source: 'website',
            preparedDraft,
          },
          processed_at: new Date().toISOString(),
        } as any)

      if (draftError) {
        return NextResponse.json({ error: 'Failed to prepare booking payment' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          receipt: order.receipt,
          status: order.status,
        },
        total_amount: preparedDraft.totalAmount,
      })
    }

    const { data: existingBooking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, total_amount, payment_status, guest_name, razorpay_order_id')
      .eq('id', booking_id)
      .single() as any

    if (bookingError || !existingBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (existingBooking.payment_status === 'fully_paid') {
      return NextResponse.json({ error: 'Booking is already fully paid' }, { status: 409 })
    }

    const trustedAmount = Number(existingBooking.total_amount)
    if (!trustedAmount || trustedAmount <= 0) {
      return NextResponse.json({ error: 'Booking total is invalid' }, { status: 400 })
    }

    if (amount && Math.abs(Number(amount) - trustedAmount) > 0.01) {
      return NextResponse.json({ error: 'Amount does not match booking total' }, { status: 409 })
    }

    if (existingBooking.razorpay_order_id) {
      try {
        const existingOrder = await razorpay.orders.fetch(existingBooking.razorpay_order_id)
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
