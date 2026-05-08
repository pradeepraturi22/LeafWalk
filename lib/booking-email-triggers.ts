import { generateCheckInCompletedEmail, generateCheckInPassAttachment, generateReceiptAttachment, renderAdminWebsiteBookingAlertEmail, renderBookingConfirmationEmail, renderPaymentSuccessEmail, sendEmailWithResult } from '@/lib/email-service'
import { logDebug, logError, logInfo } from '@/lib/logger'
import { isLocalTestMode } from '@/lib/runtime-mode'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { sendTourOperatorBookingStatusEmail } from '@/lib/tour-operator-notifications'
import { buildWifiEmailPayload, getWifiQrCid } from '@/lib/wifi-email'

type BookingEmailContext = {
  id: string
  created_at?: string | null
  booking_number?: string | null
  invoice_number?: string | null
  booking_source?: string | null
  booking_type?: string | null
  booking_status?: string | null
  checked_in_at?: string | null
  payment_status?: string | null
  payment_method?: string | null
  guest_name?: string | null
  gst_invoice_requested?: boolean | null
  gst_company_name?: string | null
  gst_number?: string | null
  gst_state?: string | null
  guest_email?: string | null
  guest_phone?: string | null
  guest_phone_country?: string | null
  check_in: string
  check_out: string
  nights?: number | null
  rooms_booked?: number | null
  adults?: number | null
  meal_plan?: string | null
  total_amount?: number | null
  subtotal?: number | null
  cgst?: number | null
  sgst?: number | null
  gst_total?: number | null
  advance_amount?: number | null
  balance_amount?: number | null
  payment_due_date?: string | null
  razorpay_payment_id?: string | null
  tour_operator_id?: string | null
  room?: { name?: string | null; category?: string | null; featured_image?: string | null } | null
  tour_operator?: {
    company_name?: string | null
    contact_person?: string | null
    email?: string | null
    phone?: string | null
  } | null
}

type BookingEmailTrigger =
  | 'public_booking_created'
  | 'admin_booking_created'
  | 'admin_status_changed'
  | 'admin_payment_updated'
  | 'admin_payment_completed'
  | 'payment_verified'

const BOOKING_EMAIL_SELECT = `
  id, created_at, booking_number, invoice_number, booking_source, booking_type, booking_status, checked_in_at, payment_status, payment_method,
  guest_name, gst_invoice_requested, gst_company_name, gst_number, gst_state, guest_email, guest_phone, guest_phone_country,
  check_in, check_out, nights, rooms_booked, adults, meal_plan,
  total_amount, subtotal, cgst, sgst, gst_total, advance_amount, balance_amount, payment_due_date, razorpay_payment_id, tour_operator_id,
  room:rooms(name, category, featured_image),
  tour_operator:tour_operators(company_name, contact_person, email, cc_email, phone)
`

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase()
}

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10)
}

function getCheckInDateKey(booking: BookingEmailContext) {
  return String(booking.check_in || '').slice(0, 10)
}

function isBackdatedBookingEntry(booking: BookingEmailContext) {
  const checkInKey = getCheckInDateKey(booking)
  return Boolean(checkInKey) && checkInKey < getTodayDateKey()
}

async function hasNotificationMarker(bookingId: string | null, recipient: string, markerPrefix: string) {
  try {
    let query = getSupabaseAdmin()
      .from('notification_logs')
      .select('id')
      .eq('type', 'email')
      .eq('recipient', recipient)
      .eq('status', 'sent')
      .like('content', `${markerPrefix}%`)
      .limit(1)

    query = bookingId ? query.eq('booking_id', bookingId) : query.is('booking_id', null)
    const { data } = await query
    return Boolean(data?.length)
  } catch {
    return false
  }
}

async function logEmailTrigger(input: {
  bookingId: string | null
  recipient: string
  subject: string
  status: 'sent' | 'failed'
  marker: string
  eventType?: 'booking_confirmation' | 'payment_success' | 'checkin_reminder'
  errorMessage?: string
}) {
  try {
    await getSupabaseAdmin().from('notification_logs').insert({
      booking_id: input.bookingId,
      type: 'email',
      recipient: input.recipient,
      status: input.status,
      content: input.marker.slice(0, 500),
      error_message: input.errorMessage || null,
      sent_at: input.status === 'sent' ? new Date().toISOString() : null,
    })
  } catch (error) {
    logError('Failed to log booking email notification:', error)
  }

  if (input.bookingId) {
    try {
      await getSupabaseAdmin().from('email_events').insert({
        booking_id: input.bookingId,
        event_type: input.eventType || 'general',
        recipient_email: input.recipient,
        subject: input.subject,
        status: input.status,
        error_message: input.errorMessage || null,
        sent_at: input.status === 'sent' ? new Date().toISOString() : null,
      })
    } catch (error) {
      logError('Failed to log booking email event:', error)
    }
  }
}

async function sendTrackedGuestEmail(input: {
  booking: BookingEmailContext
  recipient: string
  subject: string
  html: string
  marker: string
  eventType: 'booking_confirmation' | 'payment_success' | 'checkin_reminder'
  debugLabel: string
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string; cid?: string; disposition?: 'attachment' | 'inline' }>
  fromEmail?: string
  fromName?: string
}) {
  const alreadySent = await hasNotificationMarker(input.booking.id, input.recipient, input.marker)
  if (alreadySent) {
    if (isLocalTestMode()) {
      logDebug(`LOCAL TEST MODE skipped duplicate ${input.debugLabel}`, {
        booking_id: input.booking.id,
        recipient: input.recipient,
        marker: input.marker,
      })
    }
    return false
  }

  if (isLocalTestMode()) {
    logInfo(`LOCAL TEST MODE ${input.debugLabel} triggered`, {
      booking_id: input.booking.id,
      booking_source: input.booking.booking_source || 'unknown',
      recipient: input.recipient,
      subject: input.subject,
    })
  }

  const result = await sendEmailWithResult(
    input.recipient,
    input.subject,
    input.html,
    input.attachments,
    {
      emailType: input.eventType,
      fromEmail: input.fromEmail,
      fromName: input.fromName,
    }
  )

  await logEmailTrigger({
    bookingId: input.booking.id,
    recipient: input.recipient,
    subject: input.subject,
    status: result.success ? 'sent' : 'failed',
    marker: input.marker,
    eventType: input.eventType,
    errorMessage: result.success ? undefined : (result.error || 'Email provider rejected message'),
  })

  return result.success
}

async function buildCheckInEmailAssets(booking: BookingEmailContext) {
  const isTourOperatorGuest = normalize(booking.booking_source) === 'tour_operator'
  const wifiPayload = await buildWifiEmailPayload()
  const attachments = isTourOperatorGuest
    ? [
        await generateCheckInPassAttachment(booking as any),
      ]
    : [
        await generateReceiptAttachment(booking as any),
        ...(wifiPayload?.qrAttachment ? [wifiPayload.qrAttachment] : []),
      ]

  return {
    html: generateCheckInCompletedEmail(booking as any, {
      ...wifiPayload?.wifi,
      qrCid: wifiPayload?.qrAttachment ? getWifiQrCid() : null,
    }),
    attachments,
  }
}

function getFrontDeskSender() {
  return {
    fromEmail: process.env.FROM_EMAIL_FRONTDESK || 'frontdesk@leafwalk.in',
    fromName: 'LeafWalk Front Desk',
  }
}

function getCheckInMarker(booking: BookingEmailContext, prefix: 'guest_check_in_completed' | 'walk_in_check_in_completed') {
  const bookingKey = booking.booking_number || booking.id
  const checkInStamp = booking.checked_in_at || booking.created_at || 'no-ts'
  return `${prefix}:${bookingKey}:${checkInStamp}`
}

async function hasOperatorStatusEmailBeenSent(
  bookingId: string,
  recipient: string,
  statusType: 'registered' | 'hold' | 'confirmed' | 'cancelled',
  paymentStatus?: string | null
) {
  return hasNotificationMarker(bookingId, recipient, `tour_operator_${statusType}_${paymentStatus || 'unknown'}:`)
}

function shouldSendGuestConfirmationOnBookingEvent(booking: BookingEmailContext) {
  const status = normalize(booking.booking_status)
  return status === 'confirmed'
}

function shouldSendGuestCheckInEmail(booking: BookingEmailContext) {
  return normalize(booking.booking_status) === 'checked_in'
}

function isWalkInBooking(booking: BookingEmailContext) {
  return normalize(booking.booking_source) === 'walk_in'
}

function shouldSendWalkInWelcomeEmailOnCreate(booking: BookingEmailContext, trigger: BookingEmailTrigger) {
  return trigger === 'admin_booking_created' && isWalkInBooking(booking) && shouldSendGuestCheckInEmail(booking)
}

function shouldSendWalkInPaymentCompletionEmail(booking: BookingEmailContext, trigger: BookingEmailTrigger) {
  return trigger === 'admin_status_changed' && isWalkInBooking(booking) && normalize(booking.payment_status) === 'fully_paid'
}

function shouldSendGuestPaymentUpdateEmail(booking: BookingEmailContext, trigger: BookingEmailTrigger) {
  const paymentStatus = normalize(booking.payment_status)
  if (trigger === 'admin_payment_completed') return paymentStatus === 'fully_paid'
  if (trigger === 'admin_payment_updated') return ['payment_processing', 'fully_paid'].includes(paymentStatus)
  return false
}

function resolveOperatorStatusType(booking: BookingEmailContext): 'registered' | 'hold' | 'confirmed' | 'cancelled' {
  const status = normalize(booking.booking_status)
  if (status === 'hold') return 'hold'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'pending') return 'registered'
  return 'confirmed'
}

export async function getBookingEmailContext(bookingId: string) {
  const { data } = await getSupabaseAdmin()
    .from('bookings')
    .select(BOOKING_EMAIL_SELECT)
    .eq('id', bookingId)
    .single() as any
  const booking = (data || null) as BookingEmailContext | null
  if (!booking) return null

  if (
    normalize(booking.booking_source) === 'tour_operator' &&
    booking.tour_operator_id &&
    (!booking.tour_operator || !booking.tour_operator.email)
  ) {
    const { data: operatorData } = await getSupabaseAdmin()
      .from('tour_operators')
      .select('company_name, contact_person, email, cc_email, phone')
      .eq('id', booking.tour_operator_id)
      .single() as any

    if (operatorData) {
      booking.tour_operator = operatorData
    }
  }

  return booking
}

export async function sendBookingLifecycleEmails(bookingId: string, trigger: BookingEmailTrigger) {
  const booking = await getBookingEmailContext(bookingId)
  if (!booking) return { guestConfirmation: false, paymentSuccess: false, operatorStatus: false, adminAlert: false }

  const source = normalize(booking.booking_source)
  const suppressCreateEmailsForBackdatedEntry = trigger === 'admin_booking_created' && isBackdatedBookingEntry(booking)
  const results = {
    guestConfirmation: false,
    paymentSuccess: false,
    operatorStatus: false,
    adminAlert: false,
  }

  if (isLocalTestMode()) {
    logDebug('LOCAL TEST MODE booking email trigger evaluation', {
      booking_id: booking.id,
      trigger,
      booking_source: booking.booking_source || 'unknown',
      booking_status: booking.booking_status || 'unknown',
      payment_status: booking.payment_status || 'unknown',
      suppress_create_emails_for_backdated_entry: suppressCreateEmailsForBackdatedEntry,
    })
  }

  if (
    !suppressCreateEmailsForBackdatedEntry &&
    source === 'tour_operator' &&
    booking.tour_operator?.email &&
    ['admin_booking_created', 'admin_status_changed'].includes(trigger) &&
    normalize(booking.booking_status) !== 'checked_in'
  ) {
    const statusType = resolveOperatorStatusType(booking)
    const operatorAlreadySent = await hasOperatorStatusEmailBeenSent(booking.id, booking.tour_operator.email, statusType, booking.payment_status)
    if (!operatorAlreadySent) {
      if (isLocalTestMode()) {
        logInfo('LOCAL TEST MODE operator booking email triggered', {
          booking_id: booking.id,
          recipient: booking.tour_operator.email,
          statusType,
        })
      }
      results.operatorStatus = await sendTourOperatorBookingStatusEmail(booking, booking.tour_operator, statusType)
    }
  }

  // `website` source is used both for public website bookings and admin-created direct bookings using LWWEB tariff.
  // We decide confirmation timing from booking/payment status so public pending bookings do not get premature emails.
  if (!suppressCreateEmailsForBackdatedEntry && booking.guest_email && ['admin_booking_created', 'admin_status_changed'].includes(trigger) && shouldSendGuestConfirmationOnBookingEvent(booking)) {
    const isTourOperatorGuest = source === 'tour_operator'
    results.guestConfirmation = await sendTrackedGuestEmail({
      booking,
      recipient: booking.guest_email,
      subject: `Booking Confirmed - ${booking.booking_number || 'LeafWalk Resort'}`,
      html: renderBookingConfirmationEmail(booking as any),
      marker: `guest_booking_confirmation:${booking.booking_number || booking.id}`,
      eventType: 'booking_confirmation',
      debugLabel: `${source || 'unknown'} guest booking confirmation`,
      attachments: isTourOperatorGuest
        ? [await generateCheckInPassAttachment(booking as any)]
        : [await generateReceiptAttachment(booking as any)],
    })
  }

  if (!suppressCreateEmailsForBackdatedEntry && booking.guest_email && shouldSendWalkInWelcomeEmailOnCreate(booking, trigger)) {
    const checkInAssets = await buildCheckInEmailAssets(booking)
    const frontDeskSender = getFrontDeskSender()
    results.guestConfirmation = await sendTrackedGuestEmail({
      booking,
      recipient: booking.guest_email,
      subject: `Welcome to LeafWalk Resort - ${booking.booking_number || 'Walk-in Booking'}`,
      html: checkInAssets.html,
      marker: getCheckInMarker(booking, 'walk_in_check_in_completed'),
      eventType: 'booking_confirmation',
      debugLabel: 'walk-in welcome email',
      attachments: checkInAssets.attachments,
      fromEmail: frontDeskSender.fromEmail,
      fromName: frontDeskSender.fromName,
    })
  }

  if (booking.guest_email && trigger === 'admin_status_changed' && shouldSendGuestCheckInEmail(booking) && !isWalkInBooking(booking)) {
    const checkInAssets = await buildCheckInEmailAssets(booking)
    const frontDeskSender = getFrontDeskSender()
    results.guestConfirmation = await sendTrackedGuestEmail({
      booking,
      recipient: booking.guest_email,
      subject: `Welcome to LeafWalk Resort - Check-in Completed`,
      html: checkInAssets.html,
      marker: getCheckInMarker(booking, 'guest_check_in_completed'),
      eventType: 'checkin_reminder',
      debugLabel: `${source || 'unknown'} guest check-in completed`,
      attachments: checkInAssets.attachments,
      fromEmail: frontDeskSender.fromEmail,
      fromName: frontDeskSender.fromName,
    })
  }

  if (booking.guest_email && shouldSendWalkInPaymentCompletionEmail(booking, trigger)) {
    results.paymentSuccess = await sendTrackedGuestEmail({
      booking,
      recipient: booking.guest_email,
      subject: `Payment Completed - ${booking.booking_number || 'LeafWalk Resort'}`,
      html: renderPaymentSuccessEmail(booking as any),
      marker: `walk_in_payment_completed:${booking.booking_number || booking.id}`,
      eventType: 'payment_success',
      debugLabel: 'walk-in payment completion',
      attachments: booking.gst_invoice_requested ? [await generateReceiptAttachment(booking as any)] : undefined,
    })
  }

  if (booking.guest_email && shouldSendGuestPaymentUpdateEmail(booking, trigger)) {
    const isFinalPayment = normalize(booking.payment_status) === 'fully_paid'
    results.paymentSuccess = await sendTrackedGuestEmail({
      booking,
      recipient: booking.guest_email,
      subject: isFinalPayment
        ? `Final Payment Received - ${booking.booking_number || 'LeafWalk Resort'}`
        : `Payment Received - ${booking.booking_number || 'LeafWalk Resort'}`,
      html: renderPaymentSuccessEmail(booking as any),
      marker: `${isFinalPayment ? 'guest_payment_completed' : 'guest_payment_received'}:${booking.booking_number || booking.id}:${booking.advance_amount || 0}`,
      eventType: 'payment_success',
      debugLabel: `${source || 'unknown'} guest payment update`,
      attachments: source === 'tour_operator' ? undefined : [await generateReceiptAttachment(booking as any)],
    })
  }

  if (booking.guest_email && trigger === 'payment_verified') {
    results.guestConfirmation = await sendTrackedGuestEmail({
      booking,
      recipient: booking.guest_email,
      subject: `Booking Confirmed - ${booking.booking_number || 'LeafWalk Resort'}`,
      html: renderBookingConfirmationEmail(booking as any),
      marker: `guest_booking_confirmation:${booking.booking_number || booking.id}`,
      eventType: 'booking_confirmation',
      debugLabel: 'website payment-verified booking confirmation',
      attachments: [await generateReceiptAttachment(booking as any)],
    })

    if (source === 'website') {
      const adminRecipient = process.env.ADMIN_BOOKING_ALERT_EMAIL || 'admin@leafwalk.in'
      results.adminAlert = await sendTrackedGuestEmail({
        booking,
        recipient: adminRecipient,
        subject: `New Website Booking - ${booking.booking_number || 'LeafWalk Resort'}`,
        html: renderAdminWebsiteBookingAlertEmail(booking as any),
        marker: `admin_website_booking_alert:${booking.booking_number || booking.id}`,
        eventType: 'booking_confirmation',
        debugLabel: 'website booking admin alert',
        attachments: [await generateReceiptAttachment(booking as any)],
      })
    }
  }

  if (isLocalTestMode() && trigger === 'public_booking_created' && !shouldSendGuestConfirmationOnBookingEvent(booking)) {
    logInfo('LOCAL TEST MODE website booking created without guest confirmation', {
      booking_id: booking.id,
      booking_source: booking.booking_source || 'unknown',
      booking_status: booking.booking_status || 'unknown',
      payment_status: booking.payment_status || 'unknown',
    })
  }

  return results
}
