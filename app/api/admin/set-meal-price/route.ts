import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

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
    const mealType = String(body.meal_type || '').trim().toLowerCase()
    const price = Number(body.price || 0)
    const applicableFrom = body.applicable_from || null
    const applicableTo = body.applicable_to || null

    if (!['breakfast', 'lunch', 'dinner'].includes(mealType)) {
      return NextResponse.json({ error: 'Valid meal_type is required' }, { status: 400 })
    }
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'price must be 0 or greater' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const payload = {
      meal_type: mealType,
      price,
      applicable_from: applicableFrom,
      applicable_to: applicableTo,
    }

    const { data: existing } = await supabase
      .from('meal_prices')
      .select('id')
      .eq('meal_type', mealType)
      .is('applicable_from', applicableFrom)
      .is('applicable_to', applicableTo)
      .order('created_at', { ascending: false })
      .limit(1) as any

    const mutation = existing?.length
      ? supabase.from('meal_prices').update(payload as any).eq('id', existing[0].id)
      : supabase.from('meal_prices').insert(payload as any)

    const { data, error } = await mutation.select().single() as any
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, meal_price: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
