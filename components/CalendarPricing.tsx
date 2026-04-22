'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'
import { formatCurrency, toLocalDateString } from '@/lib/utils'
import BulkEditModal from '@/components/BulkEditModal'
import DateCell from '@/components/DateCell'

type PricingEntry = {
  date: string
  base_price: number
  extra_bed_price: number
  child_price: number
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function monthValue(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`
}

function monthLabel(date: Date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

function buildCalendarDays(currentMonth: Date) {
  const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())

  const cells: { date: string; inCurrentMonth: boolean; dayNumber: number }[] = []
  for (let index = 0; index < 42; index += 1) {
    const cursor = new Date(start)
    cursor.setDate(start.getDate() + index)
    cells.push({
      date: toLocalDateString(cursor),
      inCurrentMonth: cursor.getMonth() === currentMonth.getMonth(),
      dayNumber: cursor.getDate(),
    })
  }
  return cells
}

function rangeBetween(dates: string[], startDate: string, endDate: string) {
  const startIndex = dates.indexOf(startDate)
  const endIndex = dates.indexOf(endDate)
  if (startIndex === -1 || endIndex === -1) return [startDate]
  const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
  return dates.slice(from, to + 1)
}

export default function CalendarPricing() {
  const [roomCategory, setRoomCategory] = useState<'deluxe' | 'premium'>('deluxe')
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [pricing, setPricing] = useState<Record<string, PricingEntry>>({})
  const [loading, setLoading] = useState(false)
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [dragStartDate, setDragStartDate] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const rateType = 'lwweb'
  const editable = true
  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth])
  const currentMonthDates = useMemo(() => calendarDays.filter((day) => day.inCurrentMonth).map((day) => day.date), [calendarDays])

  const loadPricing = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        room_category: roomCategory,
        rate_type: 'lwweb',
        month: monthValue(currentMonth),
      })
      const response = await fetch(`/api/admin/get-pricing-calendar?${params.toString()}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not load pricing')

      const next: Record<string, PricingEntry> = {}
      for (const entry of result.dates || []) {
        next[entry.date] = entry
      }
      setPricing(next)
    } catch (error: any) {
      toast.error(error.message || 'Could not load pricing calendar')
    } finally {
      setLoading(false)
    }
  }, [currentMonth, rateType, roomCategory])

  useEffect(() => {
    loadPricing()
  }, [loadPricing])

  useEffect(() => {
    function handleMouseUp() {
      if (!isDragging) return
      setIsDragging(false)
      setDragStartDate(null)
      if (selectedDates.length > 0 && editable) setModalOpen(true)
    }

    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [editable, isDragging, selectedDates.length])

  async function getAdminToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  async function saveDates(payload: { base_price: number; extra_bed_price: number; child_price: number }) {
    const token = await getAdminToken()
    if (!token) {
      toast.error('Admin session expired')
      return
    }

      const endpoint = selectedDates.length > 1 ? '/api/admin/set-bulk-pricing' : '/api/admin/set-date-price'
      const body = selectedDates.length > 1
      ? { room_category: roomCategory, rate_type: 'lwweb', dates: selectedDates, ...payload }
      : { room_category: roomCategory, rate_type: 'lwweb', date: selectedDates[0], ...payload }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.error || 'Could not save price')

    toast.success(selectedDates.length > 1 ? 'Bulk pricing updated' : 'Date price saved')
    setModalOpen(false)
    setSelectedDates([])
    loadPricing()
  }

  function handleCellMouseDown(date: string) {
    if (!editable || !currentMonthDates.includes(date)) return
    setDragStartDate(date)
    setIsDragging(true)
    setSelectedDates([date])
  }

  function handleCellMouseEnter(date: string) {
    if (!editable || !isDragging || !dragStartDate || !currentMonthDates.includes(date)) return
    setSelectedDates(rangeBetween(currentMonthDates, dragStartDate, date))
  }

  function activeValues() {
    if (selectedDates.length !== 1) return undefined
    const current = pricing[selectedDates[0]]
    if (!current) return undefined
    return {
      base_price: current.base_price,
      extra_bed_price: current.extra_bed_price,
      child_price: current.child_price,
    }
  }

  const monthSummary = useMemo(() => {
    const entries = Object.values(pricing)
    if (entries.length === 0) return { days: 0, avg: 0 }
    const total = entries.reduce((sum, entry) => sum + Number(entry.base_price || 0), 0)
    return { days: entries.length, avg: Math.round(total / entries.length) }
  }, [pricing])

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-200/80">
        Date-wise pricing here updates only <strong>LWWEB</strong> direct website pricing. OTA and B2B pricing are not editable in this calendar.
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">Category</label>
            <div className="flex gap-2">
              {(['deluxe', 'premium'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRoomCategory(value)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold capitalize transition-all ${roomCategory === value ? 'bg-[#c9a14a] text-black' : 'border border-white/15 bg-white/5 text-white/60 hover:text-white'}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">Pricing Type</label>
            <div className="rounded-xl border border-[#c9a14a]/20 bg-[#c9a14a]/10 px-4 py-2.5 text-sm font-semibold text-[#e6c87a]">
              LWWEB Direct Website
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Prev
          </button>
          <div className="min-w-[180px] text-center">
            <p className="font-playfair text-2xl text-white">{monthLabel(currentMonth)}</p>
            <p className="text-xs text-white/35">
              {monthSummary.days > 0 ? `${monthSummary.days} priced days · avg ${formatCurrency(monthSummary.avg)}` : 'No pricing set'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          <span className="mr-2 inline-block h-3 w-3 rounded-full bg-white/20" />
          No price set
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          <span className="mr-2 inline-block h-3 w-3 rounded-full bg-emerald-400" />
          Date price available
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          <span className="mr-2 inline-block h-3 w-3 rounded-full bg-blue-400" />
          Drag selected range
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 grid grid-cols-7 gap-3">
          {WEEK_DAYS.map((day) => (
            <div key={day} className="px-2 text-center text-xs font-semibold uppercase tracking-[0.24em] text-white/30">
              {day}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex h-[420px] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#c9a14a] border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-3">
            {calendarDays.map((day) => (
              <DateCell
                key={day.date}
                date={day.date}
                dayNumber={day.dayNumber}
                inCurrentMonth={day.inCurrentMonth}
                isSelected={selectedDates.includes(day.date)}
                isEditable={editable && day.inCurrentMonth}
                pricing={pricing[day.date]}
                onMouseDown={handleCellMouseDown}
                onMouseEnter={handleCellMouseEnter}
              />
            ))}
          </div>
        )}
      </div>

      <BulkEditModal
        open={modalOpen}
        dates={selectedDates}
        initialValues={activeValues()}
        onClose={() => {
          setModalOpen(false)
          setSelectedDates([])
        }}
        onSave={saveDates}
      />
    </div>
  )
}
