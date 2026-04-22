const { writeFileSync, mkdirSync, readFileSync } = require('fs')
const { join } = require('path')
const { jsPDF } = require('jspdf')

const booking = {
  id: 'demo-booking-0001',
  booking_number: 'LWR-DEMO-2026-001',
  guest_name: 'Pradeep Sharma',
  guest_email: 'demo.guest@example.com',
  guest_phone: '9876543210',
  room: { name: 'Premium Cottage', category: 'Cottage' },
  check_in: '2026-04-15',
  check_out: '2026-04-17',
  created_at: '2026-04-09T10:00:00.000Z',
  nights: 2,
  rooms_booked: 1,
  adults: 2,
  meal_plan: 'MAP',
  total_amount: 12500,
  advance_amount: 12500,
  balance_amount: 0,
  booking_status: 'confirmed',
  payment_status: 'fully_paid',
  booking_source: 'website',
}

const COLORS = {
  forest: [15, 28, 15],
  gold: [201, 161, 74],
  ink: [24, 24, 27],
  muted: [107, 114, 128],
  border: [229, 231, 235],
  soft: [249, 250, 251],
  successBg: [220, 252, 231],
  successInk: [22, 101, 52],
}

const RESORT = {
  name: 'LEAFWALK RESORT',
  subtitle: 'Stay in Lap of Nature',
  address: 'Vill- Banas, Narad Chatti, Hanuman Chatti',
  city: 'Yamunotri Road, Uttarkashi, Uttarakhand - 249193',
  phone: '+91-9368080535 | +91-8630227541',
  email: 'info@leafwalk.in',
  website: 'www.leafwalk.in',
}

const LOGO_IMAGE = readFileSync(join(process.cwd(), 'public', 'logo', 'leafwalk-logo.jpeg'))

function formatDate(input) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Calcutta',
  }).format(new Date(input))
}

function amount(value) {
  return `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function setFill(doc, color) {
  doc.setFillColor(color[0], color[1], color[2])
}

function setDraw(doc, color) {
  doc.setDrawColor(color[0], color[1], color[2])
}

function setText(doc, color) {
  doc.setTextColor(color[0], color[1], color[2])
}

function writeLabelValue(doc, x, y, label, value, width = 78) {
  doc.setFont('times', 'bold')
  doc.setFontSize(8.2)
  setText(doc, COLORS.muted)
  doc.text(label.toUpperCase(), x, y)
  doc.setFont('times', 'normal')
  doc.setFontSize(10.8)
  setText(doc, COLORS.ink)
  const lines = doc.splitTextToSize(value || '-', width)
  doc.text(lines, x, y + 5)
}

function drawBadge(doc, x, y, text, bg, ink) {
  const width = Math.max(28, doc.getTextWidth(text) + 8)
  setFill(doc, bg)
  setDraw(doc, bg)
  doc.roundedRect(x, y, width, 8, 4, 4, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  setText(doc, ink)
  doc.text(text, x + width / 2, y + 5.4, { align: 'center' })
  return width
}

function addLogo(doc, x, y, size) {
  setFill(doc, [255, 255, 255])
  setDraw(doc, [255, 255, 255])
  doc.roundedRect(x, y, size, size, 6, 6, 'FD')
  setDraw(doc, [214, 219, 220])
  doc.roundedRect(x, y, size, size, 6, 6, 'S')
  const innerSize = size - 4
  const innerX = x + (size - innerSize) / 2
  const innerY = y + (size - innerSize) / 2
  doc.addImage(
    Uint8Array.from(LOGO_IMAGE),
    'JPEG',
    innerX,
    innerY,
    innerSize,
    innerSize
  )
}

const doc = new jsPDF({ unit: 'mm', format: 'a4' })
const pageWidth = 210
const contentLeft = 15
const contentWidth = 180
const right = 192
const bookingRef = booking.booking_number
const issueDate = formatDate(booking.created_at)
const checkIn = formatDate(booking.check_in)
const checkOut = formatDate(booking.check_out)

setFill(doc, COLORS.forest)
doc.rect(0, 0, pageWidth, 34, 'F')
setFill(doc, [26, 45, 26])
doc.circle(178, 7, 26, 'F')
doc.circle(192, 14, 16, 'F')
addLogo(doc, 15, 6, 21)
setText(doc, COLORS.gold)
doc.setFont('times', 'bold')
doc.setFontSize(20.5)
doc.text(RESORT.name, 40, 14.5)
doc.setFont('times', 'italic')
doc.setFontSize(8.8)
doc.text(RESORT.subtitle.toUpperCase(), 40, 19.2)
setText(doc, [220, 220, 220])
doc.setFont('helvetica', 'normal')
doc.setFontSize(7.5)
doc.text(RESORT.address, right, 9.8, { align: 'right' })
doc.text(RESORT.city, right, 13.4, { align: 'right' })
doc.text(RESORT.phone, right, 17, { align: 'right' })
doc.text(`${RESORT.email} | ${RESORT.website}`, right, 20.6, { align: 'right' })
doc.setFont('times', 'italic')
doc.setFontSize(7.8)
setText(doc, [196, 210, 196])
doc.text('Mountain hospitality, curated for every stay.', 40, 24.8)

setFill(doc, COLORS.gold)
doc.rect(0, 34, pageWidth, 1.6, 'F')

setFill(doc, COLORS.soft)
setDraw(doc, COLORS.border)
doc.roundedRect(contentLeft, 41, contentWidth, 20, 3, 3, 'FD')
doc.setFont('times', 'bold')
doc.setFontSize(19.5)
setText(doc, COLORS.ink)
doc.text('Booking Receipt', 20, 49.5)
doc.setFont('times', 'italic')
doc.setFontSize(9.2)
setText(doc, COLORS.muted)
doc.text(`Receipt Ref: ${bookingRef}`, right, 47.5, { align: 'right' })
doc.text(`Issued On: ${issueDate}`, right, 52.5, { align: 'right' })
doc.setFontSize(8.2)
doc.text('Source: WEBSITE', right, 57, { align: 'right' })

const badgeWidths = [
  Math.max(28, doc.getTextWidth('CONFIRMED') + 8),
  Math.max(28, doc.getTextWidth('FULLY PAID') + 8),
  Math.max(28, doc.getTextWidth('2 NIGHT STAY') + 8),
]
const badgeGap = 6
const badgeStart = contentLeft + (contentWidth - (badgeWidths[0] + badgeWidths[1] + badgeWidths[2] + badgeGap * 2)) / 2
let badgeX = badgeStart
badgeX += drawBadge(doc, badgeX, 66, 'CONFIRMED', COLORS.successBg, COLORS.successInk) + badgeGap
badgeX += drawBadge(doc, badgeX, 66, 'FULLY PAID', COLORS.successBg, COLORS.successInk) + badgeGap
drawBadge(doc, badgeX, 66, '2 NIGHT STAY', COLORS.soft, COLORS.ink)

setDraw(doc, COLORS.border)
doc.roundedRect(15, 80, 86, 40, 3, 3)
doc.roundedRect(109, 80, 86, 40, 3, 3)

writeLabelValue(doc, 20, 89, 'Guest Name', booking.guest_name, 68)
writeLabelValue(doc, 20, 101, 'Email', booking.guest_email, 68)
writeLabelValue(doc, 20, 113, 'Phone', booking.guest_phone, 68)

writeLabelValue(doc, 114, 89, 'Check-in', checkIn, 66)
writeLabelValue(doc, 114, 101, 'Check-out', checkOut, 66)
writeLabelValue(doc, 114, 113, 'Stay', `${booking.nights} nights | ${booking.rooms_booked} room(s)`, 66)

setFill(doc, [252, 250, 245])
doc.roundedRect(15, 128, 180, 26, 3, 3, 'FD')
doc.line(72, 128, 72, 154)
doc.line(118, 128, 118, 154)
doc.line(154, 128, 154, 154)
writeLabelValue(doc, 20, 136, 'Room Type', booking.room.name, 44)
writeLabelValue(doc, 77, 136, 'Meal Plan', 'Breakfast + Dinner (MAP)', 36)
writeLabelValue(doc, 123, 136, 'Guests', `${booking.adults} adult(s)`, 24)
writeLabelValue(doc, 159, 136, 'Source', 'WEBSITE', 24)

doc.roundedRect(15, 162, 118, 62, 3, 3)
setFill(doc, COLORS.soft)
doc.roundedRect(15, 162, 118, 10, 3, 3, 'F')
doc.setFont('times', 'bold')
doc.setFontSize(9.4)
setText(doc, COLORS.muted)
doc.text('STAY DETAILS', 20, 168.8)
setText(doc, COLORS.ink)
doc.setFont('times', 'normal')
doc.setFontSize(11)
doc.text(`Booking Reference: ${bookingRef}`, 20, 179.5)
doc.text(`Room: ${booking.room.name}`, 20, 188)
doc.text('Meal Plan: Breakfast + Dinner (MAP)', 20, 196.5)
doc.text(`Check-in: ${checkIn}`, 20, 205)
doc.text(`Check-out: ${checkOut}`, 20, 213.5)

doc.roundedRect(138, 162, 57, 62, 3, 3)
setFill(doc, COLORS.soft)
doc.roundedRect(138, 162, 57, 10, 3, 3, 'F')
doc.setFont('times', 'bold')
doc.setFontSize(9.2)
setText(doc, COLORS.muted)
doc.text('PAYMENT SUMMARY', 166.5, 168.8, { align: 'center' })
doc.setFont('times', 'normal')
doc.setFontSize(10.2)
setText(doc, COLORS.muted)
doc.text('Booking Total', 142, 180)
setText(doc, COLORS.ink)
doc.setFont('times', 'bold')
doc.text(amount(booking.total_amount), 190, 180, { align: 'right' })
setText(doc, COLORS.muted)
doc.setFont('times', 'normal')
doc.text('Amount Paid', 142, 190)
setText(doc, COLORS.ink)
doc.setFont('times', 'bold')
doc.text(amount(booking.advance_amount), 190, 190, { align: 'right' })
setText(doc, COLORS.muted)
doc.setFont('times', 'normal')
doc.text('Balance Due', 142, 200)
setText(doc, COLORS.ink)
doc.setFont('times', 'bold')
doc.text(amount(booking.balance_amount), 190, 200, { align: 'right' })

setFill(doc, COLORS.forest)
doc.roundedRect(142, 208, 49, 12, 2, 2, 'F')
setText(doc, COLORS.gold)
doc.setFont('times', 'bold')
doc.setFontSize(11.5)
doc.text(amount(booking.total_amount), 166.5, 216, { align: 'center' })

doc.roundedRect(15, 232, 180, 34, 3, 3)
setFill(doc, COLORS.soft)
doc.roundedRect(15, 232, 180, 10, 3, 3, 'F')
doc.setFont('times', 'bold')
doc.setFontSize(9.4)
setText(doc, COLORS.muted)
doc.text('IMPORTANT NOTES', 20, 238.5)
doc.setFont('times', 'normal')
doc.setFontSize(9.8)
setText(doc, COLORS.ink)
doc.text('- This receipt is system generated and valid without physical signature.', 20, 248)
doc.text('- Standard check-in is after 3:00 PM and check-out is before 11:00 AM.', 20, 253.4)
doc.text('- Please carry a valid government ID for all staying guests.', 20, 258.8)
doc.text('- For assistance contact LeafWalk Resort at +91-9368080535.', 20, 264.2)

setFill(doc, COLORS.soft)
doc.rect(0, 279, pageWidth, 18, 'F')
setDraw(doc, COLORS.border)
doc.line(15, 279, 195, 279)
doc.setFont('times', 'italic')
doc.setFontSize(8.6)
setText(doc, COLORS.muted)
doc.text('LeafWalk Resort | info@leafwalk.in | www.leafwalk.in', 15, 286)
doc.setFontSize(7.8)
doc.text('Premium mountain hospitality crafted for direct and online guests alike.', 15, 290.5)
doc.setFont('times', 'bold')
doc.setFontSize(13.5)
setText(doc, COLORS.gold)
doc.text('Thank you for booking with LeafWalk Resort', 195, 286, { align: 'right' })

const outputDir = join(process.cwd(), 'tmp')
mkdirSync(outputDir, { recursive: true })
const outputPath = join(outputDir, 'demo-online-booking-receipt-enhanced-v7.pdf')
writeFileSync(outputPath, Buffer.from(doc.output('arraybuffer')))
console.log(outputPath)
