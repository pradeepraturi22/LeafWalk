// app/api/booking-status/route.ts
// Public endpoint — returns booking details for confirmation page
// Booking UUID (v4) is unguessable — safe for public read
// Does NOT expose sensitive admin notes or payment signatures

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        id, booking_number, guest_name, guest_email, guest_phone,
        check_in, check_out, nights, adults, rooms_booked, meal_plan,
        total_amount, advance_amount, balance_amount,
        booking_status, payment_status, razorpay_payment_id,
        special_requests,
        room:rooms(name, category, featured_image)
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Mask phone for security — show last 4 digits only
    const maskedPhone = data.guest_phone
      ? data.guest_phone.replace(/(\d{6})(\d{4})$/, '******$2')
      : null

    return NextResponse.json({ ...data, guest_phone: maskedPhone })
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
