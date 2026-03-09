// lib/sms-service.ts - MSG91 SMS Service

export async function sendSMS(phone: string, message: string): Promise<boolean> {
  const apiKey = process.env.MSG91_API_KEY
  const senderId = process.env.MSG91_SENDER_ID || 'LFWALK'

  if (!apiKey) {
    console.log('📲 SMS (Demo):', phone, '-', message)
    return true
  }

  try {
    const response = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'authkey': apiKey },
      body: JSON.stringify({
        template_id: process.env.MSG91_TEMPLATE_ID,
        sender: senderId,
        short_url: '0',
        mobiles: `91${phone}`,
        VAR1: message,
      })
    })
    const data = await response.json()
    console.log('SMS response:', data)
    return data.type === 'success'
  } catch (error) {
    console.error('SMS error:', error)
    return false
  }
}

// SMS Templates
export function bookingConfirmationSMS(booking: any): string {
  return `Dear ${booking.guest_name}, your booking at LeafWalk Resort is CONFIRMED! Ref: ${booking.booking_number}. Check-in: ${booking.check_in}. Total: Rs.${booking.total_amount}. Ph: +91-9368080535`
}

export function balanceReminderSMS(booking: any, daysLeft: number): string {
  return `Reminder: Balance payment Rs.${booking.balance_amount} due for your LeafWalk booking ${booking.booking_number}. Check-in in ${daysLeft} days. Pay before 7 days of arrival. Ph: +91-9368080535`
}

export function checkInReminderSMS(booking: any): string {
  return `Welcome to LeafWalk Resort! Your check-in is TOMORROW (${booking.check_in}). Check-in time: 3PM-7PM. Carry valid ID. Ref: ${booking.booking_number}. Ph: +91-9368080535`
}
