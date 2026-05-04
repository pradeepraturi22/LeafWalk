import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { isAdminRoomCategory } from '@/lib/room-categories'

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false

  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !user) return false

  const { data: profile } = await getSupabaseAdmin().from('users').select('role').eq('id', user.id).single() as any
  return Boolean(profile && ['admin', 'manager'].includes(profile.role))
}

async function saveDatePrice(input: {
  roomCategory: string
  rateType: string
  rateDate: string
  basePrice: number
  extraBedPrice: number
  childPrice: number
}) {
  const supabase = getSupabaseAdmin()
  const payload = {
    room_category: input.roomCategory,
    rate_type: input.rateType,
    rate_date: input.rateDate,
    base_price: input.basePrice,
    extra_bed_price: Math.max(0, input.extraBedPrice),
    child_price: Math.max(0, input.childPrice),
    season_id: null,
    meal_plan: null,
    price_per_night: null,
    child_5_12_price: Math.max(0, input.childPrice),
    updated_at: new Date().toISOString(),
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('room_rates')
    .select('id')
    .eq('room_category', input.roomCategory)
    .eq('rate_type', input.rateType)
    .eq('rate_date', input.rateDate) as any

  if (existingError) throw new Error(existingError.message)

  if (existingRows && existingRows.length > 0) {
    const ids = existingRows.map((row: any) => row.id)
    const { data, error } = await supabase
      .from('room_rates')
      .update(payload as any)
      .in('id', ids)
      .select()
      .limit(1)
      .single() as any

    if (error) throw new Error(error.message)
    return data
  }

  const { data, error } = await supabase
    .from('room_rates')
    .insert(payload as any)
    .select()
    .single() as any

  if (error) throw new Error(error.message)
  return data
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const roomCategory = String(body.room_category || '').trim().toLowerCase()
    const rateType = String(body.rate_type || 'lwweb').trim().toLowerCase()
    const rateDate = String(body.date || body.rate_date || '').trim()
    const basePrice = Number(body.base_price || 0)
    const extraBedPrice = Number(body.extra_bed_price || 0)
    const childPrice = Number(body.child_price || 0)

    if (!isAdminRoomCategory(roomCategory)) return NextResponse.json({ error: 'Valid room_category is required' }, { status: 400 })
    if (!['lwweb', 'ota'].includes(rateType)) return NextResponse.json({ error: 'rate_type must be lwweb or ota' }, { status: 400 })
    if (!rateDate) return NextResponse.json({ error: 'date is required' }, { status: 400 })
    if (!Number.isFinite(basePrice) || basePrice <= 0) return NextResponse.json({ error: 'base_price must be greater than 0' }, { status: 400 })

    const data = await saveDatePrice({
      roomCategory,
      rateType,
      rateDate,
      basePrice,
      extraBedPrice,
      childPrice,
    })

    return NextResponse.json({ success: true, room_rate: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
