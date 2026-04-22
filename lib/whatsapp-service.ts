import { formatDate } from '@/lib/utils'
import { logError, logInfo } from '@/lib/logger'
import { isLocalNotificationMockMode } from '@/lib/runtime-mode'

const MEAL_LABELS: Record<string, string> = {
  EP: 'Room Only',
  CP: 'With Breakfast',
  MAP: 'Breakfast + Dinner',
  AP: 'All Meals',
}

export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  // LOCAL TEST MODE ONLY
  // REMOVE / DISABLE FOR PRODUCTION
  if (isLocalNotificationMockMode()) {
    logInfo('LOCAL TEST MODE WhatsApp mock send:', { phone, preview: message.slice(0, 160) })
    return true
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

  if (!accountSid || !authToken) {
    logInfo('WhatsApp demo mode:', phone)
    return true
  }

  try {
    const to = `whatsapp:+91${phone.replace(/^\+91/, '').replace(/\D/g, '')}`
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: to, Body: message }),
    })

    const data = await res.json()
    if (data.error_code) {
      logError('Twilio error:', data.message)
      return false
    }

    logInfo('WhatsApp sent:', to)
    return true
  } catch (error) {
    logError('WhatsApp error:', error)
    return false
  }
}

export function bookingConfirmationWhatsApp(booking: any): string {
  const checkIn = formatDate(booking.check_in)
  const checkOut = formatDate(booking.check_out)
  const meal = MEAL_LABELS[booking.meal_plan] || booking.meal_plan
  const balance = Number(booking.balance_amount || 0)
  const isFullyPaid = booking.payment_status === 'fully_paid'

  return `LeafWalk Resort - Booking Confirmed

Hello ${booking.guest_name},

Your booking is confirmed. Here are your details:

Booking Ref: ${booking.booking_number}
Room: ${booking.room?.name || '-'} (${booking.rooms_booked || 1} room)
Meal Plan: ${meal}
Check-in: ${checkIn} (after 3:00 PM)
Check-out: ${checkOut} (before 11:00 AM)
Nights: ${booking.nights}
Guests: ${booking.adults} Adult${Number(booking.adults) > 1 ? 's' : ''}${Number(booking.children_5_to_12) > 0 ? `, ${booking.children_5_to_12} Child` : ''}

Total: Rs.${Number(booking.total_amount).toLocaleString('en-IN')}
${Number(booking.advance_amount) > 0 ? `Advance Paid: Rs.${Number(booking.advance_amount).toLocaleString('en-IN')}\n` : ''}${!isFullyPaid && balance > 0 ? `Balance Due: Rs.${balance.toLocaleString('en-IN')} (pay before 7 days of check-in)\n` : ''}Location: Vill- Banas, Narad Chatti, Uttarkashi, Uttarakhand
Contact: +91-9368080535 | +91-8630227541
Website: www.leafwalk.in

We look forward to welcoming you.`
}

export function holdConfirmationWhatsApp(booking: any): string {
  const checkIn = formatDate(booking.check_in)
  const checkOut = formatDate(booking.check_out)

  return `LeafWalk Resort - Room Hold Confirmed

Hello ${booking.guest_name},

Your room has been held as requested.

Booking Ref: ${booking.booking_number}
Room: ${booking.room?.name || '-'}
Check-in: ${checkIn}
Check-out: ${checkOut}
Nights: ${booking.nights}
Total Amount: Rs.${Number(booking.total_amount).toLocaleString('en-IN')}

Status: Room on Hold - Booking will be confirmed upon payment.

Contact: +91-9368080535
Website: www.leafwalk.in`
}

export function balanceReminderWhatsApp(booking: any, daysLeft: number): string {
  const checkIn = formatDate(booking.check_in)

  return `LeafWalk Resort - Payment Reminder

Hello ${booking.guest_name},

This is a friendly reminder for your upcoming stay.

Booking: ${booking.booking_number}
Check-in: ${checkIn} (${daysLeft} days away)
Balance Due: Rs.${Number(booking.balance_amount).toLocaleString('en-IN')}

Please complete your payment at the earliest to secure your booking.

Contact: +91-9368080535 | bookings@leafwalk.in
Thank you.`
}
