'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import toast, { Toaster } from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Room {
  id: string; name: string; slug: string; category: string
  display_price_from: number; price?: number; is_active: boolean
  offer_label: string | null; offer_badge_text: string | null
  offer_discount_percent: number; offer_is_active: boolean
  offer_valid_until: string | null; max_extra_beds: number
}
interface Season {
  id: string; name: string; label: string
  start_month: number; start_day: number
  end_month: number; end_day: number
  is_yatra_season: boolean; sort_order: number
}
interface RoomRate {
  id: string; room_category: string; season_id: string; meal_plan: string
  rate_type: string; price_per_night: number; extra_bed_price: number
  child_5_12_price: number
}
interface Offer {
  id: string; title: string; description: string; code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  valid_from: string; valid_until: string
  is_active: boolean; min_nights: number; max_uses: number | null
  used_count: number; applicable_rooms: string[] | null
  applicable_categories: string[] | null
  max_discount_amount: number | null
}

const MEAL_PLANS = ['EP', 'CP', 'MAP', 'AP']
const MEAL_LABELS: Record<string, string> = {
  EP: 'Room Only', CP: 'With Breakfast', MAP: 'Breakfast + Dinner', AP: 'All Meals'
}
const SEASON_COLORS: Record<string, string> = {
  peak: 'bg-red-500/15 text-red-400 border-red-500/25',
  festive: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  shoulder: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  low: 'bg-green-500/15 text-green-400 border-green-500/25',
}

function generatePromoCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'rooms' | 'seasons' | 'rates' | 'offers'

export default function AdminPricingPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('rooms')
  const [rooms, setRooms] = useState<Room[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [rates, setRates] = useState<RoomRate[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { initWithAuth() }, [])

  async function initWithAuth() {
    // Verify admin auth before loading
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { window.location.href = '/admin/login'; return }
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) { window.location.href = '/admin/login'; return }
      await loadAll(session.access_token)
    } catch { window.location.href = '/admin/login' }
  }

  async function loadAll(token?: string) {
    setLoading(true)
    const [r, s, rt, o] = await Promise.all([
      supabase.from('rooms').select('id,name,slug,category,display_price_from,is_active,offer_label,offer_badge_text,offer_discount_percent,offer_is_active,offer_valid_until,max_extra_beds').order('category').order('name'),
      supabase.from('seasons').select('*').order('sort_order'),
      supabase.from('room_rates').select('*').order('room_category').order('meal_plan'),
      supabase.from('offers').select('*').order('created_at', { ascending: false }),
    ])
    setRooms(r.data || [])
    setSeasons(s.data || [])
    setRates(rt.data || [])
    setOffers(o.data || [])
    setLoading(false)
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'rooms',   label: 'OTA & Website Rates', icon: '🌐' },
    { key: 'seasons', label: 'Seasons',               icon: '📅' },
    { key: 'rates',   label: 'Rate Matrix',           icon: '📊' },
    { key: 'offers',  label: 'Promo Codes',           icon: '🎁' },
  ]

  return (
    <div className="min-h-screen bg-[#0b0b0b] p-6">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />

      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-playfair text-[#c9a14a] mb-1">Pricing & Offers</h1>
          <p className="text-white/40 text-sm">Manage OTA & website display prices, seasonal rate matrix, promo codes. Walk-in & B2B rates are managed in Rate Matrix → B2B tab.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === t.key ? 'bg-[#c9a14a] text-black' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-2 border-[#c9a14a] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === 'rooms'   && <RoomPricingTab   rooms={rooms}   reload={loadAll} />}
            {tab === 'seasons' && <SeasonsTab        seasons={seasons} reload={loadAll} />}
            {tab === 'rates'   && <RateMatrixTab     rooms={rooms} seasons={seasons} rates={rates} reload={loadAll} />}
            {tab === 'offers'  && <OffersTab         offers={offers} rooms={rooms} reload={loadAll} />}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Tab 1: Room Base Prices + Per-room Offers ────────────────────────────────
function RoomPricingTab({ rooms, reload }: { rooms: Room[]; reload: () => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Room>>({})
  const [saving, setSaving] = useState(false)

  function startEdit(room: Room) {
    setEditing(room.id)
    setForm({
      display_price_from: room.display_price_from || room.price,
      max_extra_beds: room.max_extra_beds || 0,
      offer_label: room.offer_label || '',
      offer_badge_text: room.offer_badge_text || '',
      offer_discount_percent: room.offer_discount_percent || 0,
      offer_is_active: room.offer_is_active || false,
      offer_valid_until: room.offer_valid_until || '',
    })
  }

  async function save(roomId: string) {
    if (!form.display_price_from || form.display_price_from < 100) {
      toast.error('Base price must be at least ₹100'); return
    }
    setSaving(true)
    const { error } = await supabase.from('rooms').update({
      display_price_from: form.display_price_from,
      max_extra_beds: form.max_extra_beds || 0,
      offer_label: form.offer_label || null,
      offer_badge_text: form.offer_badge_text || null,
      offer_discount_percent: form.offer_discount_percent || 0,
      offer_is_active: form.offer_is_active || false,
      offer_valid_until: form.offer_valid_until || null,
      updated_at: new Date().toISOString(),
    }).eq('id', roomId)
    setSaving(false)
    if (error) { toast.error('Failed to save: ' + error.message); return }
    toast.success('Room pricing saved successfully')
    setEditing(null)
    reload()
  }

  const INP = 'w-full px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-sm focus:outline-none focus:border-[#c9a14a]'

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-[#c9a14a]/20 bg-[#c9a14a]/5 text-sm text-[#c9a14a]/80">
        💡 <strong>OTA & Website Display Price</strong> — the "From ₹X/night" shown on your website, MakeMyTrip, Booking.com etc. This does NOT affect walk-in or B2B rates. Those are set separately in Rate Matrix → B2B tab.
      </div>

      {rooms.map(room => (
        <div key={room.id} className="bg-white/3 border border-white/8 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-white font-semibold">{room.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${room.category === 'premium' ? 'bg-[#c9a14a]/20 text-[#c9a14a]' : 'bg-blue-500/20 text-blue-400'}`}>
                  {room.category.toUpperCase()}
                </span>
                {room.offer_is_active && room.offer_badge_text && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/25">
                    🔥 {room.offer_badge_text}
                  </span>
                )}
              </div>
              <p className="text-white/40 text-sm">Display Price: <strong className="text-[#c9a14a]">₹{(room.display_price_from || room.price || 0).toLocaleString()}/night</strong></p>
            </div>
            <button onClick={() => editing === room.id ? setEditing(null) : startEdit(room)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-white/5 border border-white/15 text-white/70 hover:text-white hover:bg-white/10">
              {editing === room.id ? 'Cancel' : 'Edit Pricing'}
            </button>
          </div>

          {editing === room.id && (
            <div className="mt-5 pt-5 border-t border-white/8 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Display Price (₹/night) <span className="text-red-400">*</span></label>
                  <input type="number" min={100} step={50}
                    value={form.display_price_from || ''} onChange={e => setForm(f => ({ ...f, display_price_from: +e.target.value }))}
                    placeholder="e.g. 3500" className={INP} />
                  <p className="text-xs text-white/30 mt-1">Shown as "From ₹X/night" on website and OTA</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Max Extra Beds Per Room</label>
                  <input type="number" min={0} max={3}
                    value={form.max_extra_beds ?? 0} onChange={e => setForm(f => ({ ...f, max_extra_beds: +e.target.value }))}
                    className={INP} />
                </div>
              </div>

              {/* Per-room offer */}
              <div className="p-4 rounded-xl border border-white/8 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-semibold text-sm">Room-Level Offer Badge</h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={form.offer_is_active || false}
                        onChange={e => setForm(f => ({ ...f, offer_is_active: e.target.checked }))} />
                      <div className={`w-10 h-5 rounded-full transition-all ${form.offer_is_active ? 'bg-[#c9a14a]' : 'bg-white/15'}`} />
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${form.offer_is_active ? 'left-5' : 'left-0.5'}`} />
                    </div>
                    <span className="text-sm text-white/60">{form.offer_is_active ? 'Active' : 'Inactive'}</span>
                  </label>
                </div>
                <p className="text-xs text-white/35">This badge appears on the room card on the website — e.g. "Summer Special · 20% OFF"</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Offer Label</label>
                    <input type="text" maxLength={60} placeholder="e.g. Summer Special"
                      value={form.offer_label || ''} onChange={e => setForm(f => ({ ...f, offer_label: e.target.value }))}
                      className={INP} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Badge Text</label>
                    <input type="text" maxLength={30} placeholder="e.g. 20% OFF"
                      value={form.offer_badge_text || ''} onChange={e => setForm(f => ({ ...f, offer_badge_text: e.target.value }))}
                      className={INP} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Discount %</label>
                    <input type="number" min={0} max={100} step={5}
                      value={form.offer_discount_percent || 0} onChange={e => setForm(f => ({ ...f, offer_discount_percent: +e.target.value }))}
                      className={INP} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Offer Valid Until</label>
                  <input type="date" value={form.offer_valid_until || ''} onChange={e => setForm(f => ({ ...f, offer_valid_until: e.target.value }))}
                    className={INP} style={{ colorScheme: 'dark' }} />
                </div>
              </div>

              <button onClick={() => save(room.id)} disabled={saving}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black hover:opacity-90 disabled:opacity-50 transition-all">
                {saving ? 'Saving...' : 'Save Room Pricing'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Tab 2: Seasons ───────────────────────────────────────────────────────────
function SeasonsTab({ seasons, reload }: { seasons: Season[]; reload: () => void }) {
  const blank = { name: '', label: '', start_month: 4, start_day: 1, end_month: 6, end_day: 30, is_yatra_season: false, sort_order: 0 }
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const INP = 'w-full px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-sm focus:outline-none focus:border-[#c9a14a]'

  function daysInMonth(m: number) {
    return [31,29,31,30,31,30,31,31,30,31,30,31][m-1] || 31
  }

  async function save() {
    if (!form.name || !form.label) { toast.error('Season name and label are required'); return }
    setSaving(true)
    const payload = {
      name: form.name, label: form.label,
      start_month: form.start_month, start_day: form.start_day,
      end_month: form.end_month, end_day: form.end_day,
      is_yatra_season: form.is_yatra_season, sort_order: form.sort_order,
    }
    const { error } = editId
      ? await supabase.from('seasons').update(payload).eq('id', editId)
      : await supabase.from('seasons').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message.includes('unique') ? 'A season with this name already exists' : error.message); return }
    toast.success(editId ? 'Season updated' : 'Season created')
    setForm(blank); setEditId(null); reload()
  }

  function formatSeason(s: Season) {
    return `${MONTHS[s.start_month-1]} ${s.start_day} → ${MONTHS[s.end_month-1]} ${s.end_day}`
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-sm text-yellow-300/80">
        💡 Seasons use <strong>month + day</strong> (not full dates) so they repeat every year automatically. E.g. "Summer" = Apr 15 → Jun 30 every year.
      </div>

      {/* Form */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4">{editId ? 'Edit Season' : 'Add New Season'}</h3>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Season Name <span className="text-red-400">*</span></label>
            <input type="text" placeholder="e.g. summer_peak (no spaces)" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/\s+/g,'_') }))} className={INP} />
            <p className="text-xs text-white/25 mt-1">Unique key, no spaces</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Display Label <span className="text-red-400">*</span></label>
            <input type="text" placeholder="e.g. Summer Peak" value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className={INP} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Start Month</label>
            <select value={form.start_month} onChange={e => setForm(f => ({ ...f, start_month: +e.target.value }))} className={INP}>
              {MONTHS.map((m,i) => <option key={m} value={i+1} style={{background:'#1a1a1a'}}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Start Day</label>
            <select value={form.start_day} onChange={e => setForm(f => ({ ...f, start_day: +e.target.value }))} className={INP}>
              {Array.from({length: daysInMonth(form.start_month)}, (_,i) => i+1).map(d => <option key={d} value={d} style={{background:'#1a1a1a'}}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">End Month</label>
            <select value={form.end_month} onChange={e => setForm(f => ({ ...f, end_month: +e.target.value }))} className={INP}>
              {MONTHS.map((m,i) => <option key={m} value={i+1} style={{background:'#1a1a1a'}}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">End Day</label>
            <select value={form.end_day} onChange={e => setForm(f => ({ ...f, end_day: +e.target.value }))} className={INP}>
              {Array.from({length: daysInMonth(form.end_month)}, (_,i) => i+1).map(d => <option key={d} value={d} style={{background:'#1a1a1a'}}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-6 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_yatra_season} onChange={e => setForm(f => ({ ...f, is_yatra_season: e.target.checked }))} className="rounded" />
            <span className="text-sm text-white/60">Yatra Season (pilgrimage peak)</span>
          </label>
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/50">Sort Order</label>
            <input type="number" min={0} value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: +e.target.value }))} className={INP + ' w-16'} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={saving}
            className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black hover:opacity-90 disabled:opacity-50 transition-all">
            {saving ? 'Saving...' : editId ? 'Update Season' : 'Add Season'}
          </button>
          {editId && <button onClick={() => { setForm(blank); setEditId(null) }} className="px-5 py-2.5 rounded-xl text-sm bg-white/5 border border-white/15 text-white/60 hover:text-white">Cancel</button>}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {seasons.map(s => (
          <div key={s.id} className="flex items-center justify-between gap-4 bg-white/3 border border-white/8 rounded-xl px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-white font-medium text-sm">{s.label}</p>
                {s.is_yatra_season && <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400 border border-orange-500/25">🙏 Yatra</span>}
              </div>
              <p className="text-white/40 text-xs">{formatSeason(s)} · key: <span className="font-mono">{s.name}</span></p>
            </div>
            <button onClick={() => { setEditId(s.id); setForm({ name: s.name, label: s.label, start_month: s.start_month, start_day: s.start_day, end_month: s.end_month, end_day: s.end_day, is_yatra_season: s.is_yatra_season, sort_order: s.sort_order }) }}
              className="px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/15 text-white/60 hover:text-white transition-all">
              Edit
            </button>
          </div>
        ))}
        {seasons.length === 0 && <p className="text-center text-white/30 py-10">No seasons yet. Add your first season above.</p>}
      </div>
    </div>
  )
}

// ─── Tab 3: Rate Matrix ───────────────────────────────────────────────────────
// Real schema: room_rates has room_category (deluxe/premium), season_id, meal_plan, rate_type
function RateMatrixTab({ seasons, rates, reload }: { rooms: Room[]; seasons: Season[]; rates: RoomRate[]; reload: () => void }) {
  const [category, setCategory] = useState<'deluxe' | 'premium'>('deluxe')
  const [rateType, setRateType] = useState('b2c')
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [cellValue, setCellValue] = useState('')
  const [extraBedValue, setExtraBedValue] = useState('')
  const [childValue, setChildValue] = useState('')
  const [saving, setSaving] = useState(false)

  function getRate(seasonId: string, meal: string) {
    return rates.find(r => r.room_category === category && r.season_id === seasonId && r.meal_plan === meal && r.rate_type === rateType)
  }
  function cellKey(seasonId: string, meal: string) { return `${seasonId}:${meal}` }

  async function saveCell(seasonId: string, meal: string) {
    const price = parseFloat(cellValue)
    const extraBed = parseFloat(extraBedValue) || 0
    const child = parseFloat(childValue) || 0
    if (isNaN(price) || price < 100) { toast.error('Enter a valid price (min ₹100)'); return }
    setSaving(true)
    const existing = getRate(seasonId, meal)
    const payload = {
      room_category: category, season_id: seasonId, meal_plan: meal,
      rate_type: rateType, price_per_night: price,
      extra_bed_price: extraBed, child_5_12_price: child,
    }
    const { error } = existing
      ? await supabase.from('room_rates').update({ price_per_night: price, extra_bed_price: extraBed, child_5_12_price: child }).eq('id', existing.id)
      : await supabase.from('room_rates').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Rate saved')
    setEditingCell(null)
    reload()
  }

  const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const INP = 'w-full px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-sm focus:outline-none focus:border-[#c9a14a]'

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-sm text-blue-300/80">
        📊 <strong>B2C rates</strong> power the online booking website. <strong>B2B rates</strong> are for tour operators &amp; walk-in bookings — these are used internally by admin/manager only and are never shown to online customers.
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">Category</label>
          <div className="flex gap-2">
            {(['deluxe','premium'] as const).map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize ${category === c ? 'bg-[#c9a14a] text-black' : 'bg-white/5 border border-white/15 text-white/60 hover:text-white'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">Rate Type</label>
          <div className="flex gap-2">
            {['b2c','b2b'].map(t => (
              <button key={t} onClick={() => setRateType(t)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${rateType === t ? 'bg-[#c9a14a] text-black' : 'bg-white/5 border border-white/15 text-white/60 hover:text-white'}`}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {seasons.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-10">Add seasons first in the Seasons tab.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Season</th>
                {MEAL_PLANS.map(m => (
                  <th key={m} className="text-center px-3 py-3 text-white/50 font-medium">
                    <div>{m}</div>
                    <div className="text-xs text-white/30 font-normal">{MEAL_LABELS[m]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seasons.map(season => (
                <tr key={season.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium text-xs">{season.label}</p>
                    <p className="text-white/35 text-xs">
                      {['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][season.start_month]} {season.start_day} → {['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][season.end_month]} {season.end_day}
                    </p>
                  </td>
                  {MEAL_PLANS.map(meal => {
                    const rate = getRate(season.id, meal)
                    const key = cellKey(season.id, meal)
                    const isEditing = editingCell === key
                    return (
                      <td key={meal} className="px-3 py-3 text-center">
                        {isEditing ? (
                          <div className="space-y-1.5 min-w-[110px]">
                            <input type="number" min={100} step={50} value={cellValue}
                              onChange={e => setCellValue(e.target.value)}
                              placeholder="₹/night" className={INP + ' text-center'} autoFocus />
                            <input type="number" min={0} step={100} value={extraBedValue}
                              onChange={e => setExtraBedValue(e.target.value)}
                              placeholder="Extra bed ₹" className={INP + ' text-center text-xs'} />
                            <input type="number" min={0} step={100} value={childValue}
                              onChange={e => setChildValue(e.target.value)}
                              placeholder="Child 5-12 ₹" className={INP + ' text-center text-xs'} />
                            <div className="flex gap-1">
                              <button onClick={() => saveCell(season.id, meal)} disabled={saving}
                                className="flex-1 py-1 rounded-lg bg-[#c9a14a] text-black text-xs font-bold hover:opacity-90 disabled:opacity-50">✓</button>
                              <button onClick={() => setEditingCell(null)}
                                className="flex-1 py-1 rounded-lg bg-white/10 text-white/60 text-xs hover:bg-white/20">✕</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => {
                            setEditingCell(key)
                            setCellValue(rate?.price_per_night?.toString() || '')
                            setExtraBedValue(rate?.extra_bed_price?.toString() || '0')
                            setChildValue(rate?.child_5_12_price?.toString() || '0')
                          }}
                            className={`w-full py-2 px-2 rounded-lg text-xs font-semibold transition-all ${rate ? 'bg-[#c9a14a]/10 text-[#c9a14a] hover:bg-[#c9a14a]/20 border border-[#c9a14a]/20' : 'bg-white/3 text-white/25 hover:bg-white/8 border border-dashed border-white/10'}`}>
                            {rate ? <>₹{Number(rate.price_per_night).toLocaleString()}<br /><span className="text-white/30 font-normal">+₹{rate.extra_bed_price} xbed</span></> : '+ Set Rate'}
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tab 4: Promo Codes ───────────────────────────────────────────────────────
function OffersTab({ offers, rooms, reload }: { offers: Offer[]; rooms: Room[]; reload: () => void }) {
  const blank = {
    title: '', description: '', code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 10,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '', is_active: true, min_nights: 1,
    max_uses: '' as string | number, max_discount_amount: '' as string | number,
    applicable_categories: [] as string[],
  }
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const INP = 'w-full px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-sm focus:outline-none focus:border-[#c9a14a]'

  function genCode() { setForm(f => ({ ...f, code: generatePromoCode() })) }

  async function save() {
    if (!form.title || !form.code || !form.valid_until) { toast.error('Fill all required fields'); return }
    if (form.code.length < 4) { toast.error('Code must be at least 4 characters'); return }
    if (new Date(form.valid_until) < new Date()) { toast.error('Expiry date cannot be in the past'); return }
    setSaving(true)
    const payload = {
      title: form.title.trim(), description: form.description.trim(),
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      valid_from: form.valid_from, valid_until: form.valid_until, is_active: form.is_active,
      min_nights: form.min_nights,
      max_uses: form.max_uses === '' ? null : +form.max_uses,
      max_discount_amount: form.max_discount_amount === '' ? null : +form.max_discount_amount,
      applicable_categories: form.applicable_categories.length > 0 ? form.applicable_categories : null,
    }
    const { error } = editId
      ? await supabase.from('offers').update(payload).eq('id', editId)
      : await supabase.from('offers').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message.includes('unique') ? 'This promo code already exists' : error.message); return }
    toast.success(editId ? 'Promo code updated' : 'Promo code created')
    setForm(blank); setEditId(null); reload()
  }

  async function toggle(id: string, current: boolean) {
    const { error } = await supabase.from('offers').update({ is_active: !current }).eq('id', id)
    if (error) toast.error(error.message); else { toast.success('Updated'); reload() }
  }

  async function deleteOffer(id: string) {
    if (!confirm('Delete this promo code? This cannot be undone.')) return
    const { error } = await supabase.from('offers').delete().eq('id', id)
    if (error) toast.error(error.message); else { toast.success('Deleted'); reload() }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => { setCopied(code); setTimeout(() => setCopied(null), 2000) })
  }

  const isExpired = (d: string) => new Date(d) < new Date()

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-5">{editId ? 'Edit Promo Code' : 'Create New Promo Code'}</h3>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Offer Title <span className="text-red-400">*</span></label>
            <input type="text" maxLength={100} placeholder="e.g. Summer Special 2026"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={INP} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Promo Code <span className="text-red-400">*</span></label>
            <div className="flex gap-2">
              <input type="text" maxLength={20} placeholder="e.g. SUMMER20"
                value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                className={INP + ' uppercase font-mono tracking-widest'} />
              <button onClick={genCode} title="Generate random code" className="px-3 py-2 rounded-lg bg-white/8 border border-white/15 text-white/60 hover:text-white text-xs whitespace-nowrap transition-all">Auto</button>
            </div>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-white/50 mb-1.5">Description</label>
          <input type="text" maxLength={200} placeholder="Short description shown to customer"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={INP} />
        </div>
        <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Discount Type <span className="text-red-400">*</span></label>
            <select value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as 'percentage'|'fixed' }))} className={INP}>
              <option value="percentage" style={{background:'#1a1a1a'}}>% Percentage</option>
              <option value="fixed" style={{background:'#1a1a1a'}}>₹ Fixed Amount</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              {form.discount_type === 'percentage' ? 'Discount %' : 'Discount ₹'} <span className="text-red-400">*</span>
            </label>
            <input type="number" min={1} max={form.discount_type === 'percentage' ? 100 : 999999} value={form.discount_value}
              onChange={e => setForm(f => ({ ...f, discount_value: +e.target.value }))} className={INP} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Max Discount (₹)</label>
            <input type="number" min={0} step={100} placeholder="No cap"
              value={form.max_discount_amount} onChange={e => setForm(f => ({ ...f, max_discount_amount: e.target.value }))} className={INP} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Min Nights</label>
            <input type="number" min={1} value={form.min_nights}
              onChange={e => setForm(f => ({ ...f, min_nights: +e.target.value }))} className={INP} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Max Uses</label>
            <input type="number" min={1} placeholder="Unlimited"
              value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} className={INP} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Applies To</label>
            <select value={form.applicable_categories.join(',')}
              onChange={e => setForm(f => ({ ...f, applicable_categories: e.target.value ? e.target.value.split(',') : [] }))}
              className={INP}>
              <option value="" style={{ background: '#1a1a1a' }}>All Rooms</option>
              <option value="deluxe" style={{ background: '#1a1a1a' }}>Deluxe Only</option>
              <option value="premium" style={{ background: '#1a1a1a' }}>Premium Only</option>
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Valid From <span className="text-red-400">*</span></label>
            <input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} className={INP} style={{ colorScheme: 'dark' }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Valid Until <span className="text-red-400">*</span></label>
            <input type="date" value={form.valid_until} min={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} className={INP} style={{ colorScheme: 'dark' }} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer pb-1">
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <div className={`w-10 h-5 rounded-full transition-all ${form.is_active ? 'bg-[#c9a14a]' : 'bg-white/15'}`} />
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${form.is_active ? 'left-5' : 'left-0.5'}`} />
              </div>
              <span className="text-sm text-white/60">Active</span>
            </label>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={saving}
            className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black hover:opacity-90 disabled:opacity-50 transition-all">
            {saving ? 'Saving...' : editId ? 'Update Code' : 'Create Promo Code'}
          </button>
          {editId && <button onClick={() => { setForm(blank); setEditId(null) }} className="px-5 py-2.5 rounded-xl text-sm bg-white/5 border border-white/15 text-white/60 hover:text-white">Cancel</button>}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {offers.map(offer => {
          const expired = isExpired(offer.valid_until)
          return (
            <div key={offer.id} className={`bg-white/3 border rounded-2xl p-5 transition-all ${expired ? 'border-white/5 opacity-60' : offer.is_active ? 'border-white/10' : 'border-white/5'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <button onClick={() => copyCode(offer.code)}
                      className="font-mono text-lg font-bold text-[#c9a14a] tracking-widest hover:text-[#e6c87a] transition-colors flex items-center gap-1.5">
                      {offer.code}
                      <span className="text-xs text-white/30">{copied === offer.code ? '✓ Copied!' : '⎘'}</span>
                    </button>
                    <span className="text-white font-semibold">{offer.title}</span>
                    {expired && <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400 border border-red-500/25">EXPIRED</span>}
                    {!expired && offer.is_active && <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400 border border-green-500/25">ACTIVE</span>}
                    {!expired && !offer.is_active && <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/40">INACTIVE</span>}
                  </div>
                  <p className="text-white/45 text-sm mb-2">{offer.description}</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/40">
                    <span>💰 <strong className="text-white/70">{offer.discount_type === 'percentage' ? `${offer.discount_value}% off` : `₹${offer.discount_value} off`}</strong>{offer.max_discount_amount ? ` (max ₹${offer.max_discount_amount.toLocaleString()})` : ''}</span>
                    <span>🌙 Min {offer.min_nights} night{offer.min_nights > 1 ? 's' : ''}</span>
                    <span>📊 Used: {offer.used_count}{offer.max_uses ? ` / ${offer.max_uses}` : ' / ∞'}</span>
                    <span>📅 {offer.valid_from} → {offer.valid_until}</span>
                    {offer.applicable_categories?.length ? <span>🏷️ {offer.applicable_categories.join(', ')}</span> : <span>🏷️ All rooms</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {!expired && (
                    <button onClick={() => toggle(offer.id, offer.is_active)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/15 text-white/60 hover:text-white transition-all">
                      {offer.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                  <button onClick={() => {
                    setEditId(offer.id)
                    setForm({ title: offer.title, description: offer.description, code: offer.code, discount_type: offer.discount_type, discount_value: offer.discount_value, valid_from: offer.valid_from, valid_until: offer.valid_until, is_active: offer.is_active, min_nights: offer.min_nights, max_uses: offer.max_uses ?? '', max_discount_amount: offer.max_discount_amount ?? '', applicable_categories: offer.applicable_categories || [] })
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/15 text-white/60 hover:text-white transition-all">Edit</button>
                  <button onClick={() => deleteOffer(offer.id)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition-all">Delete</button>
                </div>
              </div>
            </div>
          )
        })}
        {offers.length === 0 && <p className="text-center text-white/30 py-10">No promo codes yet. Create your first one above.</p>}
      </div>
    </div>
  )
}