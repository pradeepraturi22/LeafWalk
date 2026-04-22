'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'

type DateRateType = 'lwweb' | 'ota' | 'b2c'
type RoomCategory = 'deluxe' | 'premium'
type TourMealPlan = 'EP' | 'CP' | 'MAP' | 'AP'

type DateWiseRateRow = { id: string; room_category: RoomCategory; rate_type: DateRateType; rate_date: string; base_price: number; extra_bed_price: number; child_price: number }
type MealPriceRow = { id: string; meal_type: 'breakfast' | 'lunch' | 'dinner'; price: number; applicable_from: string | null; applicable_to: string | null }
type SeasonRow = { id: string; label: string; name: string; start_month: number; start_day: number; end_month: number; end_day: number; sort_order: number | null }
type TourOperatorRateRow = { id: string; room_category: RoomCategory; season_id: string; meal_plan: TourMealPlan; rate_type: 'b2b'; price_per_night: number; extra_bed_price: number; child_5_12_price: number }

const INPUT = 'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#c9a14a] focus:outline-none'
const DATE_TYPES: { key: DateRateType; label: string }[] = [
  { key: 'lwweb', label: 'Direct Booking (LWWEB)' },
  { key: 'ota', label: 'OTA' },
  { key: 'b2c', label: 'Walk-in (B2C)' },
]
const TOUR_MEALS: TourMealPlan[] = ['EP', 'CP', 'MAP', 'AP']
const MEAL_LABELS: Record<TourMealPlan, string> = { EP: 'Room Only', CP: 'With Breakfast', MAP: 'Breakfast + Dinner', AP: 'All Meals' }
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function buildDateRange(start: string, end: string) {
  const out: string[] = []
  if (!start || !end) return out
  const from = new Date(`${start}T12:00:00`)
  const to = new Date(`${end}T12:00:00`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return out
  const cursor = new Date(from)
  while (cursor <= to) {
    out.push(`${cursor.getFullYear()}-${`${cursor.getMonth() + 1}`.padStart(2, '0')}-${`${cursor.getDate()}`.padStart(2, '0')}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function seasonLabel(season: SeasonRow) {
  return `${season.label || season.name} (${MONTHS[season.start_month]} ${season.start_day} - ${MONTHS[season.end_month]} ${season.end_day})`
}

export default function AdminTariffForm() {
  const [loading, setLoading] = useState(true)
  const [savingRoom, setSavingRoom] = useState(false)
  const [savingBulk, setSavingBulk] = useState(false)
  const [savingMeal, setSavingMeal] = useState(false)
  const [savingTour, setSavingTour] = useState(false)
  const [dateRates, setDateRates] = useState<DateWiseRateRow[]>([])
  const [mealPrices, setMealPrices] = useState<MealPriceRow[]>([])
  const [seasons, setSeasons] = useState<SeasonRow[]>([])
  const [tourRates, setTourRates] = useState<TourOperatorRateRow[]>([])
  const [tourCategory, setTourCategory] = useState<RoomCategory>('deluxe')
  const [editingKey, setEditingKey] = useState('')
  const [tourPrice, setTourPrice] = useState('')
  const [tourExtraBed, setTourExtraBed] = useState('')
  const [tourChild, setTourChild] = useState('')
  const [singleForm, setSingleForm] = useState({ room_category: 'deluxe' as RoomCategory, rate_type: 'lwweb' as DateRateType, rate_date: '', base_price: '', extra_bed_price: '', child_price: '' })
  const [bulkForm, setBulkForm] = useState({ room_category: 'deluxe' as RoomCategory, rate_type: 'lwweb' as DateRateType, start_date: '', end_date: '', base_price: '', extra_bed_price: '', child_price: '' })
  const [mealForm, setMealForm] = useState({ meal_type: 'breakfast', price: '', applicable_from: '', applicable_to: '' })

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  async function loadData() {
    setLoading(true)
    const [roomRes, mealRes, seasonRes, tourRes] = await Promise.all([
      supabase.from('room_rates').select('id,room_category,rate_type,rate_date,base_price,extra_bed_price,child_price').in('rate_type', ['lwweb', 'ota', 'b2c']).not('rate_date', 'is', null).order('rate_date', { ascending: false }).limit(90) as any,
      supabase.from('meal_prices').select('id,meal_type,price,applicable_from,applicable_to').order('meal_type').order('applicable_from', { ascending: false }).limit(30) as any,
      supabase.from('seasons').select('id,label,name,start_month,start_day,end_month,end_day,sort_order').order('sort_order') as any,
      supabase.from('room_rates').select('id,room_category,season_id,meal_plan,rate_type,price_per_night,extra_bed_price,child_5_12_price').eq('rate_type', 'b2b').not('season_id', 'is', null).not('meal_plan', 'is', null).order('room_category').order('season_id').order('meal_plan') as any,
    ])
    if (roomRes.error) toast.error(roomRes.error.message)
    if (mealRes.error) toast.error(mealRes.error.message)
    if (seasonRes.error) toast.error(seasonRes.error.message)
    if (tourRes.error) toast.error(tourRes.error.message)
    setDateRates((roomRes.data || []) as DateWiseRateRow[])
    setMealPrices((mealRes.data || []) as MealPriceRow[])
    setSeasons((seasonRes.data || []) as SeasonRow[])
    setTourRates((tourRes.data || []) as TourOperatorRateRow[])
    setLoading(false)
  }

  useEffect(() => { void loadData() }, [])

  async function postJson(url: string, body: Record<string, unknown>, setSaving: (value: boolean) => void, success: string) {
    const token = await getToken()
    if (!token) {
      toast.error('Admin session expired')
      return false
    }
    setSaving(true)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Request failed')
      toast.success(success)
      await loadData()
      return true
    } catch (error: any) {
      toast.error(error.message || 'Request failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  const counts = useMemo(() => ({
    lwweb: dateRates.filter((row) => row.rate_type === 'lwweb').length,
    ota: dateRates.filter((row) => row.rate_type === 'ota').length,
    b2c: dateRates.filter((row) => row.rate_type === 'b2c').length,
  }), [dateRates])
  const bulkDates = useMemo(() => buildDateRange(bulkForm.start_date, bulkForm.end_date), [bulkForm.start_date, bulkForm.end_date])
  const recentRows = useMemo(() => dateRates.slice(0, 24), [dateRates])
  const getTourRate = (seasonId: string, meal: TourMealPlan) => tourRates.find((row) => row.room_category === tourCategory && row.season_id === seasonId && row.meal_plan === meal)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#c9a14a]/20 bg-[#c9a14a]/5 p-4 text-sm text-[#c9a14a]/80">
        One pricing console for the whole property. LWWEB, OTA, and Walk-in use date-wise base prices plus meal add-ons, while Tour Operator pricing stays flat by EP/CP/MAP/AP.
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-playfair text-2xl text-white">Date-wise Base Pricing</h2>
              <p className="mt-1 text-sm text-white/45">One flow for Direct Booking, OTA, and Walk-in. Bulk update by start and end date is built in.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/50">Legacy pricing screens now redirect here.</div>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-3">
            {DATE_TYPES.map((type) => (
              <div key={type.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-white">{type.label}</div>
                <div className="mt-2 text-2xl font-bold text-[#c9a14a]">{counts[type.key]}</div>
                <div className="text-xs text-white/35">date-wise rows saved</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <form className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" onSubmit={async (event) => {
              event.preventDefault()
              if (!singleForm.rate_date || !singleForm.base_price) return toast.error('Date and base price are required')
              const ok = await postJson('/api/admin/set-room-price', { ...singleForm, base_price: Number(singleForm.base_price), extra_bed_price: Number(singleForm.extra_bed_price || 0), child_price: Number(singleForm.child_price || 0) }, setSavingRoom, 'Date-wise room price saved')
              if (ok) setSingleForm((current) => ({ ...current, base_price: '', extra_bed_price: '', child_price: '' }))
            }}>
              <h3 className="mb-4 text-lg font-semibold text-white">Single Date Update</h3>
              <div className="grid gap-4">
                <select value={singleForm.room_category} onChange={(event) => setSingleForm((current) => ({ ...current, room_category: event.target.value as RoomCategory }))} className={INPUT}><option value="deluxe" style={{ background: '#111' }}>Deluxe</option><option value="premium" style={{ background: '#111' }}>Premium</option></select>
                <select value={singleForm.rate_type} onChange={(event) => setSingleForm((current) => ({ ...current, rate_type: event.target.value as DateRateType }))} className={INPUT}>{DATE_TYPES.map((type) => <option key={type.key} value={type.key} style={{ background: '#111' }}>{type.label}</option>)}</select>
                <input type="date" value={singleForm.rate_date} onChange={(event) => setSingleForm((current) => ({ ...current, rate_date: event.target.value }))} className={INPUT} style={{ colorScheme: 'dark' }} />
                <input type="number" min={1} placeholder="Base price (EP)" value={singleForm.base_price} onChange={(event) => setSingleForm((current) => ({ ...current, base_price: event.target.value }))} className={INPUT} />
                <input type="number" min={0} placeholder="Extra bed" value={singleForm.extra_bed_price} onChange={(event) => setSingleForm((current) => ({ ...current, extra_bed_price: event.target.value }))} className={INPUT} />
                <input type="number" min={0} placeholder="Child price" value={singleForm.child_price} onChange={(event) => setSingleForm((current) => ({ ...current, child_price: event.target.value }))} className={INPUT} />
                <button type="submit" disabled={savingRoom} className="rounded-xl bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] px-6 py-3 text-sm font-bold text-black disabled:opacity-50">{savingRoom ? 'Saving...' : 'Save Single Date'}</button>
              </div>
            </form>

            <form className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" onSubmit={async (event) => {
              event.preventDefault()
              if (!bulkDates.length) return toast.error('Select a valid start and end date')
              if (!bulkForm.base_price) return toast.error('Base price is required')
              const ok = await postJson('/api/admin/set-bulk-price', { room_category: bulkForm.room_category, rate_type: bulkForm.rate_type, dates: bulkDates, base_price: Number(bulkForm.base_price), extra_bed_price: Number(bulkForm.extra_bed_price || 0), child_price: Number(bulkForm.child_price || 0) }, setSavingBulk, `Bulk updated ${bulkDates.length} date(s)`)
              if (ok) setBulkForm((current) => ({ ...current, base_price: '', extra_bed_price: '', child_price: '' }))
            }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Bulk Date Range Update</h3>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/45">{bulkDates.length ? `${bulkDates.length} date(s)` : 'Select a range'}</span>
              </div>
              <div className="grid gap-4">
                <select value={bulkForm.room_category} onChange={(event) => setBulkForm((current) => ({ ...current, room_category: event.target.value as RoomCategory }))} className={INPUT}><option value="deluxe" style={{ background: '#111' }}>Deluxe</option><option value="premium" style={{ background: '#111' }}>Premium</option></select>
                <select value={bulkForm.rate_type} onChange={(event) => setBulkForm((current) => ({ ...current, rate_type: event.target.value as DateRateType }))} className={INPUT}>{DATE_TYPES.map((type) => <option key={type.key} value={type.key} style={{ background: '#111' }}>{type.label}</option>)}</select>
                <div className="grid gap-4 sm:grid-cols-2">
                  <input type="date" value={bulkForm.start_date} onChange={(event) => setBulkForm((current) => ({ ...current, start_date: event.target.value }))} className={INPUT} style={{ colorScheme: 'dark' }} />
                  <input type="date" value={bulkForm.end_date} onChange={(event) => setBulkForm((current) => ({ ...current, end_date: event.target.value }))} className={INPUT} style={{ colorScheme: 'dark' }} />
                </div>
                <input type="number" min={1} placeholder="Base price (EP)" value={bulkForm.base_price} onChange={(event) => setBulkForm((current) => ({ ...current, base_price: event.target.value }))} className={INPUT} />
                <input type="number" min={0} placeholder="Extra bed" value={bulkForm.extra_bed_price} onChange={(event) => setBulkForm((current) => ({ ...current, extra_bed_price: event.target.value }))} className={INPUT} />
                <input type="number" min={0} placeholder="Child price" value={bulkForm.child_price} onChange={(event) => setBulkForm((current) => ({ ...current, child_price: event.target.value }))} className={INPUT} />
                <button type="submit" disabled={savingBulk} className="rounded-xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{savingBulk ? 'Applying...' : 'Apply To Date Range'}</button>
              </div>
            </form>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-5 font-playfair text-2xl text-white">Meal Add-ons</h2>
          <p className="mb-5 text-sm text-white/45">Meal rules stay separate from the room base. Direct Booking, OTA, and Walk-in totals all use these add-ons dynamically.</p>
          <form className="grid gap-4" onSubmit={async (event) => {
            event.preventDefault()
            if (!mealForm.price) return toast.error('Meal price is required')
            const ok = await postJson('/api/admin/set-meal-price', { ...mealForm, price: Number(mealForm.price), applicable_from: mealForm.applicable_from || null, applicable_to: mealForm.applicable_to || null }, setSavingMeal, 'Meal price saved')
            if (ok) setMealForm((current) => ({ ...current, price: '', applicable_from: '', applicable_to: '' }))
          }}>
            <select value={mealForm.meal_type} onChange={(event) => setMealForm((current) => ({ ...current, meal_type: event.target.value }))} className={INPUT}><option value="breakfast" style={{ background: '#111' }}>Breakfast</option><option value="lunch" style={{ background: '#111' }}>Lunch</option><option value="dinner" style={{ background: '#111' }}>Dinner</option></select>
            <input type="number" min={0} placeholder="Meal price" value={mealForm.price} onChange={(event) => setMealForm((current) => ({ ...current, price: event.target.value }))} className={INPUT} />
            <input type="date" value={mealForm.applicable_from} onChange={(event) => setMealForm((current) => ({ ...current, applicable_from: event.target.value }))} className={INPUT} style={{ colorScheme: 'dark' }} />
            <input type="date" value={mealForm.applicable_to} onChange={(event) => setMealForm((current) => ({ ...current, applicable_to: event.target.value }))} className={INPUT} style={{ colorScheme: 'dark' }} />
            <button type="submit" disabled={savingMeal} className="rounded-xl bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] px-6 py-3 text-sm font-bold text-black disabled:opacity-50">{savingMeal ? 'Saving...' : 'Save Meal Price'}</button>
          </form>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-playfair text-2xl text-white">Tour Operator Rates</h2>
            <p className="mt-1 text-sm text-white/45">B2B stays on a flat plan matrix. Set EP, CP, MAP, and AP season-wise from the same page.</p>
          </div>
          <div className="flex gap-2">
            {(['deluxe', 'premium'] as const).map((category) => <button key={category} onClick={() => setTourCategory(category)} className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${tourCategory === category ? 'bg-[#c9a14a] text-black' : 'border border-white/10 bg-white/5 text-white/60'}`}>{category}</button>)}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-4 py-3 text-left font-medium text-white/45">Season</th>
                {TOUR_MEALS.map((meal) => <th key={meal} className="px-3 py-3 text-center font-medium text-white/45"><div>{meal}</div><div className="text-xs font-normal text-white/25">{MEAL_LABELS[meal]}</div></th>)}
              </tr>
            </thead>
            <tbody>
              {seasons.map((season) => (
                <tr key={season.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white"><div className="font-medium">{seasonLabel(season)}</div></td>
                  {TOUR_MEALS.map((meal) => {
                    const key = `${season.id}:${meal}`
                    const rate = getTourRate(season.id, meal)
                    return (
                      <td key={meal} className="px-3 py-3 align-top text-center">
                        {editingKey === key ? (
                          <div className="space-y-1.5">
                            <input type="number" min={1} value={tourPrice} onChange={(event) => setTourPrice(event.target.value)} className={INPUT + ' !px-2 !py-2 text-center text-xs'} />
                            <input type="number" min={0} value={tourExtraBed} onChange={(event) => setTourExtraBed(event.target.value)} className={INPUT + ' !px-2 !py-2 text-center text-xs'} />
                            <input type="number" min={0} value={tourChild} onChange={(event) => setTourChild(event.target.value)} className={INPUT + ' !px-2 !py-2 text-center text-xs'} />
                            <div className="flex gap-1">
                              <button type="button" onClick={() => setEditingKey('')} className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs text-white/60">Cancel</button>
                              <button type="button" disabled={savingTour} onClick={async () => {
                                const existing = getTourRate(season.id, meal)
                                const token = await getToken()
                                if (!token) return toast.error('Admin session expired')
                                setSavingTour(true)
                                try {
                                  const response = await fetch(`/api/admin/data?type=room-rate&id=${existing?.id || 'new'}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ room_category: tourCategory, season_id: season.id, meal_plan: meal, rate_type: 'b2b', price_per_night: Number(tourPrice || 0), extra_bed_price: Number(tourExtraBed || 0), child_5_12_price: Number(tourChild || 0) }),
                                  })
                                  const result = await response.json()
                                  if (!response.ok || !result.success) throw new Error(result.error || 'Failed to save tour operator rate')
                                  toast.success('Tour operator rate saved')
                                  setEditingKey('')
                                  await loadData()
                                } catch (error: any) {
                                  toast.error(error.message || 'Failed to save tour operator rate')
                                } finally {
                                  setSavingTour(false)
                                }
                              }} className="flex-1 rounded-lg bg-[#c9a14a] px-2 py-1.5 text-xs font-bold text-black disabled:opacity-50">{savingTour ? '...' : 'Save'}</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => { setEditingKey(key); setTourPrice(rate ? String(rate.price_per_night) : ''); setTourExtraBed(rate ? String(rate.extra_bed_price) : '0'); setTourChild(rate ? String(rate.child_5_12_price) : '0') }} className={`w-full rounded-xl border px-2 py-3 text-xs ${rate ? 'border-[#c9a14a]/20 bg-[#c9a14a]/10 text-[#c9a14a]' : 'border-dashed border-white/10 bg-white/[0.02] text-white/25'}`}>
                            {rate ? <><div className="font-semibold">Rs. {Number(rate.price_per_night || 0).toLocaleString()}</div><div className="mt-1 text-[11px] text-white/35">Bed {Number(rate.extra_bed_price || 0).toLocaleString()}</div></> : '+ Set Rate'}
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
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="mb-4 font-playfair text-xl text-white">Recent Date-wise Prices</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/10 text-left text-white/45"><th className="px-3 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Room</th><th className="px-3 py-3 font-medium">Source</th><th className="px-3 py-3 font-medium">Base</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={4} className="px-3 py-8 text-center text-white/35">Loading pricing...</td></tr> : recentRows.length ? recentRows.map((rate) => <tr key={rate.id} className="border-b border-white/5 text-white/75"><td className="px-3 py-3">{rate.rate_date}</td><td className="px-3 py-3 capitalize">{rate.room_category}</td><td className="px-3 py-3 uppercase">{rate.rate_type}</td><td className="px-3 py-3">Rs. {Number(rate.base_price || 0).toLocaleString()}</td></tr>) : <tr><td colSpan={4} className="px-3 py-8 text-center text-white/35">No date-wise room prices saved yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="mb-4 font-playfair text-xl text-white">Meal Price Rules</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/10 text-left text-white/45"><th className="px-3 py-3 font-medium">Meal</th><th className="px-3 py-3 font-medium">Price</th><th className="px-3 py-3 font-medium">From</th><th className="px-3 py-3 font-medium">To</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={4} className="px-3 py-8 text-center text-white/35">Loading meal pricing...</td></tr> : mealPrices.length ? mealPrices.map((meal) => <tr key={meal.id} className="border-b border-white/5 text-white/75"><td className="px-3 py-3 capitalize">{meal.meal_type}</td><td className="px-3 py-3">Rs. {Number(meal.price || 0).toLocaleString()}</td><td className="px-3 py-3">{meal.applicable_from || 'Always'}</td><td className="px-3 py-3">{meal.applicable_to || 'Open'}</td></tr>) : <tr><td colSpan={4} className="px-3 py-8 text-center text-white/35">No meal price rules saved yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
