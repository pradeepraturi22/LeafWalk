import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { getStayTariffBreakdown, normalizeTariffRate, PUBLIC_WEB_RATE_TYPE } from '@/lib/public-tariff'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('room_id')
    const checkIn = searchParams.get('check_in')
    const checkOut = searchParams.get('check_out')
    const mealPlan = searchParams.get('meal_plan') || 'EP'

    if (!roomId || !checkIn || !checkOut) {
      return NextResponse.json({ error: 'room_id, check_in, and check_out are required' }, { status: 400 })
    }
    if (checkOut <= checkIn) {
      return NextResponse.json({ error: 'check_out must be after check_in' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, category, name')
      .eq('id', roomId)
      .single() as any

    if (roomError || !room?.category) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const { data: rateRows, error: rateError } = await supabase
      .from('room_rates')
      .select('season_id,specific_date,is_date_override,meal_plan,rate_type,price_per_night,extra_bed_price,child_5_12_price,season:seasons(id,name,start_month,start_day,end_month,end_day)')
      .eq('room_category', room.category)
      .eq('rate_type', PUBLIC_WEB_RATE_TYPE)
      .order('created_at', { ascending: false }) as any

    if (rateError) {
      return NextResponse.json({ error: 'Could not load tariffs' }, { status: 500 })
    }

    const breakdown = getStayTariffBreakdown({
      checkIn,
      checkOut,
      mealPlan,
      rateType: PUBLIC_WEB_RATE_TYPE,
      rates: (rateRows || []).map(normalizeTariffRate),
      fallbackPrice: 0,
    })

    if (!breakdown.nights.length || breakdown.nights.some((night) => night.room_price <= 0)) {
      return NextResponse.json({ error: 'No tariff found for the selected dates' }, { status: 404 })
    }

    return NextResponse.json({
      room_id: roomId,
      room_name: room.name,
      room_category: room.category,
      meal_plan: mealPlan,
      rate_type: PUBLIC_WEB_RATE_TYPE,
      check_in: checkIn,
      check_out: checkOut,
      nights_count: breakdown.nights.length,
      total_price: Math.round(breakdown.roomSubtotalPerRoom * 100) / 100,
      subtotal_per_room: Math.round(breakdown.roomSubtotalPerRoom * 100) / 100,
      nights: breakdown.nights.map((night) => ({
        date: night.date,
        price: night.room_price,
        extra_bed_price: night.extra_bed_price,
        child_price: night.child_price,
      })),
      nightly_breakdown: breakdown.nights,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
