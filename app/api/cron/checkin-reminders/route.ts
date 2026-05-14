import { NextRequest, NextResponse } from 'next/server'
import { generateReceiptAttachment, renderCheckInReminderEmail, sendEmail } from '@/lib/email-service'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { hasBalanceReminderBeenSent, sendTourOperatorBalanceReminderEmail } from '@/lib/tour-operator-notifications'
import { requireInternalSecret } from '@/lib/internal-auth'

type ReminderBooking = {
  id: string
  booking_number: string | null
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  check_in: string
  check_out: string
  nights: number | null
  rooms_booked: number | null
  adults: number | null
  meal_plan: string | null
  total_amount: number | null
  advance_amount: number | null
  balance_amount: number | null
  payment_status: string | null
  booking_status: string | null
  payment_due_date: string | null
  booking_source: string | null
  room: { name?: string | null; category?: string | null } | null
  tour_operator: {
    company_name?: string | null
    contact_person?: string | null
    email?: string | null
    phone?: string | null
  } | null
}

async function hasDirectReminderBeenSent(bookingId: string, email: string, daysLeft: number) {
  try {
    const { data } = await getSupabaseAdmin()
      .from('notification_logs')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('type', 'email')
      .eq('recipient', email)
      .eq('status', 'sent')
      .like('content', `direct_balance_${daysLeft}d:%`)
      .limit(1)
    return Boolean(data?.length)
  } catch {
    return false
  }
}

async function logReminder(bookingId: string, recipient: string, status: 'sent' | 'failed', marker: string) {
  try {
    await getSupabaseAdmin().from('notification_logs').insert({
      booking_id: bookingId,
      type: 'email',
      recipient,
      status,
      content: marker,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
  } catch {}
}

export async function POST(request: NextRequest) {
  const unauthorized = requireInternalSecret(request)
  if (unauthorized) return unauthorized

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkpoints = [7, 6, 5, 4, 3, 2, 1]
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() + Math.min(...checkpoints))
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + Math.max(...checkpoints))

  const { data: bookings, error } = await getSupabaseAdmin()
    .from('bookings')
    .select(`
      id, booking_number, guest_name, guest_email, guest_phone, check_in, check_out, nights,
      rooms_booked, adults, meal_plan, total_amount, advance_amount, balance_amount, payment_status,
      booking_status, payment_due_date, booking_source,
      room:rooms(name, category, featured_image),
      tour_operator:tour_operators(company_name, contact_person, email, phone)
    `)
    .gt('balance_amount', 0)
    .neq('payment_status', 'fully_paid')
    .neq('payment_status', 'refunded')
    .gte('check_in', startDate.toISOString().slice(0, 10))
    .lte('check_in', endDate.toISOString().slice(0, 10))
    .not('booking_status', 'in', '("cancelled","no_show","checked_out","completed")') as any

  if (error) {
    return NextResponse.json({ error: error.message || 'Could not load bookings' }, { status: 500 })
  }

  let sentCount = 0
  const touched: Array<{ booking_id: string; recipient: string; days_left: number }> = []

  for (const booking of (bookings || []) as ReminderBooking[]) {
    const checkIn = new Date(`${booking.check_in}T00:00:00`)
    const daysLeft = Math.ceil((checkIn.getTime() - today.getTime()) / 86400000)
    if (!checkpoints.includes(daysLeft)) continue

    if (booking.tour_operator?.email) {
      const alreadySent = await hasBalanceReminderBeenSent(booking.id, booking.tour_operator.email, daysLeft)
      if (alreadySent) continue
      const sent = await sendTourOperatorBalanceReminderEmail(booking, booking.tour_operator, daysLeft)
      if (sent) {
        sentCount += 1
        touched.push({ booking_id: booking.id, recipient: booking.tour_operator.email, days_left: daysLeft })
      }
      continue
    }

    if (!booking.guest_email) continue
    const alreadySent = await hasDirectReminderBeenSent(booking.id, booking.guest_email, daysLeft)
    if (alreadySent) continue

    const subject = `Payment Reminder - ${booking.booking_number || 'LeafWalk Resort'} - ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
    const sent = await sendEmail(
      booking.guest_email,
      subject,
      renderCheckInReminderEmail(booking as any),
      [await generateReceiptAttachment(booking as any, { documentMode: 'receipt' })],
      { emailType: 'checkin_reminder' }
    )
    await logReminder(booking.id, booking.guest_email, sent ? 'sent' : 'failed', `direct_balance_${daysLeft}d:${booking.booking_number || booking.id}`)
    if (sent) {
      sentCount += 1
      touched.push({ booking_id: booking.id, recipient: booking.guest_email, days_left: daysLeft })
    }
  }

  return NextResponse.json({ success: true, sentCount, touched })
}
