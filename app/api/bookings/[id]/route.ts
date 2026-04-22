import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedCustomer } from '@/lib/customer-auth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

function phoneMatches(customerPhone?: string | null, bookingPhone?: string | null) {
  const left = String(customerPhone || '').replace(/\D/g, '')
  const right = String(bookingPhone || '').replace(/\D/g, '')
  if (!left || !right) return false
  return left === right || left.endsWith(right) || right.endsWith(left)
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthenticatedCustomer(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('bookings')
      .select(`
        id, user_id, created_at, booking_number, invoice_number, guest_name, guest_email, guest_phone, guest_phone_country,
        room_id, check_in, check_out, nights, adults, rooms_booked, meal_plan,
        total_amount, subtotal, cgst, sgst, gst_total, advance_amount, balance_amount,
        booking_status, payment_status, payment_id, payment_method, razorpay_payment_id, special_requests,
        room:rooms(name, category, featured_image)
      `)
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

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
