// app/api/bookings/create/route.ts
// Uses service role (getSupabaseAdmin()) to bypass RLS — this is the CORRECT approach
// Never expose service role key on client side

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      user_id,
      guest_name, guest_email, guest_phone, guest_phone_country,
      room_id, check_in, check_out, nights,
      rooms_booked, adults, children_below_5, children_5_to_12, children_above_12, extra_beds,
      meal_plan, rate_per_room_per_night, extra_bed_rate_per_night, child_rate_per_night,
      booking_source, special_requests,
      promo_code, discount_amount, discount_percent, discount_reason,
    } = body

    // Required field validation
    if (!room_id || !check_in || !check_out || !nights || !guest_name || !guest_phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!rate_per_room_per_night || rate_per_room_per_night <= 0) {
      return NextResponse.json({ error: 'Invalid room rate' }, { status: 400 })
    }

    const phoneDigits = String(guest_phone).replace(/\D/g, '')
    if (phoneDigits.length < 6 || phoneDigits.length > 15) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    // Room check
    const { data: room, error: roomErr } = await getSupabaseAdmin()
      .from('rooms').select('id,is_active,total_rooms').eq('id', room_id).single() as any
    if (roomErr || !room?.is_active) {
      return NextResponse.json({ error: 'Room not found or inactive' }, { status: 404 })
    }

    // Availability double-check at server side
    const { data: existing } = await getSupabaseAdmin()
      .from('bookings').select('rooms_booked')
      .eq('room_id', room_id)
      .in('booking_status', ['pending', 'confirmed', 'hold', 'checked_in'])
      .lt('check_in', check_out).gt('check_out', check_in)

    const bookedCount = existing?.reduce((s, b) => s + (b.rooms_booked || 1), 0) || 0
    const availCount  = room.total_rooms - bookedCount
    const numRooms    = rooms_booked || 1

    if (availCount < numRooms) {
      return NextResponse.json({ error: `Only ${availCount} room(s) available for selected dates` }, { status: 409 })
    }

    // Financial calc
    const r        = Number(rate_per_room_per_night)
    const xbRate   = Number(extra_bed_rate_per_night || 0)
    const xbCount  = Number(extra_beds || 0)
    const n        = Number(nights)
    const nr       = Number(numRooms)
    const base     = r * n * nr
    const xbAmt    = xbRate * n * xbCount
    const sub      = base + xbAmt
    const disc     = Number(discount_amount || 0)
    const afterDisc = Math.max(0, sub - disc)
    const cgst     = Math.round(afterDisc * 0.06)
    const sgst     = Math.round(afterDisc * 0.06)
    const total    = afterDisc + cgst + sgst

    const { data: booking, error: bErr } = await getSupabaseAdmin()
      .from('bookings').insert({
        guest_name:               String(guest_name).trim().slice(0, 200),
        guest_email:              guest_email || null,
        guest_phone:              phoneDigits,
        guest_phone_country:      guest_phone_country || '+91',
        room_id,
        check_in,
        check_out,
        nights: n,
        adults: Number(adults || 2),
        rooms_booked: nr,
        extra_beds: xbCount,
        children_below_5:  Number(children_below_5  || 0),
        children_5_to_12:  Number(children_5_to_12  || 0),
        children_above_12: Number(children_above_12 || 0),
        meal_plan:                meal_plan || 'CP',
        rate_per_room_per_night:  r,
        extra_bed_rate_per_night: xbRate,
        child_rate_per_night:     Number(child_rate_per_night || 0),
        subtotal:    sub,
        discount_amount:  disc,
        discount_percent: Number(discount_percent || 0),
        discount_reason:  discount_reason || null,
        promo_code:       promo_code || null,
        cgst,
        sgst,
        gst_total:   cgst + sgst,
        total_amount: total,
        advance_amount: total,
        balance_amount: 0,
        user_id:         user_id || null,
        booking_source:  booking_source || 'website',
        booking_status:  'pending',
        payment_status:  'pending',
        special_requests: special_requests || null,
      }).select().single() as any

    if (bErr || !booking) {
      console.error('Booking insert error:', bErr)
      return NextResponse.json({ error: bErr?.message || 'Failed to create booking' }, { status: 500 })
    }

    return NextResponse.json({ booking_id: booking.id, total_amount: total })
  } catch (err: any) {
    console.error('Booking create error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}