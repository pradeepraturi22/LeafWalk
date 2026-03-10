// lib/notification-service.ts
import { sendEmail, generateBookingConfirmationEmail } from './email-service'
import { sendSMS, bookingConfirmationSMS } from './sms-service'
import { sendWhatsApp, bookingConfirmationWhatsApp } from './whatsapp-service'
import { supabase } from './supabaseClient'

export interface NotificationOptions {
  email?: boolean
  sms?: boolean
  whatsapp?: boolean
}

export async function sendBookingNotifications(
  booking: any,
  options: NotificationOptions = { email: true, sms: true, whatsapp: true }
) {
  const results = {
    email: false,
    sms: false,
    whatsapp: false,
    errors: [] as string[]
  }

  // Send Email
  if (options.email && booking.guest_email) {
    try {
      const emailHtml = generateBookingConfirmationEmail(booking)
      await sendEmail({
        to: booking.guest_email,
        subject: `Booking Confirmed - ${booking.invoice_number || 'Leafwalk Resort'}`,
        html: emailHtml
      })
      results.email = true
      await logNotification(booking.id, 'email', booking.guest_email, 'sent')
    } catch (error: any) {
      results.errors.push(`Email: ${error.message}`)
      await logNotification(booking.id, 'email', booking.guest_email, 'failed', error.message)
    }
  }

  // Send SMS
  if (options.sms && booking.guest_phone) {
    try {
      const smsMessage = bookingConfirmationSMS(booking)
      await sendSMS(booking.guest_phone, smsMessage)
      results.sms = true
      await logNotification(booking.id, 'sms', booking.guest_phone, 'sent')
    } catch (error: any) {
      results.errors.push(`SMS: ${error.message}`)
      await logNotification(booking.id, 'sms', booking.guest_phone, 'failed', error.message)
    }
  }

  // Send WhatsApp
  if (options.whatsapp && booking.guest_phone) {
    try {
      const whatsappMessage = bookingConfirmationWhatsApp(booking)
      await sendWhatsApp(booking.guest_phone, whatsappMessage)
      results.whatsapp = true
      await logNotification(booking.id, 'whatsapp', booking.guest_phone, 'sent')
    } catch (error: any) {
      results.errors.push(`WhatsApp: ${error.message}`)
      await logNotification(booking.id, 'whatsapp', booking.guest_phone, 'failed', error.message)
    }
  }

  return results
}

async function logNotification(
  bookingId: string,
  type: 'email' | 'sms' | 'whatsapp',
  recipient: string,
  status: 'sent' | 'failed',
  errorMessage?: string
) {
  try {
    await supabase.from('notification_logs').insert({
      booking_id: bookingId,
      type,
      recipient,
      status,
      error_message: errorMessage,
      sent_at: status === 'sent' ? new Date().toISOString() : null
    })
  } catch (error) {
    console.error('Failed to log notification:', error)
  }
}
