// lib/whatsapp-service.ts - Twilio WhatsApp

const MEAL_LABELS: Record<string, string> = {
  EP: 'Room Only', CP: 'With Breakfast',
  MAP: 'Breakfast + Dinner', AP: 'All Meals',
}

export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

  if (!accountSid || !authToken) {
    console.log('📱 WhatsApp (Demo):', phone, '-', message.slice(0, 80))
    return true
  }

  try {
    const to = `whatsapp:+91${phone.replace(/^\+91/, '').replace(/\D/g, '')}`
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: from, To: to, Body: message }),
      }
    )
    const data = await res.json()
    if (data.error_code) { console.error('Twilio error:', data.message); return false }
    console.log('✅ WhatsApp sent to', to)
    return true
  } catch (err) {
    console.error('WhatsApp error:', err)
    return false
  }
}

// ─── Message Templates ────────────────────────────────────────────────────────

export function bookingConfirmationWhatsApp(booking: any): string {
  const checkIn  = new Date(booking.check_in).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const checkOut = new Date(booking.check_out).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const meal     = MEAL_LABELS[booking.meal_plan] || booking.meal_plan
  const balance  = Number(booking.balance_amount || 0)
  const isFullyPaid = booking.payment_status === 'fully_paid'

  return `🌿 *LeafWalk Resort — Booking Confirmed!*

Hello *${booking.guest_name}*,

Your booking is confirmed. Here are your details:

📋 *Booking Ref:* ${booking.booking_number}
🏠 *Room:* ${booking.room?.name || '—'} (${booking.rooms_booked || 1} room)
🍽 *Meal Plan:* ${meal}
📅 *Check-in:* ${checkIn} _(after 3:00 PM)_
📅 *Check-out:* ${checkOut} _(before 11:00 AM)_
🌙 *Nights:* ${booking.nights}
👥 *Guests:* ${booking.adults} Adult${Number(booking.adults) > 1 ? 's' : ''}${Number(booking.children_5_to_12) > 0 ? `, ${booking.children_5_to_12} Child` : ''}

💰 *Total:* ₹${Number(booking.total_amount).toLocaleString()}
${Number(booking.advance_amount) > 0 ? `✅ *Advance Paid:* ₹${Number(booking.advance_amount).toLocaleString()}\n` : ''}${!isFullyPaid && balance > 0 ? `⚠️ *Balance Due:* ₹${balance.toLocaleString()} _(pay before 7 days of check-in)_\n` : ''}
📍 *Location:* Vill- Banas, Narad Chatti, Uttarkashi, Uttarakhand
📞 *Contact:* +91-9368080535 | +91-8630227541
🌐 www.leafwalk.in

_We look forward to welcoming you! 🙏_`
}

export function holdConfirmationWhatsApp(booking: any): string {
  const checkIn  = new Date(booking.check_in).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const checkOut = new Date(booking.check_out).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  return `🌿 *LeafWalk Resort — Room Hold Confirmed*

Hello *${booking.guest_name}*,

Your room has been held as requested.

📋 *Booking Ref:* ${booking.booking_number}
🏠 *Room:* ${booking.room?.name || '—'}
📅 *Check-in:* ${checkIn}
📅 *Check-out:* ${checkOut}
🌙 *Nights:* ${booking.nights}
💰 *Total Amount:* ₹${Number(booking.total_amount).toLocaleString()}

⚠️ *Status:* Room on Hold — Booking will be confirmed upon payment.

📞 *Contact:* +91-9368080535
🌐 www.leafwalk.in`
}

export function balanceReminderWhatsApp(booking: any, daysLeft: number): string {
  const checkIn = new Date(booking.check_in).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  return `🌿 *LeafWalk Resort — Payment Reminder*

Hello *${booking.guest_name}*,

This is a friendly reminder for your upcoming stay.

📋 *Booking:* ${booking.booking_number}
📅 *Check-in:* ${checkIn} _(${daysLeft} days away)_
⚠️ *Balance Due:* ₹${Number(booking.balance_amount).toLocaleString()}

Please complete your payment at the earliest to secure your booking.

📞 *Contact:* +91-9368080535 | bookings@leafwalk.in
_Thank you! 🙏_`
}
