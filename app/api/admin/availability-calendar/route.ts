import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { getAdminRoomAvailabilityCalendar } from '@/lib/server-availability'

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null

  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !user) return null

  const { data: profile } = await getSupabaseAdmin()
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single() as any

  if (!profile || !['admin', 'manager'].includes(profile.role)) return null
  return { userId: user.id, role: profile.role }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const checkIn = String(searchParams.get('checkIn') || '').trim().slice(0, 10)
    const checkOut = String(searchParams.get('checkOut') || '').trim().slice(0, 10)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/

    if (!datePattern.test(checkIn) || !datePattern.test(checkOut)) {
      return NextResponse.json({ success: false, error: 'Valid check-in and check-out dates are required' }, { status: 400 })
    }

    if (checkOut <= checkIn) {
      return NextResponse.json({ success: false, error: 'Check-out must be after check-in' }, { status: 400 })
    }

    const calendar = await getAdminRoomAvailabilityCalendar(checkIn, checkOut)

    return NextResponse.json({
      success: true,
      checkIn,
      checkOut,
      ...calendar,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Could not load availability calendar' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const roomCategory = String(body.room_category || '').trim().toLowerCase()
    const allowedRooms = Number(body.allowed_rooms)
    const notes = body.notes ? String(body.notes).trim().slice(0, 500) : null
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    const today = new Date()
    const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    const date = String(body.date || '').trim().slice(0, 10)
    const startDate = String(body.start_date || '').trim().slice(0, 10)
    const endDate = String(body.end_date || '').trim().slice(0, 10)
    const hasRange = Boolean(startDate && endDate)

    if (!roomCategory || !Number.isFinite(allowedRooms) || allowedRooms < 0) {
      return NextResponse.json({ success: false, error: 'room_category and allowed_rooms are required' }, { status: 400 })
    }

    if (hasRange) {
      if (!datePattern.test(startDate) || !datePattern.test(endDate) || endDate < startDate) {
        return NextResponse.json({ success: false, error: 'Valid start_date and end_date are required' }, { status: 400 })
      }
      const start = new Date(`${startDate}T00:00:00Z`)
      if (start < todayDate) {
        return NextResponse.json({ success: false, error: 'Past dates cannot be updated' }, { status: 400 })
      }
    } else if (!datePattern.test(date)) {
      return NextResponse.json({ success: false, error: 'Valid date is required' }, { status: 400 })
    } else {
      const singleDate = new Date(`${date}T00:00:00Z`)
      if (singleDate < todayDate) {
        return NextResponse.json({ success: false, error: 'Past dates cannot be updated' }, { status: 400 })
      }
    }

    const { data: inventoryRows, error: inventoryError } = await getSupabaseAdmin()
      .from('rooms')
      .select('total_rooms')
      .eq('category', roomCategory)
      .eq('is_active', true) as any

    if (inventoryError) {
      throw inventoryError
    }

    const physicalTotal = (inventoryRows || []).reduce((sum: number, row: any) => sum + (Number(row.total_rooms) || 0), 0)
    if (physicalTotal <= 0) {
      return NextResponse.json({ success: false, error: 'No active room inventory found for that category' }, { status: 404 })
    }

    if (allowedRooms > physicalTotal) {
      return NextResponse.json({ success: false, error: `Allowed rooms cannot exceed physical total (${physicalTotal})` }, { status: 400 })
    }

    const dates = hasRange ? buildDateRange(startDate, endDate) : [date]
    const payload = dates.map((currentDate) => ({
      room_category: roomCategory,
      control_date: currentDate,
      allowed_rooms: allowedRooms,
      notes,
      updated_at: new Date().toISOString(),
      created_by: admin.userId,
    }))

    const { error } = await getSupabaseAdmin()
      .from('availability_controls')
      .upsert(payload as any, { onConflict: 'room_category,control_date' })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      room_category: roomCategory,
      allowed_rooms: allowedRooms,
      dates_updated: dates,
      bulk: hasRange,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Could not save availability control' }, { status: 500 })
  }
}

function buildDateRange(startDate: string, endDate: string) {
  const dates: string[] = []
  const current = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }
  return dates
}
