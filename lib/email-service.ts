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
import { readFileSync } from 'fs'
import { jsPDF } from 'jspdf'
import { join } from 'path'

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
  const formatPassDate = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value || '-'
    const day = String(date.getDate()).padStart(2, '0')
    const month = date.toLocaleString('en-GB', { month: 'short' })
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }
  const mealLabels: Record<string, string> = {
    EP: 'Room Only (EP)',
    CP: 'With Breakfast (CP)',
    MAP: 'Breakfast + Dinner (MAP)',
    AP: 'All Meals (AP)',
  }
  const fitText = (text: string, maxLength = 44) => {
    const value = String(text || '-').trim()
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const bookingRef = booking?.booking_number || String(booking?.id || '').slice(0, 8).toUpperCase()
  const bookingStatus = String(booking?.booking_status || '').toLowerCase()
  const paymentStatus = String(booking?.payment_status || 'pending').replace(/_/g, ' ').toUpperCase()
  const passStatus = bookingStatus === 'hold' ? 'HOLD' : paymentStatus
  const roomName = booking?.room?.name || booking?.room?.category || '-'
  const nights = Number(booking?.nights || 0)
  const checkInDate = formatPassDate(String(booking?.check_in || ''))
  const checkOutDate = formatPassDate(String(booking?.check_out || ''))
  const mealPlan = mealLabels[String(booking?.meal_plan || '')] || booking?.meal_plan || '-'
  const guestName = fitText(booking?.guest_name || '-')
  const guestEmail = fitText(booking?.guest_email || '-')
  const guestPhone = fitText(booking?.guest_phone || '-')
  const children = Number(booking?.children_5_to_12 || 0)
  const extraBeds = Number(booking?.extra_beds || 0)
  const issuedOn = formatPassDate(String(booking?.updated_at || booking?.created_at || new Date().toISOString()))
  const bookingSource = String(booking?.booking_source || '-').replace(/_/g, ' ').toUpperCase()
  const resortContact = '+91-8630227541'
  const resortLogoDataUrl = `data:image/jpeg;base64,${readFileSync(join(process.cwd(), 'public', 'logo', 'leafwalk-logo.jpeg')).toString('base64')}`
  const drawBadge = (x: number, y: number, text: string, fill: [number, number, number], color: [number, number, number], width: number) => {
    doc.setFillColor(...fill)
    doc.roundedRect(x, y, width, 8, 4, 4, 'F')
    doc.setTextColor(...color)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(text, x + width / 2, y + 5.2, { align: 'center' })
  }
  const drawKeyValueBlock = (
    x: number,
    y: number,
    width: number,
    title: string,
    rows: Array<[string, string]>,
    rowGap = 7
  ) => {
    const height = 12 + rows.length * rowGap + 8
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(229, 231, 235)
    doc.roundedRect(x, y, width, height, 4, 4, 'FD')
    doc.setTextColor(107, 114, 128)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(title.toUpperCase(), x + 4, y + 7)
    let rowY = y + 14
    for (const [label, value] of rows) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(107, 114, 128)
      doc.text(label, x + 4, rowY)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(17, 24, 39)
      doc.text(fitText(value, 28), x + width - 4, rowY, { align: 'right' })
      rowY += rowGap
    }
    return height
  }

  doc.setFillColor(250, 247, 241)
  doc.rect(0, 0, 210, 297, 'F')
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(10, 10, 190, 277, 4, 4, 'F')

  doc.setFillColor(15, 28, 15)
  doc.roundedRect(10, 10, 190, 28, 4, 4, 'F')
  doc.setFillColor(255, 255, 255)
  doc.circle(20, 24, 6.8, 'F')
  doc.addImage(resortLogoDataUrl, 'JPEG', 15.8, 19.8, 8.4, 8.4)
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(1.1)
  doc.circle(20, 24, 6.8, 'S')
  doc.setTextColor(201, 161, 74)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.text('LeafWalk Resort', 33, 23)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('STAY IN LAP OF NATURE · UTTARKASHI, UTTARAKHAND', 33, 31)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7.5)
  doc.text(resortContact, 192, 19, { align: 'right' })
  doc.text('info@leafwalk.in', 192, 25, { align: 'right' })
  doc.text('www.leafwalk.in', 192, 31, { align: 'right' })

  doc.setDrawColor(201, 161, 74)
  doc.setLineWidth(0.8)
  doc.line(10, 40, 200, 40)

  doc.setTextColor(17, 24, 39)
  doc.setFont('times', 'normal')
  doc.setFontSize(18)
  doc.text('Check In Pass', 18, 52)
  doc.setTextColor(107, 114, 128)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('Booking Ref', 122, 46)
  doc.text('Issued', 122, 52)
  doc.text('Source', 122, 58)
  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.text(bookingRef, 192, 46, { align: 'right' })
  doc.text(issuedOn, 192, 52, { align: 'right' })
  doc.text(bookingSource, 192, 58, { align: 'right' })

  doc.setDrawColor(229, 231, 235)
  doc.line(10, 62, 200, 62)
  doc.line(10, 74, 200, 74)
  drawBadge(18, 66, bookingStatus === 'confirmed' ? 'CONFIRMED' : bookingStatus.toUpperCase(), [220, 252, 231], [22, 101, 52], 22)
  drawBadge(42, 66, passStatus === 'FULLY PAID' ? 'Fully Paid' : 'Advance Paid', [254, 243, 199], [146, 64, 14], 26)

  doc.setTextColor(17, 24, 39)
  doc.setFont('times', 'normal')
  doc.setFontSize(16)
  doc.text(guestName, 18, 92)
  doc.setTextColor(107, 114, 128)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(guestPhone, 22, 99)
  doc.text(guestEmail, 22, 106)

  doc.setDrawColor(229, 231, 235)
  doc.roundedRect(122, 84, 70, 18, 4, 4, 'S')
  doc.line(143, 84, 143, 102)
  doc.line(171, 84, 171, 102)
  doc.setTextColor(156, 163, 175)
  doc.setFontSize(7.5)
  doc.text('CHECK-IN', 132.5, 89, { align: 'center' })
  doc.text('CHECK-OUT', 181.5, 89, { align: 'center' })
  doc.setFillColor(15, 28, 15)
  doc.rect(143, 84, 28, 18, 'F')
  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text(checkInDate, 132.5, 94.5, { align: 'center' })
  doc.text(checkOutDate, 181.5, 94.5, { align: 'center' })
  doc.setTextColor(201, 161, 74)
  doc.setFontSize(16)
  doc.text(String(nights || '-'), 157, 92.5, { align: 'center' })
  doc.setFontSize(7)
  doc.text('NIGHTS', 157, 98, { align: 'center' })
  doc.setTextColor(107, 114, 128)
  doc.text('After 3:00 PM', 132.5, 98.5, { align: 'center' })
  doc.text('Before 11:00 AM', 181.5, 98.5, { align: 'center' })

  doc.setTextColor(156, 163, 175)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('ROOM DETAILS', 18, 118)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(18, 121, 174, 20, 4, 4, 'S')
  doc.text('DESCRIPTION', 184, 128, { align: 'right' })
  doc.line(18, 129.5, 192, 129.5)
  doc.setTextColor(17, 24, 39)
  doc.setFontSize(10.5)
  doc.text(fitText(roomName, 42), 22, 136.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(107, 114, 128)
  const roomSummary = `${booking?.rooms_booked || 1} room × ${nights} nights · ${fitText(mealPlan, 24)} · ${booking?.adults || 1} Adults${children > 0 ? ` · ${children} Child` : ''}${extraBeds > 0 ? ` · ${extraBeds} Extra Bed` : ''}`
  doc.text(doc.splitTextToSize(roomSummary, 164), 22, 140)

  let y = 146
  doc.setFillColor(255, 253, 248)
  doc.setDrawColor(232, 220, 194)
  doc.roundedRect(18, y, 174, 18, 4, 4, 'FD')
  doc.setTextColor(17, 24, 39)
  doc.setFont('times', 'normal')
  doc.setFontSize(15)
  doc.text('Welcome to LeafWalk Resort', 22, y + 7.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(75, 85, 99)
  doc.text('Please share this pass at the front desk during arrival. We are ready to welcome you for a smooth check-in experience.', 22, y + 13)

  const leftRows: Array<[string, string]> = [
    ['Present At Front Desk', bookingRef],
    ['Check-in Time', 'After 3:00 PM'],
    ['Check-out Time', 'Before 11:00 AM'],
    ['ID Requirement', 'Valid government ID required'],
    ['Front Desk', '+91-8630227541'],
    ['Breakfast', '8:00 AM - 10:00 AM'],
    ['Kitchen Closes', '10:00 PM'],
    ['Resort Contact', resortContact],
  ]
  const rightRows: Array<[string, string]> = [
    ['Booking No.', bookingRef],
    ['Issued On', issuedOn],
    ['Source', bookingSource],
    ['Rooms', String(booking?.rooms_booked || 1)],
    ['Adults', String(booking?.adults || 1)],
  ]
  const leftHeight = drawKeyValueBlock(18, 168, 92, 'Arrival Instructions', leftRows, 5.8)
  const rightHeight = drawKeyValueBlock(114, 168, 78, 'Booking Info', rightRows, 5.8)
  y = 168 + Math.max(leftHeight, rightHeight) + 4

  doc.setFillColor(249, 249, 247)
  doc.roundedRect(18, y, 174, 22, 4, 4, 'FD')
  doc.setTextColor(107, 114, 128)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('IMPORTANT INFORMATION', 22, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  const leftNotes = [
    'Check-in after 3:00 PM · Check-out before 11:00 AM',
    'Breakfast 8:00 AM - 10:00 AM · Kitchen closes 10:00 PM',
    'Cancellation charges as per reservation policy',
    `Front desk support · ${resortContact}`,
  ]
  const rightNotes = [
    'Valid government ID required at check-in',
    'Dinner orders are served as per kitchen timings',
    'No pets allowed in resort premises',
    'Keep this pass ready at arrival',
  ]
  let noteY = y + 13
  for (let i = 0; i < Math.max(leftNotes.length, rightNotes.length); i += 1) {
    doc.setTextColor(201, 161, 74)
    if (leftNotes[i]) {
      doc.text('·', 22, noteY)
      doc.setTextColor(107, 114, 128)
      doc.text(leftNotes[i], 25, noteY)
    }
    if (rightNotes[i]) {
      doc.setTextColor(201, 161, 74)
      doc.text('·', 110, noteY)
      doc.setTextColor(107, 114, 128)
      doc.text(rightNotes[i], 113, noteY)
    }
    noteY += 4.1
  }

  doc.line(18, 283.5, 192, 283.5)
  doc.setTextColor(201, 161, 74)
  doc.setFont('times', 'normal')
  doc.setFontSize(9.5)
  doc.text('LeafWalk Resort', 18, 286.8)
  doc.setTextColor(156, 163, 175)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.2)
  doc.text('Vill- Banas, Narad Chatti, Hanuman Chatti', 18, 289.8)
  doc.text('Yamunotri Road, Uttarkashi, Uttarakhand - 249193', 18, 292.8)
  doc.text(resortContact, 192, 286.8, { align: 'right' })
  doc.text('info@leafwalk.in · www.leafwalk.in', 192, 289.8, { align: 'right' })
  doc.text('This is a computer generated check-in pass', 192, 292.8, { align: 'right' })

  return Buffer.from(doc.output('arraybuffer'))
}
