import {
  createBookingReceiptPdf,
  renderBookingConfirmationEmail,
  renderAdminWebsiteBookingAlertEmail,
  renderCheckInCompletedEmail,
  renderCheckInReminderEmail,
  renderPaymentSuccessEmail,
  renderOtpEmail,
  type EmailProviderResult,
  sendTransactionalEmail,
} from '@/lib/email'
import { buildBookingReceiptHtml } from '@/lib/booking-receipt-generator'
import { renderHtmlToPdfBuffer } from '@/lib/html-pdf'
import { logError } from '@/lib/logger'
import { jsPDF } from 'jspdf'

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string; cid?: string; disposition?: 'attachment' | 'inline' }>,
  options?: {
    cc?: string | string[]
    fromEmail?: string
    fromName?: string
    emailType?: 'booking_confirmation' | 'payment_success' | 'otp_login' | 'checkin_reminder' | 'general'
  }
): Promise<boolean> {
  const result = await sendTransactionalEmail({
    to,
    subject,
    html,
    attachments,
    cc: options?.cc,
    fromEmail: options?.fromEmail,
    fromName: options?.fromName,
    emailType: options?.emailType,
  })
  return result.success
}

export async function sendEmailWithResult(
  to: string,
  subject: string,
  html: string,
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string; cid?: string; disposition?: 'attachment' | 'inline' }>,
  options?: {
    cc?: string | string[]
    fromEmail?: string
    fromName?: string
    emailType?: 'booking_confirmation' | 'payment_success' | 'otp_login' | 'checkin_reminder' | 'general'
  }
): Promise<EmailProviderResult> {
  return sendTransactionalEmail({
    to,
    subject,
    html,
    attachments,
    cc: options?.cc,
    fromEmail: options?.fromEmail,
    fromName: options?.fromName,
    emailType: options?.emailType,
  })
}

export function generateBookingConfirmationEmail(booking: any) {
  return renderBookingConfirmationEmail(booking)
}

export function generateBalanceReminderEmail(booking: any, daysLeft: number) {
  return renderCheckInReminderEmail({
    ...booking,
    nights: booking.nights || daysLeft,
  })
}

export function generateCheckInCompletedEmail(
  booking: any,
  wifi?: { ssid?: string | null; password?: string | null; security?: string | null; hidden?: boolean | null; qrCid?: string | null }
) {
  return renderCheckInCompletedEmail(booking, wifi)
}

export function generateTourOperatorBookingEmail(booking: any, operator: any) {
  return `
    <div style="margin:0;padding:32px;background:#f3f1eb;font-family:Arial,sans-serif">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e9dcc0">
        <div style="padding:28px 32px;background:#101010;color:#c9a14a">
          <div style="font-size:28px;font-weight:700;letter-spacing:0.04em">LeafWalk Resort</div>
          <div style="margin-top:6px;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#f0d691">Tour Operator Desk</div>
        </div>
        <div style="padding:32px;color:#1f2937;line-height:1.7">
          <h1 style="margin:0 0 18px;font-size:24px;color:#111827">Tour Operator Booking Update</h1>
          <p>Hi ${operator?.contact_person || operator?.company_name || 'Partner'},</p>
          <p>A booking has been recorded for your account. Key details are below:</p>
          <table style="width:100%;border-collapse:collapse;margin-top:18px">
            ${[
              ['Booking Ref', booking.booking_number || booking.id],
              ['Operator', operator?.company_name || '-'],
              ['Guest', booking.guest_name || '-'],
              ['Check-in', booking.check_in || '-'],
              ['Check-out', booking.check_out || '-'],
              ['Nights', String(booking.nights || 0)],
              ['Rooms', String(booking.rooms_booked || 1)],
              ['Adults', String(booking.adults || 1)],
              ['Meal Plan', booking.meal_plan || 'EP'],
              ['Status', booking.booking_status || '-'],
              ['Payment Status', booking.payment_status || '-'],
              ['Total', `INR ${Number(booking.total_amount || 0).toLocaleString('en-IN')}`],
              ['Balance Due', `INR ${Number(booking.balance_amount || 0).toLocaleString('en-IN')}`],
            ].map(([label, value]) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:42%">${label}</td>
                <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;font-weight:600">${value}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      </div>
    </div>
  `
}

export function generateOtpEmail(name: string, otp: string) {
  return renderOtpEmail(name, otp)
}

export { renderBookingConfirmationEmail, renderPaymentSuccessEmail, renderCheckInReminderEmail, renderCheckInCompletedEmail }
export { renderAdminWebsiteBookingAlertEmail }

function safeDocumentReference(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function generateReceiptAttachment(booking: any) {
  const isFullPaymentInvoice = booking?.payment_status === 'fully_paid'
  const reference = booking?.invoice_number || booking?.booking_number || booking?.id
  const safeReference = safeDocumentReference(String(reference || 'leafwalk-document'))
  const filename = isFullPaymentInvoice
    ? `leafwalk-gst-invoice-${safeReference}.pdf`
    : `leafwalk-receipt-${safeReference}.pdf`

  try {
    const html = buildBookingReceiptHtml(booking, { includePrintTools: false })
    return {
      filename,
      content: await renderHtmlToPdfBuffer(html),
      contentType: 'application/pdf',
    }
  } catch (error) {
    logError('HTML invoice PDF render failed; falling back to jsPDF attachment', {
      booking_id: booking?.id,
      booking_number: booking?.booking_number,
      invoice_number: booking?.invoice_number,
      error,
    })
  }

  return {
    filename,
    content: createBookingReceiptPdf(booking),
    contentType: 'application/pdf',
  }
}

export async function generateCheckInPassAttachment(booking: any) {
  const reference = booking?.booking_number || booking?.id
  const safeReference = safeDocumentReference(String(reference || 'leafwalk-check-in-pass'))
  const filename = `leafwalk-check-in-pass-${safeReference}.pdf`

  try {
    const html = buildBookingReceiptHtml(booking, {
      includePrintTools: false,
      documentMode: 'check_in_pass',
    })

    return {
      filename,
      content: await renderHtmlToPdfBuffer(html),
      contentType: 'application/pdf',
    }
  } catch (error) {
    logError('HTML check-in pass PDF render failed; falling back to jsPDF attachment', {
      booking_id: booking?.id,
      booking_number: booking?.booking_number,
      error,
    })
  }

  return {
    filename,
    content: createCheckInPassPdf(booking),
    contentType: 'application/pdf',
  }
}

function createCheckInPassPdf(booking: any) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const bookingRef = booking?.booking_number || String(booking?.id || '').slice(0, 8).toUpperCase()
  const bookingStatus = String(booking?.booking_status || '').toLowerCase()
  const paymentStatus = String(booking?.payment_status || 'pending').replace(/_/g, ' ').toUpperCase()
  const passStatus = bookingStatus === 'hold' ? 'HOLD' : paymentStatus
  const roomName = booking?.room?.name || booking?.room?.category || '-'
  const nights = Number(booking?.nights || 0)

  doc.setFillColor(250, 247, 241)
  doc.rect(0, 0, 210, 297, 'F')
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(10, 10, 190, 277, 4, 4, 'F')

  doc.setFillColor(15, 28, 15)
  doc.roundedRect(10, 10, 190, 38, 4, 4, 'F')
  doc.setTextColor(201, 161, 74)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(21)
  doc.text('LeafWalk Resort', 24, 25)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Stay in Lap of Nature | Uttarkashi, Uttarakhand', 24, 34)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.text('+91-9368080535 | info@leafwalk.in', 188, 25, { align: 'right' })
  doc.text('www.leafwalk.in', 188, 34, { align: 'right' })

  doc.setDrawColor(201, 161, 74)
  doc.setLineWidth(0.8)
  doc.line(10, 51, 200, 51)

  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(23)
  doc.text('Check In Pass', 20, 67)
  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  doc.text('Guest Arrival Copy', 20, 75)

  doc.setFillColor(240, 253, 244)
  doc.roundedRect(145, 59, 43, 13, 3, 3, 'F')
  doc.setTextColor(22, 101, 52)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(passStatus, 166.5, 67.5, { align: 'center' })

  doc.setFillColor(250, 247, 241)
  doc.roundedRect(20, 84, 168, 30, 4, 4, 'F')
  doc.setTextColor(107, 114, 128)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Guest Name', 28, 96)
  doc.text('Booking Ref', 118, 96)
  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(String(booking?.guest_name || '-'), 28, 106)
  doc.text(bookingRef, 118, 106)

  doc.setFillColor(255, 255, 255)
  doc.roundedRect(20, 124, 168, 36, 4, 4, 'S')
  doc.setTextColor(107, 114, 128)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('CHECK-IN', 30, 136)
  doc.text('NIGHTS', 99, 136, { align: 'center' })
  doc.text('CHECK-OUT', 146, 136)
  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(String(booking?.check_in || '-'), 30, 148)
  doc.text(String(nights || '-'), 99, 148, { align: 'center' })
  doc.text(String(booking?.check_out || '-'), 146, 148)

  const rows: Array<[string, string]> = [
    ['Room Type', roomName],
    ['Rooms', String(booking?.rooms_booked || 1)],
    ['Adults', String(booking?.adults || 1)],
    ['Meal Plan', booking?.meal_plan || '-'],
    ['Phone', booking?.guest_phone || '-'],
  ]

  let y = 176
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text('Room Details', 20, y)
  y += 8
  doc.setFontSize(10)
  for (const [label, value] of rows) {
    doc.setTextColor(107, 114, 128)
    doc.setFont('helvetica', 'normal')
    doc.text(label, 20, y)
    doc.setTextColor(17, 24, 39)
    doc.setFont('helvetica', 'bold')
    doc.text(String(value), 72, y)
    doc.setDrawColor(229, 231, 235)
    doc.line(20, y + 5, 190, y + 5)
    y += 13
  }

  y += 4
  doc.setFillColor(250, 247, 241)
  doc.roundedRect(20, y, 168, 42, 4, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.setFontSize(11)
  doc.text('Important Information', 28, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(75, 85, 99)
  doc.setFontSize(9)
  const notes = [
    'Check-in after 3:00 PM and check-out before 11:00 AM.',
    'Valid government ID is required at check-in.',
    'Breakfast served 8-10 AM. Kitchen closes at 10 PM.',
    'For assistance, contact LeafWalk Resort front desk.',
  ]
  y += 20
  for (const note of notes) {
    doc.text(`- ${note}`, 28, y)
    y += 7
  }

  doc.setFillColor(15, 28, 15)
  doc.roundedRect(10, 270, 190, 17, 4, 4, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.text('LeafWalk Resort | Vill- Banas, Narad Chatti, Yamunotri Road, Uttarkashi | +91-9368080535', 105, 280, { align: 'center' })

  return Buffer.from(doc.output('arraybuffer'))
}
