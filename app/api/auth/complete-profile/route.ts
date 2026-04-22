import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ensureCustomerAccount, getAuthenticatedCustomer, normalizeEmail, normalizePhone, setCustomerSessionCookie } from '@/lib/customer-auth'
import { parseJsonBody, sanitizeString } from '@/lib/security'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

const completeProfileSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: z.string().min(6).max(20),
  redirect: z.string().max(500).optional().or(z.literal('')),
  bookingId: z.string().uuid().optional().or(z.literal('')),
})

async function linkBookingToProfile(input: { bookingId: string; email: string; userId: string }) {
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
  const auth = await getAuthenticatedCustomer(request)
  if (!auth) {
    return NextResponse.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please sign in to complete your profile.' },
    }, { status: 401 })
  }

  const parsed = await parseJsonBody(request, completeProfileSchema)
  if (!parsed.success) {
    return parsed.response
  }

  try {
    const fullName = sanitizeString(parsed.data.full_name, 100)
    const phone = normalizePhone(parsed.data.phone)
    const bookingId = String(parsed.data.bookingId || '').trim() || null
    const email = normalizeEmail(auth.session.email || auth.user.email || null)

    if (!email) {
      return NextResponse.json({
        success: false,
        error: { code: 'EMAIL_REQUIRED', message: 'Authenticated email is required.' },
      }, { status: 400 })
    }

    const profile = await ensureCustomerAccount({
      email,
      name: fullName,
      phone,
      emailVerified: true,
      phoneVerified: false,
    })

    setCustomerSessionCookie({
      email,
      userId: profile.id,
    })

    if (bookingId) {
      await linkBookingToProfile({ bookingId, email, userId: profile.id })
    }

    return NextResponse.json({
      success: true,
      user: profile,
      has_profile: true,
      requires_profile_completion: false,
      message: 'Profile saved successfully',
    })
  } catch (error: any) {
    const code = error?.code || 'PROFILE_SAVE_FAILED'
    const status =
      code === 'BOOKING_NOT_FOUND' ? 404 :
      code === 'BOOKING_CLAIM_DENIED' ? 403 :
      500

    return NextResponse.json({
      success: false,
      error: { code, message: error.message || 'Could not save profile' },
    }, { status })
  }
}
