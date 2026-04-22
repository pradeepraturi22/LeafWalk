import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createStyledBookingReceiptPdf } from '../lib/booking-email-receipt-pdf'

const demoBooking = {
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

const outputDir = join(process.cwd(), 'tmp')
mkdirSync(outputDir, { recursive: true })

const pdf = createStyledBookingReceiptPdf(demoBooking)
const outputPath = join(outputDir, 'demo-online-booking-receipt.pdf')
writeFileSync(outputPath, pdf)

console.log(outputPath)
