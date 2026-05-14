import { jsPDF } from 'jspdf'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getInvoicePartyMeta } from '@/lib/invoice-party'
import { calculateGST, calculateGSTFromSubtotal } from '@/lib/gst-bill-service'
import { formatDate } from '@/lib/utils'

type ReceiptBooking = {
  id: string
  booking_number?: string | null
  invoice_number?: string | null
  booking_source?: string | null
  guest_name?: string | null
  gst_invoice_requested?: boolean | null
  gst_company_name?: string | null
  gst_number?: string | null
  gst_state?: string | null
  guest_email?: string | null
  guest_phone?: string | null
  guest_phone_country?: string | null
  guest_address?: string | null
  guest_district?: string | null
  guest_state?: string | null
  guest_country?: string | null
  room?: { name?: string | null; category?: string | null } | null
  check_in: string
  check_out: string
  created_at?: string | null
  nights?: number | null
  rooms_booked?: number | null
  adults?: number | null
  children_5_to_12?: number | null
  children_below_5?: number | null
  extra_beds?: number | null
  meal_plan?: string | null
  total_amount?: number | null
  subtotal?: number | null
  cgst?: number | null
  sgst?: number | null
  gst_total?: number | null
  advance_amount?: number | null
  balance_amount?: number | null
  payment_method?: string | null
  payment_status?: string | null
  booking_status?: string | null
  confirmed_at?: string | null
  tour_operator?: {
    company_name?: string | null
    contact_person?: string | null
    email?: string | null
    phone?: string | null
    gst_number?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
  } | null
}

const COLORS = {
  forest: [15, 28, 15] as const,
  forest2: [26, 45, 26] as const,
  gold: [201, 161, 74] as const,
  goldSoft: [252, 250, 245] as const,
  ink: [17, 24, 39] as const,
  body: [55, 65, 81] as const,
  muted: [107, 114, 128] as const,
  faint: [249, 249, 247] as const,
  border: [229, 231, 235] as const,
  white: [255, 255, 255] as const,
  greenBg: [220, 252, 231] as const,
  greenInk: [22, 101, 52] as const,
  amberBg: [254, 243, 199] as const,
  amberInk: [146, 64, 14] as const,
  redBg: [254, 226, 226] as const,
  redInk: [153, 27, 27] as const,
  purpleBg: [243, 232, 255] as const,
  purpleInk: [107, 33, 168] as const,
}

const RESORT = {
  name: 'LeafWalk Resort',
  tagline: 'Stay in Lap of Nature',
  address: 'Vill- Banas, Narad Chatti, Hanuman Chatti',
  city: 'Yamunotri Road, Uttarkashi, Uttarakhand - 249193',
  phone: '+91-9368080535 | +91-8630227541',
  email: 'info@leafwalk.in',
  website: 'www.leafwalk.in',
  gstin: '05AADFL1234R1Z5',
  sacCode: '996311',
}

const LOGO_IMAGE = readFileSync(join(process.cwd(), 'public', 'logo', 'leafwalk-logo.jpeg'))

const MEAL_LABELS: Record<string, string> = {
  EP: 'Room Only (EP)',
  CP: 'With Breakfast (CP)',
  MAP: 'Breakfast + Dinner (MAP)',
  AP: 'All Meals (AP)',
}

function setFill(doc: jsPDF, color: readonly number[]) {
  doc.setFillColor(color[0], color[1], color[2])
}

function setDraw(doc: jsPDF, color: readonly number[]) {
  doc.setDrawColor(color[0], color[1], color[2])
}

function setText(doc: jsPDF, color: readonly number[]) {
  doc.setTextColor(color[0], color[1], color[2])
}

function money(value?: number | null) {
  return `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function shortDate(value?: string | null) {
  return value ? formatDate(value) : '-'
}

function clean(value?: string | null) {
  return String(value || '').trim() || '-'
}

function normalizeStatus(value?: string | null) {
  return String(value || 'pending').replace(/_/g, ' ').toUpperCase()
}

function badgeColors(status?: string | null) {
  const normalized = String(status || '').toLowerCase()
  if (['confirmed', 'checked_in', 'checked_out', 'fully_paid'].includes(normalized)) {
    return { bg: COLORS.greenBg, ink: COLORS.greenInk }
  }
  if (['cancelled', 'failed'].includes(normalized)) {
    return { bg: COLORS.redBg, ink: COLORS.redInk }
  }
  if (normalized === 'checked_out') {
    return { bg: COLORS.purpleBg, ink: COLORS.purpleInk }
  }
  return { bg: COLORS.amberBg, ink: COLORS.amberInk }
}

function addLogo(doc: jsPDF, x: number, y: number, size: number) {
  const radius = size / 2
  setFill(doc, COLORS.white)
  setDraw(doc, COLORS.gold)
  doc.circle(x + radius, y + radius, radius, 'FD')
  const innerSize = size - 11
  doc.addImage(
    Uint8Array.from(LOGO_IMAGE),
    'JPEG',
    x + (size - innerSize) / 2,
    y + (size - innerSize) / 2,
    innerSize,
    innerSize
  )
}

function drawGoldLine(doc: jsPDF, y: number) {
  setFill(doc, COLORS.gold)
  doc.rect(0, y, 210, 1.5, 'F')
}

function drawBadge(doc: jsPDF, x: number, y: number, label: string, status?: string | null) {
  const colors = badgeColors(status)
  const width = Math.max(26, doc.getTextWidth(label) + 8)
  setFill(doc, colors.bg)
  setDraw(doc, colors.bg)
  doc.roundedRect(x, y, width, 7.5, 3.75, 3.75, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  setText(doc, colors.ink)
  doc.text(label, x + width / 2, y + 5.1, { align: 'center' })
  return width
}

function sectionLabel(doc: jsPDF, label: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  setText(doc, COLORS.muted)
  doc.text(label.toUpperCase(), x, y)
}

function labelValue(doc: jsPDF, label: string, value: string, x: number, y: number, width: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  setText(doc, COLORS.muted)
  doc.text(label.toUpperCase(), x, y)
  doc.setFont('times', 'normal')
  doc.setFontSize(10.4)
  setText(doc, COLORS.ink)
  const lines = doc.splitTextToSize(value || '-', width)
  doc.text(lines, x, y + 5)
}

function tableRow(doc: jsPDF, label: string, value: string, x: number, y: number, width: number, emphasize = false) {
  doc.setFont('helvetica', emphasize ? 'bold' : 'normal')
  doc.setFontSize(9.4)
  setText(doc, emphasize ? COLORS.ink : COLORS.body)
  doc.text(label, x, y)
  doc.setFont('helvetica', 'bold')
  setText(doc, emphasize ? COLORS.gold : COLORS.ink)
  doc.text(value, x + width, y, { align: 'right' })
}

export function createStyledBookingReceiptPdf(
  booking: ReceiptBooking,
  options: { documentMode?: 'receipt' | 'invoice' } = {}
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const bookingRef = booking.booking_number || booking.id.slice(0, 8).toUpperCase()
  const invoiceRef = booking.invoice_number || `INV-${bookingRef}`
  const isFullyPaid = String(booking.payment_status || '').toLowerCase() === 'fully_paid'
  const isInvoiceDocument = options.documentMode === 'invoice' || (options.documentMode !== 'receipt' && isFullyPaid)
  const docTitle = isInvoiceDocument ? 'GST Tax Invoice' : 'Booking Receipt'
  const issueDate = shortDate(booking.created_at || new Date().toISOString())
  const checkIn = shortDate(booking.check_in)
  const checkOut = shortDate(booking.check_out)
  const nights = Number(booking.nights || 0)
  const rooms = Number(booking.rooms_booked || 1)
  const adults = Number(booking.adults || 1)
  const mealLabel = MEAL_LABELS[String(booking.meal_plan || '').toUpperCase()] || clean(booking.meal_plan)
  const total = Number(booking.total_amount || 0)
  const storedSubtotal = Number(booking.subtotal || 0)
  const gstMath = total > 0
    ? calculateGST(total)
    : calculateGSTFromSubtotal(storedSubtotal)
  const taxable = gstMath.subtotal
  const cgst = gstMath.cgst
  const sgst = gstMath.sgst
  const advance = Number(booking.advance_amount || 0)
  const balance = isFullyPaid ? 0 : Number(booking.balance_amount || 0)
  const source = String(booking.booking_source || 'direct').replace(/_/g, ' ').toUpperCase()
  const paymentMode = String(booking.payment_method || (isFullyPaid ? 'razorpay' : '-')).replace(/_/g, ' ').toUpperCase()
  const roomName = booking.room?.name || booking.room?.category || 'Room'
  const phone = `${booking.guest_phone_country || ''}${booking.guest_phone || ''}`.trim()
  const invoiceParty = getInvoicePartyMeta(booking)

  setFill(doc, COLORS.forest)
  doc.rect(0, 0, 210, 40, 'F')
  setFill(doc, COLORS.forest2)
  doc.circle(178, 8, 28, 'F')
  doc.circle(196, 18, 18, 'F')
  addLogo(doc, 16, 7.5, 23)
  doc.setFont('times', 'bold')
  doc.setFontSize(24)
  setText(doc, COLORS.gold)
  doc.text(RESORT.name, 44, 17.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.8)
  setText(doc, [156, 163, 175])
  doc.text(RESORT.tagline.toUpperCase(), 44, 23)
  doc.setFontSize(7.5)
  doc.text('Yamunotri Road, Uttarkashi, Uttarakhand', 44, 28.2)
  doc.text(RESORT.phone, 192, 11.5, { align: 'right' })
  doc.text(RESORT.email, 192, 16.8, { align: 'right' })
  doc.text(RESORT.website, 192, 22.1, { align: 'right' })
  doc.text(`GSTIN: ${RESORT.gstin}`, 192, 27.4, { align: 'right' })
  drawGoldLine(doc, 40)

  setFill(doc, COLORS.faint)
  setDraw(doc, COLORS.border)
  doc.rect(0, 41.5, 210, 23, 'FD')
  doc.setFont('times', 'bold')
  doc.setFontSize(20)
  setText(doc, COLORS.ink)
  doc.text(docTitle, 16, 52)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  setText(doc, COLORS.muted)
  if (isInvoiceDocument) {
    doc.text('Invoice No:', 128, 49)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.8)
    setText(doc, COLORS.ink)
    doc.text(invoiceRef, 192, 49, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    setText(doc, COLORS.muted)
    doc.text('Booking Ref:', 128, 54.5)
    doc.setFont('helvetica', 'bold')
    setText(doc, COLORS.ink)
    doc.text(bookingRef, 192, 54.5, { align: 'right' })
  } else {
    doc.text('Booking Ref:', 128, 50)
    doc.setFont('helvetica', 'bold')
    setText(doc, COLORS.ink)
    doc.text(bookingRef, 192, 50, { align: 'right' })
  }
  doc.setFont('helvetica', 'normal')
  setText(doc, COLORS.muted)
  doc.text('Issued:', 128, 60)
  doc.setFont('helvetica', 'bold')
  setText(doc, COLORS.ink)
  doc.text(issueDate, 192, 60, { align: 'right' })

  let badgeX = 16
  badgeX += drawBadge(doc, badgeX, 70, normalizeStatus(booking.booking_status), booking.booking_status) + 5
  badgeX += drawBadge(doc, badgeX, 70, normalizeStatus(booking.payment_status), booking.payment_status) + 5
  drawBadge(doc, badgeX, 70, `${nights} NIGHT STAY`, 'hold')

  setDraw(doc, COLORS.border)
  doc.roundedRect(16, 83, 82, 38, 3, 3)
  doc.roundedRect(106, 83, 88, 38, 3, 3)
  labelValue(doc, isInvoiceDocument ? 'Bill To' : 'Guest Name', clean(invoiceParty.name), 21, 92, 68)
  labelValue(
    doc,
    isInvoiceDocument ? 'Email / GSTIN' : 'Email',
    clean(isInvoiceDocument ? [invoiceParty.email, invoiceParty.gstNumber ? `GSTIN: ${invoiceParty.gstNumber}` : null].filter(Boolean).join(' | ') : booking.guest_email),
    21,
    104,
    68
  )
  labelValue(
    doc,
    isInvoiceDocument ? 'Phone / State' : 'Phone',
    clean(isInvoiceDocument ? [invoiceParty.phone, invoiceParty.gstState ? `${invoiceParty.gstState}${invoiceParty.stateCode ? ` (${invoiceParty.stateCode})` : ''}` : null].filter(Boolean).join(' | ') : phone),
    21,
    116,
    68
  )
  labelValue(doc, 'Check-in', checkIn, 112, 92, 66)
  labelValue(doc, 'Check-out', checkOut, 112, 104, 66)
  labelValue(doc, 'Stay', `${nights} nights | ${rooms} room(s)`, 112, 116, 66)

  setFill(doc, COLORS.goldSoft)
  setDraw(doc, COLORS.border)
  doc.roundedRect(16, 129, 178, 24, 3, 3, 'FD')
  doc.line(72, 129, 72, 153)
  doc.line(121, 129, 121, 153)
  doc.line(157, 129, 157, 153)
  labelValue(doc, 'Room Type', clean(roomName), 21, 138, 43)
  labelValue(doc, 'Meal Plan', mealLabel, 77, 138, 35)
  labelValue(doc, 'Guests', `${adults} adult(s)`, 126, 138, 24)
  labelValue(doc, 'Source', source, 162, 138, 24)

  sectionLabel(doc, 'Room Details', 16, 161)
  setDraw(doc, COLORS.border)
  doc.roundedRect(16, 165, 178, 31, 3, 3)
  setFill(doc, COLORS.faint)
  doc.roundedRect(16, 165, 178, 9, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  setText(doc, COLORS.muted)
  doc.text('DESCRIPTION', 21, 171)
  if (isInvoiceDocument) {
    doc.text('SAC', 142, 171, { align: 'right' })
  }
  doc.text('AMOUNT', 188, 171, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.2)
  setText(doc, COLORS.ink)
  doc.text(clean(roomName), 21, 181)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  setText(doc, COLORS.muted)
  doc.text(`${rooms} room x ${nights} nights | ${mealLabel} | ${adults} adult(s)`, 21, 187)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.2)
  setText(doc, COLORS.ink)
  if (isInvoiceDocument) {
    doc.text(RESORT.sacCode, 142, 184, { align: 'right' })
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.2)
  setText(doc, COLORS.ink)
  doc.text(money(total), 188, 184, { align: 'right' })

  sectionLabel(doc, isInvoiceDocument ? 'GST Invoice Summary' : 'Payment Summary', 16, 207)
  setDraw(doc, COLORS.border)
  doc.roundedRect(16, 211, 86, 50, 3, 3)
  let y = 222
  if (isInvoiceDocument) {
    tableRow(doc, 'Taxable Amount', money(taxable), 22, y, 72)
    y += 8
    tableRow(doc, 'CGST @ 2.5%', money(cgst), 22, y, 72)
    y += 8
    tableRow(doc, 'SGST @ 2.5%', money(sgst), 22, y, 72)
    y += 8
  } else {
    tableRow(doc, 'Booking Total', money(total), 22, y, 72)
    y += 8
    tableRow(doc, 'Amount Paid', money(advance), 22, y, 72)
    y += 8
    tableRow(doc, 'Balance Due', money(balance), 22, y, 72)
    y += 8
  }
  setFill(doc, COLORS.forest)
  doc.roundedRect(20, 241, 78, 10, 2, 2, 'F')
  doc.setFont('times', 'bold')
  doc.setFontSize(13)
  setText(doc, COLORS.gold)
  doc.text(money(total), 59, 247.6, { align: 'center' })

  sectionLabel(doc, 'Booking Info', 111, 207)
  setDraw(doc, COLORS.border)
  doc.roundedRect(111, 211, 83, 50, 3, 3)
  let infoY = 222
  if (isInvoiceDocument) {
    tableRow(doc, 'Invoice No.', invoiceRef, 117, infoY, 70)
    infoY += 8
  }
  tableRow(doc, 'Booking No.', bookingRef, 117, infoY, 70)
  infoY += 8
  tableRow(doc, 'Payment Mode', paymentMode, 117, infoY, 70)
  infoY += 8
  tableRow(doc, 'Rooms', String(rooms), 117, infoY, 70)
  infoY += 8
  tableRow(doc, 'Adults', String(adults), 117, infoY, 70)

  setFill(doc, COLORS.faint)
  setDraw(doc, COLORS.border)
  doc.roundedRect(16, 263, 178, 22, 3, 3, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  setText(doc, COLORS.muted)
  doc.text('IMPORTANT INFORMATION', 21, 270)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.3)
  setText(doc, COLORS.body)
  doc.text('- Check-in after 3:00 PM | Check-out before 11:00 AM', 21, 276)
  doc.text('- Valid government ID required at check-in', 21, 281)
  doc.text('- Breakfast 8-10 AM | Kitchen closes at 10 PM', 107, 276)
  doc.text('- Cancellation charges as per reservation policy', 107, 281)
  doc.text('- Front desk support: +91-8630227541', 21, 286)
  doc.text('- Outside food/alcohol as per resort policy', 107, 286)

  setFill(doc, COLORS.faint)
  doc.rect(0, 287, 210, 10, 'F')
  drawGoldLine(doc, 286)
  doc.setFont('times', 'bold')
  doc.setFontSize(11)
  setText(doc, COLORS.gold)
  doc.text(RESORT.name, 16, 293)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.6)
  setText(doc, COLORS.muted)
  doc.text(`${RESORT.address}, ${RESORT.city}`, 48, 292)
  doc.text(`${RESORT.email} | ${RESORT.website}`, 194, 292, { align: 'right' })

  return Buffer.from(doc.output('arraybuffer'))
}
