import { supabase } from './supabaseClient'

export interface AvailabilityCheck {
  roomId: string
  checkIn: string
  checkOut: string
  totalRooms: number
  bookedRooms: number
  availableRooms: number
  isAvailable: boolean
}

export async function checkAvailability(
  roomId: string,
  checkIn: string,
  checkOut: string,
  requestedRooms: number = 1
): Promise<AvailabilityCheck> {
  try {
    // Get room details
    const { data: room } = await supabase
      .from('rooms')
      .select('total_rooms')
      .eq('id', roomId)
      .single()

    if (!room) {
      throw new Error('Room not found')
    }

    // Get overlapping bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('rooms_booked')
      .eq('room_id', roomId)
      .neq('booking_status', 'cancelled')
      .or(`and(check_in.lte.${checkOut},check_out.gt.${checkIn})`)

    const bookedRooms = bookings?.reduce((sum, b) => sum + (b.rooms_booked || 0), 0) || 0
    const availableRooms = room.total_rooms - bookedRooms

    return {
      roomId,
      checkIn,
      checkOut,
      totalRooms: room.total_rooms,
      bookedRooms,
      availableRooms,
      isAvailable: availableRooms >= requestedRooms
    }
  } catch (error) {
    console.error('Error checking availability:', error)
    throw error
  }
}

export async function getAvailableRoomsList(checkIn: string, checkOut: string) {
  try {
    const { data: rooms } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)

    if (!rooms) return []

    const availabilityPromises = rooms.map(room => 
      checkAvailability(room.id, checkIn, checkOut, 1)
    )

    const availabilities = await Promise.all(availabilityPromises)

    return rooms.map((room, index) => ({
      ...room,
      availableRooms: availabilities[index].availableRooms,
      isAvailable: availabilities[index].availableRooms > 0
    }))
  } catch (error) {
    console.error('Error getting available rooms:', error)
    return []
  }
}

export async function validateBooking(
  roomId: string,
  checkIn: string,
  checkOut: string,
  requestedRooms: number
): Promise<{ valid: boolean; message: string }> {
  try {
    const availability = await checkAvailability(roomId, checkIn, checkOut, requestedRooms)

    if (!availability.isAvailable) {
      return {
        valid: false,
        message: `Only ${availability.availableRooms} room(s) available for selected dates. You requested ${requestedRooms}.`
      }
    }

    return {
      valid: true,
      message: 'Booking is valid'
    }
  } catch (error: any) {
    return {
      valid: false,
      message: error.message || 'Failed to validate booking'
    }
  }
}
