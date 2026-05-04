import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { getRoomCategoryOrder } from '@/lib/room-categories'

const PROPERTY_ROOM_CAP = Math.max(1, Number(process.env.PROPERTY_TOTAL_ROOM_CAP || 10))

export type CategoryAvailability = {
  room: {
    id: string
    category: string
    is_active: boolean
  }
  categoryRoomIds: string[]
  totalRooms: number
  controlAllowedRooms: number
  allowedRooms: number
  blockedRooms: number
  bookedRooms: number
  availableRooms: number
  physicalAvailableRooms: number
  fullyAvailable: boolean
  nightlyAvailability: Array<{
    date: string
    totalRooms: number
    controlAllowedRooms: number
    allowedRooms: number
    blockedRooms: number
    bookedRooms: number
    availableRooms: number
    physicalAvailableRooms: number
  }>
}

export type CategoryDailyAvailability = {
  date: string
  category: string
  totalRooms: number
  controlAllowedRooms: number
  allowedRooms: number
  blockedRooms: number
  bookedRooms: number
  availableRooms: number
  physicalAvailableRooms: number
}

export type AdminAvailabilityBooking = {
  id: string
  bookingNumber: string | null
  guestName: string
  guestEmail: string | null
  guestPhone: string | null
  source: string
  status: string
  paymentStatus: string
  roomsBooked: number
  adults: number
  mealPlan: string | null
  checkIn: string
  checkOut: string
  totalAmount: number
  advanceAmount: number
  balanceAmount: number
  paymentDueDate: string | null
  dueWithin7Days: boolean
  dueTodayOrOverdue: boolean
  operatorId: string | null
  operatorName: string | null
  operatorEmail: string | null
  operatorPhone: string | null
  roomLabels: string[]
}

export type AdminCategoryDailyAvailability = CategoryDailyAvailability & {
  bookings: AdminAvailabilityBooking[]
  sourceSummary: Record<string, number>
  holdRooms: number
  confirmedRooms: number
  pendingPaymentAmount: number
  pendingPaymentBookings: number
  dueSoonCount: number
  controlNotes: string | null
}

export type AdminCalendarRoomCell = {
  date: string
  category: string
  roomLabel: string
  state: 'available' | 'blocked' | 'hold' | 'booked'
  totalRooms: number
  controlAllowedRooms: number
  allowedRooms: number
  blockedRooms: number
  bookedRooms: number
  availableRooms: number
  physicalAvailableRooms: number
  bookings: AdminAvailabilityBooking[]
  primaryBooking: AdminAvailabilityBooking | null
  sourceSummary: Record<string, number>
  holdRooms: number
  confirmedRooms: number
  pendingPaymentAmount: number
  pendingPaymentBookings: number
  dueSoonCount: number
  controlNotes: string | null
}

export type AdminCalendarRoomRow = {
  category: string
  roomLabel: string
  roomIndex: number
  days: AdminCalendarRoomCell[]
}

export type AdminRoomCalendarSection = {
  category: string
  totalRooms: number
  rows: AdminCalendarRoomRow[]
}

export type AdminRoomAvailabilityCalendar = {
  dates: string[]
  sections: AdminRoomCalendarSection[]
}

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'hold', 'checked_in']

type AvailabilityControlRow = {
  room_category: string
  control_date: string
  allowed_rooms: number | string | null
  notes?: string | null
}

type RawBookingRow = {
  id: string
  booking_number: string | null
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  booking_source: string | null
  booking_status: string | null
  payment_status: string | null
  room_id: string
  check_in: string
  check_out: string
  rooms_booked: number | string | null
  adults: number | string | null
  meal_plan: string | null
  total_amount: number | string | null
  advance_amount: number | string | null
  balance_amount: number | string | null
  payment_due_date: string | null
  tour_operator_id: string | null
  created_at?: string | null
  tour_operator?: {
    company_name?: string | null
    email?: string | null
    phone?: string | null
  } | null
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function getDateRange(checkIn: string, checkOut: string) {
  const dates: string[] = []
  let current = checkIn
  while (current < checkOut) {
    dates.push(current)
    current = addDays(current, 1)
  }
  return dates
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function formatRoomLabel(index: number) {
  return `LW${String(index).padStart(2, '0')}`
}

function getPropertyCap(totalInventory: number) {
  return Math.max(1, Math.min(PROPERTY_ROOM_CAP, Math.max(totalInventory, PROPERTY_ROOM_CAP)))
}

function getBookedRoomsForDate(bookings: RawBookingRow[], date: string, roomCategoryMap?: Map<string, string>, category?: string) {
  return bookings
    .filter((booking) => (!category || roomCategoryMap?.get(booking.room_id) === category))
    .filter((booking) => booking.check_in <= date && booking.check_out > date)
    .reduce((sum, booking) => sum + (Number(booking.rooms_booked) || 1), 0)
}

function getLabelInventory(totalsByCategory: Map<string, number>) {
  const categories = Array.from(totalsByCategory.keys()).sort((a, b) => {
    const orderDelta = getRoomCategoryOrder(a) - getRoomCategoryOrder(b)
    return orderDelta !== 0 ? orderDelta : a.localeCompare(b)
  })

  let currentIndex = 1
  const labelsByCategory = new Map<string, string[]>()
  for (const category of categories) {
    const totalRooms = totalsByCategory.get(category) || 0
    const labels = Array.from({ length: totalRooms }, (_, offset) => formatRoomLabel(currentIndex + offset))
    labelsByCategory.set(category, labels)
    currentIndex += totalRooms
  }

  return labelsByCategory
}

async function getAvailabilityControls(checkIn: string, checkOut: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('availability_controls')
    .select('room_category, control_date, allowed_rooms, notes')
    .gte('control_date', checkIn)
    .lt('control_date', checkOut) as any

  if (error) {
    const message = String(error.message || '').toLowerCase()
    const details = String((error as any).details || '').toLowerCase()
    if (
      error.code === '42P01' ||
      error.code === 'PGRST205' ||
      message.includes('availability_controls') ||
      message.includes('schema cache') ||
      details.includes('availability_controls')
    ) {
      return new Map<string, AvailabilityControlRow>()
    }
    throw new Error('Could not load availability controls')
  }

  return (data || []).reduce((map: Map<string, AvailabilityControlRow>, row: AvailabilityControlRow) => {
    map.set(`${row.room_category}:${row.control_date}`, row)
    return map
  }, new Map<string, AvailabilityControlRow>())
}

function hydrateAdminBooking(booking: RawBookingRow, date: string, roomLabels: string[]) {
  const paymentDueDate = booking.payment_due_date ? String(booking.payment_due_date) : null
  const balanceAmount = Number(booking.balance_amount) || 0
  const remainingDays = paymentDueDate ? daysBetween(date, paymentDueDate) : null

  return {
    id: String(booking.id),
    bookingNumber: booking.booking_number || null,
    guestName: String(booking.guest_name || 'Guest'),
    guestEmail: booking.guest_email ? String(booking.guest_email) : null,
    guestPhone: booking.guest_phone ? String(booking.guest_phone) : null,
    source: String(booking.booking_source || 'direct'),
    status: String(booking.booking_status || 'confirmed'),
    paymentStatus: String(booking.payment_status || 'pending'),
    roomsBooked: Number(booking.rooms_booked) || 1,
    adults: Number(booking.adults) || 1,
    mealPlan: booking.meal_plan ? String(booking.meal_plan) : null,
    checkIn: String(booking.check_in),
    checkOut: String(booking.check_out),
    totalAmount: Number(booking.total_amount) || 0,
    advanceAmount: Number(booking.advance_amount) || 0,
    balanceAmount,
    paymentDueDate,
    dueWithin7Days: Boolean(paymentDueDate && balanceAmount > 0 && remainingDays !== null && remainingDays <= 7),
    dueTodayOrOverdue: Boolean(paymentDueDate && balanceAmount > 0 && remainingDays !== null && remainingDays <= 0),
    operatorId: booking.tour_operator_id ? String(booking.tour_operator_id) : null,
    operatorName: booking.tour_operator?.company_name ? String(booking.tour_operator.company_name) : null,
    operatorEmail: booking.tour_operator?.email ? String(booking.tour_operator.email) : null,
    operatorPhone: booking.tour_operator?.phone ? String(booking.tour_operator.phone) : null,
    roomLabels,
  }
}

function getConsecutiveFreeLabels(labels: string[], occupancy: Map<string, Set<string>>, stayDates: string[], count: number) {
  for (let index = 0; index <= labels.length - count; index += 1) {
    const candidate = labels.slice(index, index + count)
    const free = candidate.every((label) =>
      stayDates.every((date) => !(occupancy.get(label)?.has(date)))
    )
    if (free) return candidate
  }
  return null
}

function getAnyFreeLabels(labels: string[], occupancy: Map<string, Set<string>>, stayDates: string[], count: number) {
  const freeLabels = labels.filter((label) =>
    stayDates.every((date) => !(occupancy.get(label)?.has(date)))
  )
  return freeLabels.length >= count ? freeLabels.slice(0, count) : []
}

function buildCategoryMetrics(
  category: string,
  dates: string[],
  totalRooms: number,
  bookings: RawBookingRow[],
  controls: Map<string, AvailabilityControlRow>,
  totalBookedByDate: Map<string, number>,
  propertyCap: number
) {
  return dates.reduce((map, date) => {
    const dayBookings = bookings.filter((booking) => booking.check_in <= date && booking.check_out > date)
    const bookedRooms = dayBookings.reduce((sum, booking) => sum + (Number(booking.rooms_booked) || 1), 0)
    const totalBookedForDate = totalBookedByDate.get(date) || 0
    const control = controls.get(`${category}:${date}`)
    const sellableTotalRooms = Math.max(totalRooms, propertyCap)
    const controlledRooms = Math.max(0, Math.min(sellableTotalRooms, Number(control?.allowed_rooms ?? sellableTotalRooms) || 0))
    const propertyBoundRooms = Math.max(bookedRooms, propertyCap - Math.max(0, totalBookedForDate - bookedRooms))
    const allowedRooms = Math.max(0, Math.min(controlledRooms, propertyBoundRooms))
    const holdRooms = dayBookings
      .filter((booking) => String(booking.booking_status || '') === 'hold')
      .reduce((sum, booking) => sum + (Number(booking.rooms_booked) || 1), 0)
    const confirmedRooms = dayBookings
      .filter((booking) => ['confirmed', 'checked_in'].includes(String(booking.booking_status || '')))
      .reduce((sum, booking) => sum + (Number(booking.rooms_booked) || 1), 0)
    const pendingPaymentAmount = dayBookings.reduce((sum, booking) => sum + (Number(booking.balance_amount) || 0), 0)
    const pendingPaymentBookings = dayBookings.filter((booking) => (Number(booking.balance_amount) || 0) > 0).length
    const dueSoonCount = dayBookings.filter((booking) => {
      const dueDate = booking.payment_due_date ? String(booking.payment_due_date) : null
      const balance = Number(booking.balance_amount) || 0
      const remainingDays = dueDate ? daysBetween(date, dueDate) : null
      return Boolean(dueDate && balance > 0 && remainingDays !== null && remainingDays <= 7)
    }).length
    const sourceSummary = dayBookings.reduce((summary: Record<string, number>, booking) => {
      const source = String(booking.booking_source || 'direct')
      summary[source] = (summary[source] || 0) + (Number(booking.rooms_booked) || 1)
      return summary
    }, {})

    map.set(date, {
      date,
      category,
      totalRooms: sellableTotalRooms,
      controlAllowedRooms: controlledRooms,
      allowedRooms,
      blockedRooms: Math.max(0, sellableTotalRooms - allowedRooms),
      bookedRooms,
      availableRooms: Math.max(0, allowedRooms - bookedRooms),
      physicalAvailableRooms: Math.max(0, sellableTotalRooms - bookedRooms),
      sourceSummary,
      holdRooms,
      confirmedRooms,
      pendingPaymentAmount,
      pendingPaymentBookings,
      dueSoonCount,
      controlNotes: control?.notes || null,
    })
    return map
  }, new Map<string, Omit<AdminCategoryDailyAvailability, 'bookings'>>())
}

function allocateCategoryRows(
  category: string,
  labels: string[],
  dates: string[],
  bookings: RawBookingRow[],
  metricsByDate: Map<string, Omit<AdminCategoryDailyAvailability, 'bookings'>>
): AdminCalendarRoomRow[] {
  const occupancy = new Map<string, Set<string>>()
  const bookingLabelMap = new Map<string, string[]>()
  const bookingByLabelAndDate = new Map<string, AdminAvailabilityBooking>()

  for (const label of labels) occupancy.set(label, new Set<string>())

  const sortedBookings = [...bookings].sort((left, right) => {
    const startDelta = String(left.check_in).localeCompare(String(right.check_in))
    if (startDelta !== 0) return startDelta
    const createdDelta = String(left.created_at || '').localeCompare(String(right.created_at || ''))
    if (createdDelta !== 0) return createdDelta
    return String(left.id).localeCompare(String(right.id))
  })

  for (const booking of sortedBookings) {
    const stayDates = dates.filter((date) => booking.check_in <= date && booking.check_out > date)
    const count = Math.max(1, Number(booking.rooms_booked) || 1)
    const consecutive = getConsecutiveFreeLabels(labels, occupancy, stayDates, count)
    const assigned = consecutive || getAnyFreeLabels(labels, occupancy, stayDates, count)
    const safeAssigned = assigned.length ? assigned : labels.slice(0, count)
    bookingLabelMap.set(String(booking.id), safeAssigned)

    const hydrated = hydrateAdminBooking(booking, stayDates[0] || booking.check_in, safeAssigned)
    for (const label of safeAssigned) {
      const occupied = occupancy.get(label)
      if (!occupied) continue
      for (const date of stayDates) {
        occupied.add(date)
        bookingByLabelAndDate.set(`${label}:${date}`, hydrated)
      }
    }
  }

  return labels.map((label, rowIndex) => ({
    category,
    roomLabel: label,
    roomIndex: rowIndex + 1,
    days: dates.map((date) => {
      const metric = metricsByDate.get(date)
      const primaryBooking = bookingByLabelAndDate.get(`${label}:${date}`) || null
      const dayBookings = sortedBookings
        .filter((booking) => booking.check_in <= date && booking.check_out > date)
        .map((booking) => hydrateAdminBooking(booking, date, bookingLabelMap.get(String(booking.id)) || []))
        const state = primaryBooking
        ? primaryBooking.status === 'hold'
          ? 'hold'
          : 'booked'
        : rowIndex >= (metric?.allowedRooms || 0)
          ? 'blocked'
          : 'available'

      return {
        date,
        category,
        roomLabel: label,
        state,
        totalRooms: metric?.totalRooms || labels.length,
        controlAllowedRooms: metric?.controlAllowedRooms || labels.length,
        allowedRooms: metric?.allowedRooms || labels.length,
        blockedRooms: metric?.blockedRooms || 0,
        bookedRooms: metric?.bookedRooms || 0,
        availableRooms: metric?.availableRooms || 0,
        physicalAvailableRooms: metric?.physicalAvailableRooms || 0,
        bookings: dayBookings,
        primaryBooking,
        sourceSummary: metric?.sourceSummary || {},
        holdRooms: metric?.holdRooms || 0,
        confirmedRooms: metric?.confirmedRooms || 0,
        pendingPaymentAmount: metric?.pendingPaymentAmount || 0,
        pendingPaymentBookings: metric?.pendingPaymentBookings || 0,
        dueSoonCount: metric?.dueSoonCount || 0,
        controlNotes: metric?.controlNotes || null,
      }
    }),
  }))
}

async function getInventoryAndBookings(checkIn: string, checkOut: string) {
  const supabase = getSupabaseAdmin()

  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('id, category, total_rooms')
    .eq('is_active', true) as any

  if (roomsError || !rooms?.length) {
    throw new Error('Could not fetch room inventory')
  }

  const totalsByCategory = new Map<string, number>()
  const roomCategoryMap = new Map<string, string>()
  for (const room of rooms) {
    roomCategoryMap.set(room.id, room.category)
    totalsByCategory.set(room.category, (totalsByCategory.get(room.category) || 0) + (Number(room.total_rooms) || 0))
  }

  const roomIds = rooms.map((room: any) => room.id)
  const { data: overlapping, error: overlappingError } = await supabase
    .from('bookings')
    .select('id, booking_number, guest_name, guest_email, guest_phone, booking_source, booking_status, payment_status, room_id, check_in, check_out, rooms_booked, adults, meal_plan, total_amount, advance_amount, balance_amount, payment_due_date, tour_operator_id, created_at, tour_operator:tour_operators(company_name,email,phone)')
    .in('room_id', roomIds)
    .in('booking_status', ACTIVE_BOOKING_STATUSES)
    .lt('check_in', checkOut)
    .gt('check_out', checkIn) as any

  if (overlappingError) {
    throw new Error('Could not check availability')
  }

  return {
    rooms,
    totalsByCategory,
    roomCategoryMap,
    overlapping: (overlapping || []) as RawBookingRow[],
  }
}

export async function getCategoryAvailabilityForRoom(
  roomId: string,
  checkIn: string,
  checkOut: string
): Promise<CategoryAvailability> {
  const supabase = getSupabaseAdmin()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, category, is_active')
    .eq('id', roomId)
    .single() as any

  if (roomError || !room) throw new Error('Room not found')
  if (!room.is_active) throw new Error('Room not available')

  const { data: categoryRooms, error: categoryRoomsError } = await supabase
    .from('rooms')
    .select('id, total_rooms')
    .eq('category', room.category)
    .eq('is_active', true) as any

  if (categoryRoomsError || !categoryRooms?.length) throw new Error('Could not fetch room inventory')

  const categoryRoomIds = categoryRooms.map((entry: any) => entry.id)
  const totalRooms = categoryRooms.reduce((sum: number, entry: any) => sum + (Number(entry.total_rooms) || 0), 0)
  const controls = await getAvailabilityControls(checkIn, checkOut)
  const propertyCap = getPropertyCap(totalRooms)

  const { data: allRooms, error: allRoomsError } = await supabase
    .from('rooms')
    .select('id, category')
    .eq('is_active', true) as any

  if (allRoomsError || !allRooms?.length) throw new Error('Could not fetch room inventory')

  const roomCategoryMap = new Map<string, string>()
  const allRoomIds = allRooms.map((entry: any) => {
    roomCategoryMap.set(entry.id, entry.category)
    return entry.id
  })

  const { data: overlapping, error: overlappingError } = await supabase
    .from('bookings')
    .select('room_id, check_in, check_out, rooms_booked')
    .in('room_id', allRoomIds)
    .in('booking_status', ACTIVE_BOOKING_STATUSES)
    .lt('check_in', checkOut)
    .gt('check_out', checkIn) as any

  if (overlappingError) throw new Error('Could not check availability')

  const nightlyAvailability = getDateRange(checkIn, checkOut).map((date) => {
    const bookedRooms = getBookedRoomsForDate(overlapping || [], date, roomCategoryMap, room.category)
    const totalBookedForDate = getBookedRoomsForDate(overlapping || [], date)
    const control = controls.get(`${room.category}:${date}`)
    const sellableTotalRooms = Math.max(totalRooms, propertyCap)
    const controlledRooms = Math.max(0, Math.min(sellableTotalRooms, Number(control?.allowed_rooms ?? sellableTotalRooms) || 0))
    const propertyBoundRooms = Math.max(bookedRooms, propertyCap - Math.max(0, totalBookedForDate - bookedRooms))
    const allowedRooms = Math.max(0, Math.min(controlledRooms, propertyBoundRooms))
    const physicalAvailableRooms = Math.max(0, sellableTotalRooms - bookedRooms)

    return {
      date,
      totalRooms: sellableTotalRooms,
      controlAllowedRooms: controlledRooms,
      allowedRooms,
      blockedRooms: Math.max(0, sellableTotalRooms - allowedRooms),
      bookedRooms,
      availableRooms: Math.max(0, allowedRooms - bookedRooms),
      physicalAvailableRooms,
    }
  })

  const maxBookedRooms = nightlyAvailability.reduce((max, night) => Math.max(max, night.bookedRooms), 0)
  const minAvailableRooms = nightlyAvailability.reduce((min, night) => Math.min(min, night.availableRooms), totalRooms)
  const minAllowedRooms = nightlyAvailability.reduce((min, night) => Math.min(min, night.allowedRooms), totalRooms)
  const maxBlockedRooms = nightlyAvailability.reduce((max, night) => Math.max(max, night.blockedRooms), 0)
  const minPhysicalAvailableRooms = nightlyAvailability.reduce((min, night) => Math.min(min, night.physicalAvailableRooms), totalRooms)

  return {
    room,
    categoryRoomIds,
    totalRooms,
    controlAllowedRooms: nightlyAvailability.reduce((min, night) => Math.min(min, night.controlAllowedRooms), totalRooms),
    allowedRooms: minAllowedRooms,
    blockedRooms: maxBlockedRooms,
    bookedRooms: maxBookedRooms,
    availableRooms: Math.max(0, minAvailableRooms),
    physicalAvailableRooms: Math.max(0, minPhysicalAvailableRooms),
    fullyAvailable: nightlyAvailability.every((night) => night.availableRooms > 0),
    nightlyAvailability,
  }
}

export async function getCategoryAvailabilityCalendar(
  checkIn: string,
  checkOut: string
): Promise<Record<string, CategoryDailyAvailability[]>> {
  const { totalsByCategory, roomCategoryMap, overlapping } = await getInventoryAndBookings(checkIn, checkOut)
  const dates = getDateRange(checkIn, checkOut)
  const controls = await getAvailabilityControls(checkIn, checkOut)
  const propertyTotalInventory = Array.from(totalsByCategory.values()).reduce((sum, value) => sum + value, 0)
  const propertyCap = getPropertyCap(propertyTotalInventory)
  const totalBookedByDate = dates.reduce((map, date) => {
    map.set(date, getBookedRoomsForDate(overlapping, date))
    return map
  }, new Map<string, number>())
  const result: Record<string, CategoryDailyAvailability[]> = {}

  for (const category of Array.from(totalsByCategory.keys())) {
    const totalRooms = totalsByCategory.get(category) || 0
    result[category] = dates.map((date) => {
      const bookedRooms = getBookedRoomsForDate(overlapping, date, roomCategoryMap, category)
      const sellableTotalRooms = Math.max(totalRooms, propertyCap)
      const controlledRooms = Math.max(0, Math.min(sellableTotalRooms, Number(controls.get(`${category}:${date}`)?.allowed_rooms ?? sellableTotalRooms) || 0))
      const totalBookedForDate = totalBookedByDate.get(date) || 0
      const propertyBoundRooms = Math.max(bookedRooms, propertyCap - Math.max(0, totalBookedForDate - bookedRooms))
      const allowedRooms = Math.max(0, Math.min(controlledRooms, propertyBoundRooms))
      return {
        date,
        category,
        totalRooms: sellableTotalRooms,
        controlAllowedRooms: controlledRooms,
        allowedRooms,
        blockedRooms: Math.max(0, sellableTotalRooms - allowedRooms),
        bookedRooms,
        availableRooms: Math.max(0, allowedRooms - bookedRooms),
        physicalAvailableRooms: Math.max(0, sellableTotalRooms - bookedRooms),
      }
    })
  }

  return result
}

export async function getAdminAvailabilityCalendar(
  checkIn: string,
  checkOut: string
): Promise<Record<string, AdminCategoryDailyAvailability[]>> {
  const { totalsByCategory, roomCategoryMap, overlapping } = await getInventoryAndBookings(checkIn, checkOut)
  const dates = getDateRange(checkIn, checkOut)
  const controls = await getAvailabilityControls(checkIn, checkOut)
  const propertyTotalInventory = Array.from(totalsByCategory.values()).reduce((sum, value) => sum + value, 0)
  const propertyCap = getPropertyCap(propertyTotalInventory)
  const totalBookedByDate = dates.reduce((map, date) => {
    map.set(date, getBookedRoomsForDate(overlapping, date))
    return map
  }, new Map<string, number>())
  const result: Record<string, AdminCategoryDailyAvailability[]> = {}

  for (const category of Array.from(totalsByCategory.keys())) {
    const totalRooms = totalsByCategory.get(category) || 0
    const categoryBookings = overlapping.filter((booking) => roomCategoryMap.get(booking.room_id) === category)
    const metricsByDate = buildCategoryMetrics(category, dates, totalRooms, categoryBookings, controls, totalBookedByDate, propertyCap)

    result[category] = dates.map((date) => {
      const dayBookings = categoryBookings
        .filter((booking) => booking.check_in <= date && booking.check_out > date)
        .map((booking) => hydrateAdminBooking(booking, date, []))
      const metric = metricsByDate.get(date)
      return {
        ...(metric as Omit<AdminCategoryDailyAvailability, 'bookings'>),
        bookings: dayBookings,
      }
    })
  }

  return result
}

export async function getAdminRoomAvailabilityCalendar(
  checkIn: string,
  checkOut: string
): Promise<AdminRoomAvailabilityCalendar> {
  const { totalsByCategory, roomCategoryMap, overlapping } = await getInventoryAndBookings(checkIn, checkOut)
  const dates = getDateRange(checkIn, checkOut)
  const controls = await getAvailabilityControls(checkIn, checkOut)
  const labelsByCategory = getLabelInventory(totalsByCategory)
  const propertyTotalInventory = Array.from(totalsByCategory.values()).reduce((sum, value) => sum + value, 0)
  const propertyCap = getPropertyCap(propertyTotalInventory)
  const totalBookedByDate = dates.reduce((map, date) => {
    map.set(date, getBookedRoomsForDate(overlapping, date))
    return map
  }, new Map<string, number>())

  const sections = Array.from(totalsByCategory.keys())
    .sort((a, b) => {
      const orderDelta = getRoomCategoryOrder(a) - getRoomCategoryOrder(b)
      return orderDelta !== 0 ? orderDelta : a.localeCompare(b)
    })
    .map((category) => {
      const totalRooms = totalsByCategory.get(category) || 0
      const labels = labelsByCategory.get(category) || []
      const categoryBookings = overlapping.filter((booking) => roomCategoryMap.get(booking.room_id) === category)
      const metricsByDate = buildCategoryMetrics(category, dates, totalRooms, categoryBookings, controls, totalBookedByDate, propertyCap)

      return {
        category,
        totalRooms,
        rows: allocateCategoryRows(category, labels, dates, categoryBookings, metricsByDate),
      }
    })

  return { dates, sections }
}
