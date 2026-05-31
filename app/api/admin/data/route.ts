// app/api/admin/data/route.ts
// ALL endpoints require valid admin/manager JWT — uses service role for DB ops
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { sendTourOperatorWelcomeEmail } from '@/lib/tour-operator-notifications'
import { sendBookingLifecycleEmails } from '@/lib/booking-email-triggers'
import { buildBookingNumber, buildHoldBookingNumber, reserveNextInvoiceNumber } from '@/lib/reference-numbers'
import { logDebug, logError } from '@/lib/logger'
import { sanitizeEmail, sanitizePhone, sanitizeString, sanitizeUnknown } from '@/lib/security'
import { validateBookingStatusChange } from '@/lib/booking-status'
import { getWifiSettings, normalizeWifiSettingsInput, saveWifiSettings, wifiSettingsSchema, type WifiSettings } from '@/lib/site-settings'
import { z } from 'zod'
import { isLocalTestMode } from '@/lib/runtime-mode'
type RoomInventoryRow = {
  id: string
  category: string
  total_rooms: number | string | null
  is_active?: boolean | null
}

const PROPERTY_ROOM_CAP = Math.max(1, Number(process.env.PROPERTY_TOTAL_ROOM_CAP || 10))

function getRealizedBookingRevenue(booking: { payment_status?: string | null; total_amount?: number | string | null; advance_amount?: number | string | null }) {
  const paymentStatus = String(booking.payment_status || '').trim().toLowerCase()
  if (paymentStatus === 'fully_paid' || paymentStatus === 'paid') {
    return Number(booking.total_amount || 0)
  }
  if (paymentStatus === 'payment_processing') {
    return Number(booking.advance_amount || 0)
  }
  return 0
}


// ── Shared auth guard ────────────────────────────────────────────────────────
async function requireAdmin(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return null

  let userId: string | null = null
  try {
    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
    if (error || !user) return null
    userId = user.id
  } catch (error) {
    logError('Admin auth.getUser failed', error)
    return null
  }

  if (!userId) return null
  const { data: u } = await getSupabaseAdmin().from('users').select('role').eq('id', userId).single() as any
  if (!u || !['admin', 'manager'].includes(u.role)) return null
  return { userId, role: u.role }
}

const UNAUTH = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

const emptyToNull = (value: unknown) => {
  if (value == null) return null
  const normalized = String(value).trim()
  return normalized ? normalized : null
}

const normalizePaymentStatus = (value: unknown) => {
  const normalized = String(value || 'pending').trim().toLowerCase()
  if (normalized === 'paid') return 'fully_paid'
  if (normalized === 'advance_paid') return 'payment_processing'
  if (['pending', 'payment_processing', 'fully_paid', 'failed', 'refunded'].includes(normalized)) return normalized
  return 'pending'
}

const addDays = (dateString: string, days: number) => {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const getDateRange = (checkIn: string, checkOut: string) => {
  const dates: string[] = []
  let current = checkIn
  while (current < checkOut) {
    dates.push(current)
    current = addDays(current, 1)
  }
  return dates
}

const operatorSchema = z.object({
  company_name: z.string().trim().min(2).max(200),
  contact_person: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(254),
  cc_email: z.preprocess(emptyToNull, z.string().trim().email().max(254).nullable().optional()),
  phone: z.string().trim().min(7).max(20),
  pan_number: z.preprocess(emptyToNull, z.string().max(30).nullable().optional()),
  gst_number: z.preprocess(emptyToNull, z.string().max(30).nullable().optional()),
  address: z.string().trim().min(5).max(500),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  commission_rate: z.preprocess(
    (value) => {
      if (value === '' || value == null) return undefined
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : undefined
    },
    z.number().min(0).max(100).optional()
  ),
  status: z.enum(['active', 'inactive']).default('active'),
})

const nullableString = (maxLength = 500) => z.preprocess(
  emptyToNull,
  z.string().trim().max(maxLength).nullable().optional()
)

const nullableUuid = z.preprocess(
  emptyToNull,
  z.string().uuid().nullable().optional()
)

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timestampString = z.string().trim().max(80)

const adminBookingRoomItemSchema = z.object({
  room_id: z.string().uuid(),
  rooms_booked: z.coerce.number().int().min(1).max(20),
  adults: z.coerce.number().int().min(1).max(80),
  children_below_5: z.coerce.number().int().min(0).max(80).optional().default(0),
  children_5_to_12: z.coerce.number().int().min(0).max(80).optional().default(0),
  extra_beds: z.coerce.number().int().min(0).max(40).optional().default(0),
  meal_plan: z.string().trim().max(30).optional().default('EP'),
  rate_per_room_per_night: z.coerce.number().finite().min(0),
  extra_bed_rate_per_night: z.coerce.number().finite().min(0).optional().default(0),
  child_rate_per_night: z.coerce.number().finite().min(0).optional().default(0),
  subtotal: z.coerce.number().finite().min(0),
  cgst: z.coerce.number().finite().min(0).optional().default(0),
  sgst: z.coerce.number().finite().min(0).optional().default(0),
  line_total: z.coerce.number().finite().min(0),
  season_id: nullableUuid,
})

const adminBookingSchema = z.object({
  tour_operator_id: nullableUuid,
  guest_name: z.string().trim().min(2).max(200),
  guest_email: z.preprocess(emptyToNull, z.string().trim().email().max(254).nullable().optional()),
  guest_phone: nullableString(20),
  guest_id_type: nullableString(60),
  guest_id_number: nullableString(80),
  guest_country: nullableString(80),
  guest_address: nullableString(500),
  guest_state: nullableString(100),
  guest_district: nullableString(100),
  room_id: z.string().uuid(),
  check_in: dateString,
  check_out: dateString,
  nights: z.coerce.number().int().min(1).max(365),
  rooms_booked: z.coerce.number().int().min(1).max(20),
  adults: z.coerce.number().int().min(1).max(80),
  children_below_5: z.coerce.number().int().min(0).max(80).optional().default(0),
  children_5_to_12: z.coerce.number().int().min(0).max(80).optional().default(0),
  children_above_12: z.coerce.number().int().min(0).max(80).optional().default(0),
  extra_beds: z.coerce.number().int().min(0).max(40).optional().default(0),
  meal_plan: z.string().trim().max(30).optional().default('EP'),
  booking_source: z.enum(['walk_in', 'direct', 'website', 'tour_operator']).default('direct'),
  booking_type: z.string().trim().max(40).optional().default('direct'),
  is_multi_room: z.coerce.boolean().optional().default(false),
  booking_status: z.enum(['hold', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'completed']).default('confirmed'),
  rate_per_room_per_night: z.coerce.number().finite().min(0),
  extra_bed_rate_per_night: z.coerce.number().finite().min(0).optional().default(0),
  child_rate_per_night: z.coerce.number().finite().min(0).optional().default(0),
  subtotal: z.coerce.number().finite().min(0),
  cgst: z.coerce.number().finite().min(0).optional().default(0),
  sgst: z.coerce.number().finite().min(0).optional().default(0),
  gst_total: z.coerce.number().finite().min(0).optional().default(0),
  total_amount: z.coerce.number().finite().min(0),
  payment_method: nullableString(60),
  payment_status: z.preprocess(normalizePaymentStatus, z.enum(['pending', 'payment_processing', 'fully_paid', 'failed', 'refunded'])),
  advance_amount: z.coerce.number().finite().min(0).optional().default(0),
  balance_amount: z.coerce.number().finite().min(0).optional().default(0),
  payment_ref: nullableString(120),
  payment_date: z.preprocess(emptyToNull, dateString.nullable().optional()),
  advance_paid_at: z.preprocess(emptyToNull, dateString.nullable().optional()),
  payment_id: nullableString(120),
  special_requests: nullableString(500),
  admin_notes: nullableString(1000),
  hold_notes: nullableString(500),
  held_at: z.preprocess(emptyToNull, timestampString.nullable().optional()),
  confirmed_at: z.preprocess(emptyToNull, timestampString.nullable().optional()),
  checked_in_at: z.preprocess(emptyToNull, timestampString.nullable().optional()),
  season_id: nullableUuid,
  gst_invoice_requested: z.coerce.boolean().optional().default(false),
  gst_company_name: nullableString(200),
  gst_number: nullableString(30),
  gst_state: nullableString(100),
}).superRefine((value, ctx) => {
  if (value.check_out <= value.check_in) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Check-out must be after check-in',
      path: ['check_out'],
    })
  }
})

function normalizeOperatorPayload(body: any) {
  return {
    ...body,
    company_name: sanitizeString(String(body.company_name || ''), 200),
    contact_person: sanitizeString(String(body.contact_person || ''), 200),
    email: sanitizeEmail(String(body.email || '')),
    cc_email: emptyToNull(body.cc_email) ? sanitizeEmail(String(body.cc_email || '')) : null,
    phone: sanitizePhone(String(body.phone || '')),
    pan_number: emptyToNull(body.pan_number),
    gst_number: emptyToNull(body.gst_number),
    address: sanitizeString(String(body.address || ''), 500),
    city: sanitizeString(String(body.city || ''), 100),
    state: sanitizeString(String(body.state || ''), 100),
    commission_rate:
      body.commission_rate === '' || body.commission_rate == null || Number.isNaN(Number(body.commission_rate))
        ? undefined
        : Number(body.commission_rate),
    status: body.status === 'inactive' ? 'inactive' : 'active',
  }
}

async function hasWelcomeEmailAlreadyBeenSent(email: string, companyName: string) {
  const { data } = await getSupabaseAdmin()
    .from('notification_logs')
    .select('id')
    .eq('type', 'email')
    .eq('recipient', email)
    .eq('status', 'sent')
    .like('content', `tour_operator_welcome:${companyName}`)
    .limit(1)

  return Boolean(data?.length)
}

async function getCategoryAvailability(
  roomIds: string[],
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string | null
) {
  const supabase = getSupabaseAdmin()
  const { data: selectedRooms, error: selectedRoomsError } = await supabase
    .from('rooms')
    .select('id, category, total_rooms, is_active')
    .in('id', roomIds) as { data: RoomInventoryRow[] | null; error: Error | null }

  if (selectedRoomsError || !selectedRooms?.length) {
    throw new Error('Selected rooms not found')
  }

  const inactiveRoom = selectedRooms.find((room) => !room.is_active)
  if (inactiveRoom) {
    throw new Error('One or more selected rooms are inactive')
  }

  const categories: string[] = Array.from(
    selectedRooms.reduce((set: Set<string>, room: any) => set.add(room.category), new Set<string>())
  )
  const { data: activeRooms, error: activeRoomsError } = await supabase
    .from('rooms')
    .select('id, category, total_rooms')
    .eq('is_active', true) as { data: RoomInventoryRow[] | null; error: Error | null }

  if (activeRoomsError || !activeRooms?.length) {
    throw new Error('Could not load category inventory')
  }

  const roomIdsByCategory = new Map<string, string[]>()
  const totalByCategory = new Map<string, number>()
  const roomCategoryMap = new Map<string, string>()
  for (const room of activeRooms) {
    roomCategoryMap.set(room.id, room.category)
    roomIdsByCategory.set(room.category, [...(roomIdsByCategory.get(room.category) || []), room.id])
    totalByCategory.set(room.category, (totalByCategory.get(room.category) || 0) + (Number(room.total_rooms) || 0))
  }
  const propertyTotalInventory = Array.from(totalByCategory.values()).reduce((sum, value) => sum + value, 0)
  const propertyCap = Math.max(1, Math.min(PROPERTY_ROOM_CAP, Math.max(propertyTotalInventory, PROPERTY_ROOM_CAP)))

  let overlapQuery = supabase
    .from('bookings')
    .select('room_id, check_in, check_out, rooms_booked')
    .in('room_id', activeRooms.map((room) => room.id))
    .in('booking_status', ['pending', 'confirmed', 'hold', 'checked_in'])
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)

  if (excludeBookingId) {
    overlapQuery = overlapQuery.neq('id', excludeBookingId)
  }

  const { data: overlapping, error: overlapError } = await overlapQuery as any

  if (overlapError) {
    logError('Admin booking availability overlap query failed:', {
      categories,
      checkIn,
      checkOut,
      excludeBookingId,
      error: overlapError,
    })
    throw new Error('Could not validate room availability')
  }

  const overlappingByCategory = new Map<string, number>()
  const stayDates = getDateRange(checkIn, checkOut)
  for (const category of categories) {
    const categoryBaseTotal = totalByCategory.get(category) || 0
    if (!categoryBaseTotal) {
      overlappingByCategory.set(category, 0)
      continue
    }
    const nightlyAvailable = stayDates.map((date) => {
      const bookedCategory = (overlapping || [])
        .filter((booking: any) => roomCategoryMap.get(String(booking.room_id)) === category)
        .filter((booking: any) => booking.check_in <= date && booking.check_out > date)
        .reduce((sum: number, booking: any) => sum + (Number(booking.rooms_booked) || 1), 0)
      const bookedAll = (overlapping || [])
        .filter((booking: any) => booking.check_in <= date && booking.check_out > date)
        .reduce((sum: number, booking: any) => sum + (Number(booking.rooms_booked) || 1), 0)
      const categoryCapFromProperty = Math.max(bookedCategory, propertyCap - Math.max(0, bookedAll - bookedCategory))
      const allowedForCategory = Math.max(0, Math.min(categoryBaseTotal, categoryCapFromProperty))
      return Math.max(0, allowedForCategory - bookedCategory)
    })

    const minNightlyAvailable = nightlyAvailable.length ? Math.min(...nightlyAvailable) : categoryBaseTotal
    overlappingByCategory.set(category, Math.max(0, categoryBaseTotal - minNightlyAvailable))
  }

  return { selectedRooms, totalByCategory, overlappingByCategory }
}

async function hasWelcomeEmailAlreadyBeenSentToAny(emailList: string[], companyName: string) {
  const uniqueEmails = Array.from(new Set(emailList.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)))
  if (!uniqueEmails.length) return false

  const { data } = await getSupabaseAdmin()
    .from('notification_logs')
    .select('id, recipient')
    .eq('type', 'email')
    .eq('status', 'sent')
    .like('content', `tour_operator_welcome:${companyName}`)
    .limit(20)

  return Boolean(
    (data || []).some((row: any) => {
      const recipientText = String(row.recipient || '').toLowerCase()
      return uniqueEmails.some((email) => recipientText.includes(email))
    })
  )
}

function getIstNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Calcutta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0),
  }
}

function canCheckInToday(checkInDate: string) {
  const now = getIstNow()
  if (now.date > checkInDate) return true
  return now.date === checkInDate && (now.hour > 15 || (now.hour === 15 && now.minute >= 0))
}

function canCheckOutToday(checkOutDate: string) {
  const now = getIstNow()
  return now.date >= checkOutDate
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return UNAUTH

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  try {
    if (type === 'dashboard') {
      const { data: allBookings } = await getSupabaseAdmin().from('bookings').select('*')
      const { data: rooms } = await getSupabaseAdmin().from('rooms').select('*')
      const { data: recent } = await getSupabaseAdmin()
        .from('bookings').select(`*, room:rooms(name)`)
        .order('created_at', { ascending: false }).limit(10)
      return NextResponse.json({ allBookings, rooms, recent })
    }

    if (type === 'bookings') {
      const { data, error } = await getSupabaseAdmin()
        .from('bookings').select(`*, room:rooms(name, category)`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return NextResponse.json({ data })
    }

    if (type === 'booking-detail') {
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const { data, error } = await getSupabaseAdmin()
        .from('bookings')
        .select(`*, room:rooms(name, category, featured_image), tour_operator:tour_operators(company_name, contact_person, email, cc_email, phone, gst_number, pan_number, address, city, state)`)
        .eq('id', id).single() as any
      if (error) return NextResponse.json({ error: error.message }, { status: 404 })
      return NextResponse.json({ data })
    }

    if (type === 'rooms') {
      const { data, error } = await getSupabaseAdmin()
        .from('rooms').select('*').eq('is_active', true)
      if (error) throw error
      return NextResponse.json({ data })
    }

    if (type === 'rooms-all') {
      const { data, error } = await getSupabaseAdmin()
        .from('rooms')
        .select('*')
        .order('category')
        .order('name')
      if (error) throw error
      return NextResponse.json({ data: data || [] })
    }

    if (type === 'operators' || type === 'active-operators') {
      let query = getSupabaseAdmin()
        .from('tour_operators')
        .select('*')
        .order('created_at', { ascending: false })
      if (type === 'active-operators') {
        query = query.eq('status', 'active')
      }
      const { data: operators, error } = await query
      if (error) throw error
      if (!operators?.length) return NextResponse.json({ data: [] })

      const { data: allBookings } = await getSupabaseAdmin()
        .from('bookings')
        .select('tour_operator_id, total_amount, advance_amount, payment_status')
        .not('tour_operator_id', 'is', null)
        .in('booking_status', ['confirmed', 'checked_in', 'checked_out'])

      const data = operators.map((op) => {
        const opBookings = allBookings?.filter(b => b.tour_operator_id === op.id) || []
        return {
          ...op,
          total_bookings: opBookings.length,
          total_revenue: opBookings.reduce((sum, b) => sum + getRealizedBookingRevenue(b), 0)
        }
      })
      return NextResponse.json({ data })
    }

    if (type === 'rates') {
      const roomId = searchParams.get('room_id')
      const checkin = searchParams.get('check_in')
      const checkout = searchParams.get('check_out')
      if (!roomId || !checkin || !checkout) {
        return NextResponse.json({ error: 'room_id, check_in, check_out required' }, { status: 400 })
      }
      const { data: room } = await getSupabaseAdmin().from('rooms').select('category').eq('id', roomId).single() as any
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
      const { data: rates } = await getSupabaseAdmin()
        .from('room_rates')
        .select('*, season:seasons(*)')
        .eq('room_category', room.category)
      return NextResponse.json({ data: rates || [] })
    }

    // Guest lookup by phone (no auth required for lookup, but route is admin-guarded)
    if (type === 'guest-by-phone') {
      const phone = searchParams.get('phone')
      if (!phone) return NextResponse.json({ found: false })
      const { data } = await getSupabaseAdmin()
        .from('bookings')
        .select('guest_name, guest_email, guest_phone, guest_id_type, guest_id_number, guest_country, guest_state, guest_district, guest_address')
        .eq('guest_phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .single() as any
      if (!data) return NextResponse.json({ found: false })
      return NextResponse.json({ found: true, guest: data })
    }

    // Rate lookup by category + date + meal_plan + rate_type
    if (type === 'rate') {
      const category   = searchParams.get('category')
      const check_in   = searchParams.get('check_in')
      const meal_plan  = searchParams.get('meal_plan')
      const rate_type  = searchParams.get('rate_type') || 'lwweb'
      if (!category || !check_in) return NextResponse.json({ found: false })

      const d = new Date(check_in)
      const month = d.getMonth() + 1
      const day   = d.getDate()

      const { data: seasons } = await getSupabaseAdmin().from('seasons').select('*') as any
      let matchedSeason = null
      for (const s of (seasons || [])) {
        const start = s.start_month * 100 + s.start_day
        const end   = s.end_month   * 100 + s.end_day
        const cur   = month * 100 + day
        if (start <= end ? (cur >= start && cur <= end) : (cur >= start || cur <= end)) {
          matchedSeason = s; break
        }
      }
      if (!matchedSeason) return NextResponse.json({ found: false, error: 'No season matched' })

      const query = getSupabaseAdmin()
        .from('room_rates')
        .select('*')
        .eq('room_category', category)
        .eq('season_id', matchedSeason.id)
        .eq('meal_plan', meal_plan)

      if (rate_type === 'all') {
        const { data: matchedRates } = await query.in('rate_type', ['lwweb', 'b2b', 'b2c']) as any
        if (!matchedRates?.length) return NextResponse.json({ found: false, error: 'Rate not found' })
        const ratesByType = matchedRates.reduce((acc: Record<string, any>, rate: any) => {
          acc[rate.rate_type] = {
            price_per_night: rate.price_per_night,
            extra_bed_price: rate.extra_bed_price,
            child_5_12_price: rate.child_5_12_price || 0,
          }
          return acc
        }, {})
        return NextResponse.json({
          found: true,
          season_id: matchedSeason.id,
          season_label: `${matchedSeason.start_month}/${matchedSeason.start_day} – ${matchedSeason.end_month}/${matchedSeason.end_day}`,
          rates: ratesByType,
        })
      }

      const { data: rate } = await query.eq('rate_type', rate_type).single() as any

      if (!rate) return NextResponse.json({ found: false, error: 'Rate not found' })
      return NextResponse.json({
        found: true, season_id: matchedSeason.id,
        season_label: `${matchedSeason.start_month}/${matchedSeason.start_day} – ${matchedSeason.end_month}/${matchedSeason.end_day}`,
        price_per_night: rate.price_per_night,
        extra_bed_price: rate.extra_bed_price,
        child_5_12_price: rate.child_5_12_price || 0,
      })
    }

    // Daily pricing for date range
    if (type === 'daily-pricing') {
      const start = searchParams.get('start')
      const end   = searchParams.get('end')
      if (!start || !end) return NextResponse.json({ data: [] })
      const { data, error } = await getSupabaseAdmin()
        .from('daily_pricing')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('date')
      if (error) throw error
      return NextResponse.json({ data: data || [] })
    }

    // OTA pricing for date range
    if (type === 'ota-pricing') {
      const start = searchParams.get('start')
      const end   = searchParams.get('end')
      if (!start || !end) return NextResponse.json({ data: [] })
      const { data, error } = await getSupabaseAdmin()
        .from('ota_pricing')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('date')
      if (error) throw error
      return NextResponse.json({ data: data || [] })
    }

    // Payment ledger for a booking
    if (type === 'payment-ledger') {
      const booking_id = searchParams.get('booking_id')
      if (!booking_id) return NextResponse.json({ data: [] })
      const { data, error } = await getSupabaseAdmin()
        .from('booking_payments')
        .select('*')
        .eq('booking_id', booking_id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return NextResponse.json({ data: data || [] })
    }

    if (type === 'inquiries') {
      const { data, error } = await getSupabaseAdmin()
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return NextResponse.json({ data: data || [] })
    }

    if (type === 'reviews') {
      const { data, error } = await getSupabaseAdmin()
        .from('reviews')
        .select('*, room:rooms(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return NextResponse.json({ data: data || [] })
    }

    if (type === 'gallery-images') {
      const { data, error } = await getSupabaseAdmin()
        .from('gallery_images')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return NextResponse.json({ data: data || [] })
    }

    if (type === 'wifi-settings') {
      const data = await getWifiSettings()
      return NextResponse.json({ data })
    }

    if (type === 'tariff-data') {
      const [dateRates, mealPrices, seasons, tourRates] = await Promise.all([
        getSupabaseAdmin()
          .from('room_rates')
          .select('id,room_category,rate_type,rate_date,base_price,extra_bed_price,child_price')
          .in('rate_type', ['lwweb', 'ota', 'b2c'])
          .not('rate_date', 'is', null)
          .order('rate_date', { ascending: false })
          .limit(90) as any,
        getSupabaseAdmin()
          .from('meal_prices')
          .select('id,meal_type,price,applicable_from,applicable_to')
          .order('meal_type')
          .order('applicable_from', { ascending: false }) as any,
        getSupabaseAdmin()
          .from('seasons')
          .select('id,label,name,start_month,start_day,end_month,end_day,sort_order')
          .order('sort_order') as any,
        getSupabaseAdmin()
          .from('room_rates')
          .select('id,room_category,season_id,meal_plan,rate_type,price_per_night,extra_bed_price,child_5_12_price')
          .eq('rate_type', 'b2b')
          .not('season_id', 'is', null)
          .not('meal_plan', 'is', null)
          .order('room_category')
          .order('season_id')
          .order('meal_plan') as any,
      ])

      if (dateRates.error) throw dateRates.error
      if (mealPrices.error) throw mealPrices.error
      if (seasons.error) throw seasons.error
      if (tourRates.error) throw tourRates.error

      return NextResponse.json({
        dateRates: dateRates.data || [],
        mealPrices: mealPrices.data || [],
        seasons: seasons.data || [],
        tourRates: tourRates.data || [],
      })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    logError('admin/data GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return UNAUTH

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  let body: any

  try {
    body = sanitizeUnknown(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    if (type === 'availability') {
      const { room_id, check_in, check_out, rooms_needed = 1 } = body
      if (!room_id || !check_in || !check_out) {
        return NextResponse.json({ error: 'room_id, check_in, check_out required' }, { status: 400 })
      }
      const availability = await getCategoryAvailability([String(room_id)], String(check_in), String(check_out))
      const room = availability.selectedRooms.find((entry) => entry.id === String(room_id))
      const category = room?.category || ''
      const total = availability.totalByCategory.get(category) || 0
      const booked = availability.overlappingByCategory.get(category) || 0
      const available = Math.max(0, total - booked)
      return NextResponse.json({
        available,
        available_rooms: available,
        total_rooms: total,
        booked_rooms: booked,
        is_available: available >= Number(rooms_needed || 1),
      })
    }

    if (type === 'booking') {
      // Admin-created booking (walk-in, tour operator)
      const rawRoomItems = Array.isArray(body.room_items) ? body.room_items : []
      const parsedBooking = adminBookingSchema.safeParse(body)
      if (!parsedBooking.success) {
        return NextResponse.json({ error: 'Invalid booking payload', details: parsedBooking.error.flatten() }, { status: 400 })
      }
      const parsedRoomItems = rawRoomItems.length
        ? z.array(adminBookingRoomItemSchema).safeParse(rawRoomItems)
        : null
      if (parsedRoomItems && !parsedRoomItems.success) {
        return NextResponse.json({ error: 'Invalid booking room line payload', details: parsedRoomItems.error.flatten() }, { status: 400 })
      }

      const bookingData = parsedBooking.data
      const room_items = parsedRoomItems?.success ? parsedRoomItems.data : null
      const primaryRoomId = bookingData.room_id
      const bookingLines = room_items?.length
        ? room_items.map((item: any) => ({ room_id: item.room_id, rooms_booked: Number(item.rooms_booked || 1) }))
        : [{ room_id: primaryRoomId, rooms_booked: Number(bookingData.rooms_booked || 1) }]

      if (!primaryRoomId || !bookingData.check_in || !bookingData.check_out) {
        return NextResponse.json({ error: 'room_id, check_in and check_out are required' }, { status: 400 })
      }

      const uniqueRoomIds: string[] = Array.from(
        bookingLines.reduce((set: Set<string>, line: any) => {
          if (line.room_id) set.add(line.room_id)
          return set
        }, new Set<string>())
      )
      const { selectedRooms, totalByCategory, overlappingByCategory } = await getCategoryAvailability(
        uniqueRoomIds,
        bookingData.check_in,
        bookingData.check_out
      )

      const categoryByRoomId = new Map<string, string>(
        selectedRooms.map((room) => [room.id, room.category] as [string, string])
      )
      const requestedByCategory = new Map<string, number>()
      for (const line of bookingLines) {
        const category = categoryByRoomId.get(line.room_id)
        if (!category) {
          return NextResponse.json({ error: 'Selected room type is invalid' }, { status: 400 })
        }
        requestedByCategory.set(category, (requestedByCategory.get(category) || 0) + Number(line.rooms_booked || 1))
      }

      for (const [category, requested] of Array.from(requestedByCategory.entries())) {
        const total = totalByCategory.get(category) || 0
        const alreadyBooked = overlappingByCategory.get(category) || 0
        const available = Math.max(0, total - alreadyBooked)
        if (available < requested) {
          return NextResponse.json({
            error: `Only ${available} ${category} room(s) available for selected dates`,
          }, { status: 409 })
        }
      }

      // Set created_by
      const insertBookingData = {
        ...bookingData,
        created_by: admin.userId,
      }
      if (String(bookingData.booking_status || '').trim().toLowerCase() === 'checked_in' && bookingData.payment_status !== 'fully_paid') {
        return NextResponse.json({ error: 'Kindly record the full payment before check in' }, { status: 400 })
      }
      if (bookingData.booking_source === 'tour_operator') {
        if (bookingData.booking_status === 'confirmed' && Number(bookingData.advance_amount || 0) <= 0) {
          return NextResponse.json({ error: 'Advance payment is required before final confirmation' }, { status: 400 })
        }
      }
      const { data, error } = await getSupabaseAdmin()
        .from('bookings').insert(insertBookingData).select('id, booking_number, invoice_number').single() as any
      if (error) throw error
      if (data?.id && !data?.booking_number) {
        const referenceNumber = bookingData.booking_status === 'hold'
          ? buildHoldBookingNumber({ id: data.id, createdAt: new Date().toISOString() })
          : buildBookingNumber({ id: data.id, createdAt: new Date().toISOString() })
        await getSupabaseAdmin().from('bookings').update({ booking_number: referenceNumber }).eq('id', data.id)
        data.booking_number = referenceNumber
      }
      if (data?.id && bookingData.payment_status === 'fully_paid' && !data?.invoice_number) {
        const invoiceNumber = await reserveNextInvoiceNumber({
          paidAt: bookingData.payment_date || bookingData.advance_paid_at || new Date().toISOString(),
        })
        await getSupabaseAdmin().from('bookings').update({ invoice_number: invoiceNumber }).eq('id', data.id)
        data.invoice_number = invoiceNumber
      }
      if (room_items?.length && data?.id) {
        await getSupabaseAdmin().from('booking_room_items').insert(
          room_items.map((item: any) => ({ ...item, booking_id: data.id }))
        )
      }
      if (data?.id) {
        if (isLocalTestMode()) {
          logDebug('LOCAL TEST MODE admin booking created; evaluating email triggers', {
            booking_id: data.id,
            booking_source: bookingData.booking_source || 'unknown',
            booking_status: bookingData.booking_status || 'unknown',
          })
        }
        try {
          await sendBookingLifecycleEmails(data.id, 'admin_booking_created')
        } catch (emailError) {
          logError('Admin booking created but lifecycle email trigger failed:', {
            booking_id: data.id,
            booking_source: bookingData.booking_source || 'unknown',
            booking_status: bookingData.booking_status || 'unknown',
            payment_status: bookingData.payment_status || 'unknown',
            error: emailError,
          })
        }
      }
      return NextResponse.json({ success: true, ...data })
    }

    if (type === 'operator') {
      const parsedOperator = operatorSchema.safeParse(normalizeOperatorPayload(body))

      if (!parsedOperator.success) {
        return NextResponse.json({ error: 'Invalid operator payload', details: parsedOperator.error.flatten() }, { status: 400 })
      }

      const { data, error } = await getSupabaseAdmin().from('tour_operators').insert(parsedOperator.data).select('*').single() as any
      if (error) throw error

      let welcomeEmailSent = false
      if (data?.email) {
        try {
          welcomeEmailSent = await sendTourOperatorWelcomeEmail(data)
        } catch (emailError) {
          logError('tour operator welcome email failed:', emailError)
        }
      }
      return NextResponse.json({
        success: true,
        welcome_email_sent: welcomeEmailSent,
        welcome_email_skipped: false,
      })
    }

    if (type === 'gallery-image') {
      const payload = {
        title: body.title || null,
        description: body.description || null,
        image_url: body.image_url,
        category: body.category || null,
        is_featured: Boolean(body.is_featured),
        display_order: Number(body.display_order || 0),
      }
      if (!payload.image_url) {
        return NextResponse.json({ error: 'image_url required' }, { status: 400 })
      }
      const { error } = await getSupabaseAdmin().from('gallery_images').insert(payload as any)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // Save daily price override (upsert)
    if (type === 'daily-pricing') {
      const { date, room_category, base_price, adjustment, notes } = body
      if (!date || !room_category || base_price == null) {
        return NextResponse.json({ error: 'date, room_category, base_price required' }, { status: 400 })
      }
      const { error } = await getSupabaseAdmin()
        .from('daily_pricing')
        .upsert({
          date, room_category,
          base_price: Number(base_price),
          adjustment: Number(adjustment || 0),
          notes: notes || null,
          created_by: admin.userId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'date,room_category' })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // Save OTA price override (upsert)
    if (type === 'ota-pricing') {
      const entries = body.entries // [{ota_name, price}]
      const { date, room_category } = body
      if (!date || !room_category || !entries?.length) {
        return NextResponse.json({ error: 'date, room_category, entries required' }, { status: 400 })
      }
      const rows = entries.map((e: any) => ({
        date, room_category,
        ota_name: e.ota_name,
        price: Number(e.price),
        notes: e.notes || null,
        created_by: admin.userId,
      }))
      const { error } = await getSupabaseAdmin()
        .from('ota_pricing')
        .upsert(rows, { onConflict: 'date,room_category,ota_name' })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // Record a payment in the ledger
    if (type === 'payment-ledger') {
      const { booking_id, booking_number, payment_type, amount, payment_method,
              payment_ref, payment_date, payment_due_date, notes } = body
      if (!booking_id || !payment_type || !amount) {
        return NextResponse.json({ error: 'booking_id, payment_type, amount required' }, { status: 400 })
      }
      const { data: pData, error: pErr } = await getSupabaseAdmin()
        .from('booking_payments')
        .insert({
          booking_id,
          booking_number: booking_number || null,
          payment_type,
          amount: Number(amount),
          payment_method: payment_method || null,
          payment_ref: payment_ref || null,
          payment_date: payment_date || new Date().toISOString().split('T')[0],
          payment_due_date: payment_due_date || null,
          notes: notes || null,
          recorded_by: admin.userId,
        })
        .select('id')
        .single() as any
      if (pErr) throw pErr
      // Also update payment_due_date on bookings table if provided
      if (payment_due_date) {
        await getSupabaseAdmin()
          .from('bookings')
          .update({ payment_due_date })
          .eq('id', booking_id)
      }
      return NextResponse.json({ success: true, id: pData?.id })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    logError('admin/data POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return UNAUTH

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const id   = searchParams.get('id')
  let body: any

  try {
    body = sanitizeUnknown(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    if (type === 'booking-status') {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const { data: existingBooking } = await getSupabaseAdmin()
        .from('bookings')
        .select('id, booking_number, invoice_number, booking_status, payment_status, total_amount, advance_amount, balance_amount, tour_operator_id, room_id, rooms_booked, check_in, check_out')
        .eq('id', id)
        .single() as any
      if (!existingBooking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      const updateData: Record<string, any> = {
        last_modified_by: admin.userId,
        last_status_change: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (body.status)            updateData.booking_status = String(body.status).trim().toLowerCase()
      if (body.checked_in_at)  updateData.checked_in_at  = body.checked_in_at
      if (body.checked_out_at) updateData.checked_out_at = body.checked_out_at
      if (body.confirmed_at)   updateData.confirmed_at   = body.confirmed_at
      if (body.cancellation_reason) updateData.cancellation_reason = sanitizeString(String(body.cancellation_reason), 500)
      if (body.payment_method)  updateData.payment_method  = body.payment_method
      if (body.payment_status)  updateData.payment_status  = normalizePaymentStatus(body.payment_status)
      if (body.advance_amount  !== undefined) updateData.advance_amount  = Number(body.advance_amount)
      if (body.balance_amount  !== undefined) updateData.balance_amount  = Number(body.balance_amount)
      if (body.advance_paid_at) updateData.advance_paid_at = body.advance_paid_at
      if (body.admin_notes !== undefined)     updateData.admin_notes     = body.admin_notes
      if (body.transaction_number !== undefined) updateData.transaction_number = body.transaction_number
      if (body.payment_date !== undefined)       updateData.payment_date = body.payment_date
      if (body.payment_notes !== undefined)      updateData.payment_notes = body.payment_notes
      if (body.payment_due_date !== undefined)   updateData.payment_due_date = body.payment_due_date
      if (body.hold_notes !== undefined)         updateData.hold_notes = body.hold_notes
      if (body.held_at !== undefined)            updateData.held_at = body.held_at
      if (body.check_in !== undefined)           updateData.check_in = body.check_in
      if (body.check_out !== undefined)          updateData.check_out = body.check_out
      if (body.nights !== undefined)             updateData.nights = body.nights

      const nextStatus = String(updateData.booking_status || existingBooking?.booking_status || '')
      const nextPaymentStatus = String(updateData.payment_status || existingBooking?.payment_status || '')
      const transitionCheck = validateBookingStatusChange({
        currentStatus: existingBooking.booking_status,
        nextStatus,
        paymentStatus: nextPaymentStatus,
        bookingTotal: existingBooking.total_amount,
        advanceAmount: updateData.advance_amount ?? existingBooking.advance_amount,
        balanceAmount: updateData.balance_amount ?? existingBooking.balance_amount,
        checkedInAt: updateData.checked_in_at || null,
        checkedOutAt: updateData.checked_out_at || null,
        cancellationReason: updateData.cancellation_reason || null,
      })
      if (!transitionCheck.valid) {
        return NextResponse.json({ error: transitionCheck.error }, { status: 400 })
      }
      if (nextStatus === 'checked_in' && !canCheckInToday(String(existingBooking?.check_in || ''))) {
        return NextResponse.json({ error: 'Check-in is allowed only on the arrival date after 3:00 PM' }, { status: 400 })
      }
      if (nextStatus === 'checked_out' && !canCheckOutToday(String(existingBooking?.check_out || ''))) {
        return NextResponse.json({ error: 'Check-out is allowed only on or after the departure date' }, { status: 400 })
      }

      if (updateData.check_in || updateData.check_out) {
        const nextCheckIn = String(updateData.check_in || existingBooking?.check_in || '')
        const nextCheckOut = String(updateData.check_out || existingBooking?.check_out || '')
        if (!nextCheckIn || !nextCheckOut || nextCheckOut <= nextCheckIn) {
          return NextResponse.json({ error: 'Check-out must be after check-in' }, { status: 400 })
        }
        const availability = await getCategoryAvailability(
          [String(existingBooking?.room_id)],
          nextCheckIn,
          nextCheckOut,
          id
        )
        const selectedRoom = availability.selectedRooms.find((room) => room.id === String(existingBooking?.room_id))
        const category = selectedRoom?.category || ''
        const total = availability.totalByCategory.get(category) || 0
        const alreadyBooked = availability.overlappingByCategory.get(category) || 0
        const available = Math.max(0, total - alreadyBooked)
        if (available < Number(existingBooking?.rooms_booked || 1)) {
          return NextResponse.json({ error: `Only ${available} room(s) available for the shifted dates` }, { status: 409 })
        }
        updateData.nights = Math.max(1, Math.ceil((new Date(nextCheckOut).getTime() - new Date(nextCheckIn).getTime()) / 86400000))
      }

      if (nextStatus === 'confirmed' && ['hold', 'pending'].includes(String(existingBooking?.booking_status || ''))) {
        updateData.booking_number = buildBookingNumber({ id, createdAt: new Date().toISOString() })
      }
      if (nextPaymentStatus === 'fully_paid' && !existingBooking?.invoice_number) {
        updateData.invoice_number = await reserveNextInvoiceNumber({
          paidAt: updateData.payment_date || updateData.advance_paid_at || new Date().toISOString(),
        })
      }
      const { error } = await getSupabaseAdmin().from('bookings').update(updateData as any).eq('id', id)
      if (error) throw error
      if (updateData.booking_status || updateData.payment_status) {
        try {
          const bookingStatusChanged =
            Object.prototype.hasOwnProperty.call(updateData, 'booking_status') &&
            String(updateData.booking_status || '') !== String(existingBooking.booking_status || '')
          const paymentBecameFullyPaid =
            String(existingBooking.payment_status || '') !== 'fully_paid' &&
            nextPaymentStatus === 'fully_paid'
          const paymentFieldsTouched =
            Object.prototype.hasOwnProperty.call(updateData, 'payment_status') ||
            Object.prototype.hasOwnProperty.call(updateData, 'advance_amount') ||
            Object.prototype.hasOwnProperty.call(updateData, 'balance_amount') ||
            Object.prototype.hasOwnProperty.call(updateData, 'payment_date') ||
            Object.prototype.hasOwnProperty.call(updateData, 'transaction_number') ||
            Object.prototype.hasOwnProperty.call(updateData, 'payment_notes')

          const lifecycleTrigger =
            !bookingStatusChanged && paymentFieldsTouched
              ? (paymentBecameFullyPaid ? 'admin_payment_completed' : 'admin_payment_updated')
              : 'admin_status_changed'

          await sendBookingLifecycleEmails(id, lifecycleTrigger)
        } catch (emailError) {
          logError('Booking status/payment updated but lifecycle email trigger failed:', {
            booking_id: id,
            booking_status: updateData.booking_status || existingBooking.booking_status,
            payment_status: updateData.payment_status || null,
            error: emailError,
          })
        }
      }
      return NextResponse.json({ success: true })
    }

    if (type === 'operator') {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const parsedOperator = operatorSchema.partial().safeParse(normalizeOperatorPayload(body))
      if (!parsedOperator.success) {
        return NextResponse.json({ error: 'Invalid operator payload', details: parsedOperator.error.flatten() }, { status: 400 })
      }
      const { data: existingOperator, error: existingOperatorError } = await getSupabaseAdmin()
        .from('tour_operators')
        .select('*')
        .eq('id', id)
        .single() as any
      if (existingOperatorError || !existingOperator) {
        return NextResponse.json({ error: existingOperatorError?.message || 'Tour operator not found' }, { status: 404 })
      }

      const { data: updatedOperator, error } = await getSupabaseAdmin()
        .from('tour_operators')
        .update(parsedOperator.data as any)
        .eq('id', id)
        .select('*')
        .single() as any
      if (error) throw error

      let welcomeEmailSent = false
      let welcomeEmailSkipped = false

      const previousTo = String(existingOperator.email || '').trim().toLowerCase()
      const previousCc = String(existingOperator.cc_email || '').trim().toLowerCase()
      const nextTo = String(updatedOperator?.email || '').trim().toLowerCase()
      const nextCc = String(updatedOperator?.cc_email || '').trim().toLowerCase()
      const onboardingRecipientsChanged = previousTo !== nextTo || previousCc !== nextCc

      if (updatedOperator?.email) {
        try {
          if (onboardingRecipientsChanged) {
            welcomeEmailSent = await sendTourOperatorWelcomeEmail(updatedOperator)
          } else {
            welcomeEmailSkipped = true
          }
        } catch (emailError) {
          logError('tour operator update welcome email failed:', emailError)
        }
      }

      return NextResponse.json({
        success: true,
        welcome_email_sent: welcomeEmailSent,
        welcome_email_skipped: welcomeEmailSkipped,
        onboarding_recipients_changed: onboardingRecipientsChanged,
      })
    }

    if (type === 'room') {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const allowed = ['name', 'total_rooms', 'max_guests', 'max_extra_beds', 'display_price_from', 'is_active']
      const safe: Record<string, any> = {}
      for (const k of allowed) if (k in body) safe[k] = body[k]
      safe.updated_at = new Date().toISOString()
      const { error } = await getSupabaseAdmin().from('rooms').update(safe as any).eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (type === 'room-rate') {
      // id = existing rate id (for update) or 'new' (for insert)
      const { room_category, season_id, meal_plan, rate_type, price_per_night, extra_bed_price, child_5_12_price } = body
      if (id && id !== 'new') {
        const { error } = await getSupabaseAdmin().from('room_rates').update({
          price_per_night, extra_bed_price: extra_bed_price || 0,
          child_5_12_price: child_5_12_price || 0,
        } as any).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await getSupabaseAdmin().from('room_rates').insert({
          room_category, season_id, meal_plan, rate_type,
          price_per_night, extra_bed_price: extra_bed_price || 0,
          child_5_12_price: child_5_12_price || 0,
        } as any)
        if (error) throw error
      }
      return NextResponse.json({ success: true })
    }

    if (type === 'inquiry') {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const safe: Record<string, any> = {}
      if (body.status !== undefined) safe.status = body.status
      if (body.admin_notes !== undefined) safe.admin_notes = body.admin_notes
      if (body.subject !== undefined) safe.subject = body.subject
      if (body.message !== undefined) safe.message = body.message
      safe.updated_at = new Date().toISOString()
      const { error } = await getSupabaseAdmin().from('inquiries').update(safe as any).eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (type === 'review') {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const safe: Record<string, any> = {}
      if (body.is_approved !== undefined) safe.is_approved = body.is_approved
      if (body.title !== undefined) safe.title = body.title
      if (body.comment !== undefined) safe.comment = body.comment
      safe.updated_at = new Date().toISOString()
      const { error } = await getSupabaseAdmin().from('reviews').update(safe as any).eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (type === 'gallery-image') {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const safe: Record<string, any> = {}
      const allowed = ['title', 'description', 'image_url', 'category', 'is_featured', 'display_order']
      for (const key of allowed) if (key in body) safe[key] = body[key]
      const { error } = await getSupabaseAdmin().from('gallery_images').update(safe as any).eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (type === 'wifi-settings') {
      const parsedWifi = wifiSettingsSchema.safeParse(normalizeWifiSettingsInput(body))
      if (!parsedWifi.success) {
        return NextResponse.json({ error: 'Invalid Wi-Fi settings payload', details: parsedWifi.error.flatten() }, { status: 400 })
      }

      const wifiSettings: WifiSettings = {
        ssid: parsedWifi.data.ssid,
        password: parsedWifi.data.password,
        security: parsedWifi.data.security,
        hidden: parsedWifi.data.hidden,
      }

      await saveWifiSettings(wifiSettings, admin.userId)
      return NextResponse.json({ success: true, data: wifiSettings })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return UNAUTH

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const id   = searchParams.get('id')

  try {
    if (type === 'daily-pricing') {
      const date = searchParams.get('date')
      const room_category = searchParams.get('room_category')
      if (!date || !room_category) {
        return NextResponse.json({ error: 'date, room_category required' }, { status: 400 })
      }
      const { error } = await getSupabaseAdmin()
        .from('daily_pricing')
        .delete()
        .eq('date', date)
        .eq('room_category', room_category)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (type === 'operator') {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      // Don't actually delete — soft deactivate
      const { error } = await getSupabaseAdmin().from('tour_operators').update({ status: 'inactive' } as any).eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (type === 'gallery-image') {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const { error } = await getSupabaseAdmin().from('gallery_images').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
