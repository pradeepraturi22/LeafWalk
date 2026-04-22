import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

async function requireAdmin(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null

  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !user) return null

  const { data: profile } = await getSupabaseAdmin()
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single() as any

  if (!profile || !['admin', 'manager'].includes(profile.role)) return null
  return { userId: user.id, role: profile.role }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const roomCategory = String(body.room_category || '').trim().toLowerCase()
    const mealPlan = String(body.meal_plan || '').trim().toUpperCase()
    const specificDate = String(body.specific_date || body.date || '').trim()
    const price = Number(body.price || 0)
    const extraBedPrice = Number(body.extra_bed_price || 0)
    const childPrice = Number(body.child_price || 0)

    if (!['deluxe', 'premium'].includes(roomCategory)) {
      return NextResponse.json({ error: 'Valid room_category is required' }, { status: 400 })
    }
    if (!['EP', 'CP', 'MAP', 'AP'].includes(mealPlan)) {
      return NextResponse.json({ error: 'Valid meal_plan is required' }, { status: 400 })
    }
    if (!specificDate) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    }
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'price must be greater than 0' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const payload = {
      room_category: roomCategory,
      meal_plan: mealPlan,
      rate_type: 'lwweb',
      price_per_night: price,
      extra_bed_price: Math.max(0, extraBedPrice),
      child_5_12_price: Math.max(0, childPrice),
      specific_date: specificDate,
      is_date_override: true,
      season_id: null,
    }

    const { data: existing } = await supabase
      .from('room_rates')
      .select('id')
      .eq('room_category', roomCategory)
      .eq('meal_plan', mealPlan)
      .eq('rate_type', 'lwweb')
      .eq('specific_date', specificDate)
      .eq('is_date_override', true)
      .order('created_at', { ascending: false })
      .limit(1) as any

    const mutation = existing?.length
      ? supabase.from('room_rates').update(payload as any).eq('id', existing[0].id)
      : supabase.from('room_rates').insert(payload as any)

    const { data, error } = await mutation.select().single() as any

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      tariff: data,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
