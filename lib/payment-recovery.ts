import crypto from 'crypto'
import Razorpay from 'razorpay'
import { sendBookingLifecycleEmails } from '@/lib/booking-email-triggers'
import { ensureCustomerAccount } from '@/lib/customer-auth'
import { validateBookingStatusChange } from '@/lib/booking-status'
import { logError, logInfo } from '@/lib/logger'
import { buildBookingNumber, buildInvoiceNumber } from '@/lib/reference-numbers'
import { isLocalTestMode, isProduction, isRazorpayTestKey } from '@/lib/runtime-mode'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

type GatewayOrderLike = {
  id: string
  amount: string | number
  status?: string
  currency?: string
  notes?: Record<string, string | number>
}

type GatewayPaymentLike = {
  id: string
  order_id: string
  amount: string | number
  currency?: string
  status: string
  notes?: Record<string, string | number>
  error_code?: string | null
  error_description?: string | null
}

type ReconcileSuccessInput = {
  bookingId?: string | null
  orderId: string
  paymentId: string
  paymentSignature?: string | null
  source: 'verify' | 'webhook' | 'reconcile'
  gatewayOrder: GatewayOrderLike
  gatewayPayment: GatewayPaymentLike
}

type ReconcileFailureInput = {
  bookingId?: string | null
  orderId: string
  paymentId?: string | null
  source: 'webhook' | 'reconcile'
  reason?: string | null
  gatewayPayment?: GatewayPaymentLike | null
}

type ReconcileResult = {
  ok: boolean
  code:
    | 'processed'
    | 'already_processed'
    | 'cancelled_conflict'
    | 'not_found'
    | 'amount_mismatch'
    | 'order_mismatch'
    | 'invalid_transition'
    | 'conflict'
    | 'payment_failed'
    | 'pending'
  message: string
  booking?: any
  customerUserId?: string | null
}

function getRazorpayClient() {
  if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Payment gateway not configured')
  }

  if (isProduction() && isRazorpayTestKey(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID)) {
    throw new Error('Razorpay test key is not allowed in production')
  }

  if (isLocalTestMode()) {
    logInfo('LOCAL TEST MODE payment recovery client using configured key mode', {
      keyMode: isRazorpayTestKey(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) ? 'test' : 'live',
    })
  }

  return new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  })
}

export function getPaymentGatewayClient() {
  return getRazorpayClient()
}

export function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, providedSignature: string) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(providedSignature)
  if (expectedBuffer.length !== providedBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
}

export function verifyRazorpayWebhookSignature(rawBody: string, providedSignature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || ''
  if (!secret || !providedSignature) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(providedSignature)
  if (expectedBuffer.length !== providedBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
}

async function fetchBookingForPaymentLookup(input: { bookingId?: string | null; orderId?: string | null }) {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('bookings')
    .select(`
      id, user_id, created_at, booking_number, invoice_number, total_amount, subtotal, cgst, sgst, gst_total,
      promo_code, discount_amount, payment_status, booking_status, payment_method, razorpay_order_id, razorpay_payment_id,
      guest_name, guest_email, guest_phone, guest_phone_country, check_in, check_out, nights, rooms_booked, adults, meal_plan,
      advance_amount, balance_amount, room:rooms(name, category, featured_image)
    `)
    .limit(1)

  if (input.bookingId) {
    query = query.eq('id', input.bookingId)
  } else if (input.orderId) {
    query = query.eq('razorpay_order_id', input.orderId)
  } else {
    return null
  }

  const { data, error } = await query.single() as any
  if (error || !data) return null
  return data
}

async function fetchLatestBookingState(bookingId: string) {
  const { data } = await getSupabaseAdmin()
    .from('bookings')
    .select(`
      id, user_id, created_at, booking_number, invoice_number, total_amount, subtotal, cgst, sgst, gst_total,
      promo_code, discount_amount, payment_status, booking_status, payment_method, razorpay_order_id, razorpay_payment_id,
      guest_name, guest_email, guest_phone, guest_phone_country, check_in, check_out, nights, rooms_booked, adults, meal_plan,
      advance_amount, balance_amount, room:rooms(name, category, featured_image)
    `)
    .eq('id', bookingId)
    .single() as any

  return data || null
}

async function reserveWebhookEvent(input: {
  eventKey: string
  eventType: string
  paymentId?: string | null
  orderId?: string | null
  payload?: any
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('processed_payment_events')
    .insert({
      event_key: input.eventKey,
      event_type: input.eventType,
      razorpay_payment_id: input.paymentId || null,
      razorpay_order_id: input.orderId || null,
      payload_json: input.payload || null,
      processed_at: new Date().toISOString(),
    } as any)
    .select('id')
    .single() as any

  if (error?.code === '23505') {
    return { claimed: false, data: null }
  }
  if (error) throw new Error(error.message || 'Could not reserve payment event')
  return { claimed: true, data }
}

export async function claimWebhookEvent(input: {
  eventKey: string
  eventType: string
  paymentId?: string | null
  orderId?: string | null
  payload?: any
}) {
  return reserveWebhookEvent(input)
}

async function markBookingPaymentProcessing(bookingId: string, orderId: string) {
  await getSupabaseAdmin()
    .from('bookings')
    .update({
      payment_status: 'payment_processing',
      razorpay_order_id: orderId,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', bookingId)
    .neq('payment_status', 'fully_paid')
}

async function applyPromoUsageOnce(input: {
  bookingId: string
  promoCode?: string | null
  guestPhone?: string | null
  guestEmail?: string | null
  discountAmount?: number | null
}) {
  if (!input.promoCode) return

  try {
    const supabase = getSupabaseAdmin()
    const { data: offer } = await supabase
      .from('offers')
      .select('id, used_count')
      .eq('code', input.promoCode)
      .single() as any

    if (!offer) return

    const { data: existingUsage } = await supabase
      .from('promo_code_usage')
      .select('id')
      .eq('booking_id', input.bookingId)
      .eq('offer_id', offer.id)
      .limit(1) as any

    if (existingUsage?.length) return

    const { error: usageError } = await supabase
      .from('promo_code_usage')
      .insert({
        offer_id: offer.id,
        booking_id: input.bookingId,
        guest_phone: input.guestPhone || null,
        guest_email: input.guestEmail || null,
        discount_amount: Number(input.discountAmount || 0),
      } as any)

    if (usageError?.code === '23505') return
    if (usageError) {
      throw new Error(usageError.message || 'Could not record promo usage')
    }

    await supabase
      .from('offers')
      .update({ used_count: Number(offer.used_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', offer.id)
  } catch (error) {
    logError('Promo usage reconciliation error:', error)
  }
}

async function buildOrLinkCustomer(booking: any) {
  try {
    const profile = await ensureCustomerAccount({
      name: booking.guest_name,
      email: booking.guest_email,
      phone: `${booking.guest_phone_country || ''}${booking.guest_phone || ''}`,
    })
    return profile?.id || null
  } catch (error) {
    logError('Customer account reconciliation failed:', error)
    return null
  }
}

export async function reconcileSuccessfulPayment(input: ReconcileSuccessInput): Promise<ReconcileResult> {
  const supabase = getSupabaseAdmin()
  const booking = await fetchBookingForPaymentLookup({ bookingId: input.bookingId, orderId: input.orderId })

  if (!booking) {
    return { ok: false, code: 'not_found', message: 'Booking not found for payment reconciliation' }
  }

  if (!booking.razorpay_order_id || booking.razorpay_order_id !== input.orderId || input.gatewayOrder.id !== input.orderId) {
    return { ok: false, code: 'order_mismatch', message: 'Payment order does not match booking', booking }
  }

  const expectedAmountPaise = Math.round(Number(booking.total_amount || 0) * 100)
  if (Number(input.gatewayPayment.amount) !== expectedAmountPaise || Number(input.gatewayOrder.amount) !== expectedAmountPaise) {
    return { ok: false, code: 'amount_mismatch', message: 'Gateway amount does not match booking total', booking }
  }

  if (booking.payment_status === 'fully_paid' && booking.razorpay_payment_id === input.paymentId) {
    return { ok: true, code: 'already_processed', message: 'Payment already processed', booking }
  }

  if (String(booking.booking_status || '').toLowerCase() === 'cancelled') {
    await supabase.from('payments').upsert({
      booking_id: booking.id,
      amount: Number(booking.total_amount),
      currency: String(input.gatewayPayment.currency || input.gatewayOrder.currency || 'INR'),
      payment_type: 'full',
      payment_method: 'razorpay',
      razorpay_order_id: input.orderId,
      razorpay_payment_id: input.paymentId,
      razorpay_signature: input.paymentSignature || null,
      status: 'success',
    }, { onConflict: 'razorpay_payment_id' })

    await markBookingPaymentProcessing(booking.id, input.orderId)

    return {
      ok: false,
      code: 'cancelled_conflict',
      message: 'Payment captured for a cancelled booking. Marked for manual review.',
      booking: await fetchLatestBookingState(booking.id),
    }
  }

  const transitionCheck = validateBookingStatusChange({
    currentStatus: booking.booking_status,
    nextStatus: 'confirmed',
    bookingTotal: booking.total_amount,
    advanceAmount: booking.total_amount,
    balanceAmount: 0,
  })

  if (!transitionCheck.valid) {
    return { ok: false, code: 'invalid_transition', message: transitionCheck.error, booking }
  }

  const customerUserId = await buildOrLinkCustomer(booking)
  const nowIso = new Date().toISOString()
  const today = nowIso.split('T')[0]
  const bookingNumber = booking.booking_number || buildBookingNumber({
    id: booking.id,
    createdAt: booking.created_at || nowIso,
  })
  const invoiceNumber = booking.invoice_number || buildInvoiceNumber({
    id: booking.id,
    paidAt: nowIso,
  })

  await supabase.from('payments').upsert({
    booking_id: booking.id,
    amount: Number(booking.total_amount),
    currency: String(input.gatewayPayment.currency || input.gatewayOrder.currency || 'INR'),
    payment_type: 'full',
    payment_method: 'razorpay',
    razorpay_order_id: input.orderId,
    razorpay_payment_id: input.paymentId,
    razorpay_signature: input.paymentSignature || null,
    status: 'success',
  }, { onConflict: 'razorpay_payment_id' })

  await supabase.from('booking_payments').upsert({
    booking_id: booking.id,
    booking_number: bookingNumber,
    payment_type: 'final',
    amount: Number(booking.total_amount),
    payment_method: 'razorpay',
    payment_ref: input.paymentId,
    payment_date: today,
    notes: `Online payment reconciled via Razorpay (${input.source})`,
  }, { onConflict: 'payment_method,payment_ref' })

  const bookingUpdatePayload: Record<string, any> = {
    booking_number: bookingNumber,
    invoice_number: invoiceNumber,
    payment_status: 'fully_paid',
    payment_method: 'razorpay',
    advance_amount: booking.total_amount,
    balance_amount: 0,
    advance_paid_at: nowIso,
    payment_id: input.paymentId,
    razorpay_payment_id: input.paymentId,
    razorpay_order_id: input.orderId,
    razorpay_signature: input.paymentSignature || null,
    confirmed_at: nowIso,
    updated_at: nowIso,
  }

  if (String(booking.booking_status || '').toLowerCase() !== 'confirmed') {
    bookingUpdatePayload.booking_status = 'confirmed'
  }
  if (customerUserId) {
    bookingUpdatePayload.user_id = customerUserId
  }

  const { data: updatedBooking, error: updateErr } = await supabase
    .from('bookings')
    .update(bookingUpdatePayload)
    .eq('id', booking.id)
    .eq('booking_status', booking.booking_status)
    .neq('payment_status', 'fully_paid')
    .select(`
      id, user_id, created_at, booking_number, invoice_number, total_amount, subtotal, cgst, sgst, gst_total,
      promo_code, discount_amount, payment_status, booking_status, payment_method, razorpay_order_id, razorpay_payment_id,
      guest_name, guest_email, guest_phone, guest_phone_country, check_in, check_out, nights, rooms_booked, adults, meal_plan,
      advance_amount, balance_amount, room:rooms(name, category, featured_image)
    `)
    .maybeSingle() as any

  if (updateErr) {
    throw new Error(updateErr.message || 'Failed to update booking during reconciliation')
  }

  if (!updatedBooking) {
    const latestBooking = await fetchLatestBookingState(booking.id)
    if (latestBooking?.payment_status === 'fully_paid' && latestBooking?.razorpay_payment_id === input.paymentId) {
      return {
        ok: true,
        code: 'already_processed',
        message: 'Payment already processed and booking reconciled',
        booking: latestBooking,
        customerUserId,
      }
    }

    if (String(latestBooking?.booking_status || '').toLowerCase() === 'cancelled') {
      return {
        ok: false,
        code: 'cancelled_conflict',
        message: 'Cancelled bookings cannot be confirmed by late payment verification',
        booking: latestBooking,
      }
    }

    return {
      ok: false,
      code: 'conflict',
      message: 'Booking state changed during payment reconciliation',
      booking: latestBooking,
    }
  }

  await applyPromoUsageOnce({
    bookingId: updatedBooking.id,
    promoCode: updatedBooking.promo_code,
    guestPhone: updatedBooking.guest_phone,
    guestEmail: updatedBooking.guest_email,
    discountAmount: updatedBooking.discount_amount,
  })

  if (updatedBooking.guest_email) {
    await sendBookingLifecycleEmails(updatedBooking.id, 'payment_verified')
  }

  return {
    ok: true,
    code: 'processed',
    message: 'Payment verified successfully',
    booking: updatedBooking,
    customerUserId,
  }
}

export async function reconcileFailedPayment(input: ReconcileFailureInput): Promise<ReconcileResult> {
  const booking = await fetchBookingForPaymentLookup({ bookingId: input.bookingId, orderId: input.orderId })
  if (!booking) {
    return { ok: false, code: 'not_found', message: 'Booking not found for failed payment reconciliation' }
  }

  if (booking.payment_status === 'fully_paid') {
    return { ok: true, code: 'already_processed', message: 'Booking already fully paid', booking }
  }

  if (input.paymentId) {
    await getSupabaseAdmin().from('payments').upsert({
      booking_id: booking.id,
      amount: Number(booking.total_amount),
      currency: String(input.gatewayPayment?.currency || 'INR'),
      payment_type: 'full',
      payment_method: 'razorpay',
      razorpay_order_id: input.orderId,
      razorpay_payment_id: input.paymentId,
      status: 'failed',
    }, { onConflict: 'razorpay_payment_id' })
  }

  const nextPaymentStatus = booking.payment_status === 'payment_processing' ? 'failed' : (booking.payment_status || 'failed')

  const { data: updatedBooking } = await getSupabaseAdmin()
    .from('bookings')
    .update({
      payment_status: nextPaymentStatus,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', booking.id)
    .neq('payment_status', 'fully_paid')
    .select('id, booking_number, booking_status, payment_status, check_in, check_out')
    .single() as any

  return {
    ok: false,
    code: 'payment_failed',
    message: input.reason || 'Payment failed',
    booking: updatedBooking || booking,
  }
}

export async function reconcileBookingById(bookingId: string): Promise<ReconcileResult> {
  const booking = await fetchBookingForPaymentLookup({ bookingId })
  if (!booking) {
    return { ok: false, code: 'not_found', message: 'Booking not found' }
  }

  if (booking.payment_status === 'fully_paid') {
    return { ok: true, code: 'already_processed', message: 'Booking already fully paid', booking }
  }

  if (!booking.razorpay_order_id) {
    return { ok: false, code: 'pending', message: 'No Razorpay order linked yet', booking }
  }

  await markBookingPaymentProcessing(booking.id, booking.razorpay_order_id)

  const razorpay = getRazorpayClient()
  const order = await razorpay.orders.fetch(booking.razorpay_order_id) as GatewayOrderLike
  const orderPayments = await razorpay.orders.fetchPayments(booking.razorpay_order_id) as { items?: GatewayPaymentLike[] }
  const payments = orderPayments?.items || []

  const successfulPayment = payments.find((payment) => ['captured', 'authorized'].includes(String(payment.status || '').toLowerCase()))
  if (successfulPayment) {
    return reconcileSuccessfulPayment({
      bookingId: booking.id,
      orderId: booking.razorpay_order_id,
      paymentId: successfulPayment.id,
      source: 'reconcile',
      gatewayOrder: order,
      gatewayPayment: successfulPayment,
    })
  }

  const failedPayment = payments.find((payment) => String(payment.status || '').toLowerCase() === 'failed')
  if (failedPayment) {
    return reconcileFailedPayment({
      bookingId: booking.id,
      orderId: booking.razorpay_order_id,
      paymentId: failedPayment.id,
      source: 'reconcile',
      reason: failedPayment.error_description || 'Gateway reports payment failure',
      gatewayPayment: failedPayment,
    })
  }

  return {
    ok: false,
    code: 'pending',
    message: 'Payment is still processing. Please do not pay again immediately if money was deducted.',
    booking: await fetchLatestBookingState(booking.id),
  }
}
