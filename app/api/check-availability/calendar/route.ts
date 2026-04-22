import { NextResponse } from 'next/server'
import { getCategoryAvailabilityCalendar } from '@/lib/server-availability'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const checkIn = String(body?.checkIn || '').trim().slice(0, 10)
    const checkOut = String(body?.checkOut || '').trim().slice(0, 10)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/

    if (!datePattern.test(checkIn) || !datePattern.test(checkOut)) {
      return NextResponse.json({ error: 'Valid check-in and check-out dates are required' }, { status: 400 })
    }

    if (checkOut <= checkIn) {
      return NextResponse.json({ error: 'Check-out must be after check-in' }, { status: 400 })
    }

    const availability = await getCategoryAvailabilityCalendar(checkIn, checkOut)

    return NextResponse.json({
      success: true,
      checkIn,
      checkOut,
      categories: availability,
    })
  } catch (err: any) {
    console.error('Availability calendar error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
