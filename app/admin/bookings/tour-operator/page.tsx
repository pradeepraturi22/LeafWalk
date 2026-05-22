'use client'
import React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import { getIndiaStateCodeByName } from '@/lib/india-state-codes'

const MEAL_PLANS = [
  { value: 'EP', label: 'EP — Room Only' },
  { value: 'CP', label: 'CP — With Breakfast' },
  { value: 'MAP', label: 'MAP — Breakfast + Dinner' },
  { value: 'AP', label: 'AP — All Meals' },
]
const INPUT = "w-full px-4 py-3 bg-[#1a1a1a] border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a] placeholder:text-white/30 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
const LABEL = "block text-white/70 text-sm mb-2"
const NUM = `${INPUT} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`

interface RoomLine {
  id: string
  room_id: string
  rooms_booked: number
  adults: number
  children_below_5: number
  children_5_to_12: number
  extra_beds: number
  meal_plan: string
  rate_per_room_per_night: number
  extra_bed_rate: number
  child_rate: number
  manual_price: boolean
  rateInfo: any
  rateFetching: boolean
  availability: any
}

function newLine(): RoomLine {
  return {
    id: Math.random().toString(36).slice(2),
    room_id: '', rooms_booked: 1, adults: 2,
    children_below_5: 0, children_5_to_12: 0, extra_beds: 0,
    meal_plan: 'CP', rate_per_room_per_night: 0,
    extra_bed_rate: 0, child_rate: 0,
    manual_price: true, rateInfo: null, rateFetching: false, availability: null,
  }
}

function calcLine(
  line: RoomLine,
  nights: number,
  options: { calculateGst: boolean; priceIncludesTax: boolean }
) {
  const room = line.rate_per_room_per_night * line.rooms_booked * nights
  const eb = line.extra_bed_rate * line.extra_beds * nights
  const child = line.child_rate * line.children_5_to_12 * nights
  const base = room + eb + child
  if (!options.calculateGst) return { room, eb, child, base, subtotal: base, cgst: 0, sgst: 0, total: base }
  if (options.priceIncludesTax) {
    const subtotal = Math.round(base / 1.05 * 100) / 100
    const cgst = Math.round((base - subtotal) / 2 * 100) / 100
    return { room, eb, child, base, subtotal, cgst, sgst: Math.round((base - subtotal - cgst) * 100) / 100, total: base }
  }
  const subtotal = base
  const cgst = Math.round(subtotal * 0.025 * 100) / 100
  const sgst = Math.round(subtotal * 0.025 * 100) / 100
  return { room, eb, child, base, subtotal, cgst, sgst, total: subtotal + cgst + sgst }
}

export default function TourOperatorBooking() {
  const router = useRouter()
  const [rooms, setRooms] = useState<any[]>([])
  const [operators, setOperators] = useState<any[]>([])
  const [selectedOperator, setSelectedOperator] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [bookingMode, setBookingMode] = useState<'hold' | 'confirm'>('hold')
  const [lines, setLines] = useState<RoomLine[]>([newLine()])

  const [form, setForm] = useState({
    tour_operator_id: '',
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    check_in: '',
    check_out: '',
    special_requests: '',
    admin_notes: '',
    hold_notes: '',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    advance_amount: 0,
    commission_rate: 10,
    calculate_gst: true,
    price_includes_tax: true,
  })

  useEffect(() => { init() }, [])

  useEffect(() => {
    const op = operators.find(o => o.id === form.tour_operator_id)
    setSelectedOperator(op || null)
    setForm(p => ({
      ...p,
      commission_rate: op ? op.commission_rate || 10 : p.commission_rate,
    }))
  }, [form.tour_operator_id, operators])


  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }
  async function init() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { window.location.href = '/admin/login'; return }
      const vres = await fetch('/api/admin/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!vres.ok) { window.location.href = '/admin/login'; return }
      await loadData()
    } catch { window.location.href = '/admin/login'; return }
  }

  async function loadData() {
    const token = await getToken()
    const [r, o] = await Promise.all([
      fetch('/api/admin/data?type=rooms', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/admin/data?type=active-operators', { headers: { Authorization: `Bearer ${token}` } })
    ])
    setRooms((await r.json()).data || [])
    setOperators((await o.json()).data || [])
  }

  const upd = (idx: number, patch: Partial<RoomLine>) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l))

  async function fetchRate(idx: number, roomId?: string, mealPlan?: string, checkInOverride?: string) {
    const line = lines[idx]
    const rId = roomId ?? line.room_id
    const mp = mealPlan ?? line.meal_plan
    const checkIn = checkInOverride ?? form.check_in
    if (!rId || !checkIn) return
    const room = rooms.find(r => r.id === rId)
    if (!room) return
    upd(idx, { rateFetching: true })
    try {
      const res = await fetch(
        `/api/admin/data?type=rate&category=${room.category}&check_in=${checkIn}&meal_plan=${mp}&rate_type=b2b`,
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      )
      const data = await res.json()
      if (data.found) {
        upd(idx, { rateInfo: data, rate_per_room_per_night: data.price_per_night, extra_bed_rate: data.extra_bed_price || 0, child_rate: data.child_5_12_price || 0, rateFetching: false })
      } else { upd(idx, { rateInfo: null, rateFetching: false }) }
    } catch { upd(idx, { rateFetching: false }) }
  }

  async function checkAvail(idx: number, roomId: string, roomsNeeded: number, checkInOverride?: string, checkOutOverride?: string) {
    const checkIn = checkInOverride ?? form.check_in
    const checkOut = checkOutOverride ?? form.check_out
    if (!roomId || !checkIn || !checkOut) return
    try {
      const res = await fetch('/api/admin/data?type=availability', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ room_id: roomId, check_in: checkIn, check_out: checkOut, rooms_needed: roomsNeeded })
      })
      upd(idx, { availability: await res.json() })
    } catch {}
  }

  useEffect(() => {
    setLines(prev => prev.map(line => ({
      ...line,
      availability: null,
      rateInfo: null,
      rateFetching: Boolean(line.room_id && form.check_in),
    })))

    if (!form.check_in || !form.check_out || form.check_out <= form.check_in) {
      setLines(prev => prev.map(line => ({ ...line, rateFetching: false })))
      return
    }

    const snapshot = lines.map(line => ({ ...line }))
    const timer = window.setTimeout(() => {
      snapshot.forEach((line, idx) => {
        if (!line.room_id) return
        fetchRate(idx, line.room_id, line.meal_plan, form.check_in)
        checkAvail(idx, line.room_id, line.rooms_booked, form.check_in, form.check_out)
      })
    }, 150)

    return () => window.clearTimeout(timer)
  }, [form.check_in, form.check_out])

  const set = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }))

  function addDaysToDate(value: string, days: number) {
    if (!value) return ''
    const date = new Date(`${value}T12:00:00`)
    date.setDate(date.getDate() + days)
    return date.toISOString().slice(0, 10)
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10)
  }

  function tomorrowIso() {
    return addDaysToDate(todayIso(), 1)
  }

  function handleCheckInChange(value: string) {
    setForm(p => ({
      ...p,
      check_in: value,
      check_out: value ? addDaysToDate(value, 1) : '',
    }))
    setErrors(p => ({ ...p, check_out: '' }))
  }

  function handleCheckOutChange(value: string) {
    const minCheckout = form.check_in ? addDaysToDate(form.check_in, 1) : tomorrowIso()
    const safeCheckout = value && value < minCheckout ? minCheckout : value
    setForm(p => ({
      ...p,
      check_out: safeCheckout,
    }))
    setErrors(p => ({ ...p, check_out: '' }))
  }

  function validateField(field: string, value: any) {
    let e = ''
    if (field === 'guest_phone' && value && !/^\d{10}$/.test(value)) e = '10 digit required'
    if (field === 'guest_email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) e = 'Valid email required'
    if (field === 'guest_name' && !value?.trim()) e = 'Required'
    if (field === 'check_out' && form.check_in && value && value <= form.check_in) e = 'Must be after check-in'
    setErrors(p => ({ ...p, [field]: e }))
    return e === ''
  }

  const Err = ({ f }: { f: string }) => errors[f] ? <p className="text-red-400 text-xs mt-1">{errors[f]}</p> : null

  const nights = form.check_in && form.check_out
    ? Math.max(0, Math.ceil((new Date(form.check_out).getTime() - new Date(form.check_in).getTime()) / 86400000)) : 0

  const calcs = lines.map(l => calcLine(l, nights, {
    calculateGst: form.calculate_gst,
    priceIncludesTax: form.price_includes_tax,
  }))
  const grandTotal = calcs.reduce((s, c) => s + c.total, 0)
  const grandSub = calcs.reduce((s, c) => s + c.subtotal, 0)
  const grandCgst = calcs.reduce((s, c) => s + c.cgst, 0)
  const grandSgst = calcs.reduce((s, c) => s + c.sgst, 0)
  const grandGst = grandCgst + grandSgst
  const selectedOperatorStateCode = getIndiaStateCodeByName(selectedOperator?.state)
  const isIntraStateBilling = !selectedOperatorStateCode || selectedOperatorStateCode === '05'
  const commission = Math.round(grandTotal * form.commission_rate / 100 * 100) / 100
  const netAmt = grandTotal - commission
  const balance = Math.max(0, grandTotal - form.advance_amount)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateField('guest_name', form.guest_name)) { toast.error('Guest name required'); return }
    if (form.guest_phone && !validateField('guest_phone', form.guest_phone)) { toast.error('Phone format wrong'); return }
    if (!form.tour_operator_id) { toast.error('Select operator'); return }
    if (lines.some(l => !l.room_id)) { toast.error('All room lines mein room select karo'); return }
    if (nights === 0) { toast.error('Check dates fix karo'); return }
    // Duplicate room check
    const roomIds = lines.map(l => l.room_id).filter(Boolean)
    if (new Set(roomIds).size !== roomIds.length) { toast.error('Ek hi room type do baar select hai — duplicate hatao'); return }
    if (lines.some(l => l.availability?.available === false)) { toast.error('Kuch rooms available nahi'); return }

    setSubmitting(true)
    try {
      const first = lines[0], fc = calcs[0]
      const payload = {
        tour_operator_id: form.tour_operator_id,
        guest_name: form.guest_name,
        guest_email: form.guest_email || null,
        guest_phone: form.guest_phone || null,
        room_id: first.room_id,
        check_in: form.check_in, check_out: form.check_out, nights,
        rooms_booked: first.rooms_booked, adults: first.adults,
        children_below_5: first.children_below_5, children_5_to_12: first.children_5_to_12,
        extra_beds: first.extra_beds, meal_plan: first.meal_plan,
        booking_source: 'tour_operator', booking_type: 'b2b',
        is_multi_room: lines.length > 1,
        booking_status: bookingMode === 'hold' ? 'hold' : 'confirmed',
        rate_per_room_per_night: first.rate_per_room_per_night,
        extra_bed_rate_per_night: first.extra_bed_rate,
        child_rate_per_night: first.child_rate,
        subtotal: Math.round(grandSub * 100) / 100,
        cgst: Math.round(grandCgst * 100) / 100,
        sgst: Math.round(grandSgst * 100) / 100,
        gst_total: Math.round(grandGst * 100) / 100,
        total_amount: Math.round(grandTotal * 100) / 100,
        payment_method: bookingMode === 'confirm' ? form.payment_method : null,
        payment_date: bookingMode === 'confirm' ? form.payment_date || null : null,
        payment_status: bookingMode === 'hold' ? 'pending'
          : form.advance_amount >= grandTotal ? 'fully_paid' : 'payment_processing',
        advance_amount: bookingMode === 'confirm' ? form.advance_amount : 0,
        balance_amount: bookingMode === 'confirm' ? balance : Math.round(grandTotal * 100) / 100,
        special_requests: form.special_requests || null,
        admin_notes: form.admin_notes || null,
        hold_notes: bookingMode === 'hold' ? form.hold_notes || null : null,
        held_at: bookingMode === 'hold' ? new Date().toISOString() : null,
        confirmed_at: bookingMode === 'confirm' ? new Date().toISOString() : null,
        season_id: first.rateInfo?.season_id || null,
        room_items: lines.length > 1 ? lines.map((l, i) => ({
          room_id: l.room_id, rooms_booked: l.rooms_booked,
          adults: l.adults, children_below_5: l.children_below_5,
          children_5_to_12: l.children_5_to_12, extra_beds: l.extra_beds,
          meal_plan: l.meal_plan, rate_per_room_per_night: l.rate_per_room_per_night,
          extra_bed_rate_per_night: l.extra_bed_rate, child_rate_per_night: l.child_rate,
          subtotal: Math.round(calcs[i].subtotal * 100) / 100,
          cgst: Math.round(calcs[i].cgst * 100) / 100,
          sgst: Math.round(calcs[i].sgst * 100) / 100,
          line_total: Math.round(calcs[i].total * 100) / 100,
          season_id: l.rateInfo?.season_id || null,
        })) : null,
      }

      const { data: { session: _tosess } } = await supabase.auth.getSession()
      const authToken = (await getToken()) || _tosess?.access_token || ''
      const res = await fetch('/api/admin/data?type=booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(payload)
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      toast.success(bookingMode === 'hold'
        ? `🔒 Room Hold! ${result.booking_number} — Confirmation pending`
        : `✅ Confirmed! ${result.booking_number}`)
      setTimeout(() => { window.location.href = '/admin/bookings' }, 1500)
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] py-8 px-4">
      <Toaster position="top-center" />
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-playfair text-[#c9a14a] mb-1">Tour Operator Booking</h1>
            <p className="text-white/40 text-sm">B2B — Multi-room support, Hold & Confirm flow</p>
          </div>
          <Link href="/admin/dashboard" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm transition-all">← Dashboard</Link>
        </div>

        {/* Mode Toggle */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setBookingMode('hold')}
              className={`py-5 rounded-xl border-2 transition-all ${bookingMode === 'hold' ? 'border-yellow-500 bg-yellow-500/10' : 'border-white/10 bg-white/5 hover:bg-white/8'}`}>
              <div className="text-2xl mb-1">🔒</div>
              <div className={`font-semibold text-sm ${bookingMode === 'hold' ? 'text-yellow-400' : 'text-white/50'}`}>Hold Rooms</div>
              <div className={`text-xs mt-0.5 ${bookingMode === 'hold' ? 'text-yellow-400/70' : 'text-white/30'}`}>Reserve karo, payment baad mein</div>
            </button>
            <button type="button" onClick={() => setBookingMode('confirm')}
              className={`py-5 rounded-xl border-2 transition-all ${bookingMode === 'confirm' ? 'border-green-500 bg-green-500/10' : 'border-white/10 bg-white/5 hover:bg-white/8'}`}>
              <div className="text-2xl mb-1">✅</div>
              <div className={`font-semibold text-sm ${bookingMode === 'confirm' ? 'text-green-400' : 'text-white/50'}`}>Direct Confirm</div>
              <div className={`text-xs mt-0.5 ${bookingMode === 'confirm' ? 'text-green-400/70' : 'text-white/30'}`}>Payment ke saath confirm</div>
            </button>
          </div>
          {bookingMode === 'hold' && (
            <div className="mt-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-300/80 text-xs">
              🔒 Room hold ho jaayegi — payment pending rahegi. Booking detail page se baad mein payment receive karke confirm kar sakte hain.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* 1. Operator */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold">1</span>
              Tour Operator
            </h2>
            <select required value={form.tour_operator_id} onChange={e => set('tour_operator_id', e.target.value)} className={INPUT}>
              <option value="">Choose operator...</option>
              {operators.map(op => <option key={op.id} value={op.id}>{op.company_name} — {op.contact_person} ({op.commission_rate}% commission)</option>)}
            </select>
            {selectedOperator && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[['Contact', selectedOperator.contact_person], ['Email', selectedOperator.email], ['Phone', selectedOperator.phone], ['Commission', `${selectedOperator.commission_rate}%`], ['City', `${selectedOperator.city}, ${selectedOperator.state}`]].map(([l, v]) => (
                  <div key={l} className="bg-white/5 rounded-xl p-3">
                    <p className="text-white/40 text-xs mb-1">{l}</p>
                    <p className="text-white text-sm font-medium">{v}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Guest */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold">2</span>
              Guest Details
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>Guest Name *</label>
                <input type="text" required value={form.guest_name}
                  onChange={e => { set('guest_name', e.target.value); setErrors(p => ({...p, guest_name: ''})) }}
                  onBlur={e => validateField('guest_name', e.target.value)}
                  className={`${INPUT} ${errors.guest_name ? 'border-red-500' : ''}`} placeholder="Full name" />
                <Err f="guest_name" />
              </div>
              <div>
                <label className={LABEL}>Phone</label>
                <input type="tel" maxLength={10} value={form.guest_phone}
                  onChange={e => { set('guest_phone', e.target.value.replace(/\D/g, '')); setErrors(p => ({...p, guest_phone: ''})) }}
                  onBlur={e => validateField('guest_phone', e.target.value)}
                  className={`${INPUT} ${errors.guest_phone ? 'border-red-500' : ''}`} placeholder="10 digit number" />
                <Err f="guest_phone" />
              </div>
              <div>
                <label className={LABEL}>Guest Email</label>
                <input type="email" value={form.guest_email}
                  onChange={e => { set('guest_email', e.target.value.trim()); setErrors(p => ({...p, guest_email: ''})) }}
                  onBlur={e => validateField('guest_email', e.target.value)}
                  className={`${INPUT} ${errors.guest_email ? 'border-red-500' : ''}`}
                  placeholder="guest@example.com" />
                <p className="text-white/35 text-xs mt-1">Guest welcome mail is email par jayegi. Operator ko separate status mail automatically jayegi.</p>
                <Err f="guest_email" />
              </div>
            </div>
          </div>

          {/* 3. Dates */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold">3</span>
              Stay Dates
              {nights > 0 && <span className="px-3 py-0.5 bg-[#c9a14a]/20 text-[#c9a14a] rounded-full text-xs font-semibold">{nights} nights</span>}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Check-in *</label>
                <input type="date" required value={form.check_in}
                  onChange={e => handleCheckInChange(e.target.value)}
                  className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Check-out *</label>
                <input type="date" required value={form.check_out}
                  min={form.check_in ? addDaysToDate(form.check_in, 1) : tomorrowIso()}
                  onChange={e => handleCheckOutChange(e.target.value)}
                  className={`${INPUT} ${errors.check_out ? 'border-red-500' : ''}`} />
                <Err f="check_out" />
              </div>
            </div>
          </div>

          {/* 4. Room Lines */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold">4</span>
                Rooms & Occupancy
                <span className="text-white/30 text-xs font-normal">({lines.length} room type{lines.length > 1 ? 's' : ''})</span>
              </h2>
              <button type="button" onClick={() => setLines(p => [...p, newLine()])}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#c9a14a]/20 hover:bg-[#c9a14a]/30 text-[#c9a14a] rounded-full text-sm font-medium transition-all">
                + Add Room Type
              </button>
            </div>

            <div className="space-y-4">
              {lines.map((line, idx) => {
                const calc = calcs[idx]
                const rObj = rooms.find(r => r.id === line.room_id)
                return (
                  <div key={line.id} className={`border rounded-xl p-4 ${idx % 2 === 0 ? 'bg-white/3 border-white/10' : 'bg-blue-500/3 border-blue-500/10'}`}>
                    {/* Line header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-white/20 text-white text-xs rounded-full flex items-center justify-center font-bold">{idx + 1}</span>
                        <span className="text-white/70 text-sm font-medium">
                          {rObj ? rObj.name : `Room Type ${idx + 1}`}
                          {calc.total > 0 && nights > 0 && <span className="text-[#c9a14a] ml-2">₹{calc.total.toLocaleString()}</span>}
                        </span>
                      </div>
                      {lines.length > 1 && (
                        <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))}
                          className="text-red-400/60 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-red-500/10 transition-all">✕ Remove</button>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Room Type *</label>
                        <select required value={line.room_id}
                          onChange={e => { upd(idx, { room_id: e.target.value, rateInfo: null, rate_per_room_per_night: 0, availability: null }); setTimeout(() => { fetchRate(idx, e.target.value); checkAvail(idx, e.target.value, line.rooms_booked) }, 150) }}
                          className={INPUT}>
                          <option value="">Choose room...</option>
                          {rooms.map(r => {
                            const usedInOtherLine = lines.some((l, i) => i !== idx && l.room_id === r.id)
                            return (
                              <option key={r.id} value={r.id} disabled={usedInOtherLine}>
                                {usedInOtherLine ? `✗ ${r.name} (already added)` : `${r.name} (max ${r.max_guests}/room)`}
                              </option>
                            )
                          })}
                        </select>
                        {lines.some((l, i) => i !== idx && l.room_id === line.room_id && line.room_id !== '') && (
                          <p className="text-red-400 text-xs mt-1">⚠ Same room type already added — remove duplicate</p>
                        )}
                      </div>
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Meal Plan *</label>
                        <select value={line.meal_plan}
                          onChange={e => { upd(idx, { meal_plan: e.target.value, rateInfo: null }); setTimeout(() => fetchRate(idx, undefined, e.target.value), 150) }}
                          className={INPUT}>
                          {MEAL_PLANS.map(mp => <option key={mp.value} value={mp.value}>{mp.label}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Rate info bar */}
                    {line.rateFetching && <p className="text-white/30 text-xs mb-2 animate-pulse">Fetching B2B rate...</p>}
                    {line.rateInfo && !line.rateFetching && (
                      <div className="mb-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 flex items-center gap-3 flex-wrap">
                        <span>B2B · <strong>{line.rateInfo.season_label}</strong> · ₹{line.rateInfo.price_per_night}/room/night</span>
                        {line.rateInfo.extra_bed_price > 0 && <span>Extra Bed: ₹{line.rateInfo.extra_bed_price}/night</span>}
                        <span className="ml-auto rounded-full border border-yellow-500/25 bg-yellow-500/10 px-3 py-1 text-[11px] font-medium text-yellow-200">
                          Manual pricing enabled
                        </span>
                      </div>
                    )}
                      <div className="grid grid-cols-3 gap-3 mb-3 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                        {[['Rate/Room/Night (₹)', 'rate_per_room_per_night'], ['Extra Bed/Night (₹)', 'extra_bed_rate'], ['Child Rate/Night (₹)', 'child_rate']].map(([lbl, key]) => (
                          <div key={key}>
                            <label className="text-white/40 text-xs mb-1 block">{lbl}</label>
                            <input type="number" min="0"
                              value={(line as any)[key] === 0 ? '' : (line as any)[key]}
                              placeholder="0"
                              onChange={e => upd(idx, { [key]: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 } as any)}
                              onWheel={e => e.currentTarget.blur()} className={NUM} />
                          </div>
                        ))}
                      </div>

                    {/* Occupancy */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {[
                        { key: 'rooms_booked', lbl: 'Rooms', min: 1, note: '' },
                        { key: 'adults', lbl: 'Adults', min: 1, note: '' },
                        { key: 'children_below_5', lbl: 'Child 0-5', min: 0, note: '(free)' },
                        { key: 'children_5_to_12', lbl: 'Child 6-12', min: 0, note: '(paid)' },
                        { key: 'extra_beds', lbl: 'Extra Beds', min: 0, note: rObj ? `max ${rObj.max_extra_beds * line.rooms_booked}` : '' },
                      ].map(({ key, lbl, min, note }) => (
                        <div key={key}>
                          <label className="text-white/50 text-xs mb-1 block">
                            {lbl} {note && <span className={note.includes('free') ? 'text-green-400' : note.includes('paid') ? 'text-yellow-400' : 'text-white/30'}>{note}</span>}
                          </label>
                          <input type="number" min={min}
                            value={(line as any)[key] === 0 ? '' : (line as any)[key]}
                            placeholder="0"
                            onChange={e => {
                              const v = e.target.value === '' ? 0 : Math.max(min, parseInt(e.target.value) || 0)
                              upd(idx, { [key]: v } as any)
                              if (key === 'rooms_booked') setTimeout(() => checkAvail(idx, line.room_id, v), 300)
                            }}
                            onBlur={e => { if (e.target.value === '') upd(idx, { [key]: min } as any) }}
                            onWheel={e => e.currentTarget.blur()} className={NUM} />
                        </div>
                      ))}
                    </div>

                    {/* Availability */}
                    {line.availability && (
                      <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium ${line.availability.available ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                        {line.availability.available
                          ? `✓ ${line.availability.available_rooms} available (${line.availability.booked_rooms} already booked of ${line.availability.total_rooms})`
                          : `✗ Only ${line.availability.available_rooms} available, need ${line.rooms_booked}`}
                      </div>
                    )}

                    {calc.total > 0 && nights > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex justify-between text-xs text-white/40">
                        <span>{line.rooms_booked} room × {nights}N @ ₹{line.rate_per_room_per_night}/room{line.extra_beds > 0 ? ` + ${line.extra_beds} extra bed` : ''}{line.children_5_to_12 > 0 ? ` + ${line.children_5_to_12} child` : ''}</span>
                        <span className="text-white/70 font-semibold">₹{calc.total.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button type="button" onClick={() => setLines(p => [...p, newLine()])}
              className="mt-4 w-full py-3 border-2 border-dashed border-white/15 hover:border-[#c9a14a]/40 text-white/30 hover:text-[#c9a14a] rounded-xl text-sm transition-all">
              + Add Another Room Type
            </button>
          </div>

          {/* 5. Pricing Summary */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold">5</span>
              Pricing & Commission
            </h2>
            <div className="mb-4 max-w-xs">
              <label className={LABEL}>Commission Rate (%) <span className="text-white/30 text-xs">— from operator profile</span></label>
              <input type="number" min="0" max="100" step="0.5"
                value={form.commission_rate === 0 ? '' : form.commission_rate}
                placeholder="0"
                onChange={e => set('commission_rate', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                onWheel={e => e.currentTarget.blur()} className={NUM} />
            </div>
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                <span>Calculate GST</span>
                <input type="checkbox" checked={form.calculate_gst} onChange={e => set('calculate_gst', e.target.checked)} className="h-4 w-4 accent-[#c9a14a]" />
              </label>
              <label className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${form.calculate_gst ? 'border-white/10 bg-white/5 text-white/70' : 'border-white/5 bg-white/[0.03] text-white/30'}`}>
                <span>Price inclusive of tax</span>
                <input type="checkbox" checked={form.price_includes_tax} onChange={e => set('price_includes_tax', e.target.checked)} disabled={!form.calculate_gst} className="h-4 w-4 accent-[#c9a14a]" />
              </label>
            </div>

            {grandTotal > 0 && nights > 0 && (
              <div className="bg-[#111] border border-white/10 rounded-xl p-4 text-sm space-y-2">
                {lines.map((line, idx) => {
                  const rObj = rooms.find(r => r.id === line.room_id)
                  const c = calcs[idx]
                  if (!rObj || c.total === 0) return null
                  return (
                    <div key={line.id} className="flex justify-between text-white/60">
                      <span>{rObj.name} × {line.rooms_booked}r × {nights}N ({line.meal_plan})</span>
                      <span>₹{c.total.toLocaleString()}</span>
                    </div>
                  )
                })}
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/45">
                  Tax mode: {form.calculate_gst ? (form.price_includes_tax ? 'GST included in entered rates' : 'GST added over entered rates') : 'GST not calculated'}
                  {form.calculate_gst ? ` · ${isIntraStateBilling ? 'Bill To state Uttarakhand: CGST + SGST' : 'Bill To outside Uttarakhand: IGST'}` : ''}
                </div>
                <div className="border-t border-white/10 pt-2 space-y-1">
                  <div className="flex justify-between text-white/40 text-xs"><span>Subtotal (excl. GST)</span><span>₹{grandSub.toFixed(2)}</span></div>
                  {isIntraStateBilling ? (
                    <>
                      <div className="flex justify-between text-white/40 text-xs"><span>CGST @ 2.5%</span><span>₹{grandCgst.toFixed(2)}</span></div>
                      <div className="flex justify-between text-white/40 text-xs"><span>SGST @ 2.5%</span><span>₹{grandSgst.toFixed(2)}</span></div>
                    </>
                  ) : (
                    <div className="flex justify-between text-white/40 text-xs"><span>IGST @ 5%</span><span>₹{(grandCgst + grandSgst).toFixed(2)}</span></div>
                  )}
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between text-white font-bold">
                  <span>Total Booking Amount</span><span>₹{grandTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-orange-400">
                  <span>Commission @ {form.commission_rate}%</span><span>− ₹{commission.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[#c9a14a] font-bold text-base border-t border-[#c9a14a]/20 pt-2">
                  <span>Net Amount (Resort receives)</span><span>₹{netAmt.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* 6. Hold Notes OR Payment */}
          {bookingMode === 'hold' ? (
            <div className="bg-yellow-500/5 rounded-2xl border border-yellow-500/20 p-6">
              <h2 className="text-yellow-400 font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-yellow-500 text-black text-xs rounded-full flex items-center justify-center font-bold">6</span>
                Hold Notes
              </h2>
              <textarea value={form.hold_notes} onChange={e => set('hold_notes', e.target.value)}
                className={`${INPUT} border-yellow-500/20`} rows={3}
                placeholder="Operator ne kya kaha, tentative dates, kab tak hold chahiye..." />
              <p className="text-yellow-400/50 text-xs mt-2">Hold pe koi expiry nahi — admin manually confirm karega jab payment aaye</p>
            </div>
          ) : (
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold">6</span>
                Payment Details
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className={LABEL}>Payment Method</label>
                  <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className={INPUT}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Payment Date</label>
                  <input
                    type="date"
                    value={form.payment_date}
                    onChange={e => set('payment_date', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>Advance Amount Received (₹)</label>
                  <input type="number" min="0" max={grandTotal} value={form.advance_amount}
                    onChange={e => set('advance_amount', parseFloat(e.target.value) || 0)}
                    onWheel={e => e.currentTarget.blur()} className={NUM} placeholder="0" />
                  {grandTotal > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[20, 30, 50, 100].map(pct => (
                        <button key={pct} type="button"
                          onClick={() => set('advance_amount', Math.round(grandTotal * pct / 100))}
                          className="px-3 py-1 bg-white/10 hover:bg-[#c9a14a]/20 hover:text-[#c9a14a] text-white/50 text-xs rounded-full transition-all">
                          {pct}% = ₹{Math.round(grandTotal * pct / 100).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  )}
                  {form.advance_amount > 0 && balance > 0 && (
                    <p className="text-yellow-400 text-xs mt-2">Balance due: ₹{balance.toLocaleString()}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 7. Notes */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold">7</span>
              Notes
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Guest Special Requests</label>
                <textarea value={form.special_requests} onChange={e => set('special_requests', e.target.value)} className={INPUT} rows={3} placeholder="Any special requirements..." />
              </div>
              <div>
                <label className={LABEL}>Admin Notes (Internal)</label>
                <textarea value={form.admin_notes} onChange={e => set('admin_notes', e.target.value)} className={INPUT} rows={3} placeholder="Internal notes..." />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4 pb-8">
            <button type="submit"
              disabled={submitting || nights === 0 || !form.tour_operator_id || lines.some(l => !l.room_id || l.availability?.available === false)}
              className={`flex-1 py-4 rounded-full font-semibold text-lg transition-all disabled:opacity-40 ${
                bookingMode === 'hold'
                  ? 'bg-gradient-to-r from-yellow-700 to-yellow-500 text-black hover:opacity-90'
                  : 'bg-gradient-to-r from-green-700 to-green-500 text-white hover:opacity-90'
              }`}>
              {submitting ? 'Processing...' : bookingMode === 'hold'
                ? `🔒 Hold Rooms${grandTotal > 0 ? ` — ₹${grandTotal.toLocaleString()}` : ''}`
                : `✅ Confirm Booking${grandTotal > 0 ? ` — ₹${grandTotal.toLocaleString()}` : ''}`}
            </button>
            <Link href="/admin/dashboard" className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-full text-white font-semibold transition-all">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
