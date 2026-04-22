import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedCustomer } from '@/lib/customer-auth'
import { validateBookingStatusChange } from '@/lib/booking-status'
import { parseJsonBody } from '@/lib/security'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

const cancelSchema = z.object({
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

  const parsed = await parseJsonBody(request, cancelSchema)
  if (!parsed.success) {
    return parsed.response
  }

  try {
    const { booking_id } = parsed.data

    const { data: booking, error } = await getSupabaseAdmin()
      .from('bookings')
      .select('id, user_id, guest_email, guest_phone, booking_status, payment_status, total_amount, advance_amount, balance_amount')
      .eq('id', booking_id)
      .single() as any

    if (error || !booking) {
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

    if (['cancelled', 'checked_in', 'checked_out', 'completed'].includes(String(booking.booking_status || '').toLowerCase())) {
      return NextResponse.json({ error: 'Booking cannot be cancelled' }, { status: 400 })
    }

    const transitionCheck = validateBookingStatusChange({
      currentStatus: booking.booking_status,
      nextStatus: 'cancelled',
      bookingTotal: booking.total_amount,
      advanceAmount: booking.advance_amount,
      balanceAmount: booking.balance_amount,
      cancellationReason: 'Cancelled by guest',
    })

    if (!transitionCheck.valid) {
      return NextResponse.json({ error: transitionCheck.error }, { status: 400 })
    }

    const { data: updatedBooking, error: updateError } = await getSupabaseAdmin()
      .from('bookings')
      .update({
        booking_status: 'cancelled',
        payment_status:
          booking.payment_status === 'fully_paid'
            ? booking.payment_status
            : booking.payment_status === 'payment_processing'
              ? 'payment_processing'
              : 'failed',
        cancellation_reason: 'Cancelled by guest',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', booking_id)
      .eq('booking_status', booking.booking_status)
      .select('id, booking_status')
      .maybeSingle() as any

    if (updateError) {
      return NextResponse.json({ error: updateError.message || 'Failed to cancel booking' }, { status: 500 })
    }

    if (!updatedBooking) {
      return NextResponse.json({ error: 'Booking status changed. Please refresh and try again.' }, { status: 409 })
    }

    return NextResponse.json({ ok: true, booking_status: updatedBooking.booking_status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to cancel booking' }, { status: 500 })
  }
}
