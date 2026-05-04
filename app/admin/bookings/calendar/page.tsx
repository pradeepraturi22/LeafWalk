'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminNavbar from '@/components/AdminNavbar'
import { supabase } from '@/lib/supabaseClient'
import { formatDate, toLocalDateString } from '@/lib/utils'
import { getRoomCategoryLabel, getRoomCategoryOrder } from '@/lib/room-categories'

type BookingHoverItem = {
  id: string
  bookingNumber: string | null
  guestName: string
  guestEmail: string | null
  guestPhone: string | null
  source: string
  status: string
  paymentStatus: string
  roomsBooked: number
  adults: number
  mealPlan: string | null
  checkIn: string
  checkOut: string
  totalAmount: number
  advanceAmount: number
  balanceAmount: number
  paymentDueDate: string | null
  dueWithin7Days: boolean
  dueTodayOrOverdue: boolean
  operatorId: string | null
  operatorName: string | null
  operatorEmail: string | null
  operatorPhone: string | null
  roomLabels: string[]
}

type RoomDay = {
  date: string
  category: string
  roomLabel: string
  state: 'available' | 'blocked' | 'hold' | 'booked'
  totalRooms: number
  allowedRooms: number
  blockedRooms: number
  bookedRooms: number
  availableRooms: number
  physicalAvailableRooms: number
  bookings: BookingHoverItem[]
  primaryBooking: BookingHoverItem | null
  sourceSummary: Record<string, number>
  holdRooms: number
  confirmedRooms: number
  pendingPaymentAmount: number
  pendingPaymentBookings: number
  dueSoonCount: number
  controlNotes: string | null
}

type RoomRow = {
  category: string
  roomLabel: string
  roomIndex: number
  days: RoomDay[]
}

type RoomSection = {
  category: string
  totalRooms: number
  rows: RoomRow[]
}

type AvailabilityResponse = {
  success: boolean
  checkIn: string
  checkOut: string
  dates: string[]
  sections: RoomSection[]
  error?: string
}

type MatrixCell = {
  roomLabel: string
  category: string
  roomIndex: number
  day: RoomDay
}

type MatrixRow = {
  date: string
  leftCells: MatrixCell[]
  rightCells: MatrixCell[]
  leftAvailable: number
  rightAvailable: number
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toLocalDateString(date)
}

function daysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000))
}

function formatSourceLabel(source: string) {
  return source.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatCurrency(value: number) {
  return `Rs. ${Math.round(value).toLocaleString('en-IN')}`
}

function getCellText(day: RoomDay) {
  if (day.state === 'hold') return 'Hold'
  if (day.state === 'booked') return 'Booked'
  return 'Available'
}

function getCellTone(day: RoomDay) {
  if (day.state === 'hold') return 'bg-[#ffd400] text-black'
  if (day.state === 'booked') return 'bg-[#70ad47] text-white'
  if (day.state === 'blocked') return 'bg-[#808080] text-white'
  return 'bg-[#ffffff] text-black'
}

function getSectionLabel(category: string) {
  return getRoomCategoryLabel(category)
}

function getDateDisplayLabel(date: string) {
  const value = new Date(`${date}T12:00:00`)
  const day = value.getDate()
  const month = value.toLocaleString('en-IN', { month: 'short' })
  const year = `${value.getFullYear()}`.slice(-2)
  return `${day}-${month}-${year}`
}

function getMealPlanLabel(value: string | null) {
  if (!value) return 'EP'
  if (value === 'CP') return 'CP - Breakfast'
  if (value === 'MAP') return 'MAP - Breakfast + Dinner'
  if (value === 'AP') return 'AP - All Meals'
  if (value === 'EP') return 'EP - Room Only'
  return value
}

export default function AdminBookingsCalendarPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const [checkIn, setCheckIn] = useState(() => toLocalDateString(new Date()))
  const [checkOut, setCheckOut] = useState(() => addDays(toLocalDateString(new Date()), 10))
  const [dates, setDates] = useState<string[]>([])
  const [sections, setSections] = useState<RoomSection[]>([])
  const [selectedCell, setSelectedCell] = useState<MatrixCell | null>(null)

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    if (!token) return
    void loadCalendar(checkIn, checkOut, token)
  }, [token, checkIn, checkOut])

  async function bootstrap() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      window.location.href = '/admin/login'
      return
    }

    const verifyResponse = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (!verifyResponse.ok) {
      window.location.href = '/admin/login'
      return
    }

    setToken(session.access_token)
  }

  async function loadCalendar(nextCheckIn: string, nextCheckOut: string, accessToken: string) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ checkIn: nextCheckIn, checkOut: nextCheckOut })
      const response = await fetch(`/api/admin/availability-calendar?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      const result: AvailabilityResponse = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not load availability calendar')
      setDates(result.dates || [])
      setSections(result.sections || [])
      setSelectedCell(null)
    } catch (loadError: any) {
      setError(loadError.message || 'Could not load availability calendar')
      setDates([])
      setSections([])
    } finally {
      setLoading(false)
    }
  }

  const visibleSpan = useMemo(() => {
    return dates.length > 0 ? dates.length : daysBetween(checkIn, checkOut)
  }, [dates, checkIn, checkOut])

  function shiftRange(direction: number) {
    const delta = visibleSpan * direction
    setCheckIn((current) => addDays(current, delta))
    setCheckOut((current) => addDays(current, delta))
  }

  const orderedSections = useMemo(() => {
    return [...sections].sort((left, right) => {
      const leftOrder = getRoomCategoryOrder(left.category)
      const rightOrder = getRoomCategoryOrder(right.category)
      return leftOrder - rightOrder
    })
  }, [sections])

  const leftSection = orderedSections[0] || null
  const rightSection = orderedSections[1] || null

  const matrixRows = useMemo<MatrixRow[]>(() => {
    return dates.map((date, dateIndex) => {
      const leftCells = (leftSection?.rows || []).map((row) => ({
        roomLabel: row.roomLabel,
        category: row.category,
        roomIndex: row.roomIndex,
        day: row.days[dateIndex],
      }))
      const rightCells = (rightSection?.rows || []).map((row) => ({
        roomLabel: row.roomLabel,
        category: row.category,
        roomIndex: row.roomIndex,
        day: row.days[dateIndex],
      }))

      return {
        date,
        leftCells,
        rightCells,
        leftAvailable: leftCells[0]?.day.availableRooms ?? 0,
        rightAvailable: rightCells[0]?.day.availableRooms ?? 0,
      }
    })
  }, [dates, leftSection, rightSection])

  function handleCellSelect(cell: MatrixCell) {
    if (cell.day.state === 'available') {
      const params = new URLSearchParams({
        check_in: cell.day.date,
        check_out: addDays(cell.day.date, 1),
        room_label: cell.roomLabel,
        category: cell.category,
      })
      router.push(`/admin/bookings/walk-in?${params.toString()}`)
      return
    }
    setSelectedCell(cell)
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <AdminNavbar />
      <div className="mx-auto max-w-[2300px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#c9a14a]/70">Admin Calendar</p>
            <h1 className="mt-2 font-playfair text-3xl text-[#f4e6bd]">Booking Status Calendar</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <button onClick={() => shiftRange(-1)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">Previous</button>
            <input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" style={{ colorScheme: 'dark' }} />
            <input type="date" value={checkOut} min={addDays(checkIn, 1)} onChange={(event) => setCheckOut(event.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" style={{ colorScheme: 'dark' }} />
            <button onClick={() => void loadCalendar(checkIn, checkOut, token)} className="rounded-xl bg-[#c9a14a] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90">Refresh</button>
            <button onClick={() => shiftRange(1)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">Next</button>
          </div>
        </div>

        {error ? <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">{error}</div> : null}

        <div className="mb-4 flex flex-wrap gap-3 text-xs">
          <Legend label="Booked" classes="bg-[#70ad47] text-white" />
          <Legend label="Available" classes="bg-white text-black" />
          <Legend label="Hold" classes="bg-[#ffd400] text-black" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#cfcfcf] bg-white text-black shadow-2xl">
          <div className="overflow-x-auto">
            <table className="min-w-[1960px] border-collapse">
              <thead>
                <tr>
                  <th className="border border-[#bdbdbd] bg-[#efefef] px-3 py-1" />
                  <th colSpan={Math.max(leftSection?.rows.length || 1, 1)} className="border border-[#bdbdbd] bg-white px-3 py-1 text-center text-[18px] font-bold text-black">
                    {leftSection ? `${getSectionLabel(leftSection.category)} Rooms` : 'Rooms'}
                  </th>
                  <th className="w-6 bg-[#2b2b2b]" />
                  <th colSpan={Math.max(rightSection?.rows.length || 1, 1)} className="border border-[#bdbdbd] bg-white px-3 py-1 text-center text-[18px] font-bold text-black">
                    {rightSection ? `${getSectionLabel(rightSection.category)} Rooms` : 'Rooms'}
                  </th>
                  <th className="border border-[#bdbdbd] bg-white px-3 py-1" />
                  <th className="border border-[#bdbdbd] bg-white px-3 py-1" />
                  <th className="border border-[#bdbdbd] bg-white px-3 py-1" />
                </tr>
                <tr>
                  <th className="sticky left-0 z-20 border border-[#bdbdbd] bg-[#f4c7a1] px-3 py-2 text-center text-[16px] font-normal text-black">Date</th>
                  {(leftSection?.rows || []).map((row) => (
                    <th key={`head-left-${row.roomLabel}`} className="border border-[#bdbdbd] bg-[#ffe38e] px-2 py-2 text-center text-[15px] font-normal text-black">{row.roomLabel}</th>
                  ))}
                  <th className="w-6 bg-[#2b2b2b]" />
                  {(rightSection?.rows || []).map((row) => (
                    <th key={`head-right-${row.roomLabel}`} className="border border-[#bdbdbd] bg-[#f4b183] px-2 py-2 text-center text-[15px] font-normal text-black">{row.roomLabel}</th>
                  ))}
                  <th className="border border-[#bdbdbd] bg-[#f4b183] px-2 py-2 text-center text-[15px] font-normal text-black">Kitchen Area</th>
                  <th className="border border-[#bdbdbd] bg-[#fff2cc] px-2 py-2 text-center text-[13px] font-semibold text-black">{leftSection ? `${getSectionLabel(leftSection.category).slice(0, 3).toUpperCase()} Available` : 'Available'}</th>
                  <th className="border border-[#bdbdbd] bg-[#fff2cc] px-2 py-2 text-center text-[13px] font-semibold text-black">{rightSection ? `${getSectionLabel(rightSection.category).slice(0, 3).toUpperCase()} Available` : 'Available'}</th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row) => (
                  <tr key={row.date}>
                    <td className="sticky left-0 z-10 border border-[#bdbdbd] bg-[#d9e9f7] px-3 py-1 text-center text-[14px] text-black">{getDateDisplayLabel(row.date)}</td>
                    {row.leftCells.map((cell) => (
                      <RoomStatusCell key={`${row.date}-${cell.roomLabel}`} cell={cell} selectedCell={selectedCell} onSelect={handleCellSelect} />
                    ))}
                    <td className="w-6 bg-[#2b2b2b]" />
                    {row.rightCells.map((cell) => (
                      <RoomStatusCell key={`${row.date}-${cell.roomLabel}`} cell={cell} selectedCell={selectedCell} onSelect={handleCellSelect} />
                    ))}
                    <td className="border border-[#bdbdbd] bg-[#f3f3f3] px-2 py-1 text-center text-[13px] text-black">Available</td>
                    <td className="border border-[#bdbdbd] bg-white px-3 py-1 text-center text-[15px] font-semibold text-black">{row.leftAvailable}</td>
                    <td className="border border-[#bdbdbd] bg-white px-3 py-1 text-center text-[15px] font-semibold text-black">{row.rightAvailable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedCell ? <SelectedCellDetails cell={selectedCell} token={token} onClose={() => setSelectedCell(null)} /> : null}
        {loading ? <div className="mt-6 flex items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-[#c9a14a] border-t-transparent" /></div> : null}
      </div>
    </div>
  )
}

function RoomStatusCell({ cell, selectedCell, onSelect }: { cell: MatrixCell; selectedCell: MatrixCell | null; onSelect: (cell: MatrixCell) => void }) {
  const selected = selectedCell?.roomLabel === cell.roomLabel && selectedCell?.day.date === cell.day.date

  return (
    <td className="group relative border border-[#bdbdbd] px-1 py-1">
      <button
        type="button"
        onClick={() => onSelect(cell)}
        className={`min-w-[74px] px-2 py-1 text-center text-[13px] font-normal ${getCellTone(cell.day)} ${selected ? 'ring-2 ring-[#c9a14a]' : ''}`}
      >
        {getCellText(cell.day)}
      </button>
      <div className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-30 hidden w-96 -translate-x-1/2 border border-[#b8a45a] bg-[#fff2b2] p-4 text-left shadow-2xl group-hover:block">
        <div className="text-[16px] font-bold text-black">Pradeep:</div>
        {cell.day.primaryBooking ? (
          <div className="mt-2 space-y-1 text-[14px] text-black">
            <div>Hotel:- Leaf Walk Cottages- Yamunotri</div>
            <div>Guest Name- {cell.day.primaryBooking.guestName}</div>
            <div>Room- {cell.roomLabel}</div>
            <div>Meal Plan- {getMealPlanLabel(cell.day.primaryBooking.mealPlan)}</div>
            <div>Guests- {cell.day.primaryBooking.adults} Adult{cell.day.primaryBooking.adults > 1 ? 's' : ''}</div>
            <div>Source- {formatSourceLabel(cell.day.primaryBooking.source)}</div>
            <div>Status- {cell.day.primaryBooking.status.replace(/_/g, ' ')}</div>
            <div>Pending- {formatCurrency(cell.day.primaryBooking.balanceAmount)}</div>
            <div>Stay- {formatDate(cell.day.primaryBooking.checkIn)} to {formatDate(cell.day.primaryBooking.checkOut)}</div>
          </div>
        ) : (
          <div className="mt-2 text-[14px] text-black">Click to open admin booking form for this available slot.</div>
        )}
      </div>
    </td>
  )
}

function SelectedCellDetails({ cell, token, onClose }: { cell: MatrixCell; token: string; onClose: () => void }) {
  const [sendingId, setSendingId] = useState<string | null>(null)
  const sortedBookings = [...cell.day.bookings].sort((a, b) => Number(b.dueTodayOrOverdue || b.dueWithin7Days) - Number(a.dueTodayOrOverdue || a.dueWithin7Days))

  async function sendReminder(bookingId: string, channel: 'email' | 'sms' | 'whatsapp') {
    setSendingId(`${bookingId}:${channel}`)
    try {
      const response = await fetch('/api/admin/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'balance_reminder', booking_id: bookingId, channel }),
      })
      const result = await response.json()
      if (!response.ok || result.error) throw new Error(result.error || 'Could not send reminder')
      window.alert(`${channel.toUpperCase()} reminder sent successfully.`)
    } catch (error: any) {
      window.alert(error.message || 'Could not send reminder')
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-[#111111] p-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#c9a14a]/70">Selected Slot</p>
          <h2 className="mt-2 font-playfair text-2xl text-white">{cell.roomLabel} · {formatDate(cell.day.date)}</h2>
          <p className="mt-2 text-sm text-white/45">Status: {getCellText(cell.day)} · Category: {getSectionLabel(cell.category)}</p>
        </div>
        <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">Close Details</button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-6">
        <StatCard label="Allowed" value={String(cell.day.allowedRooms)} accent="text-[#c9a14a]" />
        <StatCard label="Booked" value={String(cell.day.bookedRooms)} accent="text-emerald-300" />
        <StatCard label="Hold" value={String(cell.day.holdRooms)} accent="text-yellow-300" />
        <StatCard label="Available" value={String(cell.day.availableRooms)} accent="text-red-300" />
        <StatCard label="Pending Bookings" value={String(cell.day.pendingPaymentBookings)} accent="text-rose-300" />
        <StatCard label="Pending Amount" value={formatCurrency(cell.day.pendingPaymentAmount)} accent="text-rose-200" />
      </div>

      <div className="mt-6 space-y-3">
        {sortedBookings.length ? sortedBookings.map((booking) => (
          <div key={booking.id} className={`rounded-2xl border p-4 ${booking.roomLabels.includes(cell.roomLabel) ? 'border-[#c9a14a]/40 bg-[#c9a14a]/10' : 'border-white/10 bg-white/[0.03]'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-white">{booking.guestName}</div>
                <div className="mt-1 text-sm text-white/45">{(booking.bookingNumber || booking.id.slice(0, 8))} · {formatSourceLabel(booking.source)} · {booking.status.replace(/_/g, ' ')}</div>
                <div className="mt-1 text-sm text-white/40">Guest: {booking.guestEmail || 'No email'} · {booking.guestPhone || 'No phone'}</div>
                {booking.operatorName ? <div className="mt-1 text-sm text-white/40">Tour operator: {booking.operatorName} · {booking.operatorEmail || 'No email'} · {booking.operatorPhone || 'No phone'}</div> : null}
                <div className="mt-1 text-sm text-white/40">Room refs: {booking.roomLabels.join(', ') || 'Not allocated'}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">{booking.roomsBooked} room</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">{booking.paymentStatus.replace(/_/g, ' ')}</span>
                {booking.roomLabels.includes(cell.roomLabel) ? <span className="rounded-full border border-[#c9a14a]/30 bg-[#c9a14a]/10 px-3 py-1 text-xs font-semibold text-[#f4e6bd]">Occupies this slot</span> : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <MiniInfo label="Stay" value={`${formatDate(booking.checkIn)} to ${formatDate(booking.checkOut)}`} />
              <MiniInfo label="Guests" value={`${booking.adults} adult${booking.adults > 1 ? 's' : ''}`} />
              <MiniInfo label="Meal Plan" value={getMealPlanLabel(booking.mealPlan)} />
              <MiniInfo label="Source" value={formatSourceLabel(booking.source)} />
              <MiniInfo label="Pending" value={formatCurrency(booking.balanceAmount)} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => sendReminder(booking.id, 'email')} disabled={sendingId === `${booking.id}:email`} className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100 transition hover:bg-blue-500/20 disabled:opacity-50">{sendingId === `${booking.id}:email` ? 'Sending Email...' : 'Send Email Reminder'}</button>
              <button onClick={() => sendReminder(booking.id, 'whatsapp')} disabled={sendingId === `${booking.id}:whatsapp`} className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50">{sendingId === `${booking.id}:whatsapp` ? 'Sending WhatsApp...' : 'Send WhatsApp Reminder'}</button>
              <button onClick={() => sendReminder(booking.id, 'sms')} disabled={sendingId === `${booking.id}:sms`} className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-50">{sendingId === `${booking.id}:sms` ? 'Sending SMS...' : 'Send SMS Reminder'}</button>
            </div>
          </div>
        )) : <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">No bookings found for this date.</div>}
      </div>
    </div>
  )
}

function Legend({ label, classes }: { label: string; classes: string }) {
  return <span className={`rounded-sm border border-[#999] px-3 py-1 font-semibold ${classes}`}>{label}</span>
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</div><div className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</div></div>
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="text-[11px] uppercase tracking-[0.15em] text-white/35">{label}</div><div className="mt-1 text-sm font-medium text-white">{value}</div></div>
}
