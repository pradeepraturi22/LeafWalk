import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendEmail, generateBookingConfirmationEmail, generateTourOperatorBookingEmail, generateBalanceReminderEmail } from '@/lib/email-service'
import { sendSMS, bookingConfirmationSMS, balanceReminderSMS } from '@/lib/sms-service'
import { sendWhatsApp, bookingConfirmationWhatsApp, holdConfirmationWhatsApp, balanceReminderWhatsApp } from '@/lib/whatsapp-service'
import { hasBalanceReminderBeenSent, sendTourOperatorBalanceReminderEmail } from '@/lib/tour-operator-notifications'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { parseJsonBody } from '@/lib/security'
import { requireInternalSecret } from '@/lib/internal-auth'

const notifySchema = z.object({
  type: z.enum(['booking_confirmation', 'hold_confirmation', 'balance_reminder']),
  booking_id: z.string().uuid(),
  channel: z.union([z.enum(['email', 'sms', 'whatsapp']), z.array(z.enum(['email', 'sms', 'whatsapp']))]).optional(),
  force: z.boolean().optional(),
})

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return null
  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !user) return null
  const { data } = await getSupabaseAdmin().from('users').select('role').eq('id', user.id).single() as any
  if (!data || !['admin', 'manager'].includes(data.role)) return null
  return user
}

async function log(bookingId: string, type: string, recipient: string, status: string, content?: string) {
  try {
    await getSupabaseAdmin().from('notification_logs').insert({
      booking_id: bookingId,
      type,
      recipient,
      status,
      content: content?.slice(0, 500),
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
  } catch {}
}

function getReminderTargets(booking: any) {
  const operator = Array.isArray(booking.tour_operator) ? booking.tour_operator[0] : booking.tour_operator
  if (booking.tour_operator_id && operator) {
    return {
      email: operator.email || booking.guest_email || null,
      phone: operator.phone || booking.guest_phone || null,
      label: operator.company_name || booking.guest_name || 'Guest',
    }
  }
  return {
    email: booking.guest_email || null,
    phone: booking.guest_phone || null,
    label: booking.guest_name || 'Guest',
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJsonBody(request, notifySchema)
  if (!parsed.success) {
    return parsed.response
  }

  try {
    const { type, booking_id, channel, force } = parsed.data
    const { data: booking, error } = await getSupabaseAdmin()
      .from('bookings')
      .select(`
        id, booking_number, guest_name, guest_email, guest_phone, check_in, check_out, nights,
        rooms_booked, adults, meal_plan, total_amount, advance_amount, balance_amount, payment_status, booking_status,
        room:rooms(name, category),
        tour_operator_id,
        tour_operator:tour_operators(company_name, contact_person, email, phone)
      `)
      .eq('id', booking_id)
      .single() as any

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const requestedChannels = Array.isArray(channel) ? channel : channel ? [channel] : ['email', 'sms', 'whatsapp']
    const shouldSend = (kind: 'email' | 'sms' | 'whatsapp') => requestedChannels.includes(kind)
    const results = { email: false, sms: false, whatsapp: false }

    if (type === 'booking_confirmation' || type === 'hold_confirmation') {
      const isHold = booking.booking_status === 'hold' || type === 'hold_confirmation'

      if (booking.guest_email && shouldSend('email')) {
        const subject = isHold
          ? `Room on Hold - ${booking.booking_number} | LeafWalk Resort`
          : `Booking Confirmed - ${booking.booking_number} | LeafWalk Resort`
        results.email = await sendEmail(booking.guest_email, subject, generateBookingConfirmationEmail(booking), undefined, { emailType: 'booking_confirmation' })
        await log(booking_id, 'email', booking.guest_email, results.email ? 'sent' : 'failed')
      }

      if (booking.guest_phone && shouldSend('sms')) {
        const msg = bookingConfirmationSMS(booking)
        results.sms = await sendSMS(booking.guest_phone, msg)
        await log(booking_id, 'sms', booking.guest_phone, results.sms ? 'sent' : 'failed', msg)
      }

      if (booking.guest_phone && shouldSend('whatsapp')) {
        const msg = isHold ? holdConfirmationWhatsApp(booking) : bookingConfirmationWhatsApp(booking)
        results.whatsapp = await sendWhatsApp(booking.guest_phone, msg)
        await log(booking_id, 'whatsapp', booking.guest_phone, results.whatsapp ? 'sent' : 'failed', msg)
      }

      if (booking.tour_operator_id && booking.tour_operator?.email) {
        const html = generateTourOperatorBookingEmail(booking, booking.tour_operator)
        const subject = `New Booking - ${booking.booking_number} | LeafWalk Resort`
        await sendEmail(booking.tour_operator.email, subject, html, undefined, { emailType: 'booking_confirmation' })
      }

      await getSupabaseAdmin().from('bookings').update({
        email_sent: results.email,
        email_sent_at: results.email ? new Date().toISOString() : null,
        sms_sent: results.sms,
        sms_sent_at: results.sms ? new Date().toISOString() : null,
        whatsapp_sent: results.whatsapp,
        whatsapp_sent_at: results.whatsapp ? new Date().toISOString() : null,
      } as any).eq('id', booking_id)
    }

    if (type === 'balance_reminder') {
      const daysLeft = Math.ceil((new Date(booking.check_in).getTime() - Date.now()) / 86400000)
      const targets = getReminderTargets(booking)

      if (booking.tour_operator?.email && shouldSend('email')) {
        const alreadySent = await hasBalanceReminderBeenSent(booking.id, booking.tour_operator.email, daysLeft)
        if (force || !alreadySent) {
          results.email = await sendTourOperatorBalanceReminderEmail(booking, booking.tour_operator, daysLeft)
          await log(booking_id, 'email', booking.tour_operator.email, results.email ? 'sent' : 'failed', `Balance reminder for ${targets.label}`)
        }
      } else if (targets.email && shouldSend('email')) {
        const html = generateBalanceReminderEmail(booking, daysLeft)
        results.email = await sendEmail(targets.email, `Payment Reminder - ${booking.booking_number} | LeafWalk Resort`, html, undefined, { emailType: 'checkin_reminder' })
        await log(booking_id, 'email', targets.email, results.email ? 'sent' : 'failed', `Balance reminder for ${targets.label}`)
      }

      if (targets.phone && shouldSend('sms')) {
        results.sms = await sendSMS(targets.phone, balanceReminderSMS(booking, daysLeft))
        await log(booking_id, 'sms', targets.phone, results.sms ? 'sent' : 'failed', `Balance reminder for ${targets.label}`)
      }

      if (targets.phone && shouldSend('whatsapp')) {
        results.whatsapp = await sendWhatsApp(targets.phone, balanceReminderWhatsApp(booking, daysLeft))
        await log(booking_id, 'whatsapp', targets.phone, results.whatsapp ? 'sent' : 'failed', `Balance reminder for ${targets.label}`)
      }
    }

    return NextResponse.json({ success: true, ...results })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Notification failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const unauthorized = requireInternalSecret(request)
  if (unauthorized) return unauthorized

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkpoints = [15, 7, 1]
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() + Math.min(...checkpoints))
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + Math.max(...checkpoints))

  const { data } = await getSupabaseAdmin().from('bookings')
    .select(`
      id, booking_number, guest_name, guest_email, guest_phone, check_in, check_out, nights,
      rooms_booked, adults, meal_plan, total_amount, advance_amount, balance_amount, payment_status, booking_status,
      tour_operator_id,
      tour_operator:tour_operators(company_name, contact_person, email, phone)
    `)
    .gt('balance_amount', 0)
    .gte('check_in', startDate.toISOString().split('T')[0])
    .lte('check_in', endDate.toISOString().split('T')[0])
    .not('booking_status', 'in', '("cancelled","no_show","checked_out","completed")')

  let sent = 0
  for (const booking of data || []) {
    const daysLeft = Math.ceil((new Date(booking.check_in).getTime() - today.getTime()) / 86400000)
    if (!checkpoints.includes(daysLeft)) continue

    const targets = getReminderTargets(booking)
    const operator = Array.isArray((booking as any).tour_operator) ? (booking as any).tour_operator[0] : (booking as any).tour_operator
    if (booking.tour_operator_id && operator?.email) {
      const alreadySent = await hasBalanceReminderBeenSent(booking.id, operator.email, daysLeft)
      if (alreadySent) continue
      const emailSent = await sendTourOperatorBalanceReminderEmail(booking, operator, daysLeft)
      if (emailSent) sent += 1
      if (targets.phone) {
        await sendSMS(targets.phone, balanceReminderSMS(booking, daysLeft))
        await sendWhatsApp(targets.phone, balanceReminderWhatsApp(booking, daysLeft))
      }
      continue
    }

    if (targets.email) {
      const alreadySent = await getSupabaseAdmin().from('notification_logs')
        .select('id')
        .eq('booking_id', booking.id)
        .eq('type', 'email')
        .eq('recipient', targets.email)
        .eq('status', 'sent')
        .like('content', `direct_balance_${daysLeft}d:%`)
        .limit(1)

      if (!(alreadySent.data || []).length) {
        const emailSent = await sendEmail(
          targets.email,
          `Payment Reminder - ${booking.booking_number} | LeafWalk Resort`,
          generateBalanceReminderEmail(booking, daysLeft),
          undefined,
          { emailType: 'checkin_reminder' }
        )
        await log(booking.id, 'email', targets.email, emailSent ? 'sent' : 'failed', `direct_balance_${daysLeft}d:${booking.booking_number || booking.id}`)
        if (emailSent) sent += 1
      }
    }
    if (targets.phone) {
      await sendSMS(targets.phone, balanceReminderSMS(booking, daysLeft))
      await sendWhatsApp(targets.phone, balanceReminderWhatsApp(booking, daysLeft))
    }
  }

  return NextResponse.json({ sent })
}
