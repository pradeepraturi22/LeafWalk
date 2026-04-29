import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getPaymentGatewayClient,
  reconcileSuccessfulPayment,
  verifyRazorpayPaymentSignature,
} from '@/lib/payment-recovery'
import { logDebug } from '@/lib/logger'
import { logPaymentAudit } from '@/lib/payment-audit'
import { parseJsonBody } from '@/lib/security'
import { isLocalTestMode } from '@/lib/runtime-mode'

const verifyPaymentSchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  booking_id: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, verifyPaymentSchema)
  if (!parsed.success) {
    return parsed.response
  }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, booking_id } = parsed.data
  const requestId = crypto.randomUUID()

  if (isLocalTestMode()) {
    logDebug('LOCAL TEST MODE payment verify request', {
      booking_id,
      razorpay_order_id,
      razorpay_payment_id,
    })
  }

  if (!verifyRazorpayPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    await logPaymentAudit({
      eventType: 'verify_rejected',
      status: 'failed',
      source: 'verify_api',
      bookingId: booking_id || null,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      requestId,
      message: 'Invalid payment signature',
    })
    return NextResponse.json({
      success: false,
      error: { code: 'INVALID_SIGNATURE', message: 'Invalid payment signature' },
    }, { status: 400 })
  }

  try {
    await logPaymentAudit({
      eventType: 'verify_requested',
      status: 'info',
      source: 'verify_api',
      bookingId: booking_id || null,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      requestId,
    })
    const razorpay = getPaymentGatewayClient()
    const payment = await razorpay.payments.fetch(razorpay_payment_id)
    const order = await razorpay.orders.fetch(razorpay_order_id)

    if (!payment || payment.order_id !== razorpay_order_id) {
      await logPaymentAudit({
        eventType: 'verify_failed',
        status: 'failed',
        source: 'verify_api',
        bookingId: booking_id || null,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        requestId,
        message: 'Payment not found at gateway',
      })
      return NextResponse.json({
        success: false,
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment not found at gateway' },
      }, { status: 404 })
    }

    if (!order || order.id !== razorpay_order_id) {
      await logPaymentAudit({
        eventType: 'verify_failed',
        status: 'failed',
        source: 'verify_api',
        bookingId: booking_id || null,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        requestId,
        message: 'Order not found at gateway',
      })
      return NextResponse.json({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: 'Order not found at gateway' },
      }, { status: 404 })
    }

    if (!['authorized', 'captured'].includes(String(payment.status || '').toLowerCase())) {
      await logPaymentAudit({
        eventType: 'verify_pending',
        status: 'warning',
        source: 'verify_api',
        bookingId: booking_id || null,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount: Number(payment.amount || 0) / 100,
        currency: String(payment.currency || 'INR'),
        requestId,
        message: `Gateway status: ${payment.status || 'unknown'}`,
      })
      return NextResponse.json({
        success: false,
        error: { code: 'PAYMENT_NOT_CAPTURED', message: 'Payment is still being processed. Please do not pay again immediately if money was deducted.' },
      }, { status: 409 })
    }

    const result = await reconcileSuccessfulPayment({
      bookingId: booking_id,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      paymentSignature: razorpay_signature,
      source: 'verify',
      gatewayOrder: order,
      gatewayPayment: payment,
    })

    if (result.ok) {
      await logPaymentAudit({
        eventType: 'verify_succeeded',
        status: 'success',
        source: 'verify_api',
        bookingId: result.booking?.id || booking_id || null,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount: Number(payment.amount || 0) / 100,
        currency: String(payment.currency || 'INR'),
        requestId,
        message: result.message,
      })
      return NextResponse.json({
        success: true,
        booking: result.booking,
        customer_user_id: result.customerUserId || null,
        message: result.message,
      })
    }

    const status =
      result.code === 'not_found' ? 404 :
      result.code === 'amount_mismatch' ? 409 :
      result.code === 'order_mismatch' ? 409 :
      result.code === 'invalid_transition' ? 409 :
      result.code === 'cancelled_conflict' ? 409 :
      result.code === 'conflict' ? 409 :
      400

    await logPaymentAudit({
      eventType: 'verify_failed',
      status: 'failed',
      source: 'verify_api',
      bookingId: result.booking?.id || booking_id || null,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: Number(payment.amount || 0) / 100,
      currency: String(payment.currency || 'INR'),
      requestId,
      message: result.message,
      payload: { code: result.code },
    })

    return NextResponse.json({
      success: false,
      booking: result.booking || null,
      error: {
        code: result.code.toUpperCase(),
        message: result.message,
      },
    }, { status })
  } catch (error: any) {
    await logPaymentAudit({
      eventType: 'verify_failed',
      status: 'failed',
      source: 'verify_api',
      bookingId: booking_id || null,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      requestId,
      message: error?.message || 'Verification failed',
    })
    return NextResponse.json({
      success: false,
      error: { code: 'VERIFY_FAILED', message: 'Verification failed' },
    }, { status: 500 })
  }
}
