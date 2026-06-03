import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { sendBookingLifecycleEmails } from '@/lib/booking-email-triggers'
import { validateBookingStatusChange } from '@/lib/booking-status'
import { sanitizeString, sanitizeUnknown } from '@/lib/security'
import { logDebug, logError } from '@/lib/logger'
import { isLocalTestMode } from '@/lib/runtime-mode'

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return null

  const { data: { user }, error: authErr } = await getSupabaseAdmin().auth.getUser(token)
  if (authErr || !user) return null

  const { data: profile } = await getSupabaseAdmin().from('users').select('role').eq('id', user.id).single() as any
  if (!profile || !['admin', 'manager'].includes(profile.role)) return null
  return user
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

function validateAdminCheckInWindow(checkInDate?: string | null) {
  if (!checkInDate) {
    return 'Check-in date is missing for this booking'
  }

  const now = getIstNow()
  const bookingDate = String(checkInDate).slice(0, 10)

  if (bookingDate > now.date) {
    return 'Guests can only be checked in on their actual check-in date'
  }
  if (bookingDate === now.date && now.hour < 15) {
    return 'Guests can be checked in only after 3:00 PM on the check-in date'
  }

  return null
}

function validateAdminCheckOutWindow(checkOutDate?: string | null) {
  if (!checkOutDate) {
    return 'Check-out date is missing for this booking'
  }

  const now = getIstNow()
  const bookingDate = String(checkOutDate).slice(0, 10)

  if (bookingDate > now.date) {
    return 'Guests can only be checked out on or after their actual check-out date'
  }

  return null
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('bookings')
      .select(`
        id, booking_number, invoice_number, guest_name, guest_email, guest_phone,
        room_id, check_in, check_out, nights, adults, rooms_booked,
        total_amount, advance_amount, balance_amount,
        booking_status, payment_status, meal_plan,
        promo_code, discount_amount, razorpay_payment_id,
        special_requests, created_at, booking_source,
        room:rooms(name, category),
        tour_operator:tour_operators(company_name)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ bookings: data || [] })
  } catch (error) {
    logError('Admin bookings route error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = sanitizeUnknown(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const { booking_id, ...updates } = body
    if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

    const { data: existingBooking } = await getSupabaseAdmin()
      .from('bookings')
      .select('id, booking_status, payment_status, total_amount, advance_amount, balance_amount, tour_operator_id, check_in, check_out')
      .eq('id', booking_id)
      .single() as any

    if (!existingBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const allowed = ['booking_status', 'payment_status', 'special_requests', 'advance_amount', 'balance_amount', 'checked_in_at', 'checked_out_at', 'cancellation_reason']
    const safeUpdates: Record<string, any> = {}
    for (const key of allowed) {
      if (key in updates) safeUpdates[key] = updates[key]
    }

    if (safeUpdates.booking_status) {
      safeUpdates.booking_status = String(safeUpdates.booking_status).trim().toLowerCase()
      if (safeUpdates.booking_status === 'checked_in') {
        const checkInWindowError = validateAdminCheckInWindow(existingBooking.check_in)
        if (checkInWindowError) {
          return NextResponse.json({ error: checkInWindowError }, { status: 400 })
        }
      }
      if (safeUpdates.booking_status === 'checked_out') {
        const checkOutWindowError = validateAdminCheckOutWindow(existingBooking.check_out)
        if (checkOutWindowError) {
          return NextResponse.json({ error: checkOutWindowError }, { status: 400 })
        }
      }
      const transitionCheck = validateBookingStatusChange({
        currentStatus: existingBooking.booking_status,
        nextStatus: safeUpdates.booking_status,
        paymentStatus: safeUpdates.payment_status ?? existingBooking.payment_status,
        bookingTotal: existingBooking.total_amount,
        advanceAmount: safeUpdates.advance_amount ?? existingBooking.advance_amount,
        balanceAmount: safeUpdates.balance_amount ?? existingBooking.balance_amount,
        checkedInAt: safeUpdates.checked_in_at || null,
        checkedOutAt: safeUpdates.checked_out_at || null,
        cancellationReason: safeUpdates.cancellation_reason ? sanitizeString(String(safeUpdates.cancellation_reason), 500) : null,
      })
      if (!transitionCheck.valid) {
        return NextResponse.json({ error: transitionCheck.error }, { status: 400 })
      }
    }

    if (safeUpdates.advance_amount !== undefined) safeUpdates.advance_amount = Number(safeUpdates.advance_amount)
    if (safeUpdates.balance_amount !== undefined) safeUpdates.balance_amount = Number(safeUpdates.balance_amount)
    if (safeUpdates.cancellation_reason) safeUpdates.cancellation_reason = sanitizeString(String(safeUpdates.cancellation_reason), 500)

    const { error } = await getSupabaseAdmin().from('bookings').update(safeUpdates).eq('id', booking_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (safeUpdates.booking_status) {
      if (isLocalTestMode()) {
        logDebug('LOCAL TEST MODE admin bookings PATCH; evaluating email triggers', {
          booking_id,
          next_status: safeUpdates.booking_status || existingBooking.booking_status || 'unknown',
        })
      }
      await sendBookingLifecycleEmails(booking_id, 'admin_status_changed')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    logError('Admin bookings patch error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
