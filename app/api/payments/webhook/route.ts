import { NextRequest, NextResponse } from 'next/server'
import {
  claimWebhookEvent,
  reconcileFailedPayment,
  reconcileSuccessfulPayment,
  verifyRazorpayWebhookSignature,
} from '@/lib/payment-recovery'

function getBookingIdFromPayload(payload: any) {
  return (
    payload?.payment?.entity?.notes?.booking_id ||
    payload?.order?.entity?.notes?.booking_id ||
    null
  )
}

function getOrderIdFromPayload(payload: any) {
  return (
    payload?.payment?.entity?.order_id ||
    payload?.order?.entity?.id ||
    null
  )
}

function getPaymentIdFromPayload(payload: any) {
  return payload?.payment?.entity?.id || null
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature') || ''

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
  }

  const eventType = String(body?.event || '')
  const orderId = getOrderIdFromPayload(body?.payload || {})
  const paymentId = getPaymentIdFromPayload(body?.payload || {})
  const bookingId = getBookingIdFromPayload(body?.payload || {})
  const eventKey =
    request.headers.get('x-razorpay-event-id') ||
    `${eventType}:${paymentId || 'no-payment'}:${orderId || 'no-order'}:${body?.created_at || 'no-created-at'}`

  try {
    const reservation = await claimWebhookEvent({
      eventKey,
      eventType,
      paymentId,
      orderId,
      payload: {
        event: eventType,
        created_at: body?.created_at || null,
        account_id: body?.account_id || null,
      },
    })

    if (!reservation.claimed) {
      return NextResponse.json({ ok: true, duplicate: true })
    }

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = body?.payload?.payment?.entity || body?.payload?.order?.entity?.payments?.[0] || null
      const orderEntity = body?.payload?.order?.entity || {
        id: orderId,
        amount: paymentEntity?.amount,
        currency: paymentEntity?.currency,
        notes: paymentEntity?.notes || {},
      }

      if (!paymentEntity?.id || !orderEntity?.id) {
        return NextResponse.json({ error: 'Webhook payload missing payment or order entity' }, { status: 400 })
      }

      const result = await reconcileSuccessfulPayment({
        bookingId,
        orderId: orderEntity.id,
        paymentId: paymentEntity.id,
        source: 'webhook',
        gatewayOrder: orderEntity,
        gatewayPayment: paymentEntity,
      })

      return NextResponse.json({ ok: true, result })
    }

    if (eventType === 'payment.failed') {
      const paymentEntity = body?.payload?.payment?.entity || null
      const result = await reconcileFailedPayment({
        bookingId,
        orderId: paymentEntity?.order_id || orderId,
        paymentId: paymentEntity?.id || paymentId,
        source: 'webhook',
        reason: paymentEntity?.error_description || 'Gateway reports payment failure',
        gatewayPayment: paymentEntity,
      })

      return NextResponse.json({ ok: true, result })
    }

    return NextResponse.json({ ok: true, ignored: true, event: eventType })
  } catch (error: any) {
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
