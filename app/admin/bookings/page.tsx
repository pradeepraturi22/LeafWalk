// app/admin/bookings/page.tsx — Fixed: correct DB enum values, all statuses, booking_number
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import AdminNavbar from '@/components/AdminNavbar'
import toast, { Toaster } from 'react-hot-toast'

// ── Correct DB enums ──────────────────────────────────────────────────────────
// booking_status: hold | pending | confirmed | checked_in | checked_out | cancelled | no_show | completed
// payment_status: pending | advance_paid | fully_paid | failed | refunded

interface Booking {
  id: string
  booking_number: string | null
  guest_name: string
  guest_email: string | null
  guest_phone: string
  room_id: string
  check_in: string
  check_out: string
  nights: number
  adults: number
  rooms_booked: number
  total_amount: number
  booking_status: string
  payment_status: string
  meal_plan: string
  promo_code: string | null
  discount_amount: number
  razorpay_payment_id: string | null
  special_requests: string | null
  created_at: string
  room: { name: string; category: string } | null
}

const BOOKING_STATUS_STYLE: Record<string, string> = {
  hold:         'bg-orange-500/20 text-orange-400 border-orange-500/30',
  pending:      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  confirmed:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  checked_in:   'bg-green-500/20 text-green-400 border-green-500/30',
  checked_out:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  cancelled:    'bg-red-500/20 text-red-400 border-red-500/30',
  no_show:      'bg-gray-500/20 text-gray-400 border-gray-500/30',
  completed:    'bg-teal-500/20 text-teal-400 border-teal-500/30',
}

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  pending:      'bg-yellow-500/20 text-yellow-400',
  advance_paid: 'bg-blue-500/20 text-blue-400',
  fully_paid:   'bg-green-500/20 text-green-400',
  failed:       'bg-red-500/20 text-red-400',
  refunded:     'bg-gray-500/20 text-gray-400',
}

const PAYMENT_LABEL: Record<string, string> = {
  pending:      'Pending',
  advance_paid: 'Advance Paid',
  fully_paid:   'Fully Paid',
  failed:       'Failed',
  refunded:     'Refunded',
}

export default function AdminBookingsPage() {
  const router = useRouter()
  const [bookings, setBookings]               = useState<Booking[]>([])
  const [filtered, setFiltered]               = useState<Booking[]>([])
  const [loading, setLoading]                 = useState(true)
  const [userRole, setUserRole]               = useState<'admin' | 'manager' | null>(null)
  const [statusFilter, setStatusFilter]       = useState('all')
  const [payFilter, setPayFilter]             = useState('all')
  const [searchQuery, setSearchQuery]         = useState('')
  const [dateFilter, setDateFilter]           = useState<'all' | 'upcoming' | 'current' | 'past'>('all')

  useEffect(() => { init() }, [])
  useEffect(() => { applyFilters() }, [bookings, statusFilter, payFilter, searchQuery, dateFilter])

  async function init() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { window.location.href = '/admin/login'; return }

      // Verify admin role server-side
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) { window.location.href = '/admin/login'; return }
      const { role } = await res.json()
      setUserRole(role as 'admin' | 'manager')
      await fetchBookings(session.access_token)
    } catch { window.location.href = '/admin/login' }
  }

  async function fetchBookings(token?: string) {
    setLoading(true)
    try {
      // Get token if not provided
      let t = token
      if (!t) {
        const { data: { session } } = await supabase.auth.getSession()
        t = session?.access_token
      }
      if (!t) throw new Error('No session')

      const res = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to fetch bookings')
      }
      const { bookings: data } = await res.json()
      setBookings(data || [])
    } catch (err: any) {
      toast.error('Failed to load bookings: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let f = [...bookings]
    if (statusFilter !== 'all') f = f.filter(b => b.booking_status === statusFilter)
    if (payFilter !== 'all') f = f.filter(b => b.payment_status === payFilter)

    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (dateFilter === 'upcoming') f = f.filter(b => new Date(b.check_in) > today)
    else if (dateFilter === 'current') f = f.filter(b => new Date(b.check_in) <= today && new Date(b.check_out) >= today)
    else if (dateFilter === 'past') f = f.filter(b => new Date(b.check_out) < today)

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      f = f.filter(b =>
        b.guest_name.toLowerCase().includes(q) ||
        (b.guest_email || '').toLowerCase().includes(q) ||
        b.guest_phone.includes(q) ||
        (b.booking_number || '').toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        (b.room?.name || '').toLowerCase().includes(q)
      )
    }
    setFiltered(f)
  }

  async function updateStatus(id: string, status: string) {
    if (!confirm(`Change booking status to "${status}"?`)) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { toast.error('Session expired'); return }
    const res = await fetch('/api/admin/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ booking_id: id, booking_status: status }),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Update failed'); return }
    toast.success('Status updated')
    fetchBookings()
  }

  const stats = {
    total:     bookings.length,
    pending:   bookings.filter(b => b.booking_status === 'pending').length,
    confirmed: bookings.filter(b => b.booking_status === 'confirmed').length,
    checkedIn: bookings.filter(b => b.booking_status === 'checked_in').length,
    revenue:   bookings.filter(b => ['advance_paid', 'fully_paid'].includes(b.payment_status))
                       .reduce((s, b) => s + Number(b.total_amount || 0), 0),
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b]">
      <div className="w-10 h-10 border-2 border-[#c9a14a] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const SEL = 'w-full px-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white text-sm focus:outline-none focus:border-[#c9a14a] [&>option]:bg-[#1a1a1a]'
  const INP = 'w-full px-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white text-sm focus:outline-none focus:border-[#c9a14a] placeholder:text-white/30'

  return (
    <div className="min-h-screen bg-[#0b0b0b]">
      <Toaster position="top-center" />
      <AdminNavbar />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-playfair text-[#c9a14a] mb-1">Bookings Management</h1>
          <p className="text-white/50 text-sm">{userRole === 'admin' ? '👑 Administrator' : '🔧 Manager'} · {bookings.length} total bookings</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total', val: stats.total, color: 'text-white' },
            { label: 'Pending', val: stats.pending, color: 'text-yellow-400' },
            { label: 'Confirmed', val: stats.confirmed, color: 'text-blue-400' },
            { label: 'Checked In', val: stats.checkedIn, color: 'text-green-400' },
            { label: 'Revenue', val: `₹${stats.revenue.toLocaleString()}`, color: 'text-[#c9a14a]' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <p className="text-white/50 text-xs mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <input placeholder="Search name / phone / ID..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} className={INP + ' col-span-2 md:col-span-1'} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={SEL}>
              <option value="all">All Statuses</option>
              <option value="hold">Hold</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
              <option value="completed">Completed</option>
            </select>
            <select value={payFilter} onChange={e => setPayFilter(e.target.value)} className={SEL}>
              <option value="all">All Payments</option>
              <option value="pending">Pending</option>
              <option value="advance_paid">Advance Paid</option>
              <option value="fully_paid">Fully Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <select value={dateFilter} onChange={e => setDateFilter(e.target.value as any)} className={SEL}>
              <option value="all">All Dates</option>
              <option value="upcoming">Upcoming</option>
              <option value="current">Currently Staying</option>
              <option value="past">Past</option>
            </select>
            <button onClick={() => { setSearchQuery(''); setStatusFilter('all'); setPayFilter('all'); setDateFilter('all') }}
              className="px-4 py-2 bg-white/8 hover:bg-white/15 border border-white/15 rounded-lg text-white/60 hover:text-white text-sm transition-all">
              Clear Filters
            </button>
          </div>
          <p className="text-white/30 text-xs mt-2">Showing {filtered.length} of {bookings.length} bookings</p>
        </div>

        {/* Table */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 bg-white/5">
                <tr>
                  {['Booking', 'Guest', 'Room', 'Dates', 'Amount', 'Status', 'Payment', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-16 text-center text-white/30">No bookings found</td></tr>
                ) : filtered.map(b => (
                  <tr key={b.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-mono text-xs">{b.booking_number || b.id.slice(0, 8) + '...'}</p>
                      <p className="text-white/30 text-xs">{new Date(b.created_at).toLocaleDateString('en-IN')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{b.guest_name}</p>
                      <p className="text-white/40 text-xs">{b.guest_phone}</p>
                      {b.guest_email && <p className="text-white/30 text-xs truncate max-w-[140px]">{b.guest_email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white">{b.room?.name || '—'}</p>
                      <p className="text-white/40 text-xs capitalize">{b.room?.category} · {b.meal_plan}</p>
                      <p className="text-white/30 text-xs">{b.rooms_booked} room{b.rooms_booked > 1 ? 's' : ''} · {b.adults} adult{b.adults > 1 ? 's' : ''}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-white text-xs">{new Date(b.check_in).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                      <p className="text-white/30 text-xs">→ {new Date(b.check_out).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                      <p className="text-white/40 text-xs">{b.nights}N</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[#c9a14a] font-bold">₹{Number(b.total_amount).toLocaleString()}</p>
                      {b.promo_code && <p className="text-green-400 text-xs">🏷️ {b.promo_code}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${BOOKING_STATUS_STYLE[b.booking_status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                        {b.booking_status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${PAYMENT_STATUS_STYLE[b.payment_status] || 'bg-gray-500/20 text-gray-400'}`}>
                        {PAYMENT_LABEL[b.payment_status] || b.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5 min-w-[90px]">
                        <button onClick={() => router.push(`/admin/bookings/${b.id}`)}
                          className="px-3 py-1.5 bg-white/8 hover:bg-white/15 border border-white/15 text-white rounded-lg text-xs transition-all">
                          View
                        </button>
                        {userRole === 'admin' && b.booking_status === 'pending' && (
                          <button onClick={() => updateStatus(b.id, 'confirmed')}
                            className="px-3 py-1.5 bg-green-500/15 hover:bg-green-500/25 border border-green-500/25 text-green-400 rounded-lg text-xs transition-all">
                            Confirm
                          </button>
                        )}
                        {userRole === 'admin' && b.booking_status === 'confirmed' && (
                          <button onClick={() => updateStatus(b.id, 'checked_in')}
                            className="px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-400 rounded-lg text-xs transition-all">
                            Check In
                          </button>
                        )}
                        {userRole === 'admin' && b.booking_status === 'checked_in' && (
                          <button onClick={() => updateStatus(b.id, 'checked_out')}
                            className="px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/25 text-purple-400 rounded-lg text-xs transition-all">
                            Check Out
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}