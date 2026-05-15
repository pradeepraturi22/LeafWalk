import { jsPDF } from 'jspdf'
import { readFileSync } from 'fs'
import { join } from 'path'
import { COMPANY_DETAILS } from '@/lib/constants'
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
  rate_per_room_per_night?: number | null
  extra_bed_rate_per_night?: number | null
  child_rate_per_night?: number | null
  total_amount?: number | null
  subtotal?: number | null
  cgst?: number | null
  sgst?: number | null
  gst_total?: number | null
  discount_amount?: number | null
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

function fmt(value?: number | null) {
  return Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

function isUttarakhandState(value?: string | null) {
  return String(value || '').trim().toLowerCase().includes('uttarakhand')
}

function isBillToIntraState(
  billTo: { stateCode?: string | null; gstState?: string | null },
  sellerStateCode: string
) {
  const buyerStateCode = String(billTo.stateCode || '').trim()
  if (buyerStateCode) return buyerStateCode === sellerStateCode
  if (billTo.gstState) return isUttarakhandState(billTo.gstState)
  return true
}

function buildInvoiceItems(booking: ReceiptBooking, taxable: number) {
  const nights = Math.max(1, Number(booking.nights || 0))
  const rooms = Math.max(1, Number(booking.rooms_booked || 1))
  const mealLabel = MEAL_LABELS[String(booking.meal_plan || '').toUpperCase()] || clean(booking.meal_plan)
  const roomName = booking.room?.name || booking.room?.category || 'Room'
  const items: Array<{ desc: string; sac: string; amount: number; qty: number; nights: number }> = []

  const roomRate = Number(booking.rate_per_room_per_night || 0)
  if (roomRate > 0) {
    items.push({
      desc: `${roomName} - ${mealLabel}`,
      sac: COMPANY_DETAILS.sacCode || RESORT.sacCode,
      amount: Math.round(roomRate * rooms * nights * 100) / 100,
      qty: rooms,
      nights,
    })
  }

  const extraBedRate = Number(booking.extra_bed_rate_per_night || 0)
  const extraBeds = Number(booking.extra_beds || 0)
  if (extraBeds > 0 && extraBedRate > 0) {
    items.push({
      desc: `Extra Bed - ${mealLabel}`,
      sac: COMPANY_DETAILS.sacCode || RESORT.sacCode,
      amount: Math.round(extraBedRate * extraBeds * nights * 100) / 100,
      qty: extraBeds,
      nights,
    })
  }

  const childRate = Number(booking.child_rate_per_night || 0)
  const children = Number(booking.children_5_to_12 || 0)
  if (children > 0 && childRate > 0) {
    items.push({
      desc: `Child (6-12 yrs) - ${mealLabel}`,
      sac: COMPANY_DETAILS.sacCode || RESORT.sacCode,
      amount: Math.round(childRate * children * nights * 100) / 100,
      qty: children,
      nights,
    })
  }

  if (items.length === 0 && taxable > 0) {
    items.push({
      desc: `${roomName} - ${mealLabel}`,
      sac: COMPANY_DETAILS.sacCode || RESORT.sacCode,
      amount: taxable,
      qty: rooms,
      nights,
    })
  }

  return items
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

function createStructuredInvoicePdf(doc: jsPDF, booking: ReceiptBooking, invoiceRef: string, issueDate: string) {
  const invoiceParty = getInvoicePartyMeta(booking)
  const total = Number(booking.total_amount || 0)
  const storedSubtotal = Number(booking.subtotal || 0)
  const gstMath = total > 0 ? calculateGST(total) : calculateGSTFromSubtotal(storedSubtotal)
  const taxable = gstMath.subtotal
  const cgst = gstMath.cgst
  const sgst = gstMath.sgst
  const gstTotal = cgst + sgst
  const nights = Number(booking.nights || 0)
  const rooms = Number(booking.rooms_booked || 1)
  const mealLabel = MEAL_LABELS[String(booking.meal_plan || '').toUpperCase()] || clean(booking.meal_plan)
  const roomName = booking.room?.name || booking.room?.category || 'Accommodation'
  const bookingRef = booking.booking_number || booking.id.slice(0, 8).toUpperCase()
  const buyerStateCode = invoiceParty.stateCode || ''
  const sellerStateCode = String(COMPANY_DETAILS.gstin || '').slice(0, 2) || '05'
  const isIntraState = isBillToIntraState(invoiceParty, sellerStateCode)
  const taxRateLabel = isIntraState ? 'CGST 2.5% + SGST 2.5%' : 'IGST 5%'
  const amountWords = `${clean(total ? `${Number(total).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : '0.00')} INR`
  const bankLines = [
    COMPANY_DETAILS.bankAccountName ? `A/c Name: ${COMPANY_DETAILS.bankAccountName}` : '',
    COMPANY_DETAILS.bankName ? `Bank Name: ${COMPANY_DETAILS.bankName}` : '',
    COMPANY_DETAILS.accountNumber ? `A/c No.: ${COMPANY_DETAILS.accountNumber}` : '',
    COMPANY_DETAILS.ifsc ? `IFSC Code: ${COMPANY_DETAILS.ifsc}` : '',
    COMPANY_DETAILS.branch ? `Branch: ${COMPANY_DETAILS.branch}` : '',
  ].filter(Boolean)

  const leftX = 10
  const pageW = 190
  const rightColW = 72
  const leftColW = pageW - rightColW

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  setText(doc, COLORS.ink)
  doc.text('Tax Invoice', 105, 10, { align: 'center' })

  setDraw(doc, [0, 0, 0])
  doc.rect(leftX, 14, leftColW, 48)
  doc.rect(leftX + leftColW, 14, rightColW, 48)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text((COMPANY_DETAILS.name || RESORT.name).toUpperCase(), 12, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const sellerLines = [
    COMPANY_DETAILS.address || RESORT.address,
    `${COMPANY_DETAILS.city || RESORT.city}, ${COMPANY_DETAILS.state || ''}${COMPANY_DETAILS.pincode ? ` - ${COMPANY_DETAILS.pincode}` : ''}`.trim(),
    COMPANY_DETAILS.phone ? `M.NO.- ${COMPANY_DETAILS.phone}` : '',
    COMPANY_DETAILS.gstin ? `GSTIN/UIN : ${COMPANY_DETAILS.gstin}` : '',
    `State Name : ${COMPANY_DETAILS.state || '-'}${sellerStateCode ? `, Code : ${sellerStateCode}` : ''}`,
    COMPANY_DETAILS.email ? `E-Mail : ${COMPANY_DETAILS.email}` : '',
  ].filter(Boolean)
  doc.text(sellerLines, 12, 25)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('Buyer (Bill to)', 12, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const buyerLines = [
    invoiceParty.name,
    invoiceParty.address || '',
    invoiceParty.phone ? `M.NO.- ${invoiceParty.phone}` : '',
    invoiceParty.email ? `E-Mail : ${invoiceParty.email}` : '',
    invoiceParty.gstNumber ? `GSTIN/UIN : ${invoiceParty.gstNumber}` : '',
    `State Name : ${invoiceParty.gstState || '-'}${buyerStateCode ? `, Code : ${buyerStateCode}` : ''}`,
  ].filter(Boolean)
  doc.text(buyerLines, 12, 49)

  const rightX = leftX + leftColW
  const rowH = 6
  const rightRows: Array<[string, string]> = [
    ['Invoice No.', invoiceRef],
    ['Dated', issueDate],
    ['Delivery Note', clean(String(booking.payment_method || '').replace(/_/g, ' ').toUpperCase())],
    ['Reference No. & Date.', bookingRef],
    ["Buyer's Order No.", bookingRef],
    ['Dispatch Doc No.', ''],
    ['Dispatched through', ''],
    ['Destination', invoiceParty.gstState || ''],
  ]
  rightRows.forEach(([label, value], index) => {
    const y = 14 + index * rowH
    if (index > 0) doc.line(rightX, y, rightX + rightColW, y)
    doc.line(rightX + 34, y, rightX + 34, y + rowH)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(label, rightX + 2, y + 4)
    doc.setFont('helvetica', 'bold')
    doc.text(value || '', rightX + 36, y + 4)
  })

  let tableY = 66
  const cols = [8, 80, 22, 18, 20, 14, 14, 22]
  const colX = [10]
  for (let i = 0; i < cols.length - 1; i += 1) colX.push(colX[i] + cols[i])
  const headerH = 8
  doc.rect(10, tableY, 198, headerH)
  colX.slice(1).forEach((x) => doc.line(x, tableY, x, tableY + 170))
  const headers = ['Sl', 'Description of Goods / Services', 'HSN/SAC', 'Qty', 'Rate', 'Per', 'Disc.%', 'Amount']
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  headers.forEach((header, idx) => {
    const x = colX[idx] + 1.5
    doc.text(header, x, tableY + 5)
  })

  const itemTop = tableY + headerH
  const rowHeight = 10
  const itemRows = [
    {
      desc: `${roomName} - ${mealLabel}`,
      sac: COMPANY_DETAILS.sacCode || RESORT.sacCode,
      qty: rooms * Math.max(nights, 1),
      rate: taxable,
      per: 'Stay',
      discount: '0',
      amount: taxable,
    },
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  itemRows.forEach((item, index) => {
    const y = itemTop + index * rowHeight
    doc.line(10, y, 208, y)
    const values = [
      String(index + 1),
      item.desc,
      item.sac,
      String(item.qty),
      fmt(item.rate),
      item.per,
      item.discount,
      fmt(item.amount),
    ]
    values.forEach((value, idx) => {
      const x = colX[idx] + 1.5
      const align = idx >= 2 && idx !== 5 ? 'right' : idx === 5 ? 'center' : 'left'
      const renderX = align === 'right' ? colX[idx] + cols[idx] - 1.5 : align === 'center' ? colX[idx] + cols[idx] / 2 : x
      doc.text(value, renderX, y + 6, { align: align as any })
    })
  })

  const totalsBaseY = itemTop + 150
  doc.line(10, totalsBaseY, 208, totalsBaseY)
  doc.setFont('helvetica', 'bold')
  doc.text('Total', 156, totalsBaseY + 6)
  doc.text(`₹ ${fmt(taxable)}`, 206, totalsBaseY + 6, { align: 'right' })

  const wordsY = totalsBaseY + 10
  doc.rect(10, wordsY, 120, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Amount Chargeable (in words)', 12, wordsY + 4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(`INR ${amountWords} Only`, 12, wordsY + 9)

  doc.rect(130, wordsY, 78, 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('Taxable Value', 132, wordsY + 4)
  doc.text('Rate', 162, wordsY + 4)
  doc.text('GST Amount', 176, wordsY + 4)
  doc.text('Total Tax Amount', 196, wordsY + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(fmt(taxable), 132, wordsY + 11)
  doc.text(isIntraState ? '5%' : '5%', 163, wordsY + 11, { align: 'center' })
  doc.text(fmt(gstTotal), 176, wordsY + 11)
  doc.text(fmt(gstTotal), 206, wordsY + 11, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.text('Total', 168, wordsY + 16)
  doc.text(fmt(gstTotal), 206, wordsY + 16, { align: 'right' })

  const taxWordsY = wordsY + 20
  doc.rect(10, taxWordsY, 198, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Tax Amount (in words)', 12, taxWordsY + 4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(`INR ${clean(gstTotal ? `${fmt(gstTotal)}` : '0.00')} Only`, 42, taxWordsY + 4)

  const declarationY = taxWordsY + 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('Declaration', 10, declarationY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  const declaration = doc.splitTextToSize(
    'We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.',
    92
  )
  doc.text(declaration, 10, declarationY + 5)

  if (bankLines.length) {
    doc.setFont('helvetica', 'bold')
    doc.text("Company's Bank Details", 110, declarationY)
    doc.setFont('helvetica', 'normal')
    doc.text(bankLines, 110, declarationY + 5)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('This is a Computer Generated Invoice', 105, 292, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.text(`for ${clean(COMPANY_DETAILS.name || RESORT.name).toUpperCase()}`, 206, 284, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.text('Authorised Signatory', 206, 289, { align: 'right' })
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
  const igst = cgst + sgst
  const discount = Number(booking.discount_amount || 0)
  const invoiceItems = buildInvoiceItems(booking, taxable)
  const grossServiceValue = Math.round((invoiceItems.reduce((sum, item) => sum + item.amount, 0) || taxable + discount) * 100) / 100
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

  sectionLabel(doc, isInvoiceDocument ? 'Invoice Line Items' : 'Room Details', 16, 161)
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
  const primaryItem = invoiceItems[0]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.2)
  setText(doc, COLORS.ink)
  doc.text(clean(primaryItem?.desc || roomName), 21, 181)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  setText(doc, COLORS.muted)
  doc.text(`${primaryItem?.qty || rooms} room x ${primaryItem?.nights || nights} nights | ${mealLabel} | ${adults} adult(s)`, 21, 187)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.2)
  setText(doc, COLORS.ink)
  if (isInvoiceDocument) {
    doc.text(primaryItem?.sac || RESORT.sacCode, 142, 184, { align: 'right' })
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.2)
  setText(doc, COLORS.ink)
  doc.text(money(isInvoiceDocument ? Number(primaryItem?.amount || taxable) : total), 188, 184, { align: 'right' })

  sectionLabel(doc, isInvoiceDocument ? 'GST Invoice Summary' : 'Payment Summary', 16, 207)
  setDraw(doc, COLORS.border)
  doc.roundedRect(16, 211, 86, 50, 3, 3)
  let y = 222
  if (isInvoiceDocument) {
    if (discount > 0) {
      tableRow(doc, 'Gross Service Value', money(grossServiceValue), 22, y, 72)
      y += 8
      tableRow(doc, 'Less: Discount', money(discount), 22, y, 72)
      y += 8
    }
    tableRow(doc, 'Taxable Amount', money(taxable), 22, y, 72)
    y += 8
    if (isBillToIntraState(invoiceParty, String(COMPANY_DETAILS.gstin || '').slice(0, 2) || '05')) {
      tableRow(doc, 'CGST @ 2.5%', money(cgst), 22, y, 72)
      y += 8
      tableRow(doc, 'SGST @ 2.5%', money(sgst), 22, y, 72)
    } else {
      tableRow(doc, 'IGST @ 5%', money(igst), 22, y, 72)
    }
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

  if (!isInvoiceDocument) {
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
  }

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
