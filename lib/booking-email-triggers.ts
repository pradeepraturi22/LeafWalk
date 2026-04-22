import { generateCheckInCompletedEmail, generateReceiptAttachment, renderBookingConfirmationEmail, sendEmail } from '@/lib/email-service'
import { logDebug, logError, logInfo } from '@/lib/logger'
import { isLocalTestMode } from '@/lib/runtime-mode'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { sendTourOperatorBookingStatusEmail } from '@/lib/tour-operator-notifications'

type BookingEmailContext = {
  id: string
  created_at?: string | null
  booking_number?: string | null
  invoice_number?: string | null
  booking_source?: string | null
  booking_type?: string | null
  booking_status?: string | null
  payment_status?: string | null
  payment_method?: string | null
  guest_name?: string | null
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
  | 'payment_verified'

const BOOKING_EMAIL_SELECT = `
  id, created_at, booking_number, invoice_number, booking_source, booking_type, booking_status, payment_status, payment_method,
  guest_name, guest_email, guest_phone, guest_phone_country,
  check_in, check_out, nights, rooms_booked, adults, meal_plan,
  total_amount, subtotal, cgst, sgst, gst_total, advance_amount, balance_amount, payment_due_date, razorpay_payment_id, tour_operator_id,
  room:rooms(name, category, featured_image),
  tour_operator:tour_operators(company_name, contact_person, email, phone)
`

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase()
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
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>
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

  const sent = await sendEmail(
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
    status: sent ? 'sent' : 'failed',
    marker: input.marker,
    eventType: input.eventType,
    errorMessage: sent ? undefined : 'Email provider rejected message',
  })

  return sent
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

  return (data || null) as BookingEmailContext | null
}

export async function sendBookingLifecycleEmails(bookingId: string, trigger: BookingEmailTrigger) {
  const booking = await getBookingEmailContext(bookingId)
  if (!booking) return { guestConfirmation: false, paymentSuccess: false, operatorStatus: false }

  const source = normalize(booking.booking_source)
  const results = {
    guestConfirmation: false,
    paymentSuccess: false,
    operatorStatus: false,
  }

  if (isLocalTestMode()) {
    logDebug('LOCAL TEST MODE booking email trigger evaluation', {
      booking_id: booking.id,
      trigger,
      booking_source: booking.booking_source || 'unknown',
      booking_status: booking.booking_status || 'unknown',
      payment_status: booking.payment_status || 'unknown',
    })
  }

  if (source === 'tour_operator' && booking.tour_operator?.email && ['admin_booking_created', 'admin_status_changed'].includes(trigger)) {
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
  if (source !== 'tour_operator' && booking.guest_email && ['admin_booking_created', 'admin_status_changed'].includes(trigger) && shouldSendGuestConfirmationOnBookingEvent(booking)) {
    results.guestConfirmation = await sendTrackedGuestEmail({
      booking,
      recipient: booking.guest_email,
      subject: `Booking Confirmed - ${booking.booking_number || 'LeafWalk Resort'}`,
      html: renderBookingConfirmationEmail(booking as any),
      marker: `guest_booking_confirmation:${booking.booking_number || booking.id}`,
      eventType: 'booking_confirmation',
      debugLabel: `${source || 'unknown'} guest booking confirmation`,
      attachments: [await generateReceiptAttachment(booking as any)],
    })
  }

  if (booking.guest_email && trigger === 'admin_status_changed' && shouldSendGuestCheckInEmail(booking)) {
    await sendTrackedGuestEmail({
      booking,
      recipient: booking.guest_email,
      subject: `Welcome to LeafWalk Resort - Check-in Completed`,
      html: generateCheckInCompletedEmail(booking as any),
      marker: `guest_check_in_completed:${booking.booking_number || booking.id}`,
      eventType: 'checkin_reminder',
      debugLabel: `${source || 'unknown'} guest check-in completed`,
      fromEmail: 'frontdesk@leafwalk.in',
      fromName: 'LeafWalk Front Desk',
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
