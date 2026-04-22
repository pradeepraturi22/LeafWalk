import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedCustomer } from '@/lib/customer-auth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

function phoneMatches(customerPhone?: string | null, bookingPhone?: string | null) {
  const left = String(customerPhone || '').replace(/\D/g, '')
  const right = String(bookingPhone || '').replace(/\D/g, '')
  if (!left || !right) return false
  return left === right || left.endsWith(right) || right.endsWith(left)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedCustomer(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('bookings')
      .select('id, booking_number, user_id, guest_email, guest_phone, booking_status, payment_status, check_in, check_out, razorpay_order_id')
      .eq('id', id)
      .single() as any

    if (error || !data) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const emailMatches = Boolean(
      auth.user.email &&
      data.guest_email &&
      String(auth.user.email).toLowerCase() === String(data.guest_email).toLowerCase()
    )

    const isOwner =
      data.user_id === auth.userId ||
      emailMatches ||
      phoneMatches(auth.user.phone, data.guest_phone)

    if (!isOwner) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: data.id,
      booking_number: data.booking_number,
      booking_status: data.booking_status,
      payment_status: data.payment_status,
      check_in: data.check_in,
      check_out: data.check_out,
      can_retry_payment_check: Boolean(data.razorpay_order_id && data.payment_status !== 'fully_paid'),
      recovery_message: ['pending', 'payment_processing'].includes(String(data.payment_status || '').toLowerCase())
        ? 'If amount was deducted, please do not pay again immediately. We are verifying your payment.'
        : null,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
