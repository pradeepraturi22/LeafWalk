'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Room { id: string; name: string; category: string; total_rooms: number; max_guests: number }
interface Booking {
  id: string; booking_number: string; guest_name: string
  booking_status: string; payment_status: string
  room_id: string; check_in: string; check_out: string
  rooms_booked: number; total_amount: number
  advance_amount: number; balance_amount: number
  booking_source: string; meal_plan: string; nights: number; adults: number
  tour_operator?: { company_name: string }
}

const S: Record<string, { bg: string; text: string; border: string; label: string; dot: string }> = {
  confirmed:   { bg: '#0d2040', text: '#93c5fd', border: '#3b82f6', label: 'Confirmed',   dot: '#3b82f6' },
  hold:        { bg: '#2a1800', text: '#fdba74', border: '#f97316', label: 'Hold',         dot: '#f97316' },
  checked_in:  { bg: '#0a2818', text: '#6ee7b7', border: '#10b981', label: 'Checked In',  dot: '#10b981' },
  checked_out: { bg: '#1e1030', text: '#c4b5fd', border: '#8b5cf6', label: 'Checked Out', dot: '#8b5cf6' },
  pending:     { bg: '#1e1a00', text: '#fde68a', border: '#f59e0b', label: 'Pending',      dot: '#f59e0b' },
}
const PAY_COLOR: Record<string, string> = {
  fully_paid: '#34d399', advance_paid: '#fb923c', pending: '#f87171'
}
const toISO = (d: Date) => d.toISOString().split('T')[0]
const fmt = (n: number) => `₹${Number(n||0).toLocaleString()}`

export default function BookingCalendar() {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [startDate, setStartDate] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate()-2); return d })
  const [days, setDays] = useState(30)
  const [selectedDate, setSelectedDate] = useState<string|null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Booking|null>(null)
  const today = toISO(new Date())

  useEffect(() => { init() }, [])
  useEffect(() => { if (rooms.length) loadBookings() }, [startDate, days, rooms])

  async function init() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { window.location.href = '/admin/login'; return }
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) { window.location.href = '/admin/login'; return }
    } catch { window.location.href = '/admin/login'; return }
    // Load rooms (public data — anon client ok)
    const { data, error } = await supabase.from('rooms').select('id,name,category,total_rooms,max_guests').order('name')
    if (error) { setFetchError('Rooms: '+error.message); setLoading(false); return }
    setRooms(data||[])
    setLoading(false)
  }

  async function loadBookings() {
    const end = new Date(startDate); end.setDate(end.getDate()+days+1)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) { setFetchError('Bookings: auth error'); return }
      const { bookings: all } = await res.json()
      const endISO = toISO(end), startISO = toISO(startDate)
      const filtered = (all || []).filter((b: any) =>
        ['pending','confirmed','hold','checked_in','checked_out'].includes(b.booking_status) &&
        b.check_in <= endISO && b.check_out >= startISO
      )
      setFetchError(''); setBookings(filtered)
    } catch (e: any) { setFetchError('Bookings: ' + e.message) }
  }

  const dates = Array.from({length:days}, (_,i) => { const d=new Date(startDate); d.setDate(d.getDate()+i); return d })
  const totalRooms = rooms.reduce((s,r)=>s+r.total_rooms,0)

  function getCellBks(roomId: string, iso: string) {
    return bookings.filter(b => b.room_id===roomId && b.check_in<=iso && b.check_out>iso)
  }
  function getAvail(room: Room, iso: string) {
    return Math.max(0, room.total_rooms - getCellBks(room.id, iso).reduce((s,b)=>s+b.rooms_booked,0))
  }

  function shift(n: number) { const d=new Date(startDate); d.setDate(d.getDate()+n); setStartDate(d) }
  function goToday() { const d=new Date(); d.setDate(d.getDate()-2); setStartDate(d) }

  if (loading) return (
    <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-[#c9a14a] border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  const bottomPanel = selectedDate || selectedBooking

  return (
    <div className="min-h-screen bg-[#0b0b0b] flex flex-col" onClick={()=>{setSelectedBooking(null)}}>

      {/* Top bar */}
      <div className="bg-[#111] border-b border-white/10 sticky top-0 z-40 flex-shrink-0">
        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
          <Link href="/admin/dashboard" className="text-white/40 hover:text-white text-sm">← Dashboard</Link>
          <span className="text-white/20">|</span>
          <span className="font-playfair text-[#c9a14a] text-lg">Room Availability Calendar</span>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              <button onClick={()=>shift(-days)} className="px-2 py-1.5 hover:bg-white/10 text-white/40 hover:text-white text-sm transition-all">‹‹</button>
              <button onClick={()=>shift(-7)} className="px-2 py-1.5 hover:bg-white/10 text-white/40 hover:text-white text-sm transition-all">‹7</button>
              <span className="px-3 text-white/60 text-sm font-medium whitespace-nowrap min-w-[160px] text-center">
                {dates[0]?.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})} – {dates[dates.length-1]?.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})}
              </span>
              <button onClick={()=>shift(7)} className="px-2 py-1.5 hover:bg-white/10 text-white/40 hover:text-white text-sm transition-all">7›</button>
              <button onClick={()=>shift(days)} className="px-2 py-1.5 hover:bg-white/10 text-white/40 hover:text-white text-sm transition-all">››</button>
            </div>
            <button onClick={goToday} className="px-3 py-1.5 bg-[#c9a14a]/20 text-[#c9a14a] rounded-lg text-sm font-medium hover:bg-[#c9a14a]/30 transition-all">Today</button>
            <select value={days} onChange={e=>setDays(+e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white/60 text-sm [&>option]:bg-[#111]">
              {[14,21,30,45].map(n=><option key={n} value={n}>{n} days</option>)}
            </select>
            <Link href="/admin/bookings/walk-in" className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-all">+ New Booking</Link>
          </div>
        </div>

        {/* Legend + stats */}
        <div className="px-4 pb-2.5 flex items-center gap-4 flex-wrap">
          {Object.entries(S).map(([k,v])=>(
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{background:v.dot}}/>
              <span className="text-white/40 text-xs">{v.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm border border-white/15"/>
            <span className="text-white/40 text-xs">Available</span>
          </div>
          <span className="ml-auto text-white/25 text-xs">{bookings.length} bookings · click date header for details · click cell for booking info</span>
          {fetchError && <span className="text-red-400 text-xs font-medium">⚠ {fetchError}</span>}
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto" style={{maxHeight: bottomPanel?'calc(100vh - 270px)':'calc(100vh - 115px)'}}>
        <table className="border-collapse" style={{minWidth:'max-content'}}>
          <thead className="sticky top-0 z-20">
            <tr>
              {/* Room header */}
              <th className="sticky left-0 z-30 bg-[#0e0e0e] border-b-2 border-r-2 border-white/15 px-3 py-2 text-left" style={{minWidth:155}}>
                <div className="text-white/40 text-xs font-semibold uppercase tracking-wider">Room Type</div>
                <div className="text-white/20 text-xs">{totalRooms} total rooms</div>
              </th>
              {dates.map(d => {
                const iso = toISO(d)
                const isT = iso===today
                const isSel = selectedDate===iso
                const isWE = [0,6].includes(d.getDay())
                const booked = rooms.reduce((s,r)=>s+getCellBks(r.id,iso).reduce((bs,b)=>bs+b.rooms_booked,0),0)
                const avail = totalRooms-booked
                return (
                  <th key={iso} onClick={()=>setSelectedDate(p=>p===iso?null:iso)}
                    className="border-b-2 border-r border-white/10 text-center cursor-pointer transition-all select-none hover:opacity-90"
                    style={{
                      minWidth:56, width:56,
                      background: isSel?'rgba(201,161,74,0.2)':isT?'rgba(201,161,74,0.09)':isWE?'rgba(255,255,255,0.025)':'#0e0e0e',
                      borderBottomColor: isSel?'#c9a14a':isT?'rgba(201,161,74,0.5)':'rgba(255,255,255,0.1)',
                    }}>
                    <div className="px-1 py-1.5">
                      <div className="text-xs leading-none" style={{color:isT||isSel?'#c9a14a':'#555'}}>{d.toLocaleDateString('en-IN',{weekday:'short'}).slice(0,2)}</div>
                      <div className="text-sm font-bold mt-0.5 leading-none" style={{color:isT||isSel?'#c9a14a':'#bbb'}}>{d.getDate()}</div>
                      <div className="text-xs mt-1 font-bold leading-none" style={{color:avail===0?'#f87171':avail===totalRooms?'#34d39999':'#fb923c'}}>{avail}</div>
                    </div>
                  </th>
                )
              })}
              {/* Today col */}
              <th className="sticky right-0 z-20 bg-[#0e0e0e] border-b-2 border-l-2 border-white/15 px-2 py-2 text-center" style={{minWidth:58}}>
                <div className="text-white/30 text-xs">Now</div>
              </th>
            </tr>
          </thead>

          <tbody>
            {rooms.map((room, ri) => (
              <tr key={room.id} style={{background:ri%2===0?'#0b0b0b':'#0d0d0d'}}>
                {/* Room label */}
                <td className="sticky left-0 z-10 border-r-2 border-b border-white/10 px-3 py-1"
                  style={{background:ri%2===0?'#0b0b0b':'#0d0d0d', minWidth:155}}>
                  <div className="text-white text-sm font-semibold">{room.name}</div>
                  <div className="text-white/30 text-xs capitalize">{room.category} · {room.total_rooms} room{room.total_rooms>1?'s':''}</div>
                </td>

                {/* Date cells */}
                {dates.map(d => {
                  const iso = toISO(d)
                  const isSel = selectedDate===iso
                  const isT = iso===today
                  const cellBks = getCellBks(room.id, iso)
                  const booked = cellBks.reduce((s,b)=>s+b.rooms_booked,0)
                  const avail = Math.max(0, room.total_rooms-booked)
                  return (
                    <td key={iso} className="border-r border-b border-white/5 p-0.5 align-top"
                      style={{minWidth:56,width:56,height:52,verticalAlign:'top',
                        background:isSel?'rgba(201,161,74,0.05)':isT?'rgba(201,161,74,0.03)':undefined}}>
                      {cellBks.length===0 ? (
                        // Available
                        <div className="w-full flex items-center justify-center rounded" style={{minHeight:44}}>
                          <span className="text-white/10 text-xs font-mono">{room.total_rooms}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-px w-full" style={{minHeight:44}}>
                          {cellBks.map(b => {
                            const st = S[b.booking_status]||S.pending
                            const isSB = selectedBooking?.id===b.id
                            return (
                              <button key={b.id} onClick={e=>{e.stopPropagation();setSelectedBooking(p=>p?.id===b.id?null:b);setSelectedDate(null)}}
                                className="w-full text-left px-1 py-0.5 rounded transition-all"
                                style={{
                                  background: isSB?st.border+'55':st.bg,
                                  border:`1px solid ${isSB?st.border:st.border+'55'}`,
                                  outline: isSB?`2px solid ${st.border}`:undefined,
                                }}>
                                <div className="flex items-center gap-0.5" style={{maxWidth:52}}>
                                  {b.check_in===iso && <span style={{color:st.dot,fontSize:7,lineHeight:1}}>▶</span>}
                                  <span className="truncate font-semibold" style={{color:st.text,fontSize:9,maxWidth:46}}>{b.guest_name.split(' ')[0]}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span style={{color:st.dot,fontSize:8}}>{b.rooms_booked}r</span>
                                  {avail>0 && cellBks.length===cellBks.indexOf(b)+1 && (
                                    <span style={{color:'#34d39977',fontSize:8}}>{avail}✓</span>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </td>
                  )
                })}

                {/* Today avail */}
                <td className="sticky right-0 z-10 border-l-2 border-b border-white/10 text-center px-1"
                  style={{background:ri%2===0?'#0b0b0b':'#0d0d0d',minWidth:58}}>
                  {(()=>{const a=getAvail(room,today);return(<>
                    <div className="text-sm font-bold leading-none" style={{color:a===0?'#f87171':a===room.total_rooms?'#34d399':'#fb923c'}}>{a}/{room.total_rooms}</div>
                    <div className="text-white/25 text-xs mt-0.5">avail</div>
                  </>)})()}
                </td>
              </tr>
            ))}

            {/* Category totals */}
            {['deluxe','premium'].map(cat => {
              const cr = rooms.filter(r=>r.category===cat)
              if (!cr.length) return null
              const ct = cr.reduce((s,r)=>s+r.total_rooms,0)
              return (
                <tr key={cat} style={{background:'#0f0f0f'}}>
                  <td className="sticky left-0 z-10 border-r-2 border-t-2 border-white/20 px-3 py-1.5 capitalize"
                    style={{background:'#0f0f0f'}}>
                    <span className="text-white/50 text-xs font-bold uppercase tracking-wider">{cat} Subtotal</span>
                    <span className="text-white/25 text-xs ml-2">{ct} rooms</span>
                  </td>
                  {dates.map(d=>{
                    const iso=toISO(d)
                    const b=cr.reduce((s,r)=>s+getCellBks(r.id,iso).reduce((bs,bk)=>bs+bk.rooms_booked,0),0)
                    const a=ct-b
                    return (
                      <td key={iso} className="border-r border-t-2 border-white/20 text-center py-1.5"
                        style={{background:selectedDate===iso?'rgba(201,161,74,0.05)':undefined}}>
                        <span className="text-xs font-bold" style={{color:a===0?'#f87171':a===ct?'#34d39966':'#fb923c'}}>{a}/{ct}</span>
                      </td>
                    )
                  })}
                  <td className="sticky right-0 z-10 border-l-2 border-t-2 border-white/20 text-center px-1"
                    style={{background:'#0f0f0f'}}>
                    {(()=>{const b=cr.reduce((s,r)=>s+getCellBks(r.id,today).reduce((bs,bk)=>bs+bk.rooms_booked,0),0);const a=ct-b;return(
                      <span className="text-xs font-bold" style={{color:a===0?'#f87171':a===ct?'#34d399':'#fb923c'}}>{a}/{ct}</span>
                    )})()}
                  </td>
                </tr>
              )
            })}

            {/* Grand total */}
            <tr style={{background:'#111'}}>
              <td className="sticky left-0 z-10 border-r-2 border-t-2 border-[#c9a14a]/40 px-3 py-2" style={{background:'#111'}}>
                <span className="text-[#c9a14a] text-xs font-bold uppercase tracking-wider">Total Available</span>
                <span className="text-white/30 text-xs ml-2">{totalRooms} total</span>
              </td>
              {dates.map(d=>{
                const iso=toISO(d)
                const isT=iso===today
                const isSel=selectedDate===iso
                const b=rooms.reduce((s,r)=>s+getCellBks(r.id,iso).reduce((bs,bk)=>bs+bk.rooms_booked,0),0)
                const a=totalRooms-b
                const pct=totalRooms>0?Math.round(b/totalRooms*100):0
                return (
                  <td key={iso} className="border-r border-t-2 border-[#c9a14a]/40 text-center py-1.5"
                    style={{background:isSel?'rgba(201,161,74,0.1)':isT?'rgba(201,161,74,0.05)':undefined}}>
                    <div className="text-xs font-bold leading-none" style={{color:a===0?'#f87171':a===totalRooms?'#34d399':'#fb923c'}}>{a}/{totalRooms}</div>
                    <div className="text-white/25 text-xs">{pct}%</div>
                  </td>
                )
              })}
              <td className="sticky right-0 z-10 border-l-2 border-t-2 border-[#c9a14a]/40 text-center px-1" style={{background:'#111'}}>
                {(()=>{const b=rooms.reduce((s,r)=>s+getCellBks(r.id,today).reduce((bs,bk)=>bs+bk.rooms_booked,0),0);const a=totalRooms-b;return(<>
                  <div className="text-sm font-bold" style={{color:a===0?'#f87171':a===totalRooms?'#34d399':'#fb923c'}}>{a}/{totalRooms}</div>
                  <div className="text-white/25 text-xs">{totalRooms>0?Math.round(b/totalRooms*100):0}%occ</div>
                </>)})()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── DATE CLICK PANEL ─────────────────────────────────────────────── */}
      {selectedDate && (()=>{
        const dateBks = bookings.filter(b=>b.check_in<=selectedDate && b.check_out>selectedDate)
        const bookedR = dateBks.reduce((s,b)=>s+b.rooms_booked,0)
        const availR = totalRooms-bookedR
        const dateObj = new Date(selectedDate+'T00:00:00')
        return (
          <div className="flex-shrink-0 bg-[#111] border-t-2 border-[#c9a14a]/40" style={{maxHeight:'42vh',overflowY:'auto'}}>
            <div className="px-5 py-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-white font-bold text-base">
                    {dateObj.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                  </h3>
                  <p className="text-white/40 text-xs mt-0.5">
                    {dateBks.length} booking{dateBks.length!==1?'s':''} · {bookedR} rooms booked ·&nbsp;
                    <span style={{color:availR===0?'#f87171':'#34d399'}}>{availR}/{totalRooms} available</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/bookings/walk-in?date=${selectedDate}`}
                    className="px-3 py-1.5 bg-[#c9a14a]/20 hover:bg-[#c9a14a]/30 text-[#c9a14a] rounded-lg text-xs font-medium transition-all">
                    + New Booking
                  </Link>
                  <button onClick={()=>setSelectedDate(null)} className="text-white/30 hover:text-white text-xl px-1">×</button>
                </div>
              </div>
              {dateBks.length===0 ? (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-7 h-7 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 text-sm">✓</div>
                  <p className="text-green-400 text-sm">Sab {totalRooms} rooms available hain is date pe</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {dateBks.map(b=>{
                    const st=S[b.booking_status]||S.pending
                    const room=rooms.find(r=>r.id===b.room_id)
                    return (
                      <Link key={b.id} href={`/admin/bookings/${b.id}`}
                        className="block rounded-xl p-3 transition-all hover:opacity-90"
                        style={{background:st.bg,border:`1px solid ${st.border}88`}}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-bold text-sm text-white">{b.guest_name}</div>
                            <div className="text-xs font-mono mt-0.5" style={{color:st.dot}}>{b.booking_number}</div>
                          </div>
                          <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{background:st.dot+'22',color:st.text}}>
                            {b.booking_status==='hold'?'🔒 ':''}{st.label}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-white/50">
                          <div className="flex justify-between">
                            <span>{room?.name||'—'}</span>
                            <span>{b.rooms_booked}r · {b.nights}N · {b.meal_plan}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{b.adults} adults</span>
                            <span className="font-bold text-white">{fmt(b.total_amount)}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-white/10">
                            <span>{(b.booking_source||'').replace('_',' ')}</span>
                            <span className="font-semibold" style={{color:PAY_COLOR[b.payment_status]||'#aaa'}}>
                              {b.payment_status==='fully_paid'?'✓ Paid':b.payment_status==='advance_paid'?`◑ Due ${fmt(b.balance_amount)}`:'○ Pending'}
                            </span>
                          </div>
                          {b.check_in===selectedDate && <div style={{color:'#34d399',fontSize:10}}>▶ Check-in today</div>}
                          {b.tour_operator && <div style={{color:st.dot,fontSize:10}} className="truncate">🏢 {b.tour_operator.company_name}</div>}
                        </div>
                      </Link>
                    )
                  })}
                  <Link href={`/admin/bookings/walk-in?date=${selectedDate}`}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 hover:border-[#c9a14a]/40 text-white/20 hover:text-[#c9a14a] transition-all"
                    style={{minHeight:100}}>
                    <span className="text-2xl">+</span>
                    <span className="text-xs mt-1">New Booking</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── CELL CLICK BOOKING DETAIL ────────────────────────────────────── */}
      {selectedBooking && !selectedDate && (()=>{
        const b=selectedBooking
        const st=S[b.booking_status]||S.pending
        const room=rooms.find(r=>r.id===b.room_id)
        return (
          <div className="flex-shrink-0 bg-[#111] border-t-2" style={{borderColor:st.border+'88'}}>
            <div className="px-5 py-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4 flex-wrap flex-1">
                  <div>
                    <div className="font-bold text-white text-base">{b.guest_name}</div>
                    <div className="text-xs font-mono mt-0.5" style={{color:st.dot}}>{b.booking_number}</div>
                    <span className="text-xs px-2 py-0.5 rounded-full mt-1.5 inline-block font-semibold" style={{background:st.bg,color:st.text,border:`1px solid ${st.border}`}}>
                      {b.booking_status==='hold'?'🔒 ':''}{st.label}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {[
                      {lbl:'Check-in',val:new Date(b.check_in+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'})},
                      {lbl:'Nights',val:String(b.nights),gold:true},
                      {lbl:'Check-out',val:new Date(b.check_out+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'})},
                    ].map(x=>(
                      <div key={x.lbl} className="bg-white/5 rounded-lg px-3 py-1.5 text-center">
                        <div className="text-white/40 text-xs">{x.lbl}</div>
                        <div className="font-bold text-sm mt-0.5" style={{color:x.gold?'#c9a14a':'#fff'}}>{x.val}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm space-y-0.5">
                    <div className="flex gap-3"><span className="text-white/40 w-14">Room:</span><span className="text-white">{room?.name||'—'} · {b.rooms_booked} room{b.rooms_booked>1?'s':''}</span></div>
                    <div className="flex gap-3"><span className="text-white/40 w-14">Guests:</span><span className="text-white">{b.adults} adults · {b.meal_plan}</span></div>
                    {b.tour_operator && <div className="flex gap-3"><span className="text-white/40 w-14">Operator:</span><span className="text-white">{b.tour_operator.company_name}</span></div>}
                  </div>
                  <div className="bg-white/5 rounded-lg px-4 py-2">
                    <div className="flex gap-5">
                      <div><div className="text-white/40 text-xs">Total</div><div className="text-white font-bold">{fmt(b.total_amount)}</div></div>
                      {Number(b.advance_amount)>0 && <div><div className="text-white/40 text-xs">Paid</div><div style={{color:'#34d399'}} className="font-bold">{fmt(b.advance_amount)}</div></div>}
                      {Number(b.balance_amount)>0 && b.payment_status!=='fully_paid' && <div><div className="text-white/40 text-xs">Balance</div><div style={{color:'#fb923c'}} className="font-bold">{fmt(b.balance_amount)}</div></div>}
                    </div>
                    <div className="mt-1 text-xs font-semibold" style={{color:PAY_COLOR[b.payment_status]}}>
                      {b.payment_status==='fully_paid'?'✓ Fully Paid':b.payment_status==='advance_paid'?'◑ Partial':'○ Pending'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/admin/bookings/${b.id}`}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{background:st.border+'33',color:st.text,border:`1px solid ${st.border}55`}}>
                    View Details →
                  </Link>
                  <button onClick={()=>setSelectedBooking(null)} className="text-white/30 hover:text-white text-xl px-1">×</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}