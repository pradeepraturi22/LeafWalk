// app/api/check-availability/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { supabaseAdmin } from '@/lib/supabaseServer'

export async function POST(req: Request) {
  try {
    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { roomId, checkIn, checkOut } = body as Record<string, unknown>

    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 })
    }
    if (!checkIn || !checkOut || typeof checkIn !== 'string' || typeof checkOut !== 'string') {
      return NextResponse.json({ error: 'Dates required' }, { status: 400 })
    }

    // Convert to date strings (handle both 'YYYY-MM-DD' and ISO datetime)
    const ciStr = new Date(checkIn).toISOString().split('T')[0]
    const coStr = new Date(checkOut).toISOString().split('T')[0]

    if (ciStr >= coStr) {
      return NextResponse.json({ error: 'Check-out must be after check-in' }, { status: 400 })
    }

    // Get room + category (public data — anon client fine)
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('id, category, is_active')
      .eq('id', roomId)
      .single()

    if (roomErr || !room) {
      console.error('Room fetch error:', roomErr?.message)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    if (!room.is_active) {
      return NextResponse.json({ error: 'Room not available' }, { status: 404 })
    }

    // Get ALL rooms in same category with total_rooms (public data)
    const { data: catRooms, error: catErr } = await supabase
      .from('rooms')
      .select('id, total_rooms')
      .eq('category', room.category)
      .eq('is_active', true)

    if (catErr || !catRooms?.length) {
      return NextResponse.json({ error: 'Could not fetch room data' }, { status: 500 })
    }

    const catRoomIds    = catRooms.map(r => r.id)
    const categoryTotal = catRooms.reduce((s, r) => s + (Number(r.total_rooms) || 0), 0)

    // Count overlapping bookings using supabaseAdmin (bypasses RLS — CORRECT count)
    const { data: overlapping, error: bookErr } = await supabaseAdmin
      .from('bookings')
      .select('rooms_booked')
      .in('room_id', catRoomIds)
      .in('booking_status', ['pending', 'confirmed', 'hold', 'checked_in'])
      .lt('check_in', coStr)
      .gt('check_out', ciStr)

    if (bookErr) {
      console.error('Bookings count error:', bookErr.message)
      return NextResponse.json({ error: 'Could not check availability' }, { status: 500 })
    }

    const booked    = (overlapping || []).reduce((s, b) => s + (Number(b.rooms_booked) || 1), 0)
    const available = Math.max(0, categoryTotal - booked)

    return NextResponse.json({
      availableRooms: available,
      totalRooms:     categoryTotal,
      bookedRooms:    booked,
      category:       room.category,
    })

  } catch (err: any) {
    console.error('Availability check error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}