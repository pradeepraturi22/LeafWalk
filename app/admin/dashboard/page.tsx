'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

const STATUS_BADGE: Record<string,string> = {
  confirmed:'bg-blue-500/20 text-blue-400', hold:'bg-orange-500/20 text-orange-400',
  checked_in:'bg-green-500/20 text-green-400', checked_out:'bg-purple-500/20 text-purple-400',
  cancelled:'bg-red-500/20 text-red-400', pending:'bg-yellow-500/20 text-yellow-400',
}
const PAY_BADGE: Record<string,string> = {
  paid:'bg-green-500/20 text-green-400', fully_paid:'bg-green-500/20 text-green-400',
  payment_processing:'bg-orange-500/20 text-orange-400', pending:'bg-red-500/20 text-red-400',
}
const isPaid = (b:any) => ['paid','fully_paid'].includes(b.payment_status)
const isActive = (b:any) => !['cancelled','no_show','checked_out','completed'].includes(String(b.booking_status || '').trim().toLowerCase())
const fmt = (n:any) => `₹${Number(n||0).toLocaleString()}`

const realizedRevenue = (b:any) => {
  const status = String(b.payment_status || '').trim().toLowerCase()
  if (['paid', 'fully_paid'].includes(status)) return Number(b.total_amount || 0)
  if (status === 'payment_processing') return Number(b.advance_amount || 0)
  return 0
}

export default function AdminDashboard() {
  const router = useRouter()
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({})
  const [recent, setRecent] = useState<any[]>([])
  const [todayAct, setTodayAct] = useState<any>({ checkIns:[], checkOuts:[], holds:[] })

  useEffect(() => { init() }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  async function init() {
    try {
      // Step 1: Get session (localStorage — fast, no network)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !session.access_token) {
        window.location.href = '/admin/login'
        return
      }

      let verifiedRole = ''

      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: 'no-store',
      })
      if (response.ok) {
        const data = await response.json()
        verifiedRole = data?.role || ''
      } else if (response.status === 401 || response.status === 403 || response.status === 404) {
        window.location.href = '/admin/login'
        return
      }

      // Step 2: Try server-side verification (service role — bypasses all RLS)
      try {
        const res = await fetch('/api/admin/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        })
        if (res.ok) {
          const d = await res.json()
          verifiedRole = d.role
        } else if (res.status === 403) {
          // Confirmed: not admin
          window.location.href = '/admin/login'
          return
        }
        // If 404/500 (API route not deployed yet), fall through to DB check
      } catch {}

      // Step 3: Fallback — direct DB query if API not available
      if (!verifiedRole) {
        window.location.href = '/admin/login'
        return
      }

      if (!verifiedRole || !['admin', 'manager'].includes(verifiedRole)) {
        console.error('Role check failed. Role was:', verifiedRole)
        window.location.href = '/admin/login'
        return
      }

      setRole(verifiedRole)
      await loadData(session.access_token)
    } catch (err) {
      console.error('Dashboard init error:', err)
      window.location.href = '/admin/login'
    } finally {
      setLoading(false)
    }
  }

  async function loadData(accessToken: string) {
    const today = new Date().toISOString().split('T')[0]
    const mStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    const response = await fetch('/api/admin/data?type=dashboard', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result?.error || 'Could not load dashboard')
    }

    const all = result.allBookings || []
    const rooms = result.rooms || []

    const active = all.filter(isActive)
    const totalRooms = rooms.reduce((s:number,r:any) => s + Number(r.total_rooms||0), 0)
    const nowOccupied = active.filter((b:any) => b.check_in <= today && b.check_out > today)
    const bookedRooms = nowOccupied.reduce((s:number,b:any) => s + Number(b.rooms_booked||1), 0)

    // Revenue — use total_amount for paid, advance_amount for partial
    const todayRev = all
      .filter((b:any) => realizedRevenue(b) > 0 && (b.advance_paid_at||b.created_at||'').startsWith(today))
      .reduce((s:number,b:any) => s + realizedRevenue(b), 0)
    const monthRev = all
      .filter((b:any) => realizedRevenue(b) > 0 && (b.advance_paid_at||b.created_at||'') >= mStart)
      .reduce((s:number,b:any) => s + realizedRevenue(b), 0)
    const pendingBal = active
      .filter((b:any) => Number(b.balance_amount||0) > 0)
      .reduce((s:number,b:any) => s + Number(b.balance_amount||0), 0)
    const totalSettled = active.reduce((s:number,b:any) => s + realizedRevenue(b), 0)

    setStats({
      total: active.length,
      confirmed: active.filter((b:any) => b.booking_status==='confirmed').length,
      hold: active.filter((b:any) => b.booking_status==='hold').length,
      checkedIn: active.filter((b:any) => b.booking_status==='checked_in').length,
      checkInsToday: active.filter((b:any) => b.check_in===today).length,
      checkOutsToday: active.filter((b:any) => b.check_out===today).length,
      occ: totalRooms > 0 ? Math.round(bookedRooms/totalRooms*100) : 0,
      totalRooms, bookedRooms, todayRev, monthRev, pendingBal, totalSettled,
    })
    setRecent((result.recent || all).slice(0,12))
    setTodayAct({
      checkIns: active.filter((b:any) => b.check_in===today),
      checkOuts: active.filter((b:any) => b.check_out===today),
      holds: active.filter((b:any) => b.booking_status==='hold'),
    })
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#c9a14a]"></div></div>

  return (
    <div className="min-h-screen bg-[#0b0b0b]">
      <div className="bg-[#111] border-b border-white/10 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">🌿</span>
            <div>
              <h1 className="text-lg font-playfair text-[#c9a14a] leading-none">LeafWalk Admin</h1>
              <p className="text-white/40 text-xs">{role === 'admin' ? 'Administrator' : 'Manager'}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/admin/bookings/calendar" className="px-4 py-2 bg-[#c9a14a]/20 hover:bg-[#c9a14a]/30 text-[#c9a14a] rounded-full text-sm font-medium transition-all">📅 Calendar</Link>
            <Link href="/" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm">Website</Link>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-full text-sm">Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Revenue cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {label:"Today's Collection", val:fmt(stats.todayRev), sub:`${stats.checkInsToday||0} check-ins`, cls:'from-blue-500/10 to-blue-600/5 border-blue-500/20', acc:'text-blue-400', icon:'💰'},
            {label:'Month Collection',   val:fmt(stats.monthRev), sub:`Settled: ${fmt(stats.totalSettled)}`, cls:'from-[#c9a14a]/10 to-[#c9a14a]/5 border-[#c9a14a]/20', acc:'text-[#c9a14a]', icon:'📊'},
            {label:'Occupancy Today',    val:`${stats.occ||0}%`,  sub:`${stats.bookedRooms||0}/${stats.totalRooms||0} rooms`, cls:'from-green-500/10 to-green-600/5 border-green-500/20', acc:'text-green-400', icon:'🏠'},
            {label:'Balance Pending',    val:fmt(stats.pendingBal), sub:`${stats.hold||0} holds pending`, cls:'from-orange-500/10 to-orange-600/5 border-orange-500/20', acc:'text-orange-400', icon:'⚠️'},
          ].map(s => (
            <div key={s.label} className={`bg-gradient-to-br ${s.cls} border rounded-2xl p-5`}>
              <div className="flex justify-between mb-3"><p className="text-white/60 text-xs uppercase tracking-wide">{s.label}</p><span className="text-xl">{s.icon}</span></div>
              <p className="text-2xl font-bold text-white mb-1">{s.val}</p>
              <p className={`text-xs ${s.acc}`}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Status pills */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {[
            {label:'Total Active', val:stats.total||0, cls:'bg-white/5 border-white/10', txt:'text-white'},
            {label:'Confirmed',    val:stats.confirmed||0, cls:'bg-blue-500/10 border-blue-500/20', txt:'text-blue-400'},
            {label:'On Hold',      val:stats.hold||0, cls:'bg-orange-500/10 border-orange-500/20', txt:'text-orange-400'},
            {label:'Checked In',   val:stats.checkedIn||0, cls:'bg-green-500/10 border-green-500/20', txt:'text-green-400'},
            {label:'Check-outs Today', val:stats.checkOutsToday||0, cls:'bg-purple-500/10 border-purple-500/20', txt:'text-purple-400'},
          ].map(s => (
            <div key={s.label} className={`${s.cls} border rounded-xl p-4 text-center`}>
              <p className={`text-3xl font-bold ${s.txt}`}>{s.val}</p>
              <p className="text-white/40 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-white font-semibold">Quick Actions</h2>
              <p className="mt-1 text-xs text-white/40">Navbar ke hidden ya secondary admin modules bhi yahin se directly open ho jayenge.</p>
            </div>
            <div className="rounded-full border border-[#c9a14a]/20 bg-[#c9a14a]/10 px-3 py-1 text-[11px] font-medium text-[#c9a14a]">
              All admin shortcuts
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            {[
              {href:'/admin/dashboard',              icon:'🏠', label:'Dashboard',      sub:'Overview',       cls:'from-white/10 border-white/20'},
              {href:'/admin/bookings',               icon:'📋', label:'All Bookings',   sub:'View & manage',  cls:'from-purple-500/20 border-purple-500/30'},
              {href:'/admin/bookings/calendar',      icon:'📅', label:'Calendar',       sub:'Availability',   cls:'from-green-500/20 border-green-500/30'},
              {href:'/admin/rooms',                  icon:'🛏', label:'Manage Rooms',   sub:'Rooms + caps',   cls:'from-teal-500/20 border-teal-500/30'},
              {href:'/admin/tariff',                 icon:'💲', label:'Tariff Console', sub:'Price setup',    cls:'from-amber-500/20 border-amber-500/30'},
              {href:'/admin/menu',                   icon:'🍽', label:'Menu',           sub:'Restaurant CMS', cls:'from-lime-500/20 border-lime-500/30'},
              {href:'/admin/billing',                icon:'🧾', label:'Billing',        sub:'Food bills',     cls:'from-emerald-500/20 border-emerald-500/30'},
              {href:'/admin/tour-operators',         icon:'👥', label:'Operators',      sub:'Manage B2B',     cls:'from-pink-500/20 border-pink-500/30'},
              {href:'/admin/bookings/walk-in',       icon:'🚶', label:'Walk-in',       sub:'New booking',   cls:'from-[#c9a14a]/20 border-[#c9a14a]/30'},
              {href:'/admin/bookings/tour-operator', icon:'🏢', label:'Tour Operator', sub:'B2B booking',   cls:'from-blue-500/20 border-blue-500/30'},
              {href:'/admin/content',                icon:'🖼', label:'Content',       sub:'Reviews & media', cls:'from-indigo-500/20 border-indigo-500/30'},
            ].map(a => (
              <Link key={a.href} href={a.href} className={`flex flex-col items-center gap-2 p-4 bg-gradient-to-b ${a.cls} border rounded-xl hover:opacity-80 transition-all text-center`}>
                <span className="text-2xl">{a.icon}</span>
                <div><p className="text-white font-semibold text-sm">{a.label}</p><p className="text-white/40 text-xs">{a.sub}</p></div>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Today */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Today&apos;s Activity</h2>
            {todayAct.checkIns?.length > 0 && <>
              <p className="text-green-400 text-xs font-semibold uppercase mb-2">Check-ins ({todayAct.checkIns.length})</p>
              {todayAct.checkIns.slice(0,4).map((b:any) => (
                <Link key={b.id} href={`/admin/bookings/${b.id}`} className="flex justify-between p-2.5 bg-green-500/10 border border-green-500/20 rounded-lg mb-2 hover:bg-green-500/20 transition-all">
                  <span className="text-white text-sm">{b.guest_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${PAY_BADGE[b.payment_status]||''}`}>{b.payment_status}</span>
                </Link>
              ))}
            </>}
            {todayAct.checkOuts?.length > 0 && <>
              <p className="text-purple-400 text-xs font-semibold uppercase mb-2 mt-3">Check-outs ({todayAct.checkOuts.length})</p>
              {todayAct.checkOuts.slice(0,4).map((b:any) => (
                <Link key={b.id} href={`/admin/bookings/${b.id}`} className="flex justify-between p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg mb-2 hover:bg-purple-500/20 transition-all">
                  <span className="text-white text-sm">{b.guest_name}</span>
                  <span className="text-purple-400 text-xs">{b.rooms_booked} room</span>
                </Link>
              ))}
            </>}
            {todayAct.holds?.length > 0 && <>
              <p className="text-orange-400 text-xs font-semibold uppercase mb-2 mt-3">Pending Holds ({todayAct.holds.length})</p>
              {todayAct.holds.slice(0,3).map((b:any) => (
                <Link key={b.id} href={`/admin/bookings/${b.id}`} className="flex justify-between p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-lg mb-2 hover:bg-orange-500/20 transition-all">
                  <span className="text-white text-sm">{b.guest_name}</span>
                  <span className="text-orange-400 text-xs">{fmt(b.total_amount)}</span>
                </Link>
              ))}
            </>}
            {!todayAct.checkIns?.length && !todayAct.checkOuts?.length && !todayAct.holds?.length &&
              <p className="text-white/30 text-sm text-center py-6">Aaj koi activity nahi</p>}
          </div>

          {/* Recent bookings */}
          <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-white font-semibold">Recent Bookings</h2>
              <Link href="/admin/bookings" className="text-[#c9a14a] text-sm hover:underline">View all →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Ref','Guest','Room','Check-in','Amount','Status','Payment'].map(h=>(
                      <th key={h} className="text-left py-2 px-2 text-white/40 text-xs font-medium uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((b:any) => (
                    <tr key={b.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                      <td className="py-2.5 px-2"><Link href={`/admin/bookings/${b.id}`} className="text-[#c9a14a] hover:underline text-xs font-mono">{b.booking_number||b.id?.slice(0,8)}</Link></td>
                      <td className="py-2.5 px-2"><div className="text-white text-sm">{b.guest_name}</div>{b.tour_operator&&<div className="text-white/30 text-xs">{b.tour_operator.company_name}</div>}</td>
                      <td className="py-2.5 px-2 text-white/60 text-xs">{b.room?.name||'—'}</td>
                      <td className="py-2.5 px-2 text-white/60 text-xs whitespace-nowrap">{formatDate(b.check_in)}</td>
                      <td className="py-2.5 px-2 text-white font-semibold text-sm whitespace-nowrap">{fmt(b.total_amount)}</td>
                      <td className="py-2.5 px-2"><span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[b.booking_status]||'bg-white/10 text-white/50'}`}>{b.booking_status}</span></td>
                      <td className="py-2.5 px-2"><span className={`px-2 py-0.5 rounded-full text-xs ${PAY_BADGE[b.payment_status]||'bg-white/10 text-white/50'}`}>{b.payment_status}</span></td>
                    </tr>
                  ))}
                  {!recent.length && <tr><td colSpan={7} className="py-10 text-center text-white/30">No bookings yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
