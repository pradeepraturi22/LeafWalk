// app/api/admin/notify/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, generateBookingConfirmationEmail, generateTourOperatorBookingEmail, generateBalanceReminderEmail } from '@/lib/email-service'
import { sendSMS, bookingConfirmationSMS, balanceReminderSMS } from '@/lib/sms-service'
import { sendWhatsApp, bookingConfirmationWhatsApp, holdConfirmationWhatsApp, balanceReminderWhatsApp } from '@/lib/whatsapp-service'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function log(booking_id: string, type: string, recipient: string, status: string, content?: string) {
  try {
    await supabase.from('notification_logs').insert({
      booking_id, type, recipient, status,
      content: content?.slice(0, 500),
      sent_at: status === 'sent' ? new Date().toISOString() : null
    })
  } catch (_) {}
}

export async function POST(request: Request) {
  try {
    const { type, booking_id } = await request.json()

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`*, room:rooms(name, category), tour_operator:tour_operators(company_name, contact_person, email, phone, commission_rate)`)
      .eq('id', booking_id)
      .single()

    if (error || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    const results = { email: false, sms: false, whatsapp: false }

    // ── Booking Confirmation ──────────────────────────────────────────────────
    if (type === 'booking_confirmation' || type === 'hold_confirmation') {
      const isHold = booking.booking_status === 'hold' || type === 'hold_confirmation'

      // Email to guest
      if (booking.guest_email) {
        const html = generateBookingConfirmationEmail(booking)
        const subject = isHold
          ? `Room on Hold — ${booking.booking_number} | LeafWalk Resort`
          : `Booking Confirmed — ${booking.booking_number} | LeafWalk Resort`
        results.email = await sendEmail(booking.guest_email, subject, html)
        await log(booking_id, 'email', booking.guest_email, results.email ? 'sent' : 'failed')
      }

      // SMS to guest
      if (booking.guest_phone) {
        const msg = bookingConfirmationSMS(booking)
        results.sms = await sendSMS(booking.guest_phone, msg)
        await log(booking_id, 'sms', booking.guest_phone, results.sms ? 'sent' : 'failed', msg)
      }

      // WhatsApp to guest
      if (booking.guest_phone) {
        const msg = isHold
          ? holdConfirmationWhatsApp(booking)
          : bookingConfirmationWhatsApp(booking)
        results.whatsapp = await sendWhatsApp(booking.guest_phone, msg)
        await log(booking_id, 'whatsapp', booking.guest_phone, results.whatsapp ? 'sent' : 'failed', msg)

        // Update whatsapp_sent flag
        if (results.whatsapp) {
          await supabase.from('bookings').update({
            whatsapp_sent: true,
            whatsapp_sent_at: new Date().toISOString()
          }).eq('id', booking_id)
        }
      }

      // Email to tour operator (if B2B booking)
      if (booking.tour_operator_id && booking.tour_operator?.email) {
        const html = generateTourOperatorBookingEmail(booking, booking.tour_operator)
        const subject = `New Booking — ${booking.booking_number} | LeafWalk Resort`
        await sendEmail(booking.tour_operator.email, subject, html)
      }

      // Update notification flags
      await supabase.from('bookings').update({
        email_sent: results.email,
        email_sent_at: results.email ? new Date().toISOString() : null,
        sms_sent: results.sms,
        sms_sent_at: results.sms ? new Date().toISOString() : null,
      }).eq('id', booking_id)
    }

    // ── Balance Reminder ──────────────────────────────────────────────────────
    if (type === 'balance_reminder') {
      const daysLeft = Math.ceil((new Date(booking.check_in).getTime() - Date.now()) / 86400000)

      if (booking.guest_email) {
        const html = generateBalanceReminderEmail(booking, daysLeft)
        await sendEmail(booking.guest_email, `Payment Reminder — ${booking.booking_number} | LeafWalk Resort`, html)
      }
      if (booking.guest_phone) {
        await sendSMS(booking.guest_phone, balanceReminderSMS(booking, daysLeft))
        await sendWhatsApp(booking.guest_phone, balanceReminderWhatsApp(booking, daysLeft))
      }
    }

    return NextResponse.json({ success: true, ...results })
  } catch (err: any) {
    console.error('Notify error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET — Auto balance reminders (call via cron)
export async function GET() {
  const today = new Date()
  const in7  = new Date(today.getTime() + 7  * 86400000).toISOString().split('T')[0]
  const in14 = new Date(today.getTime() + 14 * 86400000).toISOString().split('T')[0]

  const { data } = await supabase.from('bookings')
    .select('*')
    .eq('payment_status', 'advance_paid')
    .gt('balance_amount', 0)
    .gte('check_in', in7)
    .lte('check_in', in14)
    .not('booking_status', 'in', '("cancelled","no_show","checked_out")')

  let sent = 0
  for (const b of data || []) {
    const days = Math.ceil((new Date(b.check_in).getTime() - today.getTime()) / 86400000)
    if (b.guest_email) await sendEmail(b.guest_email, `Payment Reminder — ${b.booking_number}`, generateBalanceReminderEmail(b, days))
    if (b.guest_phone) {
      await sendSMS(b.guest_phone, balanceReminderSMS(b, days))
      await sendWhatsApp(b.guest_phone, balanceReminderWhatsApp(b, days))
    }
    sent++
  }
  return NextResponse.json({ sent })
}