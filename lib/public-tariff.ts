import { toLocalDateString } from '@/lib/utils'

export type TariffRateType = 'lwweb' | 'b2b' | 'b2c' | 'ota'

export type TariffSeason = {
  id?: string
  name?: string
  start_month: number
  start_day: number
  end_month: number
  end_day: number
}

export type TariffRate = {
  meal_plan: string
  rate_type: string
  price_per_night: number
  extra_bed_price?: number
  child_5_12_price?: number
  season_id?: string | null
  specific_date?: string | null
  is_date_override?: boolean | null
  season?: TariffSeason | TariffSeason[] | null
}

export type StayTariffNight = {
  date: string
  room_price: number
  extra_bed_price: number
  child_price: number
  seasonName?: string
  seasonId?: string
}

export type StayTariffBreakdown = {
  nights: StayTariffNight[]
  roomSubtotalPerRoom: number
  averageRoomPrice: number
  seasonIds: string[]
}

export const PUBLIC_WEB_RATE_TYPE: TariffRateType = 'lwweb'
export const ADMIN_RATE_TYPES: TariffRateType[] = ['lwweb', 'b2b', 'b2c']
export const ALL_RATE_TYPES: TariffRateType[] = ['lwweb', 'b2b', 'b2c', 'ota']

const CANONICAL_PUBLIC_SEASONS = new Set(['peak', 'monsoon', 'moderate', 'off'])

export function normalizeTariffSeason(season?: TariffRate['season']): TariffSeason | undefined {
  if (!season) return undefined
  return Array.isArray(season) ? season[0] : season
}

export function dateInTariffSeason(date: Date, season?: TariffRate['season']) {
  const normalized = normalizeTariffSeason(season)
  if (!normalized) return true

  const month = date.getMonth() + 1
  const day = date.getDate()
  const start = normalized.start_month * 100 + normalized.start_day
  const end = normalized.end_month * 100 + normalized.end_day
  const current = month * 100 + day

  return start <= end ? current >= start && current <= end : current >= start || current <= end
}

function preferCanonicalSeasonRates(rates: TariffRate[]) {
  const canonicalRates = rates.filter((rate) => {
    if (rate.is_date_override) return false
    const season = normalizeTariffSeason(rate.season)
    return season?.name && CANONICAL_PUBLIC_SEASONS.has(season.name)
  })

  return canonicalRates.length ? canonicalRates : rates
}

function getScopedRates(rates: TariffRate[], rateType: TariffRateType) {
  const typedRates = rates.filter((rate) => rate.rate_type === rateType)
  const dateOverrides = typedRates.filter((rate) => rate.is_date_override && rate.specific_date)
  const seasonalRates = typedRates.filter((rate) => !rate.is_date_override)

  return [...dateOverrides, ...preferCanonicalSeasonRates(seasonalRates)]
}

export function normalizeTariffRate(rate: any): TariffRate {
  return {
    season_id: rate.season_id || null,
    specific_date: rate.specific_date || null,
    is_date_override: Boolean(rate.is_date_override),
    meal_plan: rate.meal_plan,
    rate_type: rate.rate_type,
    price_per_night: Number(rate.price_per_night || 0),
    extra_bed_price: Number(rate.extra_bed_price || 0),
    child_5_12_price: Number(rate.child_5_12_price || 0),
    season: Array.isArray(rate.season) ? rate.season[0] : rate.season,
  }
}

export function getTariffRateForDate({
  date,
  mealPlan,
  rateType,
  rates,
}: {
  date: Date
  mealPlan: string
  rateType: TariffRateType
  rates: TariffRate[]
}): TariffRate | null {
  const scopedRates = getScopedRates(rates, rateType)
  const dateString = toLocalDateString(date)

  const overrideRate = scopedRates.find(
    (rate) => rate.meal_plan === mealPlan && rate.is_date_override && rate.specific_date === dateString
  )

  if (overrideRate) return overrideRate

  return (
    scopedRates.find((rate) => rate.meal_plan === mealPlan && !rate.is_date_override && dateInTariffSeason(date, rate.season)) ||
    scopedRates.find((rate) => rate.meal_plan === mealPlan && !rate.is_date_override) ||
    null
  )
}

export function getRoomPriceByDate({
  date,
  mealPlan,
  rateType,
  rates,
  fallbackPrice = 0,
}: {
  date: Date
  mealPlan: string
  rateType: TariffRateType
  rates: TariffRate[]
  fallbackPrice?: number
}) {
  const matchedRate = getTariffRateForDate({ date, mealPlan, rateType, rates })
  return matchedRate?.price_per_night ?? fallbackPrice
}

export function resolvePublicNightRate({
  date,
  mealPlan,
  rates,
  fallbackPrice = 0,
}: {
  date: Date
  mealPlan: string
  rates: TariffRate[]
  fallbackPrice?: number
}) {
  return getRoomPriceByDate({
    date,
    mealPlan,
    rateType: PUBLIC_WEB_RATE_TYPE,
    rates,
    fallbackPrice,
  })
}

export function getStayDates(checkIn: string, checkOut: string) {
  const dates: string[] = []
  if (!checkIn || !checkOut) return dates

  const cursor = new Date(`${checkIn}T12:00:00`)
  const end = new Date(`${checkOut}T12:00:00`)
  while (cursor < end) {
    dates.push(toLocalDateString(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export function getStayTariffBreakdown({
  checkIn,
  checkOut,
  mealPlan,
  rateType,
  rates,
  fallbackPrice = 0,
}: {
  checkIn: string
  checkOut: string
  mealPlan: string
  rateType: TariffRateType
  rates: TariffRate[]
  fallbackPrice?: number
}): StayTariffBreakdown {
  const nights = getStayDates(checkIn, checkOut).map((dateString) => {
    const date = new Date(`${dateString}T12:00:00`)
    const matchedRate = getTariffRateForDate({ date, mealPlan, rateType, rates })
    const season = normalizeTariffSeason(matchedRate?.season)

    return {
      date: dateString,
      room_price: matchedRate?.price_per_night ?? fallbackPrice,
      extra_bed_price: matchedRate?.extra_bed_price ?? 0,
      child_price: matchedRate?.child_5_12_price ?? 0,
      seasonName: season?.name,
      seasonId: matchedRate?.season_id ?? season?.id,
    }
  })

  const roomSubtotalPerRoom = nights.reduce((sum, night) => sum + night.room_price, 0)
  const averageRoomPrice = nights.length ? roomSubtotalPerRoom / nights.length : fallbackPrice
  const seasonIds = Array.from(new Set(nights.map((night) => night.seasonId).filter(Boolean) as string[]))

  return {
    nights,
    roomSubtotalPerRoom,
    averageRoomPrice,
    seasonIds,
  }
}
