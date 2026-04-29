import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCategoryAvailabilityForRoom } from '@/lib/server-availability'
import { parseJsonBody, sanitizeString } from '@/lib/security'
import { logError } from '@/lib/logger'

const availabilitySchema = z.object({
  roomId: z.string().uuid('Invalid room ID'),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid check-in date'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid check-out date'),
})

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, availabilitySchema)
  if (!parsed.success) {
    return parsed.response
  }

  try {
    const roomId = sanitizeString(parsed.data.roomId, 64)
    const checkIn = parsed.data.checkIn
    const checkOut = parsed.data.checkOut

    if (checkIn >= checkOut) {
      return NextResponse.json({ error: 'Check-out must be after check-in' }, { status: 400 })
    }

    const availability = await getCategoryAvailabilityForRoom(roomId, checkIn, checkOut)

    return NextResponse.json({
      availableRooms: availability.availableRooms,
      allowedRooms: availability.allowedRooms,
      blockedRooms: availability.blockedRooms,
      totalRooms: availability.totalRooms,
      bookedRooms: availability.bookedRooms,
      physicalAvailableRooms: availability.physicalAvailableRooms,
      category: availability.room.category,
      fullyAvailable: availability.fullyAvailable,
      nightlyAvailability: availability.nightlyAvailability,
    })
  } catch (error: any) {
    logError('Availability check error:', error)

    if (error.message === 'Room not found' || error.message === 'Room not available') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    if (error.message === 'Could not fetch room inventory' || error.message === 'Could not check availability') {
      return NextResponse.json({ error: 'Could not check availability' }, { status: 500 })
    }

    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
