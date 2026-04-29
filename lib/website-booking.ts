import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { getCategoryAvailabilityForRoom } from '@/lib/server-availability'
import { buildLwwebPricingMatrix, buildMealUnitTotals, type DateWiseRoomRate, type MealPriceRow } from '@/lib/lwweb-date-pricing'
import { sanitizeString } from '@/lib/security'

const EMAIL_RE = /^(?!.*\.\.)([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})$/i
export const PUBLIC_MEAL_PLANS = ['EP', 'CP'] as const

export const websiteBookingDraftSchema = z.object({
  guest_name: z.string().trim().min(2).max(200),
  guest_email: z.string().trim().email().max(254),
  guest_phone: z.string().trim().min(6).max(20),
  guest_phone_country: z.string().trim().max(8).optional(),
  room_id: z.string().uuid(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nights: z.coerce.number().int().min(1).max(4),
  rooms_booked: z.coerce.number().int().min(1).max(10).default(1),
  adults: z.coerce.number().int().min(1).max(30).default(2),
  children_below_5: z.coerce.number().int().min(0).max(30).default(0),
  children_5_to_12: z.coerce.number().int().min(0).max(30).default(0),
  children_above_12: z.coerce.number().int().min(0).max(30).default(0),
  extra_beds: z.coerce.number().int().min(0).max(10).default(0),
  meal_plan: z.enum(PUBLIC_MEAL_PLANS).default('CP'),
  booking_source: z.literal('website').optional(),
  special_requests: z.string().max(500).optional().nullable(),
  promo_code: z.string().max(30).optional().nullable(),
  discount_amount: z.coerce.number().min(0).max(100000).default(0),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
  discount_reason: z.string().max(120).optional().nullable(),
}).superRefine((value, ctx) => {
  if (Number(value.adults || 0) > Number(value.rooms_booked || 1) * 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Maximum 3 adults are allowed per room',
      path: ['adults'],
    })
  }
})

export type WebsiteBookingDraftInput = z.infer<typeof websiteBookingDraftSchema>

export type PreparedWebsiteBookingDraft = {
  normalizedEmail: string
  phoneDigits: string
  totalAmount: number
  bookingPayload: Record<string, any>
  roomName: string | null
  roomCategory: string
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export async function prepareWebsiteBookingDraft(
  body: WebsiteBookingDraftInput,
  auth?: { userId?: string | null; email?: string | null }
): Promise<PreparedWebsiteBookingDraft> {
  const {
    guest_name, guest_email, guest_phone, guest_phone_country,
    room_id, check_in, check_out, nights,
    rooms_booked, adults, children_below_5, children_5_to_12, children_above_12, extra_beds,
    meal_plan,
    special_requests,
    promo_code, discount_amount, discount_percent, discount_reason,
  } = body

  const phoneDigits = String(guest_phone).replace(/\D/g, '')
  const normalizedEmail = String(guest_email || '').trim().toLowerCase()
  if (phoneDigits.length < 6 || phoneDigits.length > 15) {
    throw new Error('Invalid phone number')
  }
  if (!EMAIL_RE.test(normalizedEmail)) {
    throw new Error('Invalid email address')
  }

  if (check_out <= check_in) {
    throw new Error('Check-out must be after check-in')
  }

  const expectedNights = Math.ceil(
    (new Date(`${check_out}T12:00:00Z`).getTime() - new Date(`${check_in}T12:00:00Z`).getTime()) / 86400000
  )
  if (expectedNights !== Number(nights)) {
    throw new Error('Invalid stay duration')
  }

  const numRooms = Number(rooms_booked || 1)
  const availability = await getCategoryAvailabilityForRoom(room_id, check_in, check_out)
  if (availability.availableRooms < numRooms) {
    throw new Error(`Only ${availability.availableRooms} ${availability.room.category} room(s) available for selected dates`)
  }

  const supabase = getSupabaseAdmin()
  const selectedMealPlan = meal_plan
  const { data: roomData, error: roomError } = await supabase
    .from('rooms')
    .select('name, category')
    .eq('id', room_id)
    .single() as any

  if (roomError || !roomData?.category) {
    throw new Error('Room not found')
  }

  const { data: roomRates, error: ratesError } = await supabase
    .from('room_rates')
    .select('room_category,rate_type,rate_date,base_price,extra_bed_price,child_price')
    .eq('room_category', roomData.category)
    .eq('rate_type', 'lwweb')
    .gte('rate_date', String(check_in))
    .lt('rate_date', String(check_out))
    .order('rate_date', { ascending: true })
    .order('created_at', { ascending: false }) as any

  const { data: mealRows, error: mealError } = await supabase
    .from('meal_prices')
    .select('meal_type,price,applicable_from,applicable_to')
    .order('meal_type', { ascending: true })
    .order('applicable_from', { ascending: false }) as any

  if (ratesError || mealError) {
    throw new Error('Could not fetch room rates')
  }

  const pricingMatrix = buildLwwebPricingMatrix({
    checkIn: String(check_in),
    checkOut: String(check_out),
    roomRates: ((roomRates || []) as any[]).map((rate) => ({
      room_category: rate.room_category,
      rate_type: rate.rate_type,
      rate_date: rate.rate_date,
      base_price: Number(rate.base_price || 0),
      extra_bed_price: Number(rate.extra_bed_price || 0),
      child_price: Number(rate.child_price || 0),
    })) as DateWiseRoomRate[],
    mealPrices: ((mealRows || []) as any[]).map((meal) => ({
      meal_type: meal.meal_type,
      price: Number(meal.price || 0),
      applicable_from: meal.applicable_from,
      applicable_to: meal.applicable_to,
    })) as MealPriceRow[],
  })
  const mealUnitTotals = buildMealUnitTotals({
    checkIn: String(check_in),
    checkOut: String(check_out),
    mealPrices: ((mealRows || []) as any[]).map((meal) => ({
      meal_type: meal.meal_type,
      price: Number(meal.price || 0),
      applicable_from: meal.applicable_from,
      applicable_to: meal.applicable_to,
    })) as MealPriceRow[],
  })

  const stayNights = pricingMatrix.nights.map((night) => ({
    room_price: night[selectedMealPlan as 'EP' | 'CP' | 'MAP' | 'AP'],
    extra_bed_price: night.extra_bed_price,
    child_price: night.child_price,
  }))

  const n = Number(nights)
  const nr = numRooms
  const xbCount = Number(extra_beds || 0)
  const childCount = Number(children_5_to_12 || 0)
  const roomSubtotalPerRoom = round2(pricingMatrix.total.EP)
  const mealAddonPerAdult = selectedMealPlan === 'CP' ? round2(mealUnitTotals.breakfast) : 0
  const mealAddonAmount = round2(mealAddonPerAdult * Number(adults || 1))
  const averageRoomRate = n > 0 ? round2(roomSubtotalPerRoom / n) : 0
  const extraBedSubtotalPerBed = round2(stayNights.reduce((sum, night) => sum + night.extra_bed_price, 0))
  const averageExtraBedRate = n > 0 ? round2(extraBedSubtotalPerBed / n) : 0
  const childSubtotalPerChild = round2(stayNights.reduce((sum, night) => sum + night.child_price, 0))
  const averageChildRate = n > 0 ? round2(childSubtotalPerChild / n) : 0
  const base = roomSubtotalPerRoom * nr
  const xbAmt = extraBedSubtotalPerBed * xbCount
  const childAmt = childSubtotalPerChild * childCount
  const sub = base + mealAddonAmount + xbAmt + childAmt
  const disc = Number(discount_amount || 0)
  const afterDisc = Math.max(0, sub - disc)
  const subtotalExGst = round2(afterDisc)
  const gstTotal = round2(subtotalExGst * 0.05)
  const cgst = round2(gstTotal / 2)
  const sgst = round2(gstTotal - cgst)
  const total = round2(subtotalExGst + gstTotal)

  const authUserId =
    auth?.email && auth.email.toLowerCase() === normalizedEmail
      ? auth.userId || null
      : null

  return {
    normalizedEmail,
    phoneDigits,
    totalAmount: total,
    roomName: roomData.name || null,
    roomCategory: roomData.category,
    bookingPayload: {
      guest_name: String(guest_name).trim().slice(0, 200),
      guest_email: normalizedEmail,
      guest_phone: phoneDigits,
      guest_phone_country: guest_phone_country || '+91',
      room_id,
      check_in,
      check_out,
      nights: n,
      adults: Number(adults || 2),
      rooms_booked: nr,
      extra_beds: xbCount,
      children_below_5: Number(children_below_5 || 0),
      children_5_to_12: Number(children_5_to_12 || 0),
      children_above_12: Number(children_above_12 || 0),
      meal_plan: selectedMealPlan,
      season_id: null,
      rate_per_room_per_night: averageRoomRate,
      extra_bed_rate_per_night: averageExtraBedRate,
      child_rate_per_night: averageChildRate,
      subtotal: subtotalExGst,
      discount_amount: disc,
      discount_percent: Number(discount_percent || 0),
      discount_reason: discount_reason || null,
      promo_code: promo_code || null,
      cgst,
      sgst,
      gst_total: gstTotal,
      total_amount: total,
      advance_amount: 0,
      balance_amount: 0,
      user_id: authUserId,
      booking_source: 'website',
      booking_status: 'pending',
      payment_status: 'pending',
      special_requests: special_requests ? sanitizeString(special_requests, 500) : null,
    },
  }
}
