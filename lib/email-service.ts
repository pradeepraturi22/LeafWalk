// lib/email-service.ts - Hostinger SMTP

import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_USER || 'bookings@leafwalk.in',
    pass: process.env.SMTP_PASS || '',
  },
})

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"LeafWalk Resort" <${process.env.SMTP_USER || 'bookings@leafwalk.in'}>`,
      to,
      subject,
      html,
    })
    console.log(`✅ Email sent to ${to}`)
    return true
  } catch (error) {
    console.error('❌ Email error:', error)
    return false
  }
}

// ─── EMAIL TEMPLATES ───────────────────────────────────────────────────────

export function generateBookingConfirmationEmail(booking: any): string {
  const checkIn = new Date(booking.check_in).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const checkOut = new Date(booking.check_out).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const mealLabels: Record<string, string> = { EP: 'Room Only', CP: 'With Breakfast', MAP: 'Breakfast + Dinner', AP: 'All Meals' }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0b0b0b,#1a1a1a);padding:40px 30px;text-align:center;">
          <h1 style="color:#c9a14a;margin:0;font-size:28px;letter-spacing:2px;">LeafWalk Resort</h1>
          <p style="color:#c9a14a;margin:8px 0 0;font-size:12px;letter-spacing:3px;">STAY IN LAP OF NATURE</p>
        </td></tr>

        <!-- Status Banner -->
        <tr><td style="background:#c9a14a;padding:16px 30px;text-align:center;">
          <p style="color:#000;margin:0;font-weight:bold;font-size:18px;">✓ Booking Confirmed!</p>
          <p style="color:#000;margin:4px 0 0;font-size:14px;">Booking Ref: ${booking.booking_number || booking.id?.slice(0,8).toUpperCase()}</p>
        </td></tr>

        <!-- Guest Info -->
        <tr><td style="padding:30px 30px 10px;">
          <p style="color:#333;font-size:16px;margin:0 0 20px;">Dear <strong>${booking.guest_name}</strong>,</p>
          <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 20px;">
            Your booking at LeafWalk Resort has been confirmed. We look forward to welcoming you!
          </p>
        </td></tr>

        <!-- Booking Details -->
        <tr><td style="padding:0 30px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:8px;overflow:hidden;">
            <tr><td colspan="2" style="background:#0b0b0b;padding:12px 20px;">
              <p style="color:#c9a14a;margin:0;font-weight:bold;font-size:14px;">STAY DETAILS</p>
            </td></tr>
            ${row('Room', booking.room?.name || 'N/A')}
            ${row('Check-in', checkIn + ' (after 3:00 PM)')}
            ${row('Check-out', checkOut + ' (by 11:00 AM)')}
            ${row('Nights', booking.nights)}
            ${row('Rooms', booking.rooms_booked)}
            ${row('Meal Plan', mealLabels[booking.meal_plan] || booking.meal_plan)}
            ${row('Adults', booking.adults)}
            ${booking.extra_beds > 0 ? row('Extra Beds', booking.extra_beds) : ''}
          </table>
        </td></tr>

        <!-- Payment Details -->
        <tr><td style="padding:0 30px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:8px;overflow:hidden;">
            <tr><td colspan="2" style="background:#0b0b0b;padding:12px 20px;">
              <p style="color:#c9a14a;margin:0;font-weight:bold;font-size:14px;">PAYMENT DETAILS</p>
            </td></tr>
            ${row('Total Amount', `₹${Number(booking.total_amount).toLocaleString()}`)}
            ${booking.advance_amount > 0 ? row('Advance Paid', `₹${Number(booking.advance_amount).toLocaleString()}`) : ''}
            ${booking.balance_amount > 0 ? row('Balance Due', `₹${Number(booking.balance_amount).toLocaleString()}`, '#c9a14a') : ''}
          </table>
        </td></tr>

        <!-- Policies -->
        <tr><td style="padding:0 30px 20px;">
          <div style="background:#fff8e1;border-left:4px solid #c9a14a;padding:15px;border-radius:4px;">
            <p style="color:#333;font-size:13px;margin:0 0 8px;font-weight:bold;">Important Information</p>
            <ul style="color:#555;font-size:12px;margin:0;padding-left:18px;line-height:1.8;">
              <li>Check-in: 3:00 PM – 7:00 PM | Check-out: 11:00 AM</li>
              <li>Valid government ID required at check-in</li>
              <li>Breakfast: 8:00 AM – 10:00 AM | Kitchen closes: 10:00 PM</li>
              ${booking.balance_amount > 0 ? `<li style="color:#e65100;">Balance amount ₹${Number(booking.balance_amount).toLocaleString()} due before 7 days of check-in</li>` : ''}
            </ul>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0b0b0b;padding:25px 30px;text-align:center;">
          <p style="color:#c9a14a;margin:0 0 8px;font-weight:bold;">LeafWalk Resort</p>
          <p style="color:#888;font-size:12px;margin:0 0 5px;">Vill- Banas, Narad Chatti, 38km from Barkot, Uttarkashi</p>
          <p style="color:#888;font-size:12px;margin:0 0 5px;">📞 +91-9368080535 | +91-8630227541</p>
          <p style="color:#888;font-size:12px;margin:0;">✉ info@leafwalk.in | 🌐 www.leafwalk.in</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function generateBalanceReminderEmail(booking: any, daysLeft: number): string {
  const checkIn = new Date(booking.check_in).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  return `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <table width="600" style="background:#fff;border-radius:12px;margin:auto;overflow:hidden;">
    <tr><td style="background:#0b0b0b;padding:30px;text-align:center;">
      <h2 style="color:#c9a14a;margin:0;">LeafWalk Resort</h2>
    </td></tr>
    <tr><td style="background:#e65100;padding:15px 30px;text-align:center;">
      <p style="color:#fff;margin:0;font-weight:bold;font-size:16px;">⚠ Balance Payment Reminder</p>
    </td></tr>
    <tr><td style="padding:30px;">
      <p style="color:#333;">Dear <strong>${booking.guest_name}</strong>,</p>
      <p style="color:#555;">This is a reminder that your balance payment of <strong style="color:#e65100;">₹${Number(booking.balance_amount).toLocaleString()}</strong> is due for your upcoming stay at LeafWalk Resort.</p>
      <p style="color:#555;">Your check-in is on <strong>${checkIn}</strong> (${daysLeft} days from now).</p>
      <p style="color:#555;">Please ensure payment is made before 7 days of check-in as per our reservation policy.</p>
      <p style="color:#555;">Booking Ref: <strong>${booking.booking_number}</strong></p>
      <p style="color:#888;font-size:12px;">Contact: +91-9368080535 | bookings@leafwalk.in</p>
    </td></tr>
  </table>
</body></html>`
}

export function generateTourOperatorBookingEmail(booking: any, operator: any): string {
  const checkIn = new Date(booking.check_in).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const checkOut = new Date(booking.check_out).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const commissionAmount = Math.round(Number(booking.total_amount) * (operator.commission_rate / 100))

  return `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <table width="600" style="background:#fff;border-radius:12px;margin:auto;overflow:hidden;">
    <tr><td style="background:#0b0b0b;padding:30px;text-align:center;">
      <h2 style="color:#c9a14a;margin:0;">LeafWalk Resort</h2>
      <p style="color:#888;margin:5px 0 0;font-size:12px;">B2B Booking Confirmation</p>
    </td></tr>
    <tr><td style="background:#c9a14a;padding:15px 30px;">
      <p style="color:#000;margin:0;font-weight:bold;">New Booking: ${booking.booking_number}</p>
    </td></tr>
    <tr><td style="padding:30px;">
      <p style="color:#333;">Dear <strong>${operator.contact_person}</strong> (${operator.company_name}),</p>
      <p style="color:#555;">A booking has been registered under your account. Details below:</p>
      <table width="100%" style="border-collapse:collapse;margin:15px 0;">
        ${bRow('Guest Name', booking.guest_name)}
        ${bRow('Room', booking.room?.name || 'N/A')}
        ${bRow('Check-in', checkIn)}
        ${bRow('Check-out', checkOut)}
        ${bRow('Nights', booking.nights)}
        ${bRow('Rooms', booking.rooms_booked)}
        ${bRow('Meal Plan', booking.meal_plan)}
        ${bRow('Total Amount', `₹${Number(booking.total_amount).toLocaleString()}`)}
        ${bRow('Your Commission', `₹${commissionAmount.toLocaleString()} (${operator.commission_rate}%)`)}
        ${bRow('Advance Received', `₹${Number(booking.advance_amount || 0).toLocaleString()}`)}
        ${booking.balance_amount > 0 ? bRow('Balance Due', `₹${Number(booking.balance_amount).toLocaleString()}`) : ''}
      </table>
      <p style="color:#888;font-size:12px;">For any queries: +91-9368080535 | bookings@leafwalk.in</p>
    </td></tr>
  </table>
</body></html>`
}

function row(label: string, value: any, color = '#333') {
  return `<tr>
    <td style="padding:10px 20px;border-bottom:1px solid #eee;color:#777;font-size:13px;width:45%;">${label}</td>
    <td style="padding:10px 20px;border-bottom:1px solid #eee;color:${color};font-size:13px;font-weight:bold;">${value}</td>
  </tr>`
}
function bRow(label: string, value: any) {
  return `<tr>
    <td style="padding:8px 0;color:#777;font-size:13px;border-bottom:1px solid #f0f0f0;">${label}</td>
    <td style="padding:8px 0;color:#333;font-size:13px;font-weight:bold;border-bottom:1px solid #f0f0f0;">${value}</td>
  </tr>`
}
