type BookingTransitionInput = {
  currentStatus: string
  nextStatus: string
  bookingTotal?: number | null
  advanceAmount?: number | null
  balanceAmount?: number | null
  checkedInAt?: string | null
  checkedOutAt?: string | null
  cancellationReason?: string | null
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['hold', 'confirmed', 'cancelled'],
  hold: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: [],
}

function normalizeStatus(status: string) {
  return String(status || '').trim().toLowerCase()
}

export function isValidBookingTransition(currentStatus: string, nextStatus: string) {
  const current = normalizeStatus(currentStatus)
  const next = normalizeStatus(nextStatus)
  if (!current || !next) return false
  if (current === next) return true
  return (ALLOWED_TRANSITIONS[current] || []).includes(next)
}

export function validateBookingStatusChange(input: BookingTransitionInput) {
  const current = normalizeStatus(input.currentStatus)
  const next = normalizeStatus(input.nextStatus)

  if (!isValidBookingTransition(current, next)) {
    return { valid: false, error: `Invalid booking status transition: ${current || 'unknown'} -> ${next || 'unknown'}` }
  }

  const total = Number(input.bookingTotal || 0)
  const advance = Number(input.advanceAmount || 0)
  const balance = Number(input.balanceAmount || 0)

  if (advance < 0 || balance < 0 || total < 0) {
    return { valid: false, error: 'Amount fields cannot be negative' }
  }

  if (total > 0 && advance + balance > total + 0.01) {
    return { valid: false, error: 'Advance and balance exceed booking total' }
  }

  if (next === 'confirmed' && advance <= 0 && balance >= total) {
    return { valid: false, error: 'Advance amount is required before confirming a booking' }
  }

  if (next === 'checked_in' && !input.checkedInAt) {
    return { valid: false, error: 'checked_in_at is required before moving to checked_in' }
  }

  if (next === 'checked_out' && !input.checkedOutAt) {
    return { valid: false, error: 'checked_out_at is required before moving to checked_out' }
  }

  if (next === 'cancelled' && !String(input.cancellationReason || '').trim()) {
    return { valid: false, error: 'cancellation_reason is required before cancelling a booking' }
  }

  return { valid: true as const }
}
