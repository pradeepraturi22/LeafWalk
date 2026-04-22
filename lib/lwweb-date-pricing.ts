import { toLocalDateString } from '@/lib/utils'

export type MealType = 'breakfast' | 'lunch' | 'dinner'
export type MealPlanCode = 'EP' | 'CP' | 'MAP' | 'AP'

export type DateWiseRoomRate = {
  room_category: string
  rate_type: string
  rate_date: string
  base_price: number
  extra_bed_price: number
  child_price: number
}

export type MealPriceRow = {
  meal_type: MealType
  price: number
  applicable_from?: string | null
  applicable_to?: string | null
}

export type PricingMatrixNight = {
  date: string
  base_price: number
  extra_bed_price: number
  child_price: number
  EP: number
  CP: number
  MAP: number
  AP: number
}

export type PricingMatrixTotals = {
  EP: number
  CP: number
  MAP: number
  AP: number
}

export type PricingMatrix = {
  nights: PricingMatrixNight[]
  total: PricingMatrixTotals
}

export function getDateRange(checkIn: string, checkOut: string) {
  const dates: string[] = []
  if (!checkIn || !checkOut || checkOut <= checkIn) return dates

  const cursor = new Date(`${checkIn}T12:00:00`)
  const end = new Date(`${checkOut}T12:00:00`)
  while (cursor < end) {
    dates.push(toLocalDateString(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function mealPriceForDate(rows: MealPriceRow[], mealType: MealType, date: string) {
  const applicableRows = rows
    .filter((row) => row.meal_type === mealType)
    .filter((row) => (!row.applicable_from || row.applicable_from <= date) && (!row.applicable_to || row.applicable_to >= date))
    .sort((a, b) => {
      const aFrom = a.applicable_from || '0000-00-00'
      const bFrom = b.applicable_from || '0000-00-00'
      return bFrom.localeCompare(aFrom)
    })

  return applicableRows[0]?.price ?? 0
}

export function buildLwwebPricingMatrix({
  checkIn,
  checkOut,
  roomRates,
  mealPrices,
}: {
  checkIn: string
  checkOut: string
  roomRates: DateWiseRoomRate[]
  mealPrices: MealPriceRow[]
}): PricingMatrix {
  const dates = getDateRange(checkIn, checkOut)
  const nights = dates.map((date) => {
    const roomRate = roomRates.find((rate) => rate.rate_date === date)
    if (!roomRate || roomRate.base_price <= 0) {
      throw new Error(`No room price found for ${date}`)
    }

    const breakfast = mealPriceForDate(mealPrices, 'breakfast', date)
    const lunch = mealPriceForDate(mealPrices, 'lunch', date)
    const dinner = mealPriceForDate(mealPrices, 'dinner', date)

    return {
      date,
      base_price: roomRate.base_price,
      extra_bed_price: roomRate.extra_bed_price || 0,
      child_price: roomRate.child_price || 0,
      EP: roomRate.base_price,
      CP: roomRate.base_price + breakfast,
      MAP: roomRate.base_price + breakfast + dinner,
      AP: roomRate.base_price + breakfast + lunch + dinner,
    }
  })

  const total = nights.reduce<PricingMatrixTotals>(
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
