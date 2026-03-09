// app/api/admin/data/route.ts
// ALL endpoints require valid admin/manager JWT — uses service role for DB ops
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Shared auth guard ────────────────────────────────────────────────────────
async function requireAdmin(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  const { data: u } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
  if (!u || !['admin', 'manager'].includes(u.role)) return null
  return { userId: user.id, role: u.role }
}

const UNAUTH = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return UNAUTH

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  try {
    if (type === 'dashboard') {
      const { data: allBookings } = await supabaseAdmin.from('bookings').select('*')
      const { data: rooms } = await supabaseAdmin.from('rooms').select('*')
      const { data: recent } = await supabaseAdmin
        .from('bookings').select(`*, room:rooms(name)`)
        .order('created_at', { ascending: false }).limit(10)
      return NextResponse.json({ allBookings, rooms, recent })
    }

    if (type === 'bookings') {
      const { data, error } = await supabaseAdmin
        .from('bookings').select(`*, room:rooms(name, category)`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return NextResponse.json({ data })
    }

    if (type === 'booking-detail') {
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .select(`*, room:rooms(name, category, featured_image), tour_operator:tour_operators(company_name, contact_person, email, phone)`)
        .eq('id', id).single()
      if (error) return NextResponse.json({ error: error.message }, { status: 404 })
      return NextResponse.json({ data })
    }

    if (type === 'rooms') {
      const { data, error } = await supabaseAdmin
        .from('rooms').select('*').eq('is_active', true)
      if (error) throw error
      return NextResponse.json({ data })
    }

    if (type === 'operators') {
      const { data: operators, error } = await supabaseAdmin
        .from('tour_operators').select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      if (!operators?.length) return NextResponse.json({ data: [] })

      const { data: allBookings } = await supabaseAdmin
        .from('bookings')
        .select('tour_operator_id, total_amount')
        .not('tour_operator_id', 'is', null)
        .in('booking_status', ['confirmed', 'checked_in', 'checked_out'])

      const data = operators.map((op) => {
        const opBookings = allBookings?.filter(b => b.tour_operator_id === op.id) || []
        return {
          ...op,
          total_bookings: opBookings.length,
          total_revenue: opBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0)
        }
      })
      return NextResponse.json({ data })
    }

    if (type === 'rates') {
      const roomId = searchParams.get('room_id')
      const checkin = searchParams.get('check_in')
      const checkout = searchParams.get('check_out')
      if (!roomId || !checkin || !checkout) {
        return NextResponse.json({ error: 'room_id, check_in, check_out required' }, { status: 400 })
      }
      const { data: room } = await supabaseAdmin.from('rooms').select('category').eq('id', roomId).single()
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
      const { data: rates } = await supabaseAdmin
        .from('room_rates')
        .select('*, season:seasons(*)')
        .eq('room_category', room.category)
      return NextResponse.json({ data: rates || [] })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    console.error('admin/data GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return UNAUTH

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const body = await request.json()

  try {
    if (type === 'availability') {
      const { room_id, check_in, check_out, rooms_needed = 1 } = body
      if (!room_id || !check_in || !check_out) {
        return NextResponse.json({ error: 'room_id, check_in, check_out required' }, { status: 400 })
      }
      // Direct query (no RPC needed, service role bypasses RLS)
      const { data: room } = await supabaseAdmin.from('rooms').select('category, total_rooms').eq('id', room_id).single()
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
      const { data: catRooms } = await supabaseAdmin.from('rooms').select('id, total_rooms').eq('category', room.category).eq('is_active', true)
      const catTotal = catRooms?.reduce((s, r) => s + (r.total_rooms || 0), 0) || 0
      const catIds   = catRooms?.map(r => r.id) || []
      const { data: overlapping } = await supabaseAdmin.from('bookings').select('rooms_booked')
        .in('room_id', catIds).in('booking_status', ['pending', 'confirmed', 'hold', 'checked_in'])
        .lt('check_in', check_out).gt('check_out', check_in)
      const booked = overlapping?.reduce((s, b) => s + (b.rooms_booked || 1), 0) || 0
      const available = Math.max(0, catTotal - booked)
      return NextResponse.json({ available, available_rooms: available, total_rooms: catTotal, booked_rooms: booked, is_available: available >= (rooms_needed || 1) })
    }

    if (type === 'booking') {
      // Admin-created booking (walk-in, tour operator)
      const { room_items, ...bookingData } = body
      // Sanitize: remove any computed/generated fields
      delete bookingData.guests
      // Set created_by
      bookingData.created_by = admin.userId
      const { data, error } = await supabaseAdmin
        .from('bookings').insert(bookingData).select('id, booking_number').single()
      if (error) throw error
      if (room_items?.length && data?.id) {
        await supabaseAdmin.from('booking_room_items').insert(
          room_items.map((item: any) => ({ ...item, booking_id: data.id }))
        )
      }
      return NextResponse.json({ success: true, ...data })
    }

    if (type === 'operator') {
      const { error } = await supabaseAdmin.from('tour_operators').insert(body)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    console.error('admin/data POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return UNAUTH

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const id   = searchParams.get('id')
  const body = await request.json()

  try {
    if (type === 'booking-status') {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const updateData: Record<string, any> = {
        booking_status: body.status,
        last_modified_by: admin.userId,
        last_status_change: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (body.checked_in_at)  updateData.checked_in_at  = body.checked_in_at
      if (body.checked_out_at) updateData.checked_out_at = body.checked_out_at
      if (body.confirmed_at)   updateData.confirmed_at   = body.confirmed_at
      if (body.cancellation_reason) updateData.cancellation_reason = body.cancellation_reason
      if (body.payment_method)  updateData.payment_method  = body.payment_method
      if (body.payment_status)  updateData.payment_status  = body.payment_status
      if (body.advance_amount  !== undefined) updateData.advance_amount  = body.advance_amount
      if (body.balance_amount  !== undefined) updateData.balance_amount  = body.balance_amount
      if (body.advance_paid_at) updateData.advance_paid_at = body.advance_paid_at
      if (body.admin_notes)     updateData.admin_notes     = body.admin_notes
      const { error } = await supabaseAdmin.from('bookings').update(updateData).eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (type === 'operator') {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const { error } = await supabaseAdmin.from('tour_operators').update(body).eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return UNAUTH

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const id   = searchParams.get('id')

  try {
    if (type === 'operator') {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      // Don't actually delete — soft deactivate
      const { error } = await supabaseAdmin.from('tour_operators').update({ status: 'inactive' }).eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
