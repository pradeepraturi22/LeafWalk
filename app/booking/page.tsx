'use client'
import React from 'react'
import { useState, useEffect, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'
import toast, { Toaster } from 'react-hot-toast'
import { loadRazorpayScript } from '@/lib/razorpay'

interface Room {
  id: string; name: string; slug: string; category: string
  description: string; max_guests: number; max_extra_beds: number
  total_rooms: number; amenities: string[]; featured_image: string
  display_price_from: number
}
interface RoomRate {
  meal_plan: string; rate_type: string; price_per_night: number
  extra_bed_price: number; child_5_12_price: number
  season?: any
}
interface FormErrors {
  name?: string; email?: string; phone?: string
  checkIn?: string; checkOut?: string
}
interface PromoResult {
  valid: boolean; offer_id?: string; code?: string
  discount_percentage?: number; discount_amount?: number
  message?: string; error?: string
}
interface DayAvail {
  date: string
  deluxeAvail: number; deluxeTotal: number
  premiumAvail: number; premiumTotal: number
}

const MAX_PER_ROOM = 3   // max 3 guests per room; 3rd triggers auto extra bed

const MEAL_INFO: Record<string, { label: string; desc: string; icon: string }> = {
  EP:  { label: 'Room Only',          desc: 'No meals included',           icon: '🛏️' },
  CP:  { label: 'With Breakfast',     desc: 'Continental breakfast daily', icon: '☕' },
  MAP: { label: 'Breakfast + Dinner', desc: 'Two meals every day',         icon: '🍽️' },
  AP:  { label: 'All Meals',          desc: 'Full board — 3 meals daily',  icon: '🥘' },
}

const COUNTRY_CODES = [
  { code: '+91',  flag: '🇮🇳', name: 'India',        len: 10, re: /^[6-9]\d{9}$/ },
  { code: '+1',   flag: '🇺🇸', name: 'USA/Canada',   len: 10, re: /^\d{10}$/ },
  { code: '+44',  flag: '🇬🇧', name: 'UK',           len: 10, re: /^\d{10}$/ },
  { code: '+61',  flag: '🇦🇺', name: 'Australia',    len: 9,  re: /^\d{9}$/ },
  { code: '+971', flag: '🇦🇪', name: 'UAE',          len: 9,  re: /^\d{9}$/ },
  { code: '+65',  flag: '🇸🇬', name: 'Singapore',    len: 8,  re: /^\d{8}$/ },
  { code: '+60',  flag: '🇲🇾', name: 'Malaysia',     len: 9,  re: /^\d{9,10}$/ },
  { code: '+49',  flag: '🇩🇪', name: 'Germany',      len: 10, re: /^\d{10,11}$/ },
  { code: '+33',  flag: '🇫🇷', name: 'France',       len: 9,  re: /^\d{9}$/ },
  { code: '+81',  flag: '🇯🇵', name: 'Japan',        len: 10, re: /^\d{10,11}$/ },
  { code: '+86',  flag: '🇨🇳', name: 'China',        len: 11, re: /^\d{11}$/ },
  { code: '+977', flag: '🇳🇵', name: 'Nepal',        len: 10, re: /^\d{10}$/ },
  { code: '+94',  flag: '🇱🇰', name: 'Sri Lanka',    len: 9,  re: /^\d{9}$/ },
  { code: '+975', flag: '🇧🇹', name: 'Bhutan',       len: 8,  re: /^\d{8}$/ },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh',   len: 10, re: /^\d{10}$/ },
  { code: '+92',  flag: '🇵🇰', name: 'Pakistan',     len: 10, re: /^\d{10}$/ },
  { code: '+27',  flag: '🇿🇦', name: 'South Africa', len: 9,  re: /^\d{9}$/ },
  { code: '+55',  flag: '🇧🇷', name: 'Brazil',       len: 11, re: /^\d{10,11}$/ },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
function sanitize(s: string) { return s.replace(/[<>"'&;]/g, '').trim().slice(0, 200) }
function validateName(n: string) {
  if (!n.trim()) return 'Full name is required'
  if (n.trim().length < 2) return 'Name must be at least 2 characters'
  if (/[^a-zA-Z\s.\-']/.test(n)) return 'Name contains invalid characters'
}
function validateEmail(e: string) { if (e && !EMAIL_RE.test(e)) return 'Enter a valid email address' }
function validatePhoneIntl(phone: string, cc: string) {
  const d = phone.replace(/\D/g, '')
  if (!d) return 'Phone number is required'
  const c = COUNTRY_CODES.find(x => x.code === cc)
  if (c && !c.re.test(d)) return `Enter a valid ${c.name} number (${c.len} digits)`
  if (d.length < 6 || d.length > 15) return 'Enter a valid phone number'
}
class RateLimiter {
  private m = new Map<string, { n: number; r: number }>()
  check(k: string, lim: number, ms: number) {
    const now = Date.now(), e = this.m.get(k)
    if (!e || now > e.r) { this.m.set(k, { n: 1, r: now + ms }); return true }
    if (e.n >= lim) return false; e.n++; return true
  }
}
const rl = new RateLimiter()
function toDS(d: Date) { return d.toISOString().split('T')[0] }
function addDays(s: string, n: number) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return toDS(d) }
const BI: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', color: '#fff' }

// ── Availability Calendar ─────────────────────────────────────────────────────
function AvailCalendar({ checkIn, checkOut, allRooms }: { checkIn: string; checkOut: string; allRooms: Room[] }) {
  const [days, setDays] = useState<DayAvail[]>([])
  const [loading, setLoading] = useState(false)

  const deluxeTotal  = allRooms.filter(r => r.category === 'deluxe' ).reduce((s, r) => s + r.total_rooms, 0)
  const premiumTotal = allRooms.filter(r => r.category === 'premium').reduce((s, r) => s + r.total_rooms, 0)

  useEffect(() => { if (checkIn && checkOut) load() }, [checkIn, checkOut])

  async function load() {
    setLoading(true)
    try {
      // Build date list (check-in to day before check-out)
      const dates: string[] = []
      let cur = checkIn
      while (cur < checkOut) { dates.push(cur); cur = addDays(cur, 1) }
      if (!dates.length) return

      const { data: bkgs } = await supabase
        .from('bookings')
        .select('room_id, check_in, check_out, rooms_booked')
        .in('booking_status', ['pending', 'confirmed', 'hold', 'checked_in'])
        .lt('check_in', checkOut).gt('check_out', checkIn)

      const catMap: Record<string, string> = {}
      allRooms.forEach(r => { catMap[r.id] = r.category })

      setDays(dates.map(date => {
        const bk = (bkgs || []).filter(b => b.check_in <= date && b.check_out > date)
        const db = bk.filter(b => catMap[b.room_id] === 'deluxe' ).reduce((s, b) => s + (b.rooms_booked || 1), 0)
        const pb = bk.filter(b => catMap[b.room_id] === 'premium').reduce((s, b) => s + (b.rooms_booked || 1), 0)
        return {
          date,
          deluxeAvail:  Math.max(0, deluxeTotal  - db),
          deluxeTotal,
          premiumAvail: Math.max(0, premiumTotal - pb),
          premiumTotal,
        }
      }))
    } finally { setLoading(false) }
  }

  if (!checkIn || !checkOut) return null
  if (loading) return (
    <div className="flex items-center gap-2 text-white/40 text-xs py-3">
      <span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />
      Loading availability calendar...
    </div>
  )
  if (!days.length) return null

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">📅 Availability Calendar</span>
        <span className="text-xs text-white/40">per-night view</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/8 bg-white/3">
              <th className="px-4 py-2.5 text-left text-white/50 font-medium">Date</th>
              {deluxeTotal  > 0 && <th className="px-4 py-2.5 text-center text-blue-400  font-medium">🏠 Deluxe</th>}
              {premiumTotal > 0 && <th className="px-4 py-2.5 text-center text-[#c9a14a] font-medium">⭐ Premium</th>}
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => {
              const dt = new Date(d.date + 'T12:00:00')
              const lbl = dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
              return (
                <tr key={d.date} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/1' : ''}`}>
                  <td className="px-4 py-2.5 text-white/70">{lbl}</td>
                  {deluxeTotal > 0 && (
                    <td className="px-4 py-2.5 text-center">
                      <span className={`font-bold ${d.deluxeAvail === 0 ? 'text-red-400' : d.deluxeAvail === 1 ? 'text-orange-400' : 'text-blue-400'}`}>
                        {d.deluxeAvail === 0 ? '❌ Full' : `${d.deluxeAvail}/${d.deluxeTotal} avail`}
                      </span>
                    </td>
                  )}
                  {premiumTotal > 0 && (
                    <td className="px-4 py-2.5 text-center">
                      <span className={`font-bold ${d.premiumAvail === 0 ? 'text-red-400' : d.premiumAvail === 1 ? 'text-orange-400' : 'text-[#c9a14a]'}`}>
                        {d.premiumAvail === 0 ? '❌ Full' : `${d.premiumAvail}/${d.premiumTotal} avail`}
                      </span>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-white/8 text-xs text-white/30 flex gap-4">
        <span>🟢 Available &nbsp; 🟠 Only 1 left &nbsp; 🔴 Full</span>
      </div>
    </div>
  )
}

// ── Main Booking Component ────────────────────────────────────────────────────
function BookingContent() {
  const router   = useRouter()
  const sp       = useSearchParams()
  const roomSlug = sp.get('room')

  const [allRooms, setAllRooms]   = useState<Room[]>([])
  const [room, setRoom]           = useState<Room | null>(null)
  const [rates, setRates]         = useState<RoomRate[]>([])
  const [loading, setLoading]     = useState(true)
  const [step, setStep]           = useState<1 | 2>(1)
  const [userId, setUserId]       = useState<string | null>(null)

  // Step 1
  const [checkIn,  setCheckIn]    = useState(sp.get('checkIn')  || '')
  const [checkOut, setCheckOut]   = useState(sp.get('checkOut') || '')
  const [numRooms, setNumRooms]   = useState(1)
  const [adults,   setAdults]     = useState(2)
  // Online bookings always CP (Breakfast Included) — no meal plan selection for website guests
  const mealPlan = 'CP'
  const [available, setAvail]     = useState<number | null>(null)
  const [checking, setChecking]   = useState(false)
  const [showCal, setShowCal]     = useState(false)

  // Step 2
  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [note,        setNote]        = useState('')
  const [errors,      setErrors]      = useState<FormErrors>({})
  const [touched,     setTouched]     = useState<Record<string, boolean>>({})
  const [paying,      setPaying]      = useState(false)

  // Promo
  const [promoCode,     setPromoCode]     = useState('')
  const [promoResult,   setPromoResult]   = useState<PromoResult | null>(null)
  const [promoChecking, setPromoChecking] = useState(false)

  const today    = toDS(new Date())
  const tomorrow = toDS(new Date(Date.now() + 86400000))

  // ── Auto extra bed logic: max 3/room, 3rd adult = 1 extra bed per that room ─
  const maxAdults   = MAX_PER_ROOM * numRooms
  // rooms needing extra bed = adults beyond 2 per room
  const autoXbeds   = Math.min(Math.max(0, adults - 2 * numRooms), numRooms)

  // ── Load rooms & rates ────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomSlug) { router.push('/rooms'); return }
    Promise.all([
      supabase.from('rooms')
        .select('id,name,slug,category,description,max_guests,max_extra_beds,total_rooms,amenities,featured_image,display_price_from')
        .eq('is_active', true).order('category'),
      supabase.from('room_rates')
        .select('room_category,meal_plan,rate_type,price_per_night,extra_bed_price,child_5_12_price,season:seasons(id,start_month,start_day,end_month,end_day)')
        .eq('rate_type', 'b2c'),
    ]).then(([rr, ratesR]) => {
      if (rr.error || !rr.data?.length) { toast.error('Room not found'); router.push('/rooms'); return }
      const all = rr.data
      setAllRooms(all)
      const target = all.find(r => r.slug === roomSlug)
      if (!target) { toast.error('Room not found'); router.push('/rooms'); return }
      setRoom(target)
      setRates((ratesR.data || [] as any[]).filter((r: any) => r.room_category === target.category) as any)
      setLoading(false)
    })
  }, [roomSlug])

  // ── Pre-fill user ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return
      const authUser = session.user
      setUserId(authUser.id)
      // Email comes directly from auth session (reliable)
      if (authUser.email) setEmail(authUser.email)
      // Name and phone from users table
      const { data: u } = await supabase
        .from('users').select('name,phone').eq('id', authUser.id).single() as any
      if (u?.name)  setName(u.name)
      if (u?.phone) {
        // Parse stored phone: +91XXXXXXXXXX -> set CC and number
        const stored = u.phone as string
        const matchedCC = ['+971','+880','+977','+975','+94','+92','+86','+81','+65','+61','+60','+49','+44','+33','+27','+1','+91'].find(cc => stored.startsWith(cc))
        if (matchedCC) {
          setCountryCode(matchedCC)
          setPhone(stored.slice(matchedCC.length))
        } else {
          setPhone(stored.replace(/^\+91/, ''))
        }
      }
    })
  }, [])

  // Clamp adults when rooms change
  useEffect(() => { if (adults > maxAdults) setAdults(maxAdults) }, [numRooms])

  // ── Season / rate helpers ─────────────────────────────────────────────────
  function dateInSeason(d: Date, s: RoomRate['season']) {
    const m = d.getMonth() + 1, day = d.getDate()
    const st = s.start_month * 100 + s.start_day
    const en = s.end_month   * 100 + s.end_day
    const cu = m * 100 + day
    return st <= en ? cu >= st && cu <= en : cu >= st || cu <= en
  }
  function getRate() {
    if (!room || !checkIn) return room?.display_price_from || 0
    const d = new Date(checkIn + 'T12:00:00')
    return rates.find(r => r.meal_plan === mealPlan && dateInSeason(d, r.season))?.price_per_night
      || rates.find(r => r.meal_plan === mealPlan)?.price_per_night
      || room?.display_price_from || 0
  }
  function getXbRate() {
    if (!room || !checkIn) return 800
    const d = new Date(checkIn + 'T12:00:00')
    return rates.find(r => dateInSeason(d, r.season))?.extra_bed_price || 800
  }

  const nights  = checkIn && checkOut
    ? Math.max(0, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 0
  const rate    = getRate()
  const xbRate  = getXbRate()
  const base    = rate * nights * numRooms
  const xbAmt   = xbRate * nights * autoXbeds
  const subtotal = base + xbAmt
  const promoDiscount = promoResult?.valid ? (promoResult.discount_amount || 0) : 0
  const discounted = Math.max(0, subtotal - promoDiscount)
  const gst     = Math.round(discounted * 0.12)
  const total   = discounted + gst

  // ── Validation ────────────────────────────────────────────────────────────
  const touch = (f: string) => setTouched(t => ({ ...t, [f]: true }))
  const validateField = useCallback((f: string, v: string) => {
    let e: string | undefined
    if (f === 'name')  e = validateName(v)
    if (f === 'phone') e = validatePhoneIntl(v, countryCode)
    if (f === 'email') e = validateEmail(v)
    setErrors(p => ({ ...p, [f]: e }))
  }, [countryCode])

  function validateStep2() {
    const ne = validateName(name), pe = validatePhoneIntl(phone, countryCode), ee = email ? validateEmail(email) : undefined
    setErrors({ name: ne, phone: pe, email: ee })
    setTouched({ name: true, phone: true, email: true })
    return !ne && !pe && !ee
  }

  // ── Promo ─────────────────────────────────────────────────────────────────
  async function applyPromo() {
    if (!promoCode.trim()) return
    if (!nights) { toast.error('Please select dates first'); return }
    if (!rl.check('promo', 5, 60000)) { toast.error('Too many attempts'); return }
    setPromoChecking(true); setPromoResult(null)
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim(), room_category: room?.category, nights, base_amount: subtotal }),
      })
      const data: PromoResult = await res.json()
      setPromoResult(data)
      if (data.valid) toast.success(data.message || 'Promo applied!'); else toast.error(data.error || 'Invalid code')
    } catch { toast.error('Could not validate promo code') } finally { setPromoChecking(false) }
  }
  function removePromo() { setPromoCode(''); setPromoResult(null) }

  // ── Availability ──────────────────────────────────────────────────────────
  async function checkAvailability() {
    if (!rl.check('avail', 5, 30000)) { toast.error('Too many requests'); return }
    setTouched(t => ({ ...t, checkIn: true, checkOut: true }))
    if (!checkIn)  { setErrors(p => ({ ...p, checkIn:  'Check-in date required'  })); return }
    if (!checkOut) { setErrors(p => ({ ...p, checkOut: 'Check-out date required' })); return }
    if (new Date(checkOut) <= new Date(checkIn)) { setErrors(p => ({ ...p, checkOut: 'Check-out must be after check-in' })); return }
    setChecking(true); setAvail(null); setShowCal(false)
    try {
      const res = await fetch('/api/check-availability', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room!.id,
          checkIn:  ciStr(checkIn),
          checkOut: ciStr(checkOut),
        }),
      })
      const d = await res.json()

      if (!res.ok) {
        // API returned an error — do NOT silently show "no rooms"
        toast.error(d.error || 'Could not check availability. Please try again.')
        setShowCal(false)
        return
      }

      const avail = typeof d.availableRooms === 'number' ? d.availableRooms : 0
      setAvail(avail); setShowCal(true)
      if (avail > 0) toast.success(`${avail} room${avail > 1 ? 's' : ''} available!`)
      else toast.error('No rooms available for these dates.')
    } catch (err) {
      console.error('Availability check failed:', err)
      toast.error('Unable to check availability. Check your connection.')
    } finally {
      setChecking(false)
    }
  }

  // Convert date string 'YYYY-MM-DD' directly (no timezone conversion)
  function ciStr(d: string) { return d }

  function handleProceed() {
    if (!checkIn || !checkOut)    { toast.error('Please select dates'); return }
    if (available === null)       { toast.error('Please check availability first'); return }
    if (numRooms > available)     { toast.error(`Only ${available} room(s) available`); return }
    setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Payment ───────────────────────────────────────────────────────────────
  async function handlePayment() {
    if (!validateStep2()) { toast.error('Please fix the errors below'); return }
    if (!rl.check('pay', 3, 60000)) { toast.error('Too many attempts'); return }
    setPaying(true)
    try {
      const loaded = await loadRazorpayScript()
      if (!loaded) throw new Error('Payment gateway could not load. Check your internet.')

      const sName  = sanitize(name)
      const sPhone = phone.replace(/\D/g, '').slice(0, 15)
      const sEmail = sanitize(email)
      const sNote  = sanitize(note).slice(0, 500)
      const cgst   = Math.round(discounted * 0.06)
      const sgst   = Math.round(discounted * 0.06)

      // ── Use API route with service role to bypass RLS ────────────────────────
      const createRes = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId || null,
          guest_name: sName, guest_email: sEmail || null,
          guest_phone: sPhone, guest_phone_country: countryCode,
          room_id: room!.id, check_in: checkIn, check_out: checkOut, nights,
          adults, rooms_booked: numRooms, extra_beds: autoXbeds,
          children_below_5: 0, children_5_to_12: 0, children_above_12: 0,
          meal_plan: 'CP',
          rate_per_room_per_night: rate, extra_bed_rate_per_night: xbRate, child_rate_per_night: 0,
          discount_amount: promoResult?.valid ? promoDiscount : 0,
          discount_percent: promoResult?.valid ? (promoResult.discount_percentage || 0) : 0,
          discount_reason: promoResult?.valid ? `Promo: ${promoCode}` : null,
          promo_code: promoResult?.valid ? promoCode.trim().toUpperCase() : null,
          booking_source: 'website', special_requests: sNote || null,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.error || 'Could not create booking. Please try again.')
      const bookingId    = createData.booking_id
      const bookingTotal = createData.total_amount || total

      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: bookingTotal, receipt: bookingId.slice(0, 40), notes: { booking_id: bookingId, guest: sName } }),
      })
      if (!orderRes.ok) {
        // Update status via API since client can't write directly
        await fetch('/api/bookings/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: bookingId }) })
        throw new Error((await orderRes.json()).error || 'Could not create payment order.')
      }
      const { order } = await orderRes.json()

      const rzp = new (window as any).Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount, currency: 'INR',
        name: 'LeafWalk Resort',
        description: `${room!.name} — ${nights}N · Breakfast Included`,
        image: '/logo/leafwalk-logo.jpeg',
        order_id: order.id,
        prefill: { name: sName, email: sEmail, contact: countryCode + sPhone },
        notes: { booking_id: bookingId },
        theme: { color: '#c9a14a' },
        handler: async (resp: any) => {
          try {
            const vr = await fetch('/api/payments/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...resp, booking_id: bookingId }),
            })
            if (!vr.ok) throw new Error()
            toast.success('Payment successful! Booking confirmed.')
            setTimeout(() => router.push(`/booking-confirmation?id=${bookingId}`), 1500)
          } catch { toast.error('Verification failed. Contact us with your payment ID.'); setPaying(false) }
        },
        modal: {
          ondismiss: async () => {
            await fetch('/api/bookings/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: bookingId }) })
            setPaying(false); toast('Payment cancelled.', { icon: 'ℹ️' })
          },
        },
      })
      rzp.on('payment.failed', async (resp: any) => {
        await fetch('/api/bookings/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: bookingId }) })
        toast.error(`Payment failed: ${resp.error?.description || 'Please try again.'}`)
        setPaying(false)
      })
      rzp.open()
    } catch (err: any) { toast.error(err.message || 'Something went wrong.'); setPaying(false) }
  }

  const ic = (f: string) =>
    `w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none ${
      errors[f as keyof FormErrors] && touched[f] ? 'border-red-500' : 'border-white/15 hover:border-white/25 focus:border-[#c9a14a]'}`

  const FE = ({ field }: { field: string }) =>
    errors[field as keyof FormErrors] && touched[field] ? (
      <p className="flex items-center gap-1 text-red-400 text-xs mt-1.5">
        <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
        </svg>
        {errors[field as keyof FormErrors]}
      </p>
    ) : null

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b0b' }}>
      <div className="w-12 h-12 border-2 border-[#c9a14a] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!room) return null

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: '#0b0b0b' }}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />
      <div className="max-w-6xl mx-auto">

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {[{ n: 1, label: 'Select Dates & Options' }, { n: 2, label: 'Guest Details & Payment' }].map((s, i) => (
            <div key={s.n} className="flex items-center gap-3">
              <div className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                step === s.n ? 'bg-[#c9a14a] text-black' : step > s.n ? 'text-green-400 border border-green-500/30' : 'text-white/35 border border-white/10'}`}
                style={step < s.n ? { background: 'rgba(255,255,255,0.04)' } : step > s.n ? { background: 'rgba(34,197,94,0.08)' } : {}}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === s.n ? 'bg-black/20' : step > s.n ? 'bg-green-500/20' : 'bg-white/10'}`}>
                  {step > s.n ? '✓' : s.n}
                </span>
                <span className="hidden sm:block">{s.label}</span>
              </div>
              {i < 1 && <div className="w-8 h-px bg-white/15" />}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-5">

            {/* Room header */}
            <div className="flex gap-4 p-5 rounded-2xl border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
              {room.featured_image && (
                <div className="relative w-24 h-16 rounded-xl overflow-hidden shrink-0">
                  <Image src={room.featured_image} alt={room.name} fill className="object-cover" />
                </div>
              )}
              <div>
                <div className="text-white font-playfair text-lg">{room.name}</div>
                <div className="text-sm capitalize" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {room.category} Room · Max {MAX_PER_ROOM} guests per room
                </div>
                <div className="text-[#c9a14a] text-sm mt-0.5">From ₹{(room.display_price_from || 0).toLocaleString()} / night</div>
              </div>
            </div>

            {/* ═══ STEP 1 ═══ */}
            {step === 1 && (
              <>
                <div className="p-6 rounded-2xl border border-white/8 space-y-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <h2 className="text-white font-semibold text-lg">Select Your Dates</h2>

                  {/* Dates */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Check-in Date <span className="text-red-400">*</span>
                      </label>
                      <input type="date" value={checkIn} min={today}
                        style={{ ...BI, colorScheme: 'dark' }} className={ic('checkIn')}
                        onChange={e => { setCheckIn(e.target.value); setAvail(null); setShowCal(false); setPromoResult(null); setErrors(p => ({ ...p, checkIn: undefined })) }}
                        onBlur={() => { touch('checkIn'); if (!checkIn) setErrors(p => ({ ...p, checkIn: 'Required' })) }} />
                      <FE field="checkIn" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Check-out Date <span className="text-red-400">*</span>
                      </label>
                      <input type="date" value={checkOut} min={checkIn ? addDays(checkIn, 1) : tomorrow}
                        style={{ ...BI, colorScheme: 'dark' }} className={ic('checkOut')}
                        onChange={e => { setCheckOut(e.target.value); setAvail(null); setShowCal(false); setPromoResult(null); setErrors(p => ({ ...p, checkOut: undefined })) }}
                        onBlur={() => { touch('checkOut'); if (!checkOut) setErrors(p => ({ ...p, checkOut: 'Required' })) }} />
                      <FE field="checkOut" />
                    </div>
                  </div>

                  {/* Rooms + Adults (NO extra bed input) */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Number of Rooms
                      </label>
                      <select value={numRooms}
                        onChange={e => { setNumRooms(+e.target.value); setAvail(null) }}
                        className="w-full px-4 py-3 rounded-xl border border-white/15 text-sm focus:outline-none focus:border-[#c9a14a]"
                        style={BI}>
                        {Array.from({ length: Math.min(room.total_rooms, 10) }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n} style={{ background: '#1a1a1a', color: '#fff' }}>{n} Room{n > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Number of Adults
                        <span className="ml-1 text-xs font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          (max {MAX_PER_ROOM}/room)
                        </span>
                      </label>
                      <select value={adults} onChange={e => setAdults(+e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-white/15 text-sm focus:outline-none focus:border-[#c9a14a]"
                        style={BI}>
                        {Array.from({ length: maxAdults }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n} style={{ background: '#1a1a1a', color: '#fff' }}>
                            {n} Adult{n > 1 ? 's' : ''}{n > 2 * numRooms ? ' 🛏️' : ''}
                          </option>
                        ))}
                      </select>
                      {/* Auto extra bed notice */}
                      {autoXbeds > 0 && (
                        <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg border border-amber-500/25 text-xs text-amber-300"
                          style={{ background: 'rgba(251,191,36,0.06)' }}>
                          <span className="mt-0.5">🛏️</span>
                          <span>
                            <strong>{autoXbeds} extra bed{autoXbeds > 1 ? 's' : ''} auto-added</strong> for 3rd guest per room.
                            {nights > 0 && ` +₹${(xbRate * autoXbeds * nights).toLocaleString()} total.`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Breakfast included notice (online bookings always CP) */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#c9a14a]/20" style={{ background: 'rgba(201,161,74,0.05)' }}>
                    <span className="text-2xl">☕</span>
                    <div>
                      <div className="text-white text-sm font-semibold">Breakfast Included</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Continental breakfast served daily for all guests</div>
                    </div>
                  </div>
                </div>

                {/* Availability result banner */}
                {available !== null && (
                  <div className={`p-4 rounded-xl border text-sm font-medium ${available > 0 ? 'border-green-500/25 text-green-400' : 'border-red-500/25 text-red-400'}`}
                    style={{ background: available > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)' }}>
                    {available > 0
                      ? `✅ ${available} room${available > 1 ? 's' : ''} available for your selected dates`
                      : '❌ No rooms available for these dates. Check the calendar below for other dates.'}
                  </div>
                )}

                {/* Availability Calendar */}
                {showCal && <AvailCalendar checkIn={checkIn} checkOut={checkOut} allRooms={allRooms} />}

                {/* Show cal toggle before checking */}
                {!showCal && checkIn && checkOut && nights > 0 && (
                  <button type="button" onClick={() => setShowCal(true)}
                    className="text-xs text-[#c9a14a] hover:underline transition-all">
                    📅 View availability calendar for these dates →
                  </button>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button type="button" onClick={checkAvailability} disabled={checking || !checkIn || !checkOut}
                    className="flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}>
                    {checking
                      ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Checking...</>
                      : '🔍 Check Availability'}
                  </button>
                  {available !== null && available >= numRooms && nights > 0 && (
                    <button type="button" onClick={handleProceed}
                      className="flex-1 py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, #c9a14a, #e6c87a)', color: '#000' }}>
                      Continue to Guest Details →
                    </button>
                  )}
                </div>
              </>
            )}

            {/* ═══ STEP 2 ═══ */}
            {step === 2 && (
              <>
                <div className="p-6 rounded-2xl border border-white/8 space-y-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-white font-semibold text-lg">Guest Details</h2>
                    <button type="button" onClick={() => setStep(1)}
                      className="text-sm hover:text-[#c9a14a] transition-colors"
                      style={{ color: 'rgba(255,255,255,0.4)' }}>← Edit Dates</button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input type="text" autoComplete="name" value={name} maxLength={100} placeholder="Enter your full name"
                      onChange={e => { setName(e.target.value); if (touched.name) validateField('name', e.target.value) }}
                      onBlur={() => { touch('name'); validateField('name', name) }}
                      className={ic('name')} style={BI} />
                    <FE field="name" />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Mobile <span className="text-red-400">*</span>
                      </label>
                      <div className="flex gap-2">
                        <select value={countryCode}
                          onChange={e => { setCountryCode(e.target.value); setPhone(''); setErrors(p => ({ ...p, phone: undefined })) }}
                          className="px-2 py-3 rounded-xl border border-white/15 text-sm focus:outline-none focus:border-[#c9a14a] shrink-0 w-28"
                          style={BI}>
                          {COUNTRY_CODES.map(c => <option key={c.code} value={c.code} style={{ background: '#1a1a1a', color: '#fff' }}>{c.flag} {c.code}</option>)}
                        </select>
                        <input type="tel" autoComplete="tel" value={phone} maxLength={15} inputMode="numeric"
                          placeholder={countryCode === '+91' ? '10-digit number' : 'Phone number'}
                          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 15); setPhone(v); if (touched.phone) validateField('phone', v) }}
                          onBlur={() => { touch('phone'); validateField('phone', phone) }}
                          className={`flex-1 px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none ${errors.phone && touched.phone ? 'border-red-500' : 'border-white/15 hover:border-white/25 focus:border-[#c9a14a]'}`}
                          style={BI} />
                      </div>
                      <FE field="phone" />
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {countryCode === '+91' ? 'Confirmation via WhatsApp & SMS' : 'Confirmation via email'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Email <span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span>
                      </label>
                      <input type="email" autoComplete="email" value={email} maxLength={100} placeholder="your@email.com"
                        onChange={e => { setEmail(e.target.value); if (touched.email) validateField('email', e.target.value) }}
                        onBlur={() => { touch('email'); validateField('email', email) }}
                        className={ic('email')} style={BI} />
                      <FE field="email" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Special Requests <span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span>
                    </label>
                    <textarea rows={3} value={note} maxLength={500}
                      placeholder="Dietary requirements, room preferences, special occasions..."
                      onChange={e => setNote(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-white/15 text-sm resize-none hover:border-white/25 focus:border-[#c9a14a] focus:outline-none transition-all"
                      style={BI} />
                    <p className="text-xs mt-1 text-right" style={{ color: 'rgba(255,255,255,0.25)' }}>{note.length}/500</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Promo Code <span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span>
                    </label>
                    <div className="flex gap-2">
                      <input type="text" maxLength={20} placeholder="E.g. SUMMER20" value={promoCode}
                        onChange={e => { setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setPromoResult(null) }}
                        onKeyDown={e => e.key === 'Enter' && applyPromo()}
                        disabled={!!promoResult?.valid}
                        className="flex-1 px-4 py-3 rounded-xl border border-white/15 text-sm focus:outline-none focus:border-[#c9a14a] font-mono tracking-widest uppercase disabled:opacity-60 transition-all"
                        style={BI} />
                      {promoResult?.valid
                        ? <button type="button" onClick={removePromo} className="px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>Remove</button>
                        : <button type="button" onClick={applyPromo} disabled={promoChecking || !promoCode.trim() || !nights} className="px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: 'rgba(201,161,74,0.12)', border: '1px solid rgba(201,161,74,0.25)', color: '#c9a14a' }}>{promoChecking ? '...' : 'Apply'}</button>
                      }
                    </div>
                    {promoResult && (
                      <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 ${promoResult.valid ? 'text-green-400' : 'text-red-400'}`}
                        style={{ background: promoResult.valid ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${promoResult.valid ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                        {promoResult.valid ? `✅ ${promoResult.message} — saving ₹${promoResult.discount_amount?.toLocaleString()}` : `❌ ${promoResult.error}`}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5 rounded-2xl border text-sm space-y-1.5"
                  style={{ background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.15)', color: 'rgba(255,255,255,0.5)' }}>
                  <p className="text-white font-semibold mb-2">Booking Policy</p>
                  <p>• Check-in: 3:00 PM · Check-out: 11:00 AM</p>
                  <p>• Free cancellation 7+ days before · 50% refund 3–7 days · No refund within 3 days</p>
                  <p>• Valid government ID required at check-in</p>
                  <p>• By proceeding you agree to our <a href="/terms" target="_blank" className="text-[#c9a14a] hover:underline">Terms & Conditions</a></p>
                </div>

                <button type="button" onClick={handlePayment} disabled={paying}
                  className="w-full py-4 rounded-xl font-bold text-base transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  style={{ background: 'linear-gradient(135deg, #c9a14a, #e6c87a)', color: '#000', boxShadow: '0 10px 30px rgba(201,161,74,0.25)' }}>
                  {paying
                    ? <><span className="w-5 h-5 border-2 border-black/40 border-t-black rounded-full animate-spin" /><span>Processing...</span></>
                    : <><span>🔒</span><span>Pay ₹{total.toLocaleString()} Securely</span></>}
                </button>
                <div className="flex items-center justify-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <span>🔒 SSL Secured</span><span>·</span><span>Razorpay</span><span>·</span><span>UPI · Cards · NetBanking</span>
                </div>
              </>
            )}
          </div>

          {/* ── Summary Sidebar ── */}
          <div className="lg:col-span-1">
            <div className="p-6 rounded-2xl border border-white/8 sticky top-28" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <h3 className="font-playfair text-xl text-white mb-5">Booking Summary</h3>

              {room.featured_image && (
                <div className="relative h-28 rounded-xl overflow-hidden mb-5">
                  <Image src={room.featured_image} alt={room.name} fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-3 text-white text-xs font-semibold">{room.name}</div>
                </div>
              )}

              <div className="space-y-2.5 text-sm">
                {checkIn && checkOut && nights > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[['Check-in', new Date(checkIn + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
                      ['Check-out', new Date(checkOut + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })]
                    ].map(([l, v]) => (
                      <div key={l} className="p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{l}</div>
                        <div className="text-white font-medium text-xs">{v}</div>
                      </div>
                    ))}
                  </div>
                )}
                {[
                  ['Nights',    nights || '—'],
                  ['Rooms',     numRooms],
                  ['Adults',    adults],
                  ['Meal Plan', 'CP — Breakfast Included'],
                  ...(autoXbeds > 0 ? [[`Extra Bed${autoXbeds > 1 ? 's' : ''} (auto)`, autoXbeds]] : []),
                ].map(([l, v]) => (
                  <div key={String(l)} className="flex justify-between">
                    <span style={{ color: 'rgba(255,255,255,0.45)' }}>{l}</span>
                    <span className={String(l).includes('Extra') ? 'text-amber-400 text-xs' : 'text-white'}>{v}</span>
                  </div>
                ))}
              </div>

              {nights > 0 && rate > 0 && (
                <div className="mt-5 pt-5 space-y-2 text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex justify-between" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <span>₹{rate.toLocaleString()} × {nights}N × {numRooms}R</span>
                    <span>₹{base.toLocaleString()}</span>
                  </div>
                  {autoXbeds > 0 && (
                    <div className="flex justify-between text-amber-400/80">
                      <span>Extra bed{autoXbeds > 1 ? 's' : ''} × {nights}N</span>
                      <span>₹{xbAmt.toLocaleString()}</span>
                    </div>
                  )}
                  {promoResult?.valid && promoDiscount > 0 && (
                    <div className="flex justify-between text-green-400 font-medium">
                      <span>🎁 Promo ({promoCode})</span>
                      <span>−₹{promoDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <span>GST (12%)</span><span>₹{gst.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-3 text-lg font-bold text-[#c9a14a]"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span>Total</span><span>₹{total.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {(!checkIn || !checkOut || nights === 0) && (
                <p className="mt-5 pt-5 text-center text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}>
                  Select dates to see price
                </p>
              )}

              <a href="https://wa.me/919368080535?text=Hi,%20I%20need%20help%20with%20a%20booking"
                target="_blank" rel="noopener noreferrer"
                className="mt-5 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Need help? Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b0b' }}>
        <div className="w-12 h-12 border-2 border-[#c9a14a] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BookingContent />
    </Suspense>
  )
}
