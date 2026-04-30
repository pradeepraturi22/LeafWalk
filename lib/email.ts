import nodemailer from 'nodemailer'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createStyledBookingReceiptPdf } from '@/lib/booking-email-receipt-pdf'
import { logDebug, logInfo } from '@/lib/logger'
import { isLocalNotificationMockMode } from '@/lib/runtime-mode'

type EmailAttachment = {
  filename: string
  content: Buffer | string
  contentType?: string
  cid?: string
  disposition?: 'attachment' | 'inline'
}

type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: EmailAttachment[]
  fromEmail?: string
  fromName?: string
  emailType?: 'booking_confirmation' | 'payment_success' | 'otp_login' | 'checkin_reminder' | 'general'
}

type BookingLike = {
  id: string
  booking_number?: string | null
  invoice_number?: string | null
  guest_name: string
  gst_invoice_requested?: boolean | null
  gst_company_name?: string | null
  gst_number?: string | null
  gst_state?: string | null
  guest_email?: string | null
  guest_phone?: string | null
  room?: { name?: string | null; category?: string | null }
  check_in: string
  check_out: string
  nights: number
  rooms_booked?: number
  adults?: number
  meal_plan?: string | null
  total_amount: number
  subtotal?: number | null
  cgst?: number | null
  sgst?: number | null
  gst_total?: number | null
  advance_amount?: number | null
  balance_amount?: number | null
  payment_method?: string | null
  payment_status?: string | null
}

type WifiEmailDetails = {
  ssid?: string | null
  password?: string | null
  security?: string | null
  hidden?: boolean | null
  qrCid?: string | null
}

export type EmailProviderResult = {
  success: boolean
  provider?: string
  messageId?: string
  error?: string
}

type ProviderName = 'smtp' | 'resend' | 'sendgrid'

const INLINE_LOGO_CID = 'leafwalk-logo'

function getFromEmail(emailType: SendEmailInput['emailType'] = 'general') {
  if (emailType === 'booking_confirmation') {
    return process.env.FROM_EMAIL_BOOKINGS || process.env.FROM_EMAIL || process.env.SMTP_USER || 'bookings@leafwalk.in'
  }
  if (emailType === 'payment_success') {
    return process.env.FROM_EMAIL_PAYMENTS || process.env.FROM_EMAIL_BOOKINGS || process.env.FROM_EMAIL || process.env.SMTP_USER || 'payments@leafwalk.in'
  }
  if (emailType === 'otp_login') {
    return process.env.FROM_EMAIL_AUTH || process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@leafwalk.in'
  }
  if (emailType === 'checkin_reminder') {
    return process.env.FROM_EMAIL_REMINDERS || process.env.FROM_EMAIL_BOOKINGS || process.env.FROM_EMAIL || process.env.SMTP_USER || 'bookings@leafwalk.in'
  }
  return process.env.FROM_EMAIL || process.env.SMTP_USER || 'bookings@leafwalk.in'
}

function getFromName(emailType: SendEmailInput['emailType'] = 'general') {
  if (emailType === 'payment_success') return 'LeafWalk Payments'
  if (emailType === 'otp_login') return 'LeafWalk Login'
  if (emailType === 'checkin_reminder') return 'LeafWalk Reservations'
  if (emailType === 'booking_confirmation') return 'LeafWalk Bookings'
  return 'LeafWalk Resort'
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
  return `cid:${INLINE_LOGO_CID}`
}

export function createBookingReceiptPdf(booking: BookingLike) {
  return createStyledBookingReceiptPdf(booking)
}

function attachmentContentToBase64(content: Buffer | string) {
  return Buffer.isBuffer(content)
    ? content.toString('base64')
    : Buffer.from(content, 'utf8').toString('base64')
}

function getInlineLogoAttachment(): EmailAttachment | null {
  try {
    return {
      filename: 'leafwalk-logo.jpeg',
      content: readFileSync(join(process.cwd(), 'public', 'logo', 'leafwalk-logo.jpeg')),
      contentType: 'image/jpeg',
      cid: INLINE_LOGO_CID,
      disposition: 'inline',
    }
  } catch (error: any) {
    logDebug('LeafWalk inline email logo not attached', {
      error: error?.message || 'Logo file not found',
    })
    return null
  }
}

function withInlineLogoAttachments(attachments?: EmailAttachment[]) {
  const existingAttachments = attachments || []
  if (existingAttachments.some((attachment) => attachment.cid === INLINE_LOGO_CID)) {
    return existingAttachments
  }

  const logoAttachment = getInlineLogoAttachment()
  return logoAttachment ? [logoAttachment, ...existingAttachments] : existingAttachments
}

function buildTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

async function sendWithSmtp(input: SendEmailInput): Promise<EmailProviderResult> {
  const transporter = buildTransport()
  if (!transporter) {
    return { success: false, error: 'SMTP not configured' }
  }

  const fromEmail = input.fromEmail || getFromEmail(input.emailType)
  const fromName = input.fromName || getFromName(input.emailType)

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: withInlineLogoAttachments(input.attachments),
  })

  return {
    success: true,
    provider: 'smtp',
    messageId: info.messageId,
  }
}

export async function sendSmtpOnlyEmail(input: SendEmailInput): Promise<EmailProviderResult> {
  try {
    return await sendWithSmtp(input)
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'SMTP send failed',
    }
  }
}

async function sendWithResend(input: SendEmailInput): Promise<EmailProviderResult> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'Resend not configured' }
  }

  const fromEmail = input.fromEmail || getFromEmail(input.emailType)
  const attachments = withInlineLogoAttachments(input.attachments)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachmentContentToBase64(attachment.content),
        content_type: attachment.contentType,
        content_id: attachment.cid,
        disposition: attachment.disposition || (attachment.cid ? 'inline' : 'attachment'),
      })),
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    return { success: false, error: data?.message || 'Resend failed' }
  }

  return {
    success: true,
    provider: 'resend',
    messageId: data?.id,
  }
}

async function sendWithSendGrid(input: SendEmailInput): Promise<EmailProviderResult> {
  if (!process.env.SENDGRID_API_KEY) {
    return { success: false, error: 'SendGrid not configured' }
  }

  const fromEmail = input.fromEmail || getFromEmail(input.emailType)
  const fromName = input.fromName || getFromName(input.emailType)
  const attachments = withInlineLogoAttachments(input.attachments)

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: (Array.isArray(input.to) ? input.to : [input.to]).map((email) => ({ email })) }],
      from: { email: fromEmail, name: fromName },
      subject: input.subject,
      content: [
        { type: 'text/plain', value: input.text || '' },
        { type: 'text/html', value: input.html },
      ],
      attachments: attachments.map((attachment) => ({
        content: attachmentContentToBase64(attachment.content),
        filename: attachment.filename,
        type: attachment.contentType || 'application/octet-stream',
        disposition: attachment.disposition || (attachment.cid ? 'inline' : 'attachment'),
        content_id: attachment.cid,
      })),
    }),
  })

  if (!response.ok) {
    const data = await response.text()
    return { success: false, error: data || 'SendGrid failed' }
  }

  return {
    success: true,
    provider: 'sendgrid',
  }
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<EmailProviderResult> {
  try {
    // LOCAL TEST MODE ONLY
    // REMOVE / DISABLE FOR PRODUCTION
    if (isLocalNotificationMockMode()) {
      logInfo('LOCAL TEST MODE email mock send', {
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        emailType: input.emailType || 'general',
      })
      logDebug('LOCAL TEST MODE email body preview', input.html.slice(0, 400))
      return {
        success: true,
        provider: 'local-mock',
        messageId: `local-email-${Date.now()}`,
      }
    }

    const preferredProvider = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase()
    const providers: ProviderName[] =
      preferredProvider === 'smtp'
        ? ['smtp', 'resend', 'sendgrid']
        : preferredProvider === 'resend'
          ? ['resend', 'smtp', 'sendgrid']
          : preferredProvider === 'sendgrid'
            ? ['sendgrid', 'smtp', 'resend']
            : ['smtp', 'resend', 'sendgrid']

    const errors: string[] = []

    for (const provider of providers) {
      const result =
        provider === 'smtp'
          ? await sendWithSmtp(input)
          : provider === 'resend'
            ? await sendWithResend(input)
            : await sendWithSendGrid(input)

      if (result.success) {
        if (errors.length) {
          logInfo('Email delivered after provider fallback', {
            provider: result.provider,
            subject: input.subject,
            emailType: input.emailType || 'general',
            previousErrors: errors,
          })
        }
        return result
      }

      errors.push(`${provider}: ${result.error || 'Unknown provider error'}`)
    }

    return {
      success: false,
      error: errors.join(' | ') || 'Email send failed',
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Email send failed',
    }
  }
}

function layoutEmail(title: string, body: string) {
  return `
    <div style="margin:0;padding:32px;background:#f3f1eb;font-family:Arial,sans-serif">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e9dcc0">
        <div style="padding:28px 32px;background:#101010;color:#c9a14a">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:58px;height:58px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid rgba(255,255,255,0.18)">
              <img src="${getLogoUrl()}" alt="LeafWalk Resort" width="58" height="58" style="display:block;width:58px;height:58px;object-fit:contain" />
            </div>
            <div>
              <div style="font-size:28px;font-weight:700;letter-spacing:0.04em">LeafWalk Resort</div>
              <div style="margin-top:6px;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#f0d691">Stay in Lap of Nature</div>
            </div>
          </div>
        </div>
        <div style="padding:32px;color:#1f2937;line-height:1.7">
          <h1 style="margin:0 0 18px;font-size:24px;color:#111827">${title}</h1>
          ${body}
        </div>
      </div>
    </div>
  `
}

export function renderOtpEmail(name: string, otp: string) {
  return layoutEmail(
    'Your LeafWalk login code',
    `
      <p>Hi ${escapeHtml(name || 'Guest')},</p>
      <p>Use the OTP below to securely access your LeafWalk booking account.</p>
      <div style="margin:24px 0;padding:18px 22px;border-radius:14px;background:#111827;color:#f8fafc;font-size:30px;letter-spacing:0.28em;font-weight:700;text-align:center">
        ${escapeHtml(otp)}
      </div>
      <p>This code expires in 5 minutes. If you did not request this, you can ignore this email.</p>
    `
  )
}

function bookingFactsTable(booking: BookingLike, amountLabel: string) {
  const rows = [
    ['Booking Ref', booking.booking_number || booking.id.slice(0, 8).toUpperCase()],
    ['Guest', booking.guest_name],
    ['Room', booking.room?.name || booking.room?.category || '-'],
    ['Check-in', booking.check_in],
    ['Check-out', booking.check_out],
    ['Nights', String(booking.nights)],
    ['Rooms', String(booking.rooms_booked || 1)],
    ['Adults', String(booking.adults || 1)],
    ['Meal Plan', booking.meal_plan || 'EP'],
    [amountLabel, `INR ${Number(booking.total_amount || 0).toLocaleString('en-IN')}`],
    ['Amount Paid', `INR ${Number(booking.advance_amount || 0).toLocaleString('en-IN')}`],
    ['Balance Due', `INR ${Number(booking.balance_amount || 0).toLocaleString('en-IN')}`],
  ]

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:18px">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:42%">${escapeHtml(label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;font-weight:600">${escapeHtml(value)}</td>
        </tr>
      `).join('')}
    </table>
  `
}

export function renderBookingConfirmationEmail(booking: BookingLike) {
  const documentLabel = booking.payment_status === 'fully_paid' ? 'GST invoice' : 'receipt'
  return layoutEmail(
    'Your booking is confirmed',
    `
      <p>Hi ${escapeHtml(booking.guest_name)},</p>
      <p>Thank you for choosing LeafWalk Resort. Your booking has been confirmed and your ${documentLabel} is attached.</p>
      ${bookingFactsTable(booking, 'Booking Total')}
      <p style="margin-top:20px">Need help? Reply to this email or call us at +91-9368080535.</p>
    `
  )
}

export function renderPaymentSuccessEmail(booking: BookingLike) {
  return layoutEmail(
    'Payment received successfully',
    `
      <p>Hi ${escapeHtml(booking.guest_name)},</p>
      <p>We have successfully received your payment for the booking below.</p>
      ${bookingFactsTable(booking, 'Stay Total')}
      <p style="margin-top:20px">Your booking receipt is attached for quick reference.</p>
    `
  )
}

export function renderAdminWebsiteBookingAlertEmail(booking: BookingLike) {
  return layoutEmail(
    'New website booking received',
    `
      <p>A new website booking has been confirmed after successful payment.</p>
      ${bookingFactsTable(booking, 'Stay Total')}
      <p style="margin-top:20px">Please review this booking in the admin panel for arrival planning and operations.</p>
    `
  )
}

export function renderCheckInReminderEmail(booking: BookingLike) {
  return layoutEmail(
    'Your stay is coming up',
    `
      <p>Hi ${escapeHtml(booking.guest_name)},</p>
      <p>This is a friendly reminder for your upcoming stay at LeafWalk Resort.</p>
      ${bookingFactsTable(booking, 'Stay Total')}
      <p style="margin-top:20px">Check-in starts at 3:00 PM. Please carry a valid government ID for all guests.</p>
    `
  )
}

export function renderCheckInCompletedEmail(booking: BookingLike, wifi?: WifiEmailDetails) {
  const paymentStatus = String(booking.payment_status || 'pending').replace(/_/g, ' ').toUpperCase()
  const receiptLabel = booking.payment_status === 'fully_paid'
    ? (booking.gst_invoice_requested ? 'GST invoice' : 'booking receipt')
    : 'booking receipt'
  const wifiName = String(wifi?.ssid || 'Leafwalk Resort')
  const wifiPassword = String(wifi?.password || 'Password-123456')
  const wifiSecurity = String(wifi?.security || 'WPA')
  const wifiQrBlock = wifi?.qrCid ? `
        <div style="margin-top:18px;padding:18px;border:1px solid #e5e7eb;border-radius:16px;background:#faf7f1;text-align:center">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin-bottom:10px">Wi-Fi QR</div>
          <img src="cid:${escapeHtml(wifi.qrCid)}" alt="LeafWalk Wi-Fi QR" width="170" height="170" style="display:block;margin:0 auto 10px;width:170px;height:170px;object-fit:contain" />
          <div style="font-size:12px;color:#6b7280">Scan to connect instantly during your stay.</div>
        </div>
      ` : ''
  return layoutEmail(
    'Check-in completed successfully',
    `
      <p>Dear ${escapeHtml(booking.guest_name || 'Guest')},</p>
      <p>Greetings from LeafWalk Resort!</p>
      <p>We are delighted to welcome you. Your check-in has been successfully completed, and we hope you have a comfortable and pleasant stay with us.</p>

      <div style="margin-top:22px">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin-bottom:10px">Booking Details</div>
        <table style="width:100%;border-collapse:collapse">
          ${[
            ['Check-in Date', booking.check_in || '-'],
            ['Check-out Date', booking.check_out || '-'],
            ['Room Category', booking.room?.name || booking.room?.category || '-'],
            ['Number of Guests', String(booking.adults || 1)],
            ['Payment Status', paymentStatus],
          ].map(([label, value]) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:42%">${escapeHtml(label)}</td>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;font-weight:600">${escapeHtml(value)}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <div style="margin-top:22px">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin-bottom:10px">Payment Details</div>
        ${bookingFactsTable(booking, 'Stay Total')}
      </div>

      <div style="margin-top:22px">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin-bottom:10px">Hotel Information</div>
        <table style="width:100%;border-collapse:collapse">
          ${[
            ['Wi-Fi', `${wifiName} / ${wifiPassword}`],
            ['Wi-Fi Security', wifiSecurity],
            ['Restaurant Timings', 'Breakfast 8:00 AM - 10:00 AM | Kitchen till 10:00 PM'],
            ['Contact', '+91-8630227541'],
          ].map(([label, value]) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:42%">${escapeHtml(label)}</td>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;font-weight:600">${escapeHtml(value)}</td>
            </tr>
          `).join('')}
        </table>
        ${wifiQrBlock}
      </div>

      <p style="margin-top:20px">Your ${escapeHtml(receiptLabel)} is attached with this email whenever applicable for the current payment stage.</p>
      <p style="margin-top:20px">If you need any assistance during your stay, please feel free to contact our front desk anytime. We are here to make your experience memorable.</p>
      <p>Wishing you a relaxing and enjoyable stay!</p>
      <p style="margin-top:20px">
        Warm Regards,<br />
        Team LeafWalk Resort<br />
        +91-8630227541
      </p>
    `
  )
}
