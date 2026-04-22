'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useBookingDates } from '@/context/BookingContext'
import { toLocalDateString } from '@/lib/utils'

const MAX_STAY_NIGHTS = 4

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toLocalDateString(date)
}

export default function AvailabilityBar({
  title = 'Check Availability',
  subtitle = 'Select your dates to unlock live website pricing.',
  compact = false,
  onChecked,
  autoApplyDefaultDates = false,
}: {
  title?: string
  subtitle?: string
  compact?: boolean
  onChecked?: () => void
  autoApplyDefaultDates?: boolean
}) {
  const { checkInDate, checkOutDate, setDates } = useBookingDates()
  const today = toLocalDateString(new Date())
  const defaultCheckOut = addDays(today, 1)
  const [checkIn, setCheckIn] = useState(checkInDate || today)
  const [checkOut, setCheckOut] = useState(checkOutDate || defaultCheckOut)
  const [error, setError] = useState('')
  const checkInInputRef = useRef<HTMLInputElement | null>(null)
  const checkOutInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!checkInDate || !checkOutDate) {
      const nextValue = {
        checkInDate: checkInDate || today,
        checkOutDate: checkOutDate || defaultCheckOut,
      }
      setDates(nextValue)
      if (autoApplyDefaultDates) {
        setCheckIn(nextValue.checkInDate)
        setCheckOut(nextValue.checkOutDate)
      }
    }
  }, [autoApplyDefaultDates, checkInDate, checkOutDate, defaultCheckOut, setDates, today])

  const minCheckOut = useMemo(() => {
    if (!checkIn) return addDays(today, 1)
    return addDays(checkIn, 1)
  }, [checkIn, today])
  const selectedNights = useMemo(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return 0
    return Math.ceil((new Date(`${checkOut}T12:00:00`).getTime() - new Date(`${checkIn}T12:00:00`).getTime()) / 86400000)
  }, [checkIn, checkOut])
  const isLongStay = selectedNights > MAX_STAY_NIGHTS

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (!checkIn || !checkOut) {
      setError('Please choose both check-in and check-out dates.')
      return
    }
    if (checkOut <= checkIn) {
      setError('Check-out must be after check-in.')
      return
    }
    const nights = Math.ceil((new Date(`${checkOut}T12:00:00`).getTime() - new Date(`${checkIn}T12:00:00`).getTime()) / 86400000)
    if (nights > MAX_STAY_NIGHTS) {
      setError(`Online booking is available for up to ${MAX_STAY_NIGHTS} nights only.`)
      return
    }

    setDates({ checkInDate: checkIn, checkOutDate: checkOut })
    onChecked?.()
  }

  function openDatePicker(input: HTMLInputElement | null) {
    if (!input) return
    input.focus()
    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }
    input.click()
  }

  return (
    <div
      className={`overflow-hidden rounded-[30px] border border-[#c9a14a]/15 bg-[#111111]/95 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur ${
        compact ? 'p-4 md:p-4.5' : 'p-6 md:p-7'
      }`}
    >
      <div className="absolute inset-0 pointer-events-none opacity-50" />
      <div className={`relative ${compact ? 'space-y-3' : 'space-y-5'}`}>
        <div>
          <p className={`text-[#c9a14a] text-xs uppercase tracking-[0.3em] font-semibold ${compact ? 'mb-1.5' : 'mb-2'}`}>Plan Your Stay</p>
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className={`${compact ? 'text-xl' : 'text-3xl'} font-playfair text-white`}>{title}</h3>
              {subtitle ? <p className="text-sm text-white/45">{subtitle}</p> : null}
            </div>
            {checkInDate && checkOutDate && (
              <div className="rounded-full border border-[#c9a14a]/20 bg-[#c9a14a]/8 px-3 py-1.5 text-xs text-[#c9a14a]/85">
                {checkInDate} to {checkOutDate}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className={`grid gap-3 md:grid-cols-[1.25fr_1.25fr_auto] md:items-end ${compact ? 'lg:grid-cols-[1fr_1fr_auto]' : ''}`}>
          <label
            className="block cursor-pointer"
            onClick={() => openDatePicker(checkInInputRef.current)}
          >
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.2em] text-white/40">Check-in</span>
            <input
              ref={checkInInputRef}
              type="date"
              value={checkIn}
              min={today}
              onChange={(event) => {
                setCheckIn(event.target.value)
                if (event.target.value) {
                  const nextMin = addDays(event.target.value, 1)
                  if (!checkOut || checkOut <= event.target.value) {
                    setCheckOut(nextMin)
                  }
                }
              }}
              className={`w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white focus:border-[#c9a14a] focus:outline-none ${compact ? 'py-2.5 text-sm' : 'py-3'}`}
            />
          </label>

          <label
            className="block cursor-pointer"
            onClick={() => openDatePicker(checkOutInputRef.current)}
          >
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.2em] text-white/40">Check-out</span>
            <input
              ref={checkOutInputRef}
              type="date"
              value={checkOut}
              min={minCheckOut}
              onChange={(event) => setCheckOut(event.target.value)}
              className={`w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white focus:border-[#c9a14a] focus:outline-none ${compact ? 'py-2.5 text-sm' : 'py-3'}`}
            />
          </label>

          <button
            type="submit"
            className={`rounded-2xl bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] px-6 text-sm font-bold text-black transition-all hover:opacity-90 ${compact ? 'py-3' : 'py-3.5'}`}
          >
            Check Availability
          </button>
        </form>

        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : isLongStay ? (
          <p className="text-xs text-[#c9a14a]/75">For stays longer than 4 days, please contact the Leafwalk team directly.</p>
        ) : (
          null
        )}
      </div>
    </div>
  )
}
