import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getExistingCustomerProfile, normalizeEmail, normalizePhone, setCustomerSessionCookie } from '@/lib/customer-auth'
import { verifyEmailOtp } from '@/lib/otp'
import { parseJsonBody, sanitizeString } from '@/lib/security'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  bookingId: z.string().uuid().optional().or(z.literal('')),
  purpose: z.enum(['login', 'booking_claim', 'email_fallback']).optional(),
})

async function linkBookingToVerifiedCustomer(input: { bookingId: string; email: string; userId: string }) {
  const { data: booking, error: bookingError } = await getSupabaseAdmin()
    .from('bookings')
    .select('id, guest_email, user_id')
    .eq('id', input.bookingId)
    .maybeSingle() as any

  if (bookingError || !booking) {
    throw Object.assign(new Error('Booking not found'), { code: 'BOOKING_NOT_FOUND' })
  }

  const bookingEmail = String(booking.guest_email || '').trim().toLowerCase()
  if (!bookingEmail || bookingEmail !== input.email) {
    throw Object.assign(new Error('Booking could not be linked to this account'), { code: 'BOOKING_CLAIM_DENIED' })
  }

  if (booking.user_id && booking.user_id !== input.userId) {
    throw Object.assign(new Error('Booking is already linked to another account'), { code: 'BOOKING_CLAIM_DENIED' })
  }

  const { error } = await getSupabaseAdmin()
    .from('bookings')
    .update({
      user_id: input.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.bookingId)
    .or(`user_id.is.null,user_id.eq.${input.userId}`)

  if (error) {
    throw Object.assign(new Error(error.message || 'Could not link booking to user'), { code: 'BOOKING_LINK_FAILED' })
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, verifyOtpSchema)
  if (!parsed.success) {
    return parsed.response
  }

  try {
    const body = parsed.data
    const email = normalizeEmail(body.email)
    const otp = sanitizeString(String(body.otp || '').trim(), 6)
    const bookingId = String(body.bookingId || '').trim() || null

    if (!email || otp.length !== 6) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and valid 6-digit OTP are required' },
      }, { status: 400 })
    }

    await verifyEmailOtp(email, otp)

    const profile = await getExistingCustomerProfile({ email })

    if (bookingId && profile?.id) {
      await linkBookingToVerifiedCustomer({ bookingId, email, userId: profile.id })
    }

    setCustomerSessionCookie({
      email,
      userId: profile?.id || null,
    })

    return NextResponse.json({
      success: true,
      user: profile || {
        id: `pending:${email}`,
        email,
        phone: normalizePhone(null),
        name: null,
        role: 'user',
        email_verified: true,
        phone_verified: false,
      },
      has_profile: Boolean(profile),
      requires_profile_completion: !profile,
      profile_created: false,
    })
  } catch (error: any) {
    const code = error?.code || 'OTP_VERIFY_FAILED'
    const status =
      code === 'VALIDATION_ERROR' ? 400 :
      code === 'OTP_EXPIRED' ? 410 :
      code === 'INVALID_OTP' ? 401 :
      code === 'TOO_MANY_ATTEMPTS' ? 429 :
      code === 'RATE_LIMITED' ? 429 :
      code === 'BOOKING_NOT_FOUND' ? 404 :
      code === 'BOOKING_CLAIM_DENIED' ? 403 :
      500

    return NextResponse.json({
      success: false,
      error: { code, message: error.message || 'OTP verification failed' },
    }, { status })
  }
}
