// app/api/admin/bookings/route.ts
// Fetches ALL bookings for admin panel — uses service role to bypass RLS
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    // Verify caller is admin/manager
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    const { data: u } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single() as any
    if (!u || !['admin', 'manager'].includes(u.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch ALL bookings with full details
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        id, booking_number, guest_name, guest_email, guest_phone,
        room_id, check_in, check_out, nights, adults, rooms_booked,
        total_amount, advance_amount, balance_amount,
        booking_status, payment_status, meal_plan,
        promo_code, discount_amount, razorpay_payment_id,
        special_requests, created_at, booking_source,
        room:rooms(name, category),
        tour_operator:tour_operators(company_name)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Admin bookings fetch error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ bookings: data || [] })
  } catch (err: any) {
    console.error('Admin bookings route error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — update booking status (confirm, cancel, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    const { data: u } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
    if (!u || !['admin', 'manager'].includes(u.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { booking_id, ...updates } = body

    if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

    // Whitelist allowed update fields
    const allowed = ['booking_status', 'payment_status', 'special_requests', 'advance_amount', 'balance_amount']
    const safeUpdates: Record<string, any> = {}
    for (const key of allowed) {
      if (key in updates) safeUpdates[key] = updates[key]
    }

    const { error } = await supabaseAdmin
      .from('bookings').update(safeUpdates).eq('id', booking_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
