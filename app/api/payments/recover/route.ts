import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedCustomer } from '@/lib/customer-auth'
import { reconcileBookingById } from '@/lib/payment-recovery'
import { parseJsonBody } from '@/lib/security'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

const recoverSchema = z.object({
  booking_id: z.string().uuid(),
})

function phoneMatches(customerPhone?: string | null, bookingPhone?: string | null) {
  const left = String(customerPhone || '').replace(/\D/g, '')
  const right = String(bookingPhone || '').replace(/\D/g, '')
  if (!left || !right) return false
  return left === right || left.endsWith(right) || right.endsWith(left)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedCustomer(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJsonBody(request, recoverSchema)
  if (!parsed.success) {
    return parsed.response
  }

  const { booking_id } = parsed.data
  const { data: booking } = await getSupabaseAdmin()
    .from('bookings')
    .select('id, user_id, guest_email, guest_phone, booking_status, payment_status')
    .eq('id', booking_id)
    .single() as any

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const emailMatches = Boolean(
    auth.user.email &&
    booking.guest_email &&
    String(auth.user.email).toLowerCase() === String(booking.guest_email).toLowerCase()
  )

  const isOwner =
    booking.user_id === auth.userId ||
    emailMatches ||
    phoneMatches(auth.user.phone, booking.guest_phone)

  if (!isOwner) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const result = await reconcileBookingById(booking_id)

  return NextResponse.json({
    success: result.ok,
    code: result.code,
    message: result.message,
    booking: result.booking ? {
      id: result.booking.id,
      booking_number: result.booking.booking_number,
      booking_status: result.booking.booking_status,
      payment_status: result.booking.payment_status,
      check_in: result.booking.check_in,
      check_out: result.booking.check_out,
    } : null,
  })
}
