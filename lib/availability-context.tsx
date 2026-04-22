'use client'

import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type AvailabilitySelection = {
  checkIn: string
  checkOut: string
  adults: number
  children: number
}

type AvailabilityContextValue = {
  selection: AvailabilitySelection
  hydrated: boolean
  setSelection: (next: Partial<AvailabilitySelection>) => void
  clearSelection: () => void
  hasDates: boolean
}

const STORAGE_KEY = 'leafwalk-availability-selection'

const defaultSelection: AvailabilitySelection = {
  checkIn: '',
  checkOut: '',
  adults: 2,
  children: 0,
}

const AvailabilityContext = createContext<AvailabilityContextValue | null>(null)

export function AvailabilityProvider({ children }: { children: ReactNode }) {
  const [selection, setSelectionState] = useState<AvailabilitySelection>(defaultSelection)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AvailabilitySelection>
        setSelectionState({
          checkIn: parsed.checkIn || '',
          checkOut: parsed.checkOut || '',
          adults: Number(parsed.adults || 2),
          children: Number(parsed.children || 0),
        })
      }
    } catch {
      // Ignore malformed local storage and fall back to defaults.
    } finally {
      setHydrated(true)
    }
  }, [])

  const setSelection = (next: Partial<AvailabilitySelection>) => {
    setSelectionState((current) => {
      const merged = { ...current, ...next }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      }
      return merged
    })
  }

  const clearSelection = () => {
    setSelectionState(defaultSelection)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }

  const value = useMemo(() => ({
    selection,
    hydrated,
    setSelection,
    clearSelection,
    hasDates: Boolean(selection.checkIn && selection.checkOut),
  }), [selection, hydrated])

  return <AvailabilityContext.Provider value={value}>{children}</AvailabilityContext.Provider>
}

export function useAvailabilitySelection() {
  const context = useContext(AvailabilityContext)
  if (!context) {
    throw new Error('useAvailabilitySelection must be used within AvailabilityProvider')
  }
  return context
}
