'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminNavbar from '@/components/AdminNavbar'
import toast, { Toaster } from 'react-hot-toast'
import { toLocalDateString } from '@/lib/utils'

interface Room {
  id: string
  name: string
  slug: string
  category: string
  total_rooms: number
  max_guests: number
  max_extra_beds: number
  is_active: boolean
  featured_image: string | null
  display_price_from: number
}

type AvailabilityControlSnapshot = {
  category: string
  totalRooms: number
  controlAllowedRooms: number
  allowedRooms: number
  blockedRooms: number
  bookedRooms: number
  availableRooms: number
  physicalAvailableRooms: number
  controlNotes: string | null
}

type AvailabilitySummaryRow = {
  date: string
  deluxe?: AvailabilityControlSnapshot
  premium?: AvailabilityControlSnapshot
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toLocalDateString(date)
}

function formatSummaryDate(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`)
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).replace(' ', '-')
}

export default function ManageRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void initWithAuth()
  }, [])

  async function initWithAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !session.access_token) {
        window.location.href = '/admin/login'
        return
      }

      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      if (!res.ok) {
        window.location.href = '/admin/login'
        return
      }

      setToken(session.access_token)
      await loadRooms(session.access_token)
    } catch (error) {
      console.error('Rooms page auth error:', error)
      window.location.href = '/admin/login'
    }
  }

  async function loadRooms(accessToken = token) {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/data?type=rooms-all', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || 'Could not load rooms')
      }
      setRooms((result.data || []) as Room[])
    } catch (error: any) {
      toast.error(error.message || 'Could not load rooms')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0d08]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c9a14a]/30 border-t-[#c9a14a]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0d08] text-white">
      <AdminNavbar />
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1f16', color: '#fff', border: '1px solid #c9a14a30' } }} />

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 font-playfair text-3xl text-white">Manage Rooms</h1>
            <p className="text-sm text-white/40">Room inventory and room settings live here. Pricing is managed from one unified tariff console.</p>
          </div>
          <Link
            href="/admin/tariff"
            className="rounded-xl bg-[#c9a14a] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#e6c87a]"
          >
            Open Unified Tariff Console
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-[#c9a14a]/20 bg-[#c9a14a]/5 p-4 text-sm text-[#c9a14a]/80">
          Direct booking, OTA, and tour operator prices are no longer edited from the room page. Use the unified tariff console so every source stays in sync.
        </div>

        <AvailabilityControlsPanel rooms={rooms} token={token} />

        <RoomsTab rooms={rooms} reload={loadRooms} />
      </div>
    </div>
  )
}

function AvailabilityControlsPanel({ rooms, token }: { rooms: Room[]; token: string }) {
  const today = toLocalDateString(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [bulkStartDate, setBulkStartDate] = useState(today)
  const [bulkEndDate, setBulkEndDate] = useState(today)
  const [selectedCategory, setSelectedCategory] = useState<'deluxe' | 'premium'>('deluxe')
  const [allowedRooms, setAllowedRooms] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [snapshots, setSnapshots] = useState<Record<string, AvailabilityControlSnapshot>>({})
  const [summaryRows, setSummaryRows] = useState<AvailabilitySummaryRow[]>([])

  const categoryTotals = useMemo(() => (
    rooms.reduce((acc, room) => {
      acc[room.category] = (acc[room.category] || 0) + Number(room.total_rooms || 0)
      return acc
    }, {} as Record<string, number>)
  ), [rooms])

  useEffect(() => {
    if (!token) return
    void loadSnapshots(selectedDate)
  }, [token, selectedDate])

  useEffect(() => {
    const snapshot = snapshots[selectedCategory]
    if (snapshot) {
      setAllowedRooms(String(snapshot.allowedRooms))
      setNotes(snapshot.controlNotes || '')
    } else {
      setAllowedRooms(String(categoryTotals[selectedCategory] || 0))
      setNotes('')
    }
  }, [selectedCategory, snapshots, categoryTotals])

  async function loadSnapshots(date: string) {
    setLoading(true)
    try {
      const checkOut = addDays(date, 7)
      const params = new URLSearchParams({ checkIn: date, checkOut })
      const response = await fetch(`/api/admin/availability-calendar?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not load availability controls')
      }
      const nextRowsMap = Array.isArray(result.sections)
        ? result.sections.reduce((acc: Record<string, AvailabilitySummaryRow>, section: any) => {
            const category = String(section?.category || '').trim().toLowerCase()
            const days = Array.isArray(section?.rows?.[0]?.days) ? section.rows[0].days : []
            if (!category || days.length === 0) return acc

            for (const day of days) {
              const dateKey = String(day?.date || '').slice(0, 10)
              if (!dateKey) continue
              const snapshot: AvailabilityControlSnapshot = {
                category,
                totalRooms: Number(day.totalRooms || section.totalRooms || 0),
                controlAllowedRooms: Number(day.controlAllowedRooms || day.allowedRooms || 0),
                allowedRooms: Number(day.allowedRooms || 0),
                blockedRooms: Number(day.blockedRooms || 0),
                bookedRooms: Number(day.bookedRooms || 0),
                availableRooms: Number(day.availableRooms || 0),
                physicalAvailableRooms: Number(day.physicalAvailableRooms || 0),
                controlNotes: day.controlNotes || null,
              }
              acc[dateKey] = acc[dateKey] || { date: dateKey }
              acc[dateKey][category as 'deluxe' | 'premium'] = snapshot
            }
            return acc
          }, {})
        : {}

      const nextSummaryRows = (Object.values(nextRowsMap) as AvailabilitySummaryRow[]).sort((left, right) => left.date.localeCompare(right.date))
      const selectedDay = nextRowsMap[date]
      setSummaryRows(nextSummaryRows)
      setSnapshots({
        deluxe: selectedDay?.deluxe as AvailabilityControlSnapshot,
        premium: selectedDay?.premium as AvailabilityControlSnapshot,
      })
    } catch (error: any) {
      toast.error(error.message || 'Could not load availability controls')
    } finally {
      setLoading(false)
    }
  }

  async function saveControl() {
    const parsedAllowed = Number(allowedRooms)
    const maxRooms = categoryTotals[selectedCategory] || 0
    if (!Number.isFinite(parsedAllowed) || parsedAllowed < 0) {
      toast.error('Enter a valid allowed room count')
      return
    }
    if (parsedAllowed > maxRooms) {
      toast.error(`Allowed rooms cannot exceed physical total (${maxRooms})`)
      return
    }

    setSaving(true)
    try {
      const payload = mode === 'bulk'
        ? {
            room_category: selectedCategory,
            start_date: bulkStartDate,
            end_date: bulkEndDate,
            allowed_rooms: parsedAllowed,
            notes,
          }
        : {
            room_category: selectedCategory,
            date: selectedDate,
            allowed_rooms: parsedAllowed,
            notes,
          }

      const response = await fetch('/api/admin/availability-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not save availability control')
      }
      toast.success(mode === 'bulk' ? 'Bulk availability updated for direct booking and OTA' : 'Availability updated for direct booking and OTA')
      await loadSnapshots(selectedDate)
    } catch (error: any) {
      toast.error(error.message || 'Could not save availability control')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-playfair text-2xl text-white">Availability Controls</h2>
          <p className="mt-1 text-sm text-white/45">
            Update sellable room availability for direct booking and OTA from here. The same allowed-room cap is used for website and OTA-facing availability.
          </p>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs text-blue-100">
          Calendar remains view-only for availability controls
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setMode('single')}
              className={`rounded-full px-4 py-2 text-xs font-medium ${mode === 'single' ? 'bg-[#c9a14a] text-black' : 'border border-white/10 bg-white/5 text-white/60'}`}
            >
              Single Date
            </button>
            <button
              onClick={() => setMode('bulk')}
              className={`rounded-full px-4 py-2 text-xs font-medium ${mode === 'bulk' ? 'bg-[#c9a14a] text-black' : 'border border-white/10 bg-white/5 text-white/60'}`}
            >
              Bulk Date Range
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {mode === 'single' ? (
              <div>
                <label className="mb-1.5 block text-xs text-white/45">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  min={today}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white"
                />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 md:col-span-1">
                <div>
                  <label className="mb-1.5 block text-xs text-white/45">Start Date</label>
                  <input
                    type="date"
                    value={bulkStartDate}
                    min={today}
                    onChange={(e) => {
                      setBulkStartDate(e.target.value)
                      if (bulkEndDate < e.target.value) setBulkEndDate(e.target.value)
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-white/45">End Date</label>
                  <input
                    type="date"
                    min={bulkStartDate > today ? bulkStartDate : today}
                    value={bulkEndDate}
                    onChange={(e) => setBulkEndDate(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs text-white/45">Room Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as 'deluxe' | 'premium')}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white"
              >
                <option value="deluxe">Deluxe</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
            <div>
              <label className="mb-1.5 block text-xs text-white/45">Allowed Rooms</label>
              <input
                type="number"
                min={0}
                max={categoryTotals[selectedCategory] || 0}
                value={allowedRooms}
                onChange={(e) => setAllowedRooms(e.target.value)}
                inputMode="numeric"
                style={{ MozAppearance: 'textfield' }}
                className="hide-number-spinner w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white [appearance:textfield]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-white/45">Notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Maintenance, VIP hold, internal block..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/45">
            <span>Physical total: {categoryTotals[selectedCategory] || 0}</span>
            <span>Direct booking availability uses this cap</span>
            <span>OTA availability uses this cap</span>
            {mode === 'bulk' ? <span>Bulk update applies to every date in the selected range</span> : null}
            <span>Past dates cannot be edited</span>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => void saveControl()}
              disabled={saving || loading || !token}
              className="rounded-xl bg-[#c9a14a] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#e6c87a] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Availability'}
            </button>
            <button
              onClick={() => void loadSnapshots(selectedDate)}
              disabled={loading || !token}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-white">Availability Summary</div>
              <div className="mt-1 text-xs text-white/40">7-day bookable, booked, and available view for both categories</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Previous 7 Days
              </button>
              <input
                type="date"
                value={selectedDate}
                min={today}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"
              />
              <button
                type="button"
                onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Next 7 Days
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-white/35">Date</th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-blue-300">Bookable DLX</th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-blue-300">DLX Booked</th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-blue-300">DLX Available</th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-[#c9a14a]">Bookable Premium</th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-[#c9a14a]">Premium Booked</th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-[#c9a14a]">Premium Available</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <tr key={row.date} className="border-b border-white/5">
                    <td className="px-3 py-3 font-medium text-white">{formatSummaryDate(row.date)}</td>
                    <td className="px-3 py-3 text-blue-200">{row.deluxe?.controlAllowedRooms ?? categoryTotals.deluxe ?? 0}</td>
                    <td className="px-3 py-3 text-blue-200">{row.deluxe?.bookedRooms ?? 0}</td>
                    <td className="px-3 py-3 text-emerald-300">{row.deluxe?.availableRooms ?? categoryTotals.deluxe ?? 0}</td>
                    <td className="px-3 py-3 text-[#e6c87a]">{row.premium?.controlAllowedRooms ?? categoryTotals.premium ?? 0}</td>
                    <td className="px-3 py-3 text-[#e6c87a]">{row.premium?.bookedRooms ?? 0}</td>
                    <td className="px-3 py-3 text-emerald-300">{row.premium?.availableRooms ?? categoryTotals.premium ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(['deluxe', 'premium'] as const).map((category) => {
              const snapshot = snapshots[category]
              if (!snapshot?.controlNotes) return null

              return (
                <div key={category} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55">
                  <span className="font-semibold capitalize text-white/75">{category} note:</span> {snapshot.controlNotes}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <style jsx>{`
        .hide-number-spinner::-webkit-outer-spin-button,
        .hide-number-spinner::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </div>
  )
}

function RoomsTab({ rooms, reload }: { rooms: Room[]; reload: () => void }) {
  const [editing, setEditing] = useState<Room | null>(null)
  const [saving, setSaving] = useState(false)

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  async function toggleActive(room: Room) {
    const token = await getToken()
    const res = await fetch(`/api/admin/data?type=room&id=${room.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_active: !room.is_active }),
    })
    const d = await res.json()
    if (!res.ok) toast.error(d.error || 'Update failed')
    else {
      toast.success(room.is_active ? 'Room deactivated' : 'Room activated')
      reload()
    }
  }

  async function saveRoom() {
    if (!editing) return
    setSaving(true)
    const token = await getToken()
    const res = await fetch(`/api/admin/data?type=room&id=${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: editing.name,
        total_rooms: editing.total_rooms,
        max_guests: editing.max_guests,
        max_extra_beds: editing.max_extra_beds,
        display_price_from: editing.display_price_from,
      }),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) toast.error(d.error || 'Save failed')
    else {
      toast.success('Room saved')
      setEditing(null)
      reload()
    }
  }

  return (
    <>
      <div className="grid gap-4">
        {rooms.map((room) => (
          <div key={room.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-white/15">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${room.is_active ? 'bg-green-400' : 'bg-red-400/60'}`} />
                <div>
                  <div className="text-base font-semibold text-white">{room.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      room.category === 'premium'
                        ? 'border-[#c9a14a]/30 bg-[#c9a14a]/10 text-[#c9a14a]'
                        : 'border-blue-500/25 bg-blue-500/10 text-blue-400'
                    }`}>
                      {room.category}
                    </span>
                    <span className="text-xs text-white/35">{room.total_rooms} rooms · max {room.max_guests} guests · {room.max_extra_beds} extra beds</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="mr-2 text-right">
                  <div className="font-semibold text-[#c9a14a]">Rs. {(room.display_price_from || 0).toLocaleString()}</div>
                  <div className="text-xs text-white/30">marketing display only</div>
                </div>
                <button
                  onClick={() => setEditing({ ...room })}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  Edit
                </button>
                <button
                  onClick={() => void toggleActive(room)}
                  className={`rounded-xl border px-4 py-2 text-sm transition ${
                    room.is_active
                      ? 'border-red-500/20 bg-red-500/8 text-red-400 hover:bg-red-500/15'
                      : 'border-green-500/20 bg-green-500/8 text-green-400 hover:bg-green-500/15'
                  }`}
                >
                  {room.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0f1410] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-playfair text-xl text-white">Edit Room</h2>
                <p className="mt-0.5 text-xs capitalize text-white/35">{editing.category} category</p>
              </div>
              <button onClick={() => setEditing(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-2xl leading-none text-white/30 hover:bg-white/5 hover:text-white">
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs text-white/45">Room Name</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition-colors focus:border-[#c9a14a]/50 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Rooms', key: 'total_rooms', min: 1 },
                  { label: 'Max Guests', key: 'max_guests', min: 1 },
                  { label: 'Extra Beds', key: 'max_extra_beds', min: 0 },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="mb-1.5 block text-xs text-white/45">{field.label}</label>
                    <input
                      type="number"
                      min={field.min}
                      value={(editing as any)[field.key]}
                      onChange={(e) => setEditing({ ...editing, [field.key]: parseInt(e.target.value, 10) || 0 })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white transition-colors focus:border-[#c9a14a]/50 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-white/45">Display Price From (marketing only)</label>
                <input
                  type="number"
                  min={0}
                  value={editing.display_price_from || ''}
                  onChange={(e) => setEditing({ ...editing, display_price_from: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition-colors focus:border-[#c9a14a]/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 transition hover:text-white">
                Cancel
              </button>
              <button onClick={() => void saveRoom()} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#c9a14a] py-2.5 text-sm font-semibold text-black transition hover:bg-[#e8c97a] disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
