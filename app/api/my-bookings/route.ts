import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedCustomer } from '@/lib/customer-auth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedCustomer(request)
  if (!auth) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Please sign in to view bookings',
      },
    }, { status: 401 })
  }

  const user = auth.user
  const phone = user.phone ? String(user.phone).replace(/\D/g, '') : null
  const email = user.email ? String(user.email).trim().toLowerCase() : null

  if (!auth.userId && !email && !phone) {
    return NextResponse.json({
      success: true,
      user,
      bookings: [],
    })
  }

  const bookingSelect = `
    user_id,
    id, booking_number, invoice_number, check_in, check_out, nights, rooms_booked, adults, meal_plan,
    total_amount, subtotal, cgst, sgst, gst_total, payment_id, discount_amount, promo_code, booking_status, payment_status,
    guest_name, guest_email, guest_phone, razorpay_payment_id, created_at, special_requests,
    room:rooms(name, category, featured_image, slug)
  `

  const queries = []
  if (auth.userId) {
    queries.push(getSupabaseAdmin().from('bookings').select(bookingSelect).eq('user_id', auth.userId).order('created_at', { ascending: false }) as any)
  }
  if (email) {
    queries.push(getSupabaseAdmin().from('bookings').select(bookingSelect).eq('guest_email', email).order('created_at', { ascending: false }) as any)
  }
  if (phone) {
    queries.push(getSupabaseAdmin().from('bookings').select(bookingSelect).eq('guest_phone', phone).order('created_at', { ascending: false }) as any)
  }

  const results = await Promise.all(queries)
  const error = results.find((result: any) => result.error)?.error
  const data = results.flatMap((result: any) => result.data || [])

  if (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'BOOKINGS_FETCH_FAILED',
        message: error.message || 'Could not load bookings',
      },
    }, { status: 500 })
  }

  const filtered = (data || []).filter((booking: any) => {
    const bookingPhone = String(booking.guest_phone || '').replace(/\D/g, '')
    const phoneMatches = phone && bookingPhone
      ? bookingPhone === phone || phone.endsWith(bookingPhone) || bookingPhone.endsWith(phone)
      : false

    return (
      booking.user_id === auth.userId ||
      (user.email && booking.guest_email && String(booking.guest_email).toLowerCase() === String(user.email).toLowerCase()) ||
      phoneMatches
    )
  })

  const unique = Array.from(new Map(filtered.map((booking: any) => [booking.id, booking])).values())

  return NextResponse.json({
    success: true,
    user,
    bookings: unique,
  })
}
