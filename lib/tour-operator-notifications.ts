import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { generateCheckInPassAttachment, generateReceiptAttachment, sendEmail, sendEmailWithResult } from '@/lib/email-service'
import { logDebug, logError, logInfo } from '@/lib/logger'
import { isLocalTestMode } from '@/lib/runtime-mode'
import { buildWifiEmailPayload, getWifiQrCid } from '@/lib/wifi-email'

type TourOperatorLike = {
  id?: string
  company_name?: string | null
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
}

type BookingLike = {
  id: string
  booking_number?: string | null
  guest_name?: string | null
  guest_email?: string | null
  guest_phone?: string | null
  check_in: string
  check_out: string
  nights?: number | null
  rooms_booked?: number | null
  adults?: number | null
  meal_plan?: string | null
  total_amount?: number | null
  advance_amount?: number | null
  balance_amount?: number | null
  payment_status?: string | null
  booking_status?: string | null
  cancellation_reason?: string | null
  payment_due_date?: string | null
  room?: { name?: string | null; category?: string | null } | null
}

type WifiEmailDetails = {
  ssid?: string | null
  password?: string | null
  security?: string | null
  hidden?: boolean | null
  qrCid?: string | null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getLogoUrl() {
  return 'cid:leafwalk-logo'
}

function safe(value?: string | null) {
  return escapeHtml(String(value || '-'))
}

function operatorLayout(title: string, body: string) {
  return `
    <div style="margin:0;padding:32px;background:#f5f2ea;font-family:Arial,sans-serif">
      <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e8dcc2;border-radius:18px;overflow:hidden">
        <div style="padding:24px 28px;background:#101010;color:#c9a14a">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:56px;height:56px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid rgba(255,255,255,0.18)">
              <img src="${getLogoUrl()}" alt="LeafWalk Resort" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:contain" />
            </div>
            <div>
              <div style="font-size:26px;font-weight:700">LeafWalk Resort</div>
              <div style="margin-top:6px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#f0d691">Travel Partner Desk</div>
            </div>
          </div>
        </div>
        <div style="padding:28px;color:#1f2937;line-height:1.65">
          <h1 style="margin:0 0 16px;font-size:24px;color:#111827">${title}</h1>
          ${body}
        </div>
      </div>
    </div>
  `
}

function bookingFacts(booking: BookingLike, operator: TourOperatorLike) {
  const rows = [
    ['Booking Ref', booking.booking_number || booking.id.slice(0, 8).toUpperCase()],
    ['Operator', operator.company_name],
    ['Guest Name', booking.guest_name || '-'],
    ['Room Type', booking.room?.name || booking.room?.category || '-'],
    ['Check-in', booking.check_in],
    ['Check-out', booking.check_out],
    ['Nights', String(booking.nights || 0)],
    ['Rooms', String(booking.rooms_booked || 1)],
    ['Adults', String(booking.adults || 1)],
    ['Meal Plan', booking.meal_plan || 'EP'],
    ['Booking Status', booking.booking_status || '-'],
    ['Payment Status', booking.payment_status || '-'],
    ['Total Amount', `INR ${Number(booking.total_amount || 0).toLocaleString('en-IN')}`],
    ['Advance Paid', `INR ${Number(booking.advance_amount || 0).toLocaleString('en-IN')}`],
    ['Balance Pending', `INR ${Number(booking.balance_amount || 0).toLocaleString('en-IN')}`],
    ['Payment Due Date', booking.payment_due_date || '-'],
  ]

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:9px 0;border-bottom:1px solid #ececec;color:#6b7280;font-size:13px;width:40%">${escapeHtml(String(label || '-'))}</td>
          <td style="padding:9px 0;border-bottom:1px solid #ececec;color:#111827;font-size:13px;font-weight:600">${escapeHtml(String(value || '-'))}</td>
        </tr>
      `).join('')}
    </table>
  `
}

function buildWelcomeHtml(operator: TourOperatorLike) {
  const partnerName = safe(operator.company_name || operator.contact_person || 'Partner')

  return operatorLayout(
    'Welcome to Leafwalk Resort - Partnership Confirmation',
    `
      <p>Dear ${partnerName},</p>
      <p>Greetings from Leafwalk Resort!</p>
      <p>We are pleased to welcome you as our valued travel partner.</p>
      <p>Your organization has been successfully registered with us, and you can now start sending booking requests for our property.</p>
      <p>Our team is committed to providing seamless coordination, comfortable stays, and excellent service for your guests.</p>
      <div style="margin-top:20px;padding:18px 20px;border:1px solid #e8dcc2;border-radius:14px;background:#faf7f1">
        <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:10px">For booking requests and assistance, please contact us:</div>
        <div style="font-size:14px;color:#1f2937;line-height:1.8">
          <div>Phone: +91-9368080535</div>
          <div>Email: info@leafwalk.in, reservations@leafwalk.in</div>
        </div>
      </div>
      <p style="margin-top:18px">We look forward to building a strong and long-term association with you.</p>
      <p style="margin-top:18px">Warm regards,<br />Team Leafwalk Resort</p>
    `
  )
}

function buildStatusHtml(
  booking: BookingLike,
  operator: TourOperatorLike,
  statusType: 'registered' | 'hold' | 'confirmed' | 'cancelled',
  wifi?: WifiEmailDetails
) {
  const introMap = {
    registered: 'A new tour operator booking has been registered in your account.',
    hold: 'A booking has been placed on hold for your account.',
    confirmed: 'A booking has been confirmed for your account.',
    cancelled: `A booking has been cancelled.${booking.cancellation_reason ? ` Reason: ${escapeHtml(booking.cancellation_reason)}` : ''}`,
  }

  const titleMap = {
    registered: 'New Booking Registered',
    hold: 'Booking Placed On Hold',
    confirmed: 'Booking Confirmed',
    cancelled: 'Booking Cancelled',
  }

  return operatorLayout(
    titleMap[statusType],
    `
      <p>Hi ${safe(operator.contact_person || operator.company_name)},</p>
      <p>${introMap[statusType]}</p>
      ${bookingFacts(booking, operator)}
      ${String(booking.booking_status || '').toLowerCase() === 'checked_in' ? `
        <div style="margin-top:22px">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin-bottom:10px">Hotel Information</div>
          <table style="width:100%;border-collapse:collapse">
            ${[
              ['Wi-Fi', `${wifi?.ssid || 'Leafwalk Resort'} / ${wifi?.password || 'Password-123456'}`],
              ['Wi-Fi Security', wifi?.security || 'WPA'],
              ['Restaurant Timings', 'Breakfast 8:00 AM - 10:00 AM | Kitchen till 10:00 PM'],
              ['Front Desk Contact', '+91-8630227541'],
            ].map(([label, value]) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:42%">${escapeHtml(label)}</td>
                <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;font-weight:600">${escapeHtml(value)}</td>
              </tr>
            `).join('')}
          </table>
          ${wifi?.qrCid ? `
            <div style="margin-top:18px;padding:18px;border:1px solid #e5e7eb;border-radius:16px;background:#faf7f1;text-align:center">
              <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin-bottom:10px">Guest Wi-Fi QR</div>
              <img src="cid:${escapeHtml(wifi.qrCid)}" alt="LeafWalk Wi-Fi QR" width="170" height="170" style="display:block;margin:0 auto 10px;width:170px;height:170px;object-fit:contain" />
              <div style="font-size:12px;color:#6b7280">Guest can scan this QR after arrival to connect instantly.</div>
            </div>
          ` : ''}
        </div>
      ` : ''}
    `
  )
}

function buildReminderHtml(booking: BookingLike, operator: TourOperatorLike, daysLeft: number) {
  const balance = Number(booking.balance_amount || 0)
  const checkInText = daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`

  return operatorLayout(
    `Balance Payment Reminder - ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`,
    `
      <p>Hi ${safe(operator.contact_person || operator.company_name)},</p>
      <p>This is a gentle payment reminder for the booking below. Guest check-in is <strong>${checkInText}</strong>.</p>
      <p style="padding:14px 16px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412">
        Balance payment of <strong>INR ${balance.toLocaleString('en-IN')}</strong> is pending. Kindly clear the due amount before check-in so there is no inconvenience during guest arrival.
      </p>
      ${bookingFacts(booking, operator)}
      <p style="margin-top:18px">For payment coordination, please contact the LeafWalk payments team.</p>
    `
  )
}

async function logNotification(bookingId: string | null, recipient: string, status: 'sent' | 'failed', content: string, errorMessage?: string) {
  try {
    await getSupabaseAdmin().from('notification_logs').insert({
      booking_id: bookingId,
      type: 'email',
      recipient,
      status,
      content: content.slice(0, 500),
      error_message: errorMessage || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
  } catch (error) {
    logError('Failed to log tour operator notification:', error)
  }
}

export async function sendTourOperatorWelcomeEmail(operator: TourOperatorLike) {
  if (!operator.email) return false

  if (isLocalTestMode()) {
    logInfo('LOCAL TEST MODE operator registration welcome email triggered', {
      company_name: operator.company_name || '-',
      recipient: operator.email,
    })
  }

  const result = await sendEmailWithResult(
    operator.email,
    'Welcome to Leafwalk Resort - Partnership Confirmation',
    buildWelcomeHtml(operator),
    undefined,
    {
      emailType: 'general',
      fromEmail: process.env.FROM_EMAIL_PARTNERS || process.env.FROM_EMAIL || 'no-reply@leafwalk.in',
      fromName: 'LeafWalk Partner Desk',
    }
  )

  if (!result.success) {
    logError('Tour operator welcome email provider failed:', {
      recipient: operator.email,
      company_name: operator.company_name || '-',
      provider: result.provider || 'unknown',
      error: result.error || 'Unknown email provider error',
    })
  }

  await logNotification(null, operator.email, result.success ? 'sent' : 'failed', `tour_operator_welcome:${operator.company_name}`, result.error)
  return result.success
}

export async function sendTourOperatorBookingStatusEmail(
  booking: BookingLike,
  operator: TourOperatorLike,
  statusType: 'registered' | 'hold' | 'confirmed' | 'cancelled'
) {
  if (!operator.email) return false

  if (isLocalTestMode()) {
    logDebug('LOCAL TEST MODE operator booking status email triggered', {
      booking_id: booking.id,
      booking_number: booking.booking_number || booking.id,
      recipient: operator.email,
      statusType,
    })
  }

  const subjectMap = {
    registered: `New Booking Registered - ${booking.booking_number || 'LeafWalk Resort'}`,
    hold: `Booking On Hold - ${booking.booking_number || 'LeafWalk Resort'}`,
    confirmed: `Booking Confirmed - ${booking.booking_number || 'LeafWalk Resort'}`,
    cancelled: `Booking Cancelled - ${booking.booking_number || 'LeafWalk Resort'}`,
  }
  const isCheckedIn = String(booking.booking_status || '').toLowerCase() === 'checked_in'
  const wifiPayload = isCheckedIn ? await buildWifiEmailPayload() : null
  const attachments = [
    await generateReceiptAttachment(booking as any),
    await generateCheckInPassAttachment(booking as any),
    ...(wifiPayload?.qrAttachment ? [wifiPayload.qrAttachment] : []),
  ]

  const result = await sendEmailWithResult(
    operator.email,
    subjectMap[statusType],
    buildStatusHtml(booking, operator, statusType, wifiPayload ? {
      ...wifiPayload.wifi,
      qrCid: wifiPayload.qrAttachment ? getWifiQrCid() : null,
    } : undefined),
    attachments,
    {
      emailType: 'booking_confirmation',
      fromEmail: process.env.FROM_EMAIL_BOOKINGS || process.env.FROM_EMAIL || 'no-reply@leafwalk.in',
      fromName: 'LeafWalk Reservations',
    }
  )

  await logNotification(
    booking.id,
    operator.email,
    result.success ? 'sent' : 'failed',
    `tour_operator_${statusType}_${booking.payment_status || 'unknown'}:${booking.booking_number || booking.id}`,
    result.error
  )
  return result.success
}

export async function sendTourOperatorBalanceReminderEmail(
  booking: BookingLike,
  operator: TourOperatorLike,
  daysLeft: number
) {
  if (!operator.email) return false

  const sent = await sendEmail(
    operator.email,
    `Balance Payment Reminder - ${booking.booking_number || 'LeafWalk Resort'} - ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
    buildReminderHtml(booking, operator, daysLeft),
    [await generateReceiptAttachment(booking as any)],
    {
      emailType: 'payment_success',
      fromEmail: process.env.FROM_EMAIL_PAYMENTS || 'payments@leafwalk.in',
      fromName: 'LeafWalk Payments',
    }
  )

  await logNotification(booking.id, operator.email, sent ? 'sent' : 'failed', `tour_operator_balance_${daysLeft}d:${booking.booking_number || booking.id}`)
  return sent
}

export async function hasBalanceReminderBeenSent(bookingId: string, email: string, daysLeft: number) {
  try {
    const { data } = await getSupabaseAdmin()
      .from('notification_logs')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('type', 'email')
      .eq('recipient', email)
      .eq('status', 'sent')
      .like('content', `tour_operator_balance_${daysLeft}d:%`)
      .limit(1)

    return Boolean(data?.length)
  } catch {
    return false
  }
}
