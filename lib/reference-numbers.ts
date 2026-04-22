function getFiscalYearParts(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const startYear = month >= 4 ? year : year - 1
  const endYearShort = `${(startYear + 1) % 100}`.padStart(2, '0')
  return {
    startYear,
    fiscalYear: `${startYear}-${endYearShort}`,
  }
}

function sanitizeToken(value: string, length = 8) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, length)
}

export function buildBookingNumber(input: { id: string; createdAt?: string | Date | null }) {
  const date = input.createdAt ? new Date(input.createdAt) : new Date()
  const { fiscalYear } = getFiscalYearParts(date)
  const token = sanitizeToken(input.id, 8)
  return `LWB/${fiscalYear}/${token}`
}

export function buildHoldBookingNumber(input: { id: string; createdAt?: string | Date | null }) {
  const date = input.createdAt ? new Date(input.createdAt) : new Date()
  const { fiscalYear } = getFiscalYearParts(date)
  const token = sanitizeToken(input.id, 8)
  return `LWH/${fiscalYear}/${token}`
}

export function buildInvoiceNumber(input: { id: string; paidAt?: string | Date | null }) {
  const date = input.paidAt ? new Date(input.paidAt) : new Date()
  const { fiscalYear } = getFiscalYearParts(date)
  const token = sanitizeToken(input.id, 8)
  return `INV/${fiscalYear}/${token}`
}
