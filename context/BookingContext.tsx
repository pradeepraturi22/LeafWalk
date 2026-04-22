'use client'

import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { toLocalDateString } from '@/lib/utils'

type BookingSelection = {
  checkInDate: string
  checkOutDate: string
}

type BookingContextValue = {
  checkInDate: string
  checkOutDate: string
  hasDates: boolean
  hydrated: boolean
  setDates: (value: BookingSelection) => void
  clearDates: () => void
}

const STORAGE_KEY = 'leafwalk-booking-dates'
const BookingContext = createContext<BookingContextValue | null>(null)

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toLocalDateString(date)
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const today = toLocalDateString(new Date())
  const tomorrow = addDays(today, 1)
  const [dates, setDatesState] = useState<BookingSelection>({ checkInDate: today, checkOutDate: tomorrow })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<BookingSelection>
        const storedCheckIn = parsed.checkInDate || today
        const storedCheckOut = parsed.checkOutDate || tomorrow
        setDatesState({
          checkInDate: storedCheckIn,
          checkOutDate: storedCheckOut > storedCheckIn ? storedCheckOut : addDays(storedCheckIn, 1),
        })
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ checkInDate: today, checkOutDate: tomorrow }))
      }
    } finally {
      setHydrated(true)
    }
  }, [today, tomorrow])

  const setDates = (value: BookingSelection) => {
    setDatesState(value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    }
  }

  const clearDates = () => {
    const resetValue = { checkInDate: today, checkOutDate: tomorrow }
    setDatesState(resetValue)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resetValue))
    }
  }

  const contextValue = useMemo(() => ({
    checkInDate: dates.checkInDate,
    checkOutDate: dates.checkOutDate,
    hasDates: Boolean(dates.checkInDate && dates.checkOutDate),
    hydrated,
    setDates,
    clearDates,
  }), [dates, hydrated])

  return <BookingContext.Provider value={contextValue}>{children}</BookingContext.Provider>
}

export function useBookingDates() {
  const context = useContext(BookingContext)
  if (!context) throw new Error('useBookingDates must be used within BookingProvider')
  return context
}
