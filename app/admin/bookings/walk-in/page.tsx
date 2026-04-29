'use client'
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import ReceiptButton from '@/components/ReceiptButton'

// ── Constants ─────────────────────────────────────────────────────────────────
const MEAL_PLANS = [
  { value: 'EP',  label: 'EP – Room Only' },
  { value: 'CP',  label: 'CP – With Breakfast' },
  { value: 'MAP', label: 'MAP – Breakfast + Dinner' },
  { value: 'AP',  label: 'AP – All Meals' },
]

const COUNTRIES = [
  'India','Afghanistan','Australia','Bahrain','Bangladesh','Bhutan','Canada',
  'China','France','Germany','Indonesia','Iran','Japan','Jordan','Kuwait',
  'Malaysia','Maldives','Myanmar','Nepal','Netherlands','New Zealand','Oman',
  'Pakistan','Philippines','Qatar','Russia','Saudi Arabia','Singapore',
  'South Korea','Sri Lanka','Thailand','UAE','UK','USA','Other',
]

const S = 'w-full px-4 py-3 bg-[#1a1a1a] border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-[#c9a14a] placeholder:text-white/30'
const LBL = 'block text-white/60 text-xs mb-1.5'
const SEL = 'w-full px-4 py-3 bg-[#1a1a1a] border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-[#c9a14a] [&>option]:bg-[#1a1a1a]'

// ── Searchable Dropdown ───────────────────────────────────────────────────────
function SearchSelect({ options, value, onChange, placeholder, disabled = false }: {
  options: string[], value: string, onChange: (v: string) => void,
  placeholder?: string, disabled?: boolean,
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref    = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const filtered = options.filter(o => o.toLowerCase().includes(q.toLowerCase()))

  function handleOpen() {
    if (disabled) return
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen(v => !v)
  }

  // Recalc position on scroll so dropdown follows button
  useEffect(() => {
    if (!open) return
    const update = () => { if (btnRef.current) setRect(btnRef.current.getBoundingClientRect()) }
    window.addEventListener('scroll', update, true)
    return () => window.removeEventListener('scroll', update, true)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} ref={btnRef}
        onClick={handleOpen}
        className={`${S} flex justify-between items-center cursor-pointer text-left ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
        <span className={value ? 'text-white' : 'text-white/30'}>{value || placeholder || 'Select…'}</span>
        <span className="text-white/30 text-[10px] ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {open && !disabled && rect && (
        <div style={{
          position: 'fixed',
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          zIndex: 9999,
        }} className="bg-[#161616] border border-white/15 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-white/10">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search…"
              className="w-full px-3 py-2 bg-white/5 rounded-lg text-white text-sm focus:outline-none placeholder:text-white/30" />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(opt => (
              <div key={opt}
                onClick={() => { onChange(opt); setOpen(false); setQ('') }}
                className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${opt === value ? 'bg-[#c9a14a]/20 text-[#c9a14a]' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                {opt}
              </div>
            ))}
            {filtered.length === 0 && <div className="px-4 py-3 text-white/30 text-sm">No results</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Number input — no scroll ──────────────────────────────────────────────────
function NumInput({ value, onChange, min = 0, max, className = '', disabled = false }: {
  value: number, onChange: (n: number) => void, min?: number, max?: number, className?: string
  disabled?: boolean
}) {
  return (
    <input type="number" min={min} max={max} value={value}
      onFocus={e => e.currentTarget.select()}
      onWheel={e => e.currentTarget.blur()}
      onChange={e => {
        const parsed = parseInt(e.target.value) || 0
        const clampedMin = Math.max(min, parsed)
        const clamped = max !== undefined ? Math.min(max, clampedMin) : clampedMin
        onChange(clamped)
      }}
      disabled={disabled}
      className={`${S} ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`} />
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function WalkInBooking() {
  const [rooms,          setRooms]          = useState<any[]>([])
  const [states,         setStates]         = useState<string[]>([])
  const [districts,      setDistricts]      = useState<string[]>([])
  const [submitting,     setSubmitting]     = useState(false)
  const [rateInfo,       setRateInfo]       = useState<any>(null)
  const [rateFetching,   setRateFetching]   = useState(false)
  const [availability,   setAvailability]   = useState<any>(null)
  const [guestFound,     setGuestFound]     = useState<boolean | null>(null)
  const [authed,         setAuthed]         = useState(false)
  const [errors,         setErrors]         = useState<Record<string,string>>({})
  const [gstWanted,      setGstWanted]      = useState(false)
  const [gstConfirmed,   setGstConfirmed]   = useState(false)  // GST fields only shown after booking confirm
  const [createdBooking, setCreatedBooking] = useState<any>(null)
  const [mode,           setMode]           = useState<'walk_in'|'direct'>('walk_in')

  const [form, setForm] = useState({
    guest_name: '', guest_email: '', guest_phone: '',
    guest_id_type: '', guest_id_number: '',
    guest_country: 'India', guest_state: '', guest_district: '', guest_address: '',
    room_id: '', check_in: '', check_out: '',
    rooms_booked: 1, adults: 2,
    children_below_5: 0, children_5_to_12: 0, extra_beds: 0,
    meal_plan: 'CP', booking_type: 'b2c',
    payment_method: 'cash', payment_status: 'fully_paid',
    advance_amount: 0, payment_ref: '', payment_date: '',
    special_requests: '', admin_notes: '',
    manual_price: false,
    rate_per_room_per_night: 0, extra_bed_rate: 0, child_rate: 0,
    gst_company_name: '', gst_number: '', gst_state: '',
  })

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => { init() }, [])

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  async function init() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { window.location.href = '/admin/login'; return }
      const v = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      })
      if (!v.ok) { window.location.href = '/admin/login'; return }
      await Promise.all([loadRooms(), loadStates()])
      setAuthed(true)
    } catch { window.location.href = '/admin/login' }
  }

  async function loadRooms() {
    const r = await fetch('/api/admin/data?type=rooms', { headers: { Authorization: `Bearer ${await getToken()}` } })
    const d = await r.json()
    setRooms(d.data || [])
  }

  async function loadStates() {
    const { data } = await supabase.from('indian_states').select('name').order('name')
    setStates((data || []).map((s: any) => s.name))
  }

  // ── Districts when state changes ──────────────────────────────────────────
  useEffect(() => {
    if (form.guest_country !== 'India' || !form.guest_state) {
      setDistricts([]); set('guest_district', ''); return
    }
    supabase.from('indian_districts')
      .select('name, indian_states!inner(name)')
      .eq('indian_states.name', form.guest_state)
      .order('name')
      .then(({ data }) => {
        setDistricts((data || []).map((d: any) => d.name))
        set('guest_district', '')
      })
  }, [form.guest_state, form.guest_country])

  // ── Auto-fetch rate ───────────────────────────────────────────────────────
  useEffect(() => {
    if (form.room_id && form.check_in && !form.manual_price) fetchRate()
  }, [form.room_id, form.check_in, form.meal_plan, form.booking_type, rooms])

  // ── Availability check ────────────────────────────────────────────────────
  useEffect(() => {
    if (form.room_id && form.check_in && form.check_out) checkAvailability()
  }, [form.room_id, form.check_in, form.check_out, form.rooms_booked])

  // ── Default payment_status per mode ──────────────────────────────────────
  useEffect(() => {
    set('payment_status', mode === 'walk_in' ? 'fully_paid' : 'payment_processing')
  }, [mode])

  // ── Auto-trigger phone lookup when exactly 10 digits ──────────────────────
  useEffect(() => {
    if (!authed) return
    if (form.guest_phone.length === 10) lookupGuest(form.guest_phone)
    if (form.guest_phone.length < 10)   setGuestFound(null)
  }, [form.guest_phone, authed])

  // ── Phone lookup ──────────────────────────────────────────────────────────
  async function lookupGuest(phone: string) {
    if (phone.length !== 10) return
    setGuestFound(null)
    try {
      const r = await fetch(`/api/admin/data?type=guest-by-phone&phone=${phone}`, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      })
      const d = await r.json()
      if (d.found) {
        const g = d.guest
        setForm(p => ({
          ...p,
          guest_name:      g.guest_name      || p.guest_name,
          guest_email:     g.guest_email     || p.guest_email,
          guest_id_type:   g.guest_id_type   || p.guest_id_type,
          guest_id_number: g.guest_id_number || p.guest_id_number,
          guest_country:   g.guest_country   || p.guest_country,
          guest_state:     g.guest_state     || p.guest_state,
          guest_district:  g.guest_district  || p.guest_district,
          guest_address:   g.guest_address   || p.guest_address,
        }))
        toast.success(`✓ Returning guest: ${g.guest_name}`)
        setGuestFound(true)
      } else {
        setGuestFound(false)
      }
    } catch (err) {
      console.error('Guest lookup failed:', err)
      setGuestFound(false)
    }
  }

  async function fetchRate() {
    const room = rooms.find(r => r.id === form.room_id)
    if (!room || !form.check_in) return
    setRateFetching(true)
    try {
      const r = await fetch(
        `/api/admin/data?type=rate&category=${room.category}&check_in=${form.check_in}&meal_plan=${form.meal_plan}&rate_type=${form.booking_type}`,
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      )
      const d = await r.json()
      if (d.found) {
        setRateInfo(d)
        setForm(p => ({ ...p,
          rate_per_room_per_night: d.price_per_night,
          extra_bed_rate:          d.extra_bed_price,
          child_rate:              d.child_5_12_price || 0,
        }))
      } else {
        setRateInfo(null)
        toast.error('Is date ke liye rate nahi mila')
      }
    } catch { setRateFetching(false) }
    setRateFetching(false)
  }

  async function checkAvailability() {
    try {
      const r = await fetch('/api/admin/data?type=availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ room_id: form.room_id, check_in: form.check_in, check_out: form.check_out, rooms_needed: form.rooms_booked }),
      })
      setAvailability(await r.json())
    } catch {}
  }

  // ── Calculations ──────────────────────────────────────────────────────────
  const nights = form.check_in && form.check_out
    ? Math.max(0, Math.ceil((new Date(form.check_out).getTime() - new Date(form.check_in).getTime()) / 86400000))
    : 0

  const selRoom       = rooms.find(r => r.id === form.room_id)
  const roomAmt       = form.rate_per_room_per_night * nights * form.rooms_booked
  const xbedAmt       = form.extra_bed_rate * form.extra_beds * nights
  const childAmt      = form.child_rate * form.children_5_to_12 * nights
  const grossAmt      = roomAmt + xbedAmt + childAmt
  const subtotal      = Math.round(grossAmt / 1.18 * 100) / 100
  const cgst          = Math.round((grossAmt - subtotal) / 2 * 100) / 100
  const sgst          = cgst
  const totalAmount   = grossAmt
  const balanceAmt    = Math.max(0, totalAmount - form.advance_amount)
  const maxRoomsAllowed = Math.max(1, Number(availability?.available_rooms || selRoom?.total_rooms || 1))
  const maxAdultsAllowed = Math.max(1, form.rooms_booked * 4)
  const autoExtraBeds = Math.min(Math.max(0, form.adults - (form.rooms_booked * 2)), form.rooms_booked * 2)

  useEffect(() => {
    if (form.rooms_booked > maxRoomsAllowed) {
      set('rooms_booked', maxRoomsAllowed)
    }
  }, [maxRoomsAllowed])

  useEffect(() => {
    if (form.adults > maxAdultsAllowed) {
      set('adults', maxAdultsAllowed)
      return
    }
    if (form.extra_beds !== autoExtraBeds) {
      set('extra_beds', autoExtraBeds)
    }
  }, [form.rooms_booked, form.adults, maxAdultsAllowed, autoExtraBeds])

  // ── Validate ──────────────────────────────────────────────────────────────
  function validate() {
    const errs: Record<string,string> = {}
    if (!form.guest_phone || !/^\d{10}$/.test(form.guest_phone)) errs.guest_phone = '10 digit phone required'
    if (!form.guest_name.trim()) errs.guest_name = 'Name required'
    if (form.guest_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guest_email)) errs.guest_email = 'Invalid email'
    if (!form.room_id)   errs.room_id  = 'Select a room'
    if (!form.check_in)  errs.check_in  = 'Check-in required'
    if (!form.check_out) errs.check_out = 'Check-out required'
    if (form.rooms_booked > maxRoomsAllowed) errs.rooms_booked = `Maximum ${maxRoomsAllowed} room(s) available`
    if (form.adults > maxAdultsAllowed) errs.adults = `Maximum ${maxAdultsAllowed} adult(s) allowed`
    if (gstWanted && form.gst_company_name.trim()) {
      if (!form.gst_number.trim()) errs.gst_number = 'GSTIN required for company invoice'
      if (!form.gst_state.trim()) errs.gst_state = 'GST state required for company invoice'
    }
    if (form.check_out && form.check_in && form.check_out <= form.check_in)
      errs.check_out = 'Check-out must be after check-in'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) { toast.error('Errors hain, fix karo'); return }
    if (nights === 0)  { toast.error('Check-out check-in se baad hona chahiye'); return }
    if (availability && !availability.available) { toast.error('Rooms available nahi hain'); return }

    // Direct mode + GST wanted: first click shows GST fields, second submits
    if (mode === 'direct' && gstWanted && !gstConfirmed) {
      setGstConfirmed(true)
      toast('✓ GST details fill karo, phir confirm karo', { icon: '📋' })
      return
    }

    setSubmitting(true)
    try {
      const token = await getToken()
      const payload = {
        guest_name: form.guest_name, guest_email: form.guest_email || null,
        guest_phone: form.guest_phone,
        guest_id_type: form.guest_id_type || null, guest_id_number: form.guest_id_number || null,
        guest_country: form.guest_country || null,
        guest_address: form.guest_address  || null,
        guest_state: form.guest_state || null, guest_district: form.guest_district || null,
        room_id: form.room_id, check_in: form.check_in, check_out: form.check_out,
        nights, rooms_booked: form.rooms_booked, adults: form.adults,
        children_below_5: form.children_below_5, children_5_to_12: form.children_5_to_12,
        extra_beds: form.extra_beds, meal_plan: form.meal_plan,
        booking_source: form.booking_type === 'lwweb' ? 'website' : mode, booking_type: form.booking_type,
        booking_status: mode === 'walk_in' ? 'checked_in' : 'confirmed',
        rate_per_room_per_night: form.rate_per_room_per_night,
        extra_bed_rate_per_night: form.extra_bed_rate, child_rate_per_night: form.child_rate,
        subtotal, cgst, sgst, gst_total: cgst + sgst, total_amount: totalAmount,
        payment_method: form.payment_method, payment_status: form.payment_status,
        advance_amount: form.advance_amount, balance_amount: balanceAmt,
        payment_ref: form.payment_ref || null, payment_date: form.payment_date || null,
        payment_id: `${mode.toUpperCase()}-${Date.now()}`,
        special_requests: form.special_requests || null,
        admin_notes: form.admin_notes || null,
        season_id: rateInfo?.season_id || null,
        ...(mode === 'walk_in' ? { checked_in_at: new Date().toISOString() } : {}),
        ...(gstWanted ? {
          gst_invoice_requested: true,
          gst_company_name: form.gst_company_name || null,
          gst_number:       form.gst_number       || null,
          gst_state:        form.gst_state         || null,
        } : {}),
      }

      const res = await fetch('/api/admin/data?type=booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      const full = {
        ...result, ...form,
        nights, rooms_booked: form.rooms_booked, total_amount: totalAmount,
        subtotal, cgst, sgst, balance_amount: balanceAmt,
        room: selRoom, booking_number: result.booking_number,
      }
      setCreatedBooking(full)
      toast.success(mode === 'walk_in'
        ? `✓ Walk-in done! ${result.booking_number} — Guest checked in`
        : `✓ Booking confirmed! ${result.booking_number}`)
      setTimeout(() => { window.location.href = '/admin/bookings' }, 4000)
    } catch (err: any) {
      toast.error(err.message || 'Booking create nahi hui')
    } finally { setSubmitting(false) }
  }

  const Err = ({ f }: { f: string }) =>
    errors[f] ? <p className="text-red-400 text-[11px] mt-1">{errors[f]}</p> : null

  const isIndia = form.guest_country === 'India'
  const isWalkIn = mode === 'walk_in'

  return (
    <div className="min-h-screen bg-[#0b0b0b] py-8 px-4">
      <Toaster position="top-center" />
      <div className="max-w-5xl mx-auto">

        {/* ── Header ─── */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-playfair text-[#c9a14a]">
              {isWalkIn ? '🚶 Walk-in Booking' : '📋 Direct Booking'}
            </h1>
            <p className="text-white/40 text-sm mt-1">
              {isWalkIn ? 'Guest present — auto checked-in on save'
                        : 'Phone/WhatsApp/Email booking — status: Confirmed'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
              {(['walk_in','direct'] as const).map(m => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
                    ${m === mode
                      ? m === 'walk_in'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-blue-500/20  text-blue-400  border border-blue-500/30'
                      : 'text-white/40 hover:text-white/60'}`}>
                  {m === 'walk_in' ? '🚶 Walk-in' : '📋 Direct'}
                </button>
              ))}
            </div>
            <Link href="/admin/dashboard"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm">
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Mode banner */}
        <div className={`mb-6 px-5 py-3 rounded-xl border text-sm flex items-center gap-3
          ${isWalkIn ? 'bg-green-500/10 border-green-500/20 text-green-300'
                     : 'bg-blue-500/10  border-blue-500/20  text-blue-300'}`}>
          {isWalkIn
            ? <><span>🏨</span><span><b>Walk-in:</b> Guest physically present → status set to <b>Checked-In</b> immediately.</span></>
            : <><span>📅</span><span><b>Direct:</b> Advance booking → status <b>Confirmed</b>. GST details collected after confirmation.</span></>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── 1. Guest ─── */}
          <Section num="1" title="Guest Information">
            <div className="grid md:grid-cols-2 gap-4">

              {/* Phone FIRST */}
              <div>
                <label className={LBL}>Phone Number * <span className="text-white/30">(enter first for auto-fill)</span></label>
                <input type="tel" maxLength={10} value={form.guest_phone}
                  className={`${S} ${errors.guest_phone ? 'border-red-500' : ''}`}
                  placeholder="10 digit mobile"
                  onChange={e => { set('guest_phone', e.target.value.replace(/\D/g,'')); setErrors(p=>({...p,guest_phone:''})) }} />
                <Err f="guest_phone" />
                {guestFound === true  && <p className="text-green-400 text-[11px] mt-1">✓ Returning guest — details auto-filled</p>}
                {guestFound === false && <p className="text-white/30  text-[11px] mt-1">New guest</p>}
              </div>

              <div>
                <label className={LBL}>Full Name *</label>
                <input type="text" value={form.guest_name} placeholder="Guest full name"
                  className={`${S} ${errors.guest_name ? 'border-red-500' : ''}`}
                  onChange={e => { set('guest_name', e.target.value); setErrors(p=>({...p,guest_name:''})) }} />
                <Err f="guest_name" />
              </div>

              <div>
                <label className={LBL}>Email</label>
                <input type="text" value={form.guest_email} placeholder="email@example.com"
                  className={`${S} ${errors.guest_email ? 'border-red-500' : ''}`}
                  onChange={e => { set('guest_email', e.target.value); setErrors(p=>({...p,guest_email:''})) }} />
                <Err f="guest_email" />
              </div>

              <div>
                <label className={LBL}>ID Proof Type</label>
                <select value={form.guest_id_type} onChange={e => set('guest_id_type', e.target.value)} className={SEL}>
                  <option value="">Select…</option>
                  <option value="aadhaar">Aadhaar</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                  <option value="voter_id">Voter ID</option>
                </select>
              </div>

              {form.guest_id_type && (
                <div>
                  <label className={LBL}>ID Number</label>
                  <input type="text" value={form.guest_id_number} placeholder="ID number"
                    className={S} onChange={e => set('guest_id_number', e.target.value)} />
                </div>
              )}

              <div className="md:col-span-2">
                <label className={LBL}>Address</label>
                <textarea value={form.guest_address} rows={2} className={S}
                  placeholder="House / Flat, Street, Area"
                  onChange={e => set('guest_address', e.target.value)} />
              </div>

              {/* Country */}
              <div>
                <label className={LBL}>Country</label>
                <SearchSelect options={COUNTRIES} value={form.guest_country} placeholder="Select country"
                  onChange={v => { set('guest_country', v); set('guest_state',''); set('guest_district','') }} />
              </div>

              {/* State — India only */}
              {isIndia && (
                <div className="relative z-50">
                  <label className={LBL}>State</label>
                  <SearchSelect options={states} value={form.guest_state} placeholder="Select state"
                    onChange={v => set('guest_state', v)} />
                </div>
              )}

              {/* District — India + state selected */}
              {isIndia && form.guest_state && (
                <div className="relative z-50">
                  <label className={LBL}>District</label>
                  <SearchSelect
                    options={districts}
                    value={form.guest_district}
                    placeholder={districts.length ? 'Select district' : 'Loading…'}
                    disabled={districts.length === 0}
                    onChange={v => set('guest_district', v)} />
                </div>
              )}
            </div>
          </Section>

          {/* ── 2. Stay ─── */}
          <Section num="2" title="Stay Details">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={LBL}>Check-in *</label>
                <input type="date" value={form.check_in}
                  min={isWalkIn ? new Date().toISOString().split('T')[0] : undefined}
                  className={`${S} ${errors.check_in ? 'border-red-500' : ''}`}
                  onChange={e => { set('check_in', e.target.value); setErrors(p=>({...p,check_in:''})) }} />
                <Err f="check_in" />
              </div>
              <div>
                <label className={LBL}>Check-out *</label>
                <input type="date" value={form.check_out}
                  min={form.check_in || new Date().toISOString().split('T')[0]}
                  className={`${S} ${errors.check_out ? 'border-red-500' : ''}`}
                  onChange={e => { set('check_out', e.target.value); setErrors(p=>({...p,check_out:''})) }} />
                <Err f="check_out" />
              </div>
              <div>
                <label className={LBL}>Room Type *</label>
                <select value={form.room_id}
                  className={`${SEL} ${errors.room_id ? 'border-red-500' : ''}`}
                  onChange={e => { set('room_id', e.target.value); setErrors(p=>({...p,room_id:''})) }}>
                  <option value="">Choose room…</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.total_rooms} rooms)</option>)}
                </select>
                <Err f="room_id" />
              </div>
              <div>
                <label className={LBL}>Number of Rooms</label>
                <NumInput value={form.rooms_booked}
                  onChange={v => set('rooms_booked', Math.max(1, Math.min(maxRoomsAllowed, v)))} min={1}
                  max={maxRoomsAllowed} />
                <p className="text-white/35 text-[11px] mt-1">
                  Maximum {maxRoomsAllowed} room{maxRoomsAllowed > 1 ? 's' : ''} available
                </p>
                <Err f="rooms_booked" />
              </div>

              <div>
                <label className={LBL}>Meal Plan</label>
                <select value={form.meal_plan} onChange={e => set('meal_plan', e.target.value)} className={SEL}>
                  {MEAL_PLANS.map(mp => <option key={mp.value} value={mp.value}>{mp.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LBL}>Rate Type</label>
                <select value={form.booking_type} onChange={e => set('booking_type', e.target.value)} className={SEL}>
                  <option value="lwweb">LWWEB – Website Tariff</option>
                  <option value="b2c">B2C – Walk-in Tariff</option>
                  <option value="b2b">B2B – Agent Tariff</option>
                </select>
              </div>
            </div>

            {/* Availability badge */}
            {availability && form.check_in && form.check_out && (
              <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm font-medium
                ${availability.available
                  ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                  : 'bg-red-500/15   text-red-400   border border-red-500/25'}`}>
                {availability.available
                  ? `✓ ${availability.available_rooms} room(s) available`
                  : `✗ Only ${availability.available_rooms} available — need ${form.rooms_booked}`}
              </div>
            )}

            {/* Rate badge */}
            {rateFetching && <p className="text-white/30 text-xs mt-3 animate-pulse">Fetching rate…</p>}
            {rateInfo && !rateFetching && (
              <div className="mt-3 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
                Season: <b>{rateInfo.season_label}</b> ·
                Room: <b>₹{rateInfo.price_per_night}/night</b> ·
                Extra Bed: <b>₹{rateInfo.extra_bed_price}/night</b>
                {rateInfo.child_5_12_price > 0 && <> · Child(6-12): <b>₹{rateInfo.child_5_12_price}/night</b></>}
              </div>
            )}
          </Section>

          {/* ── 3. Occupancy ─── */}
          <Section num="3" title="Occupancy">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {([
                { lbl: 'Adults *',        k: 'adults',            min: 1, note: `Maximum ${maxAdultsAllowed} adults` },
                { lbl: 'Children (0–5)',  k: 'children_below_5',  min: 0, note: '✓ Complimentary' },
                { lbl: 'Children (6–12)', k: 'children_5_to_12',  min: 0, note: 'Charged' },
                { lbl: 'Extra Beds',      k: 'extra_beds',        min: 0, note: `Auto-added: ${autoExtraBeds}` },
              ] as const).map(({ lbl, k, min, note }) => (
                <div key={k}>
                  <label className={LBL}>{lbl}</label>
                  {note && (
                    <p className={`text-[10px] mb-1 ${k==='children_below_5' ? 'text-green-400' : 'text-white/40'}`}>{note}</p>
                  )}
                  <NumInput
                    value={(form as any)[k]}
                    min={min}
                    max={k === 'adults' ? maxAdultsAllowed : undefined}
                    disabled={k === 'extra_beds'}
                    onChange={v => set(k, v)}
                  />
                  <Err f={k} />
                </div>
              ))}
            </div>
          </Section>

          {/* ── 4. Pricing ─── */}
          <Section num="4" title="Pricing">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/50 text-xs">Rate auto-loaded from season/meal plan config</span>
              <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
                <input type="checkbox" checked={form.manual_price}
                  onChange={e => set('manual_price', e.target.checked)}
                  className="accent-[#c9a14a]" />
                Manual override
              </label>
            </div>

            {form.manual_price && (
              <div className="grid grid-cols-3 gap-3 mb-4 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                {([
                  { lbl: 'Room Rate/Night (₹)',     k: 'rate_per_room_per_night' },
                  { lbl: 'Extra Bed/Night (₹)',     k: 'extra_bed_rate' },
                  { lbl: 'Child Rate/Night (₹)',    k: 'child_rate' },
                ] as const).map(({ lbl, k }) => (
                  <div key={k}>
                    <label className={LBL}>{lbl}</label>
                    <NumInput value={(form as any)[k]} min={0} onChange={v => set(k, v)} />
                  </div>
                ))}
              </div>
            )}

            {selRoom && nights > 0 && totalAmount > 0 && (
              <div className="bg-[#c9a14a]/10 border border-[#c9a14a]/20 rounded-xl p-4 text-sm space-y-2">
                <div className="flex justify-between text-white/60">
                  <span>{selRoom.name} × {form.rooms_booked} × {nights}n @ ₹{form.rate_per_room_per_night}</span>
                  <span>₹{roomAmt.toLocaleString()}</span>
                </div>
                {form.extra_beds > 0 && (
                  <div className="flex justify-between text-white/60">
                    <span>Extra Bed ×{form.extra_beds} ×{nights}n @ ₹{form.extra_bed_rate}</span>
                    <span>₹{xbedAmt.toLocaleString()}</span>
                  </div>
                )}
                {form.children_5_to_12 > 0 && (
                  <div className="flex justify-between text-white/60">
                    <span>Child(6-12) ×{form.children_5_to_12} ×{nights}n @ ₹{form.child_rate}</span>
                    <span>₹{childAmt.toLocaleString()}</span>
                  </div>
                )}
                {form.children_below_5 > 0 && (
                  <div className="flex justify-between text-green-400/60">
                    <span>Children(0-5) ×{form.children_below_5} — Complimentary</span>
                    <span>₹0</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 space-y-1 text-xs text-white/40">
                  <div className="flex justify-between"><span>Subtotal (excl. GST 18%)</span><span>₹{subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>CGST @ 9%</span><span>₹{cgst.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>SGST @ 9%</span><span>₹{sgst.toLocaleString()}</span></div>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
                  <span className="text-white">Total Amount</span>
                  <span className="text-[#c9a14a] text-lg">₹{totalAmount.toLocaleString()}</span>
                </div>
                {!isWalkIn && (
                  <p className="text-blue-300/60 text-xs">* GST invoice generated after booking confirmation</p>
                )}
              </div>
            )}
          </Section>

          {/* ── 5. Payment ─── */}
          <Section num="5" title="Payment">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className={LBL}>Method</label>
                <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className={SEL}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className={LBL}>Status</label>
                <select value={form.payment_status} onChange={e => set('payment_status', e.target.value)} className={SEL}>
                  <option value="fully_paid">Fully Paid</option>
                  <option value="payment_processing">Advance Paid</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              {form.payment_status === 'payment_processing' && (
                <div>
                  <label className={LBL}>Advance Amount (₹)</label>
                  <NumInput value={form.advance_amount} min={0} max={totalAmount}
                    onChange={v => set('advance_amount', v)} />
                  {totalAmount > 0 && (
                    <p className="text-yellow-400 text-[11px] mt-1">
                      Balance: ₹{balanceAmt.toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* UTR / Transaction ID — show for non-cash */}
              {form.payment_method !== 'cash' && (
                <div>
                  <label className={LBL}>
                    {form.payment_method === 'upi' ? 'UPI UTR Number' :
                     form.payment_method === 'bank_transfer' ? 'Transaction / UTR No.' :
                     form.payment_method === 'card' ? 'Transaction ID' :
                     'Cheque / Ref No.'}
                  </label>
                  <input type="text" value={form.payment_ref}
                    onChange={e => set('payment_ref', e.target.value)}
                    className={S} placeholder="e.g. 123456789012" />
                </div>
              )}

              {/* Payment Date */}
              <div>
                <label className={LBL}>Payment Date</label>
                <input type="date" value={form.payment_date}
                  onChange={e => set('payment_date', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className={S} />
              </div>
            </div>
          </Section>

          {/* ── 6. GST ─── */}
          <Section num="6" title="GST Invoice">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/40 text-xs">Toggle if guest needs GST invoice</p>
              <div onClick={() => { setGstWanted(v => !v); setGstConfirmed(false) }}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${gstWanted ? 'bg-[#c9a14a]' : 'bg-white/20'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${gstWanted ? 'left-7' : 'left-1'}`} />
              </div>
            </div>

            {gstWanted && !isWalkIn && !gstConfirmed && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-300">
                📋 GST details fill karne ke liye pehle <b>"Next: Enter GST Details"</b> click karo
              </div>
            )}

            {gstWanted && (isWalkIn || gstConfirmed) && (
              <div className="grid md:grid-cols-3 gap-3 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                <div>
                  <label className={LBL}>Company / Firm Name</label>
                  <input type="text" value={form.gst_company_name} className={S}
                    placeholder="Optional - leave blank for guest-name invoice"
                    onChange={e => set('gst_company_name', e.target.value)} />
                  <p className="text-white/35 text-[11px] mt-1">
                    Blank chhodne par GST invoice guest name par banegi. Company name bharne par GSTIN aur GST state bhi required honge.
                  </p>
                </div>
                <div>
                  <label className={LBL}>GSTIN</label>
                  <input type="text" value={form.gst_number} className={S} maxLength={15}
                    placeholder="22AAAAA0000A1Z5"
                    onChange={e => set('gst_number', e.target.value.toUpperCase())} />
                  <Err f="gst_number" />
                </div>
                <div className="relative z-[80]">
                  <label className={LBL}>GST State</label>
                  <SearchSelect options={states} value={form.gst_state}
                    placeholder="Select state" onChange={v => set('gst_state', v)} />
                  <Err f="gst_state" />
                </div>
              </div>
            )}
          </Section>

          {/* ── 7. Notes ─── */}
          <Section num="7" title="Notes">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={LBL}>Guest Requests</label>
                <textarea value={form.special_requests} rows={3} className={S}
                  placeholder="Special requirements…"
                  onChange={e => set('special_requests', e.target.value)} />
              </div>
              <div>
                <label className={LBL}>Admin Notes (Internal)</label>
                <textarea value={form.admin_notes} rows={3} className={S}
                  placeholder="Internal notes…"
                  onChange={e => set('admin_notes', e.target.value)} />
              </div>
            </div>
          </Section>

          {/* ── Success actions ─── */}
          {createdBooking && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 flex gap-4 flex-wrap items-center">
              <span className="text-green-400 font-semibold">✓ Booking created!</span>
              <ReceiptButton booking={createdBooking} />
            </div>
          )}

          {/* ── Submit ─── */}
          <div className="flex gap-4 pb-8">
            <button type="submit"
              disabled={submitting || nights === 0 || !form.rate_per_room_per_night || (availability != null && !availability.available)}
              className={`flex-1 py-4 rounded-full font-semibold text-base transition-all disabled:opacity-40
                ${isWalkIn
                  ? 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:opacity-90'
                  : 'bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black hover:opacity-90'}`}>
              {submitting ? 'Saving…'
                : isWalkIn
                  ? `🚶 Check-in Guest${totalAmount > 0 ? ` · ₹${totalAmount.toLocaleString()}` : ''}`
                  : mode === 'direct' && gstWanted && !gstConfirmed
                    ? '📋 Next: Enter GST Details'
                    : `📋 Confirm Booking${totalAmount > 0 ? ` · ₹${totalAmount.toLocaleString()}` : ''}`}
            </button>
            <Link href="/admin/dashboard"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-full text-white font-semibold">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ num, title, children }: { num: string, title: string, children: React.ReactNode }) {
  return (
    <div className="relative z-0 overflow-visible bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
      <h2 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
        <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold shrink-0">
          {num}
        </span>
        {title}
      </h2>
      {children}
    </div>
  )
}
