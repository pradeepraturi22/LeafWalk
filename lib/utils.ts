// lib/utils.ts - Fixed version without external dependencies

export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}

// Date formatting utilities
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  const day = `${d.getDate()}`.padStart(2, '0')
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date)
  const formattedDate = formatDate(d)
  const hours = `${d.getHours()}`.padStart(2, '0')
  const minutes = `${d.getMinutes()}`.padStart(2, '0')
  return `${formattedDate} ${hours}:${minutes}`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount)
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Calculate nights between two dates
export function calculateNights(checkIn: Date | string, checkOut: Date | string): number {
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// Other utility functions...
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[6-9]\d{9}$/
  return phoneRegex.test(phone.replace(/\D/g, ''))
}
