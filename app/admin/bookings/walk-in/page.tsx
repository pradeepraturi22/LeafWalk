'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import GSTBillButton from '@/components/GSTBillButton'

const MEAL_PLANS = [
  { value: 'EP',  label: 'EP - Room Only' },
  { value: 'CP',  label: 'CP - With Breakfast' },
  { value: 'MAP', label: 'MAP - Breakfast + Dinner' },
  { value: 'AP',  label: 'AP - All Meals' },
]

const INPUT = "w-full px-4 py-3 bg-[#1a1a1a] border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a] placeholder:text-white/30 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
const LABEL = "block text-white/70 text-sm mb-2"

export default function WalkInBooking() {
  const router = useRouter()
  const [rooms, setRooms] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [rateInfo, setRateInfo] = useState<any>(null)
  const [rateFetching, setRateFetching] = useState(false)
  const [availability, setAvailability] = useState<any>(null)
  const [phoneLookupDone, setPhoneLookupDone] = useState(false)
  const [existingGuest, setExistingGuest] = useState<any>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [gstRequired, setGstRequired] = useState(false)
  const [createdBooking, setCreatedBooking] = useState<any>(null)

  const [form, setForm] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    guest_id_type: '',
    guest_id_number: '',
    room_id: '',
    check_in: '',
    check_out: '',
    rooms_booked: 1,
    adults: 2,
    children_below_5: 0,
    children_5_to_12: 0,
    children_above_12: 0,
    extra_beds: 0,
    meal_plan: 'CP',
    booking_type: 'b2c',
    payment_method: 'cash',
    payment_status: 'fully_paid',
    advance_amount: 0,
    special_requests: '',
    admin_notes: '',
    manual_price: false,
    rate_per_room_per_night: 0,
    extra_bed_rate: 0,
    child_rate: 0,
  })

  useEffect(() => { checkAuth(); loadRooms() }, [])

  useEffect(() => {
    if (form.room_id && form.check_in && !form.manual_price) fetchRate()
  }, [form.room_id, form.check_in, form.meal_plan, form.booking_type, rooms])

  useEffect(() => {
    if (form.room_id && form.check_in && form.check_out) checkAvailability()
  }, [form.room_id, form.check_in, form.check_out, form.rooms_booked])

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { window.location.href = '/admin/login'; return }
      const vres = await fetch('/api/admin/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!vres.ok) { window.location.href = '/admin/login'; return }
    } catch { window.location.href = '/admin/login'; return }
  }

  async function loadRooms() {
    const res = await fetch('/api/admin/data?type=rooms')
    const { data } = await res.json()
    setRooms(data || [])
  }

  // Phone lookup — find existing guest
  async function lookupGuest(phone: string) {
    if (phone.length !== 10) return
    setPhoneLookupDone(false)
    try {
      const res = await fetch(`/api/admin/data?type=guest-by-phone&phone=${phone}`)
      const data = await res.json()
      if (data.found) {
        setExistingGuest(data.guest)
        setForm(prev => ({
          ...prev,
          guest_name: data.guest.guest_name || prev.guest_name,
          guest_email: data.guest.guest_email || prev.guest_email,
          guest_id_type: data.guest.guest_id_type || prev.guest_id_type,
          guest_id_number: data.guest.guest_id_number || prev.guest_id_number,
        }))
        toast.success(`Guest found: ${data.guest.guest_name}`)
      } else {
        setExistingGuest(null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setPhoneLookupDone(true)
    }
  }

  async function fetchRate() {
    const selectedRoom = rooms.find(r => r.id === form.room_id)
    if (!selectedRoom || !form.check_in) return
    setRateFetching(true)
    try {
      const res = await fetch(`/api/admin/data?type=rate&category=${selectedRoom.category}&check_in=${form.check_in}&meal_plan=${form.meal_plan}&rate_type=${form.booking_type}`)
      const data = await res.json()
      if (data.found) {
        setRateInfo(data)
        setForm(prev => ({
          ...prev,
          rate_per_room_per_night: data.price_per_night,
          extra_bed_rate: data.extra_bed_price,
          child_rate: data.child_5_12_price || 0,
        }))
      } else {
        setRateInfo(null)
        toast.error('Is date ke liye rate nahi mila')
      }
    } catch (e) { console.error(e) }
    finally { setRateFetching(false) }
  }

  async function checkAvailability() {
    try {
      const res = await fetch('/api/admin/data?type=availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: form.room_id, check_in: form.check_in, check_out: form.check_out, rooms_needed: form.rooms_booked })
      })
      setAvailability(await res.json())
    } catch (e) { console.error(e) }
  }

  // Field-level validation on blur
  function validateField(field: string, value: any) {
    let error = ''
    if (field === 'guest_phone') {
      if (!value) error = 'Phone number required'
      else if (!/^\d{10}$/.test(value)) error = 'Phone must be exactly 10 digits'
    }
    if (field === 'guest_email' && value) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Enter a valid email address'
    }
    if (field === 'guest_name' && !value.trim()) error = 'Guest name required'
    if (field === 'check_out' && form.check_in && value && value <= form.check_in) error = 'Check-out must be after check-in'

    setErrors(prev => ({ ...prev, [field]: error }))
    return error === ''
  }

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }))

  const nights = form.check_in && form.check_out
    ? Math.max(0, Math.ceil((new Date(form.check_out).getTime() - new Date(form.check_in).getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  const selectedRoom = rooms.find(r => r.id === form.room_id)
  const roomTotal = form.rate_per_room_per_night * nights * form.rooms_booked
  const extraBedTotal = form.extra_bed_rate * form.extra_beds * nights
  const childTotal = form.child_rate * form.children_5_to_12 * nights
  const baseAmount = roomTotal + extraBedTotal + childTotal
  const subtotal = Math.round(baseAmount / 1.18 * 100) / 100
  const cgst = Math.round((baseAmount - subtotal) / 2 * 100) / 100
  const sgst = cgst
  const totalAmount = baseAmount
  const balanceAmount = totalAmount - form.advance_amount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate all fields before submit
    const validPhone = validateField('guest_phone', form.guest_phone)
    const validName = validateField('guest_name', form.guest_name)
    const validEmail = validateField('guest_email', form.guest_email)
    if (!validPhone || !validName || !validEmail) {
      toast.error('Please fix validation errors')
      return
    }
    if (!form.room_id) { toast.error('Room select karo'); return }
    if (nights === 0) { toast.error('Check-out check-in se baad hona chahiye'); return }
    if (availability && !availability.available) {
      toast.error(`Sirf ${availability.available_rooms} room available hain`); return
    }

    setSubmitting(true)
    try {
      const { data: { session: _bsess } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/data?type=booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_bsess?.access_token || ''}` },
        body: JSON.stringify({
          guest_name: form.guest_name,
          guest_email: form.guest_email || null,
          guest_phone: form.guest_phone,
          guest_id_type: form.guest_id_type || null,
          guest_id_number: form.guest_id_number || null,
          room_id: form.room_id,
          check_in: form.check_in,
          check_out: form.check_out,
          nights,
          rooms_booked: form.rooms_booked,
          adults: form.adults,
          children_below_5: form.children_below_5,
          children_5_to_12: form.children_5_to_12,
          extra_beds: form.extra_beds,
          meal_plan: form.meal_plan,
          booking_source: 'walk_in',
          booking_type: form.booking_type,
          booking_status: 'checked_in',  // Walk-in = auto checked in
          rate_per_room_per_night: form.rate_per_room_per_night,
          extra_bed_rate_per_night: form.extra_bed_rate,
          child_rate_per_night: form.child_rate,
          subtotal,
          cgst,
          sgst,
          gst_total: cgst + sgst,
          total_amount: totalAmount,
          payment_method: form.payment_method,
          payment_status: form.payment_status,
          advance_amount: form.advance_amount,
          balance_amount: Math.max(0, balanceAmount),
          payment_id: `WALKIN-${Date.now()}`,
          special_requests: form.special_requests || null,
          admin_notes: form.admin_notes || null,
          season_id: rateInfo?.season_id || null,
          checked_in_at: new Date().toISOString(),
        })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      toast.success(`Booking created! ${result.booking_number || ''} — Guest checked in`)
      // Send notification
      try {
        await fetch('/api/admin/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'booking_confirmation', booking_id: result.id })
        })
      } catch (e) { console.error('Notification failed', e) }
      setCreatedBooking({ ...result, payment_status: form.payment_status, total_amount: totalAmount, subtotal, cgst, sgst, balance_amount: Math.max(0, balanceAmount), advance_amount: form.advance_amount, room: rooms.find(r => r.id === form.room_id), nights, rooms_booked: form.rooms_booked, adults: form.adults, extra_beds: form.extra_beds, children_5_to_12: form.children_5_to_12, children_below_5: form.children_below_5, meal_plan: form.meal_plan, rate_per_room_per_night: form.rate_per_room_per_night, extra_bed_rate_per_night: form.extra_bed_rate, child_rate_per_night: form.child_rate, guest_name: form.guest_name, guest_phone: form.guest_phone, guest_email: form.guest_email, check_in: form.check_in, check_out: form.check_out, booking_number: result.booking_number, payment_method: form.payment_method })
      setTimeout(() => { window.location.href = '/admin/bookings' }, 3000)
    } catch (error: any) {
      toast.error(error.message || 'Booking create nahi hui')
    } finally {
      setSubmitting(false)
    }
  }

  const ErrMsg = ({ field }: { field: string }) =>
    errors[field] ? <p className="text-red-400 text-xs mt-1">{errors[field]}</p> : null

  return (
    <div className="min-h-screen bg-[#0b0b0b] py-8 px-4">
      <Toaster position="top-center" />
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-playfair text-[#c9a14a] mb-1">Walk-in Booking</h1>
            <p className="text-white/50 text-sm">Guest will be auto checked-in on save</p>
          </div>
          <Link href="/admin/dashboard" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm transition-all">← Dashboard</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 1. Guest Info */}
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold">1</span>
              Guest Information
            </h2>
            <div className="grid md:grid-cols-2 gap-4">

              {/* Phone first for lookup */}
              <div>
                <label className={LABEL}>Phone Number * <span className="text-white/40 text-xs">(enter first for auto-fill)</span></label>
                <input
                  type="tel"
                  maxLength={10}
                  value={form.guest_phone}
                  onChange={e => { set('guest_phone', e.target.value.replace(/\D/g, '')); setErrors(p => ({...p, guest_phone: ''})) }}
                  onBlur={e => { validateField('guest_phone', e.target.value); if (e.target.value.length === 10) lookupGuest(e.target.value) }}
                  className={`${INPUT} ${errors.guest_phone ? 'border-red-500' : ''}`}
                  placeholder="10 digit mobile number"
                />
                <ErrMsg field="guest_phone" />
                {existingGuest && <p className="text-green-400 text-xs mt-1">✓ Returning guest — details auto-filled</p>}
                {phoneLookupDone && !existingGuest && form.guest_phone.length === 10 && <p className="text-white/40 text-xs mt-1">New guest</p>}
              </div>

              <div>
                <label className={LABEL}>Guest Name *</label>
                <input
                  type="text"
                  value={form.guest_name}
                  onChange={e => { set('guest_name', e.target.value); setErrors(p => ({...p, guest_name: ''})) }}
                  onBlur={e => validateField('guest_name', e.target.value)}
                  className={`${INPUT} ${errors.guest_name ? 'border-red-500' : ''}`}
                  placeholder="Full name"
                />
                <ErrMsg field="guest_name" />
              </div>

              <div>
                <label className={LABEL}>Email</label>
                <input
                  type="text"
                  value={form.guest_email}
                  onChange={e => { set('guest_email', e.target.value); setErrors(p => ({...p, guest_email: ''})) }}
                  onBlur={e => validateField('guest_email', e.target.value)}
                  className={`${INPUT} ${errors.guest_email ? 'border-red-500' : ''}`}
                  placeholder="email@example.com"
                />
                <ErrMsg field="guest_email" />
              </div>

              <div>
                <label className={LABEL}>ID Proof Type</label>
                <select value={form.guest_id_type} onChange={e => set('guest_id_type', e.target.value)} className={INPUT}>
                  <option value="">Select ID type...</option>
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                  <option value="voter_id">Voter ID</option>
                </select>
              </div>

              <div>
                <label className={LABEL}>ID Number</label>
                <input type="text" value={form.guest_id_number} onChange={e => set('guest_id_number', e.target.value)} className={INPUT} placeholder="ID number" />
              </div>
            </div>
          </div>

          {/* 2. Stay Details */}
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold">2</span>
              Stay Details
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Check-in Date *</label>
                <input type="date" required value={form.check_in} onChange={e => set('check_in', e.target.value)} min={new Date().toISOString().split('T')[0]} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Check-out Date *</label>
                <input
                  type="date" required value={form.check_out}
                  onChange={e => { set('check_out', e.target.value); setErrors(p => ({...p, check_out: ''})) }}
                  onBlur={e => validateField('check_out', e.target.value)}
                  min={form.check_in || new Date().toISOString().split('T')[0]}
                  className={`${INPUT} ${errors.check_out ? 'border-red-500' : ''}`}
                />
                <ErrMsg field="check_out" />
              </div>
              <div>
                <label className={LABEL}>Room Type *</label>
                <select required value={form.room_id} onChange={e => set('room_id', e.target.value)} className={INPUT}>
                  <option value="">Choose room...</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name} ({room.total_rooms} rooms, max {room.max_guests} guests/room)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Number of Rooms *</label>
                <input type="number" required min="1" max={selectedRoom?.total_rooms || 99} value={form.rooms_booked} onChange={e => set('rooms_booked', parseInt(e.target.value) || 1)} className={INPUT}  onWheel={e => e.currentTarget.blur()} />
              </div>

              {availability && form.check_in && form.check_out && (
                <div className={`md:col-span-2 px-4 py-3 rounded-lg text-sm font-medium ${availability.available ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                  {availability.available
                    ? `✓ ${availability.available_rooms} room(s) available (${availability.booked_rooms} already booked of ${availability.total_rooms})`
                    : `✗ Only ${availability.available_rooms} room(s) available, you need ${form.rooms_booked}`}
                </div>
              )}

              <div>
                <label className={LABEL}>Meal Plan *</label>
                <select value={form.meal_plan} onChange={e => set('meal_plan', e.target.value)} className={INPUT}>
                  {MEAL_PLANS.map(mp => <option key={mp.value} value={mp.value}>{mp.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Booking Type *</label>
                <select value={form.booking_type} onChange={e => set('booking_type', e.target.value)} className={INPUT}>
                  <option value="b2c">B2C (Direct / Public Rate)</option>
                  <option value="b2b">B2B (Agent / Trade Rate)</option>
                </select>
              </div>
            </div>

            {rateInfo && (
              <div className="mt-4 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
                Season: <span className="font-semibold">{rateInfo.season_label}</span> &nbsp;|&nbsp;
                Rate: <span className="font-semibold">₹{rateInfo.price_per_night}/room/night</span> &nbsp;|&nbsp;
                Extra Bed: <span className="font-semibold">₹{rateInfo.extra_bed_price}/night</span>
                {rateInfo.child_5_12_price > 0 && <>&nbsp;|&nbsp;Child (6-12): <span className="font-semibold">₹{rateInfo.child_5_12_price}/night</span></>}
              </div>
            )}
            {rateFetching && <div className="mt-3 text-white/40 text-sm animate-pulse">Fetching rate...</div>}
          </div>

          {/* 3. Occupancy */}
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold">3</span>
              Occupancy Details
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className={LABEL}>Adults *</label>
                <input type="number" required min="1" value={form.adults} onWheel={e => e.currentTarget.blur()} onChange={e => set('adults', parseInt(e.target.value) || 1)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Children (0-5 yrs)</label>
                <p className="text-[10px] text-green-400 mb-1">✓ Complimentary</p>
                <input type="number" min="0" value={form.children_below_5} onChange={e => set('children_below_5', parseInt(e.target.value) || 0)} className={INPUT}  onWheel={e => e.currentTarget.blur()} />
              </div>
              <div>
                <label className={LABEL}>Children (6-12 yrs)</label>
                <p className="text-[10px] text-yellow-400 mb-1">@ child rate</p>
                <input type="number" min="0" value={form.children_5_to_12} onChange={e => set('children_5_to_12', parseInt(e.target.value) || 0)} className={INPUT}  onWheel={e => e.currentTarget.blur()} />
              </div>
              <div>
                <label className={LABEL}>Extra Beds</label>
                {selectedRoom && <p className="text-[10px] text-white/40 mb-1">Max {selectedRoom.max_extra_beds * form.rooms_booked} allowed</p>}
                <input type="number" min="0" max={selectedRoom ? selectedRoom.max_extra_beds * form.rooms_booked : 5} value={form.extra_beds} onChange={e => set('extra_beds', parseInt(e.target.value) || 0)} className={INPUT}  onWheel={e => e.currentTarget.blur()} />
              </div>
            </div>
          </div>

          {/* 4. Pricing */}
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold">4</span>
                Pricing
              </h2>
              <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
                <input type="checkbox" checked={form.manual_price} onChange={e => set('manual_price', e.target.checked)} className="w-4 h-4 accent-[#c9a14a]" />
                Manual override
              </label>
            </div>

            {form.manual_price && (
              <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                <div>
                  <label className={LABEL}>Rate/Room/Night (₹)</label>
                  <input type="number" min="0" value={form.rate_per_room_per_night} onChange={e => set('rate_per_room_per_night', parseFloat(e.target.value) || 0)} className={INPUT}  onWheel={e => e.currentTarget.blur()} />
                </div>
                <div>
                  <label className={LABEL}>Extra Bed Rate/Night (₹)</label>
                  <input type="number" min="0" value={form.extra_bed_rate} onChange={e => set('extra_bed_rate', parseFloat(e.target.value) || 0)} className={INPUT}  onWheel={e => e.currentTarget.blur()} />
                </div>
                <div>
                  <label className={LABEL}>Child Rate/Night (₹)</label>
                  <input type="number" min="0" value={form.child_rate} onChange={e => set('child_rate', parseFloat(e.target.value) || 0)} className={INPUT}  onWheel={e => e.currentTarget.blur()} />
                </div>
              </div>
            )}

            {selectedRoom && nights > 0 && form.rate_per_room_per_night > 0 && (
              <div className="bg-[#c9a14a]/10 border border-[#c9a14a]/20 rounded-xl p-4 text-sm space-y-2">
                <div className="flex justify-between text-white/70">
                  <span>{selectedRoom.name} × {form.rooms_booked} room{form.rooms_booked > 1 ? 's' : ''} × {nights} night{nights > 1 ? 's' : ''} @ ₹{form.rate_per_room_per_night}</span>
                  <span>₹{roomTotal.toLocaleString()}</span>
                </div>
                {form.extra_beds > 0 && <div className="flex justify-between text-white/70"><span>Extra Bed × {form.extra_beds} × {nights} nights @ ₹{form.extra_bed_rate}</span><span>₹{extraBedTotal.toLocaleString()}</span></div>}
                {form.children_5_to_12 > 0 && <div className="flex justify-between text-white/70"><span>Child (6-12) × {form.children_5_to_12} × {nights} nights @ ₹{form.child_rate}</span><span>₹{childTotal.toLocaleString()}</span></div>}
                {form.children_below_5 > 0 && <div className="flex justify-between text-green-400/70"><span>Children (0-5) × {form.children_below_5} — Complimentary</span><span>₹0</span></div>}
                <div className="border-t border-white/10 pt-2">
                  <div className="flex justify-between text-white/50 text-xs"><span>Subtotal (excl. GST)</span><span>₹{subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-white/50 text-xs"><span>CGST @ 9%</span><span>₹{cgst.toLocaleString()}</span></div>
                  <div className="flex justify-between text-white/50 text-xs"><span>SGST @ 9%</span><span>₹{sgst.toLocaleString()}</span></div>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between text-white font-bold text-base">
                  <span>Total Amount</span>
                  <span className="text-[#c9a14a]">₹{totalAmount.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* 5. Payment */}
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold">5</span>
              Payment Details
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>Payment Method *</label>
                <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className={INPUT}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Payment Status *</label>
                <select value={form.payment_status} onChange={e => set('payment_status', e.target.value)} className={INPUT}>
                  <option value="fully_paid">Fully Paid</option>
                  <option value="advance_paid">Advance Paid</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              {form.payment_status === 'advance_paid' && (
                <div>
                  <label className={LABEL}>Advance Amount (₹)</label>
                  <input type="number" min="0" max={totalAmount} value={form.advance_amount} onChange={e => set('advance_amount', parseFloat(e.target.value) || 0)} className={INPUT}  onWheel={e => e.currentTarget.blur()} />
                  {totalAmount > 0 && <p className="text-xs text-yellow-400 mt-1">Balance due: ₹{Math.max(0, balanceAmount).toLocaleString()}</p>}
                </div>
              )}
            </div>
          </div>


          {/* GST & Bill */}
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <span className="w-6 h-6 bg-[#c9a14a] text-black text-xs rounded-full flex items-center justify-center font-bold">6</span>
                GST Invoice
              </h2>
              <label className="flex items-center gap-3 cursor-pointer group">
                <span className="text-white/60 text-sm">GST Bill Required?</span>
                <div
                  onClick={() => setGstRequired(v => !v)}
                  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${gstRequired ? 'bg-[#c9a14a]' : 'bg-white/20'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${gstRequired ? 'left-7' : 'left-1'}`} />
                </div>
              </label>
            </div>
            {gstRequired && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                <p className="text-green-400 text-sm mb-3">✓ GST invoice will include CGST + SGST (Uttarakhand guest) or IGST (other state)</p>
                {createdBooking ? (
                  <GSTBillButton booking={createdBooking} />
                ) : (
                  <p className="text-white/40 text-xs">GST Bill download option will appear here after booking is saved with full payment</p>
                )}
              </div>
            )}
            {!gstRequired && (
              <p className="text-white/40 text-sm mt-3">No GST invoice needed — booking will proceed without tax bill</p>
            )}
          </div>

          {/* 7. Notes */}
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
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
                <label className={LABEL}>Admin Notes (Internal only)</label>
                <textarea value={form.admin_notes} onChange={e => set('admin_notes', e.target.value)} className={INPUT} rows={3} placeholder="Internal notes..." />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4 pb-8">
            <button
              type="submit"
              disabled={submitting || nights === 0 || !form.rate_per_room_per_night || (availability && !availability.available)}
              className="flex-1 bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black px-8 py-4 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-all text-lg"
            >
              {submitting ? 'Creating...' : `Create & Check-in${totalAmount > 0 ? ` — ₹${totalAmount.toLocaleString()}` : ''}`}
            </button>
            <Link href="/admin/dashboard" className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-full text-white font-semibold transition-all">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
