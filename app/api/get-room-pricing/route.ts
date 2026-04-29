import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { buildLwwebPricingMatrix, buildMealUnitTotals, getDateRange, type DateWiseRoomRate, type MealPriceRow } from '@/lib/lwweb-date-pricing'
import { getStayTariffBreakdown, normalizeTariffRate, PUBLIC_WEB_RATE_TYPE } from '@/lib/public-tariff'

type PricingInput = {
  room_category?: string
  room_id?: string
  checkInDate?: string
  checkOutDate?: string
  adults?: number
}

function getApplicableMealRows(rows: MealPriceRow[], mealType: 'breakfast' | 'lunch' | 'dinner', date: string) {
  return rows
    .filter((row) => row.meal_type === mealType)
    .filter((row) => (!row.applicable_from || row.applicable_from <= date) && (!row.applicable_to || row.applicable_to >= date))
    .sort((a, b) => String(b.applicable_from || '').localeCompare(String(a.applicable_from || '')))
}

function buildMatrixFromLegacyRates({
  checkInDate,
  checkOutDate,
  normalizedRates,
  mealPriceRows,
}: {
  checkInDate: string
  checkOutDate: string
  normalizedRates: ReturnType<typeof normalizeTariffRate>[]
  mealPriceRows: MealPriceRow[]
}) {
  const epBreakdown = getStayTariffBreakdown({
    checkIn: checkInDate,
    checkOut: checkOutDate,
    mealPlan: 'EP',
    rateType: PUBLIC_WEB_RATE_TYPE,
    rates: normalizedRates,
    fallbackPrice: 0,
  })
  const cpBreakdown = getStayTariffBreakdown({
    checkIn: checkInDate,
    checkOut: checkOutDate,
    mealPlan: 'CP',
    rateType: PUBLIC_WEB_RATE_TYPE,
    rates: normalizedRates,
    fallbackPrice: 0,
  })
  const mapBreakdown = getStayTariffBreakdown({
    checkIn: checkInDate,
    checkOut: checkOutDate,
    mealPlan: 'MAP',
    rateType: PUBLIC_WEB_RATE_TYPE,
    rates: normalizedRates,
    fallbackPrice: 0,
  })
  const apBreakdown = getStayTariffBreakdown({
    checkIn: checkInDate,
    checkOut: checkOutDate,
    mealPlan: 'AP',
    rateType: PUBLIC_WEB_RATE_TYPE,
    rates: normalizedRates,
    fallbackPrice: 0,
  })

  const nights = getDateRange(checkInDate, checkOutDate).map((date, index) => {
    const epNight = epBreakdown.nights[index]
    const cpNight = cpBreakdown.nights[index]
    const mapNight = mapBreakdown.nights[index]
    const apNight = apBreakdown.nights[index]

    const breakfastRows = getApplicableMealRows(mealPriceRows, 'breakfast', date)
    const lunchRows = getApplicableMealRows(mealPriceRows, 'lunch', date)
    const dinnerRows = getApplicableMealRows(mealPriceRows, 'dinner', date)

    const breakfast = Number(breakfastRows[0]?.price || 0)
    const lunch = Number(lunchRows[0]?.price || 0)
    const dinner = Number(dinnerRows[0]?.price || 0)

    const ep = epNight?.room_price || 0
    const cpFromMeals = ep + breakfast
    const mapFromMeals = ep + breakfast + dinner
    const apFromMeals = ep + breakfast + lunch + dinner

    return {
      date,
      base_price: ep,
      extra_bed_price: epNight?.extra_bed_price || cpNight?.extra_bed_price || mapNight?.extra_bed_price || apNight?.extra_bed_price || 0,
      child_price: epNight?.child_price || cpNight?.child_price || mapNight?.child_price || apNight?.child_price || 0,
      EP: ep,
      CP: breakfastRows.length ? cpFromMeals : (cpNight?.room_price || cpFromMeals),
      MAP: (breakfastRows.length || dinnerRows.length) ? mapFromMeals : (mapNight?.room_price || mapFromMeals),
      AP: (breakfastRows.length || lunchRows.length || dinnerRows.length) ? apFromMeals : (apNight?.room_price || apNight?.room_price || mapFromMeals),
    }
  })

  const total = nights.reduce(
    (sum, night) => ({
      EP: sum.EP + night.EP,
      CP: sum.CP + night.CP,
      MAP: sum.MAP + night.MAP,
      AP: sum.AP + night.AP,
    }),
    { EP: 0, CP: 0, MAP: 0, AP: 0 }
  )

  return { nights, total }
}

async function resolveCategory(input: PricingInput) {
  if (input.room_category) return { room: null as any, roomCategory: input.room_category.trim().toLowerCase() }
  if (!input.room_id) return { room: null, roomCategory: '' }

  const { data: room, error } = await getSupabaseAdmin()
    .from('rooms')
    .select('id, name, category')
    .eq('id', input.room_id)
    .single() as any

  if (error || !room?.category) return { room: null, roomCategory: '' }
  return { room, roomCategory: room.category as string }
}

async function buildPricingResponse(input: PricingInput) {
  const checkInDate = input.checkInDate?.trim()
  const checkOutDate = input.checkOutDate?.trim()

  if ((!input.room_category && !input.room_id) || !checkInDate || !checkOutDate) {
    return NextResponse.json({ error: 'room_category or room_id, checkInDate, and checkOutDate are required' }, { status: 400 })
  }
  if (checkOutDate <= checkInDate) {
    return NextResponse.json({ error: 'checkOutDate must be after checkInDate' }, { status: 400 })
  }

  const { room, roomCategory } = await resolveCategory(input)
  if (!roomCategory) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  const supabase = getSupabaseAdmin()
  const [{ data: roomRateRows, error: roomRatesError }, { data: mealPriceRows, error: mealPricesError }] = await Promise.all([
    supabase
      .from('room_rates')
      .select('room_category,rate_type,rate_date,base_price,extra_bed_price,child_price')
      .eq('room_category', roomCategory)
      .eq('rate_type', 'lwweb')
      .gte('rate_date', checkInDate)
      .lt('rate_date', checkOutDate)
      .order('rate_date', { ascending: true })
      .order('created_at', { ascending: false }) as any,
    supabase
      .from('meal_prices')
      .select('meal_type,price,applicable_from,applicable_to')
      .order('meal_type', { ascending: true })
      .order('applicable_from', { ascending: false }) as any,
  ])

  const normalizedMealPriceRows = mealPricesError
    ? []
    : ((mealPriceRows || []) as any[]).map((row) => ({
        meal_type: row.meal_type,
        price: Number(row.price || 0),
        applicable_from: row.applicable_from,
        applicable_to: row.applicable_to,
      })) as MealPriceRow[]
  const mealUnitTotals = buildMealUnitTotals({
    checkIn: checkInDate,
    checkOut: checkOutDate,
    mealPrices: normalizedMealPriceRows,
  })

  try {
    if (roomRatesError) {
      throw new Error(roomRatesError.message || 'Could not load room pricing')
    }

    const pricing = buildLwwebPricingMatrix({
      checkIn: checkInDate,
      checkOut: checkOutDate,
      roomRates: ((roomRateRows || []) as any[]).map((row) => ({
        room_category: row.room_category,
        rate_type: row.rate_type,
        rate_date: row.rate_date,
        base_price: Number(row.base_price || 0),
        extra_bed_price: Number(row.extra_bed_price || 0),
        child_price: Number(row.child_price || 0),
      })) as DateWiseRoomRate[],
      mealPrices: normalizedMealPriceRows,
    })

    return NextResponse.json(
      {
        success: true,
        room_id: room?.id || null,
        room_name: room?.name || null,
        room_category: roomCategory,
        check_in: checkInDate,
        check_out: checkOutDate,
        nights: pricing.nights,
        total: pricing.total,
        meal_unit_totals: mealUnitTotals,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (error: any) {
    const { data: legacyRateRows, error: legacyRateError } = await supabase
      .from('room_rates')
      .select('season_id,specific_date,is_date_override,meal_plan,rate_type,price_per_night,extra_bed_price,child_5_12_price,season:seasons(id,name,start_month,start_day,end_month,end_day)')
      .eq('room_category', roomCategory)
      .eq('rate_type', PUBLIC_WEB_RATE_TYPE)
      .order('created_at', { ascending: false }) as any

    if (legacyRateError) {
      return NextResponse.json({ error: error.message || 'Price not available' }, { status: 404 })
    }

    const normalizedRates = (legacyRateRows || []).map(normalizeTariffRate)
    const fallbackPricing = buildMatrixFromLegacyRates({
      checkInDate,
      checkOutDate,
      normalizedRates,
      mealPriceRows: normalizedMealPriceRows,
    })

    if (!fallbackPricing.nights.length || fallbackPricing.nights.some((night) => night.EP <= 0)) {
      return NextResponse.json({ error: error.message || 'Price not available' }, { status: 404 })
    }

    return NextResponse.json(
      {
        success: true,
        room_id: room?.id || null,
        room_name: room?.name || null,
        room_category: roomCategory,
        check_in: checkInDate,
        check_out: checkOutDate,
        nights: fallbackPricing.nights,
        total: fallbackPricing.total,
        meal_unit_totals: mealUnitTotals,
        source: 'seasonal-fallback',
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  return buildPricingResponse({
    room_id: body.room_id,
    room_category: body.room_category,
    checkInDate: body.checkInDate,
    checkOutDate: body.checkOutDate,
    adults: body.adults,
  })
}
