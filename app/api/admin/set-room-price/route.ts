import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { isAdminRoomCategory } from '@/lib/room-categories'

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false

  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !user) return false

  const { data: profile } = await getSupabaseAdmin()
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single() as any

  return Boolean(profile && ['admin', 'manager'].includes(profile.role))
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const roomCategory = String(body.room_category || '').trim().toLowerCase()
    const rateDate = String(body.rate_date || body.date || '').trim()
    const rateType = String(body.rate_type || 'lwweb').trim().toLowerCase()
    const basePrice = Number(body.base_price || 0)
    const extraBedPrice = Number(body.extra_bed_price || 0)
    const childPrice = Number(body.child_price || 0)

    if (!isAdminRoomCategory(roomCategory)) {
      return NextResponse.json({ error: 'Valid room_category is required' }, { status: 400 })
    }
    if (!['lwweb', 'ota', 'b2c'].includes(rateType)) {
      return NextResponse.json({ error: 'rate_type must be lwweb, ota, or b2c' }, { status: 400 })
    }
    if (!rateDate) {
      return NextResponse.json({ error: 'rate_date is required' }, { status: 400 })
    }
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return NextResponse.json({ error: 'base_price must be greater than 0' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const payload = {
      room_category: roomCategory,
      rate_type: rateType,
      rate_date: rateDate,
      base_price: basePrice,
      extra_bed_price: Math.max(0, extraBedPrice),
      child_price: Math.max(0, childPrice),
    }

    const { data: existing } = await supabase
      .from('room_rates')
      .select('id')
      .eq('room_category', roomCategory)
      .eq('rate_type', rateType)
      .eq('rate_date', rateDate)
      .order('created_at', { ascending: false })
      .limit(1) as any

    const mutation = existing?.length
      ? supabase.from('room_rates').update(payload as any).eq('id', existing[0].id)
      : supabase.from('room_rates').insert(payload as any)

    const { data, error } = await mutation.select().single() as any
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, room_rate: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
