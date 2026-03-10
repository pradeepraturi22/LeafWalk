'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import AdminNavbar from '@/components/AdminNavbar'
import toast, { Toaster } from 'react-hot-toast'
import Link from 'next/link'
import GSTBillButton from '@/components/GSTBillButton'
import ReceiptButton from '@/components/ReceiptButton'

const MEAL_PLAN_LABELS: Record<string, string> = {
  EP: 'EP - Room Only', CP: 'CP - With Breakfast',
  MAP: 'MAP - Breakfast + Dinner', AP: 'AP - All Meals'
}

const STATUS_COLORS: Record<string, string> = {
  hold: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400',
  confirmed: 'bg-blue-500/20 text-blue-400',
  checked_in: 'bg-green-500/20 text-green-400',
  checked_out: 'bg-purple-500/20 text-purple-400',
  cancelled: 'bg-red-500/20 text-red-400',
  no_show: 'bg-gray-500/20 text-gray-400',
}

const PAYMENT_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  advance_paid: 'bg-blue-500/20 text-blue-400',
  fully_paid: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  refunded: 'bg-gray-500/20 text-gray-400',
}

export default function BookingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const bookingId = params.id as string

  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmPayment, setConfirmPayment] = useState({
    method: 'bank_transfer',
    advance: 0,
    transaction_number: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_notes: '',
  })
  const [showBalanceModal, setShowBalanceModal] = useState(false)
  const [balancePayment, setBalancePayment] = useState({
    method: 'bank_transfer',
    amount: 0,
    transaction_number: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_notes: '',
  })
  const [recordingBalance, setRecordingBalance] = useState(false)

  useEffect(() => { checkAuthAndLoad() }, [])

  async function checkAuthAndLoad() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/admin/login'); return }

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single() as any
    if (!userData || !['admin', 'manager'].includes(userData.role)) {
      router.push('/admin/login'); return
    }
    setUserRole(userData.role)
    await loadBooking()
  }

  async function loadBooking() {
    try {
      const res = await fetch(`/api/admin/data?type=booking-detail&id=${bookingId}`)
      const { data, error } = await res.json()
      if (error || !data) { toast.error('Booking not found'); router.push('/admin/bookings'); return }
      setBooking(data)
    } catch (e) {
      toast.error('Failed to load booking')
      router.push('/admin/bookings')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(newStatus: string) {
    setUpdatingStatus(true)
    try {
      const body: any = { status: newStatus }
      if (newStatus === 'checked_in') body.checked_in_at = new Date().toISOString()
      if (newStatus === 'checked_out') body.checked_out_at = new Date().toISOString()

      const res = await fetch(`/api/admin/data?type=booking-status&id=${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      toast.success('Status updated')
      loadBooking()
    } catch (e: any) {
      toast.error(e.message || 'Failed to update')
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function confirmHold() {
    setUpdatingStatus(true)
    try {
      const advance = Number(confirmPayment.advance) || 0
      const total = Number(booking.total_amount) || 0
      const body: any = {
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        payment_method: confirmPayment.method,
        advance_amount: advance,
        balance_amount: Math.max(0, total - advance),
        payment_status: advance >= total ? 'fully_paid' : advance > 0 ? 'advance_paid' : 'pending',
        advance_paid_at: advance > 0 ? new Date().toISOString() : null,
        transaction_number: confirmPayment.transaction_number || null,
        payment_date: confirmPayment.payment_date || null,
        payment_notes: confirmPayment.payment_notes || null,
      }
      const res = await fetch(`/api/admin/data?type=booking-status&id=${bookingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      // Send confirmation notification (email + SMS + WhatsApp)
      fetch('/api/admin/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'booking_confirmation', booking_id: bookingId })
      }).catch(() => {})
      toast.success('✅ Hold confirmed! Email + WhatsApp sent.')
      setShowConfirmModal(false)
      loadBooking()
    } catch (e: any) {
      toast.error(e.message || 'Failed to confirm')
    } finally { setUpdatingStatus(false) }
  }

  async function recordBalancePayment() {
    setRecordingBalance(true)
    try {
      const paid = Number(balancePayment.amount) || 0
      const currentAdvance = Number(booking.advance_amount) || 0
      const total = Number(booking.total_amount) || 0
      const newAdvance = currentAdvance + paid
      const newBalance = Math.max(0, total - newAdvance)
      const isFullyPaid = newBalance <= 0

      const body: any = {
        advance_amount: newAdvance,
        balance_amount: newBalance,
        payment_status: isFullyPaid ? 'fully_paid' : 'advance_paid',
        payment_method: balancePayment.method,
        transaction_number: balancePayment.transaction_number || null,
        payment_date: balancePayment.payment_date || null,
        payment_notes: balancePayment.payment_notes || null,
        advance_paid_at: new Date().toISOString(),
      }

      const res = await fetch(`/api/admin/data?type=booking-status&id=${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      // Send WhatsApp receipt if fully paid now
      if (isFullyPaid && booking.guest_phone) {
        fetch('/api/admin/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'booking_confirmation', booking_id: bookingId }),
        }).catch(() => {})
      }

      toast.success(isFullyPaid
        ? '✅ Full payment recorded! Booking fully settled.'
        : `✅ ₹${paid.toLocaleString()} recorded. Balance: ₹${newBalance.toLocaleString()} remaining.`
      )
      setShowBalanceModal(false)
      setBalancePayment({ method: 'bank_transfer', amount: 0, transaction_number: '', payment_date: new Date().toISOString().split('T')[0], payment_notes: '' })
      loadBooking()
    } catch (e: any) {
      toast.error(e.message || 'Failed to record payment')
    } finally {
      setRecordingBalance(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#c9a14a]"></div>
    </div>
  )

  if (!booking) return null

  const nights = booking.nights || 0
  const formatCurrency = (n: number) => `₹${Number(n || 0).toLocaleString()}`
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <>
      <AdminNavbar />
      <Toaster position="top-center" />
      <div className="min-h-screen bg-[#0b0b0b] py-10 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-white/50 text-sm mb-1">Booking Reference</p>
              <h1 className="text-3xl font-playfair text-[#c9a14a]">{booking.booking_number || booking.id.slice(0, 8).toUpperCase()}</h1>
            </div>
            <Link href="/admin/bookings" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm transition-all">← All Bookings</Link>
          </div>

          {/* Status bar */}
          <div className="flex flex-wrap gap-3 mb-6">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${STATUS_COLORS[booking.booking_status] || 'bg-gray-500/20 text-gray-400'}`}>
              {booking.booking_status?.replace('_', ' ').toUpperCase()}
            </span>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${PAYMENT_COLORS[booking.payment_status] || 'bg-gray-500/20 text-gray-400'}`}>
              {booking.payment_status?.replace('_', ' ').toUpperCase()}
            </span>
            <span className="px-4 py-2 rounded-full text-sm font-semibold bg-white/10 text-white/70">
              {booking.booking_source?.replace('_', ' ').toUpperCase()} · {booking.booking_type?.toUpperCase()}
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-6">

            {/* Guest Details */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 text-lg">Guest Details</h2>
              <div className="space-y-3 text-sm">
                <Row label="Name" value={booking.guest_name} />
                <Row label="Phone" value={booking.guest_phone} />
                <Row label="Email" value={booking.guest_email || '—'} />
                {booking.guest_id_type && <Row label="ID Proof" value={`${booking.guest_id_type} — ${booking.guest_id_number || ''}`} />}
              </div>
            </div>

            {/* Stay Details */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 text-lg">Stay Details</h2>
              <div className="space-y-3 text-sm">
                <Row label="Room" value={booking.room?.name || '—'} />
                <Row label="Check-in" value={formatDate(booking.check_in)} />
                <Row label="Check-out" value={formatDate(booking.check_out)} />
                <Row label="Nights" value={`${nights} night${nights > 1 ? 's' : ''}`} />
                <Row label="Rooms" value={`${booking.rooms_booked} room${booking.rooms_booked > 1 ? 's' : ''}`} />
                <Row label="Meal Plan" value={MEAL_PLAN_LABELS[booking.meal_plan] || booking.meal_plan} />
              </div>
            </div>

            {/* Occupancy */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 text-lg">Occupancy</h2>
              <div className="space-y-3 text-sm">
                <Row label="Adults" value={booking.adults} />
                {booking.children_below_5 > 0 && <Row label="Children (0-5 yrs)" value={`${booking.children_below_5} — Complimentary`} />}
                {booking.children_5_to_12 > 0 && <Row label="Children (6-12 yrs)" value={booking.children_5_to_12} />}
                {booking.extra_beds > 0 && <Row label="Extra Beds" value={booking.extra_beds} />}
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 text-lg">Payment Breakdown</h2>
              <div className="space-y-3 text-sm">
                <Row label="Rate/Room/Night" value={formatCurrency(booking.rate_per_room_per_night)} />
                {booking.extra_bed_rate_per_night > 0 && <Row label="Extra Bed/Night" value={formatCurrency(booking.extra_bed_rate_per_night)} />}
                {booking.child_rate_per_night > 0 && <Row label="Child Rate/Night" value={formatCurrency(booking.child_rate_per_night)} />}
                <div className="border-t border-white/10 pt-3">
                  <Row label="Subtotal (excl. GST)" value={formatCurrency(booking.subtotal)} />
                  <Row label="CGST @ 9%" value={formatCurrency(booking.cgst)} />
                  <Row label="SGST @ 9%" value={formatCurrency(booking.sgst)} />
                </div>
                <div className="border-t border-white/10 pt-3">
                  <div className="flex justify-between">
                    <span className="text-white font-bold">Total Amount</span>
                    <span className="text-[#c9a14a] font-bold text-base">{formatCurrency(booking.total_amount)}</span>
                  </div>
                  {booking.advance_amount > 0 && <Row label="Advance Paid" value={formatCurrency(booking.advance_amount)} />}
                  {booking.balance_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-yellow-400">Balance Due</span>
                      <span className="text-yellow-400 font-semibold">{formatCurrency(booking.balance_amount)}</span>
                    </div>
                  )}
                </div>
                <Row label="Payment Method" value={booking.payment_method?.replace('_', ' ').toUpperCase() || '—'} />
              </div>
            </div>
          </div>

          {/* Notes */}
          {(booking.special_requests || booking.admin_notes) && (
            <div className="grid md:grid-cols-2 gap-6 mt-6">
              {booking.special_requests && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h2 className="text-white font-semibold mb-3">Guest Special Requests</h2>
                  <p className="text-white/70 text-sm">{booking.special_requests}</p>
                </div>
              )}
              {booking.admin_notes && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h2 className="text-white font-semibold mb-3">Admin Notes</h2>
                  <p className="text-white/70 text-sm">{booking.admin_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {(userRole === 'admin' || userRole === 'manager') && (
            <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Update Status</h2>

              {/* HOLD Banner */}
              {booking.booking_status === 'hold' && (
                <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">🔒</span>
                    <div>
                      <p className="text-orange-400 font-semibold">Room on Hold</p>
                      <p className="text-orange-400/60 text-xs mt-0.5">Payment pending — operator se confirm aane ka wait hai</p>
                    </div>
                  </div>
                  {booking.hold_notes && <p className="text-white/50 text-xs bg-black/20 rounded-lg px-3 py-2">📝 {booking.hold_notes}</p>}
                  <button
                    onClick={() => { setConfirmPayment({ method: 'bank_transfer', advance: 0, transaction_number: '', payment_date: '', payment_notes: '' }); setShowConfirmModal(true) }}
                    className="mt-3 w-full py-3 bg-gradient-to-r from-green-700 to-green-500 text-white rounded-xl font-semibold hover:opacity-90 transition-all">
                    ✅ Payment Receive Karke Confirm Karo
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {booking.booking_status === 'pending' && (
                  <button onClick={() => updateStatus('confirmed')} disabled={updatingStatus} className="px-5 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-full text-sm font-medium transition-all disabled:opacity-50">
                    ✓ Confirm Booking
                  </button>
                )}
                {['pending', 'confirmed'].includes(booking.booking_status) && (
                  <button onClick={() => updateStatus('checked_in')} disabled={updatingStatus} className="px-5 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-full text-sm font-medium transition-all disabled:opacity-50">
                    → Check In
                  </button>
                )}
                {booking.booking_status === 'checked_in' && (
                  <button onClick={() => updateStatus('checked_out')} disabled={updatingStatus} className="px-5 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-full text-sm font-medium transition-all disabled:opacity-50">
                    ← Check Out
                  </button>
                )}
                {!['cancelled', 'checked_out', 'no_show'].includes(booking.booking_status) && userRole === 'admin' && (
                  <button onClick={() => { if (confirm('Cancel this booking?')) updateStatus('cancelled') }} disabled={updatingStatus} className="px-5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full text-sm font-medium transition-all disabled:opacity-50">
                    ✕ Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Hold → Confirm Modal */}
          {showConfirmModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h3 className="text-white font-bold text-lg mb-1">Confirm Booking</h3>
                <p className="text-white/50 text-sm mb-5">Total: <span className="text-[#c9a14a] font-bold">₹{Number(booking.total_amount).toLocaleString()}</span></p>

                <div className="space-y-4">
                  {/* Payment Method */}
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">Payment Method *</label>
                    <select value={confirmPayment.method}
                      onChange={e => setConfirmPayment(p => ({...p, method: e.target.value}))}
                      className="w-full px-4 py-3 bg-[#111] border border-white/20 rounded-lg text-white [&>option]:bg-[#111]">
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                    </select>
                  </div>

                  {/* Transaction Number */}
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">Transaction / UTR Number</label>
                    <input type="text" value={confirmPayment.transaction_number}
                      onChange={e => setConfirmPayment(p => ({...p, transaction_number: e.target.value}))}
                      placeholder="e.g. UTR123456789 or Txn ID"
                      className="w-full px-4 py-3 bg-[#111] border border-white/20 rounded-lg text-white placeholder:text-white/20" />
                  </div>

                  {/* Payment Date */}
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">Payment Date *</label>
                    <input type="date" value={confirmPayment.payment_date}
                      onChange={e => setConfirmPayment(p => ({...p, payment_date: e.target.value}))}
                      className="w-full px-4 py-3 bg-[#111] border border-white/20 rounded-lg text-white" />
                  </div>

                  {/* Advance Amount */}
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">Advance Amount Received (₹) *</label>
                    <input type="number" min="0" max={Number(booking.total_amount)}
                      value={confirmPayment.advance === 0 ? '' : confirmPayment.advance}
                      placeholder="0"
                      onChange={e => setConfirmPayment(p => ({...p, advance: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0}))}
                      onWheel={e => e.currentTarget.blur()}
                      className="w-full px-4 py-3 bg-[#111] border border-white/20 rounded-lg text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[20, 30, 50, 100].map(pct => (
                        <button key={pct} type="button"
                          onClick={() => setConfirmPayment(p => ({...p, advance: Math.round(Number(booking.total_amount) * pct / 100)}))}
                          className="px-3 py-1 bg-white/10 hover:bg-[#c9a14a]/20 hover:text-[#c9a14a] text-white/50 text-xs rounded-full transition-all">
                          {pct}% = ₹{Math.round(Number(booking.total_amount) * pct / 100).toLocaleString()}
                        </button>
                      ))}
                    </div>
                    {confirmPayment.advance > 0 && confirmPayment.advance < Number(booking.total_amount) && (
                      <p className="text-yellow-400 text-xs mt-2">Balance remaining: ₹{(Number(booking.total_amount) - confirmPayment.advance).toLocaleString()}</p>
                    )}
                  </div>

                  {/* Payment Notes */}
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">Notes (optional)</label>
                    <textarea value={confirmPayment.payment_notes}
                      onChange={e => setConfirmPayment(p => ({...p, payment_notes: e.target.value}))}
                      rows={2} placeholder="Any payment notes..."
                      className="w-full px-4 py-3 bg-[#111] border border-white/20 rounded-lg text-white placeholder:text-white/20 resize-none" />
                  </div>
                </div>

                <div className="mt-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-xs">
                  📧 Confirm karte hi guest ko Email + SMS + WhatsApp automatically jaayega
                </div>

                <div className="flex gap-3 mt-5">
                  <button onClick={confirmHold} disabled={updatingStatus || !confirmPayment.payment_date}
                    className="flex-1 py-3 bg-gradient-to-r from-green-700 to-green-500 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all">
                    {updatingStatus ? 'Confirming...' : '✅ Confirm & Notify Guest'}
                  </button>
                  <button onClick={() => setShowConfirmModal(false)}
                    className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Balance Payment Section — only for advance_paid bookings */}
          {booking.payment_status === 'advance_paid' && !['cancelled','no_show'].includes(booking.booking_status) && (
            <div className="mt-6 bg-orange-500/5 border border-orange-500/20 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-orange-400 font-semibold mb-1">Balance Payment Pending</h2>
                  <p className="text-white/40 text-sm">
                    Advance paid: <span className="text-white font-medium">₹{Number(booking.advance_amount).toLocaleString()}</span>
                    &nbsp;·&nbsp;
                    Balance due: <span className="text-orange-400 font-bold">₹{Number(booking.balance_amount).toLocaleString()}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setBalancePayment(p => ({ ...p, amount: Number(booking.balance_amount), payment_date: new Date().toISOString().split('T')[0] }))
                    setShowBalanceModal(true)
                  }}
                  className="px-5 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 rounded-full text-sm font-semibold transition-all whitespace-nowrap">
                  💰 Record Balance Payment
                </button>
              </div>
            </div>
          )}

          {/* Balance Payment Modal */}
          {showBalanceModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h3 className="text-white font-bold text-lg mb-1">Record Balance Payment</h3>
                <div className="flex gap-4 mb-5 text-sm">
                  <span className="text-white/50">Total: <span className="text-white font-semibold">₹{Number(booking.total_amount).toLocaleString()}</span></span>
                  <span className="text-white/50">Paid: <span className="text-green-400 font-semibold">₹{Number(booking.advance_amount).toLocaleString()}</span></span>
                  <span className="text-white/50">Due: <span className="text-orange-400 font-bold">₹{Number(booking.balance_amount).toLocaleString()}</span></span>
                </div>

                <div className="space-y-4">
                  {/* Amount */}
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">Amount Received (₹) *</label>
                    <input
                      type="number" min="1" max={Number(booking.balance_amount)}
                      value={balancePayment.amount === 0 ? '' : balancePayment.amount}
                      placeholder="0"
                      onChange={e => setBalancePayment(p => ({ ...p, amount: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 }))}
                      onWheel={e => e.currentTarget.blur()}
                      className="w-full px-4 py-3 bg-[#111] border border-white/20 rounded-lg text-white placeholder:text-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    {/* Quick fill buttons */}
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <button type="button"
                        onClick={() => setBalancePayment(p => ({ ...p, amount: Number(booking.balance_amount) }))}
                        className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs rounded-full transition-all font-medium">
                        Full Balance = ₹{Number(booking.balance_amount).toLocaleString()}
                      </button>
                      {[50, 75].map(pct => (
                        <button key={pct} type="button"
                          onClick={() => setBalancePayment(p => ({ ...p, amount: Math.round(Number(booking.balance_amount) * pct / 100) }))}
                          className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white/50 text-xs rounded-full transition-all">
                          {pct}% = ₹{Math.round(Number(booking.balance_amount) * pct / 100).toLocaleString()}
                        </button>
                      ))}
                    </div>
                    {balancePayment.amount > 0 && balancePayment.amount < Number(booking.balance_amount) && (
                      <p className="text-yellow-400 text-xs mt-2">
                        Still remaining after this: ₹{(Number(booking.balance_amount) - balancePayment.amount).toLocaleString()}
                      </p>
                    )}
                    {balancePayment.amount >= Number(booking.balance_amount) && Number(booking.balance_amount) > 0 && (
                      <p className="text-green-400 text-xs mt-2">✓ Booking will be marked as Fully Paid</p>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">Payment Method *</label>
                    <select value={balancePayment.method}
                      onChange={e => setBalancePayment(p => ({ ...p, method: e.target.value }))}
                      className="w-full px-4 py-3 bg-[#111] border border-white/20 rounded-lg text-white [&>option]:bg-[#111]">
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                    </select>
                  </div>

                  {/* Transaction Number */}
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">Transaction / UTR Number</label>
                    <input type="text" value={balancePayment.transaction_number}
                      onChange={e => setBalancePayment(p => ({ ...p, transaction_number: e.target.value }))}
                      placeholder="e.g. UTR123456789"
                      className="w-full px-4 py-3 bg-[#111] border border-white/20 rounded-lg text-white placeholder:text-white/20" />
                  </div>

                  {/* Payment Date */}
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">Payment Date *</label>
                    <input type="date" value={balancePayment.payment_date}
                      onChange={e => setBalancePayment(p => ({ ...p, payment_date: e.target.value }))}
                      className="w-full px-4 py-3 bg-[#111] border border-white/20 rounded-lg text-white" />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">Notes (optional)</label>
                    <textarea value={balancePayment.payment_notes}
                      onChange={e => setBalancePayment(p => ({ ...p, payment_notes: e.target.value }))}
                      rows={2} placeholder="Any notes..."
                      className="w-full px-4 py-3 bg-[#111] border border-white/20 rounded-lg text-white placeholder:text-white/20 resize-none" />
                  </div>
                </div>

                {balancePayment.amount >= Number(booking.balance_amount) && (
                  <div className="mt-3 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-300 text-xs">
                    ✅ Full payment — booking fully settled. Guest ko WhatsApp notification jaayega.
                  </div>
                )}

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={recordBalancePayment}
                    disabled={recordingBalance || !balancePayment.amount || !balancePayment.payment_date}
                    className="flex-1 py-3 bg-gradient-to-r from-orange-700 to-orange-500 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all">
                    {recordingBalance ? 'Recording...' : '💰 Record Payment'}
                  </button>
                  <button onClick={() => setShowBalanceModal(false)}
                    className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GST Bill + Receipt Download */}
          <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-1">Documents</h2>
            <p className="text-white/40 text-xs mb-4">Download booking receipt anytime · GST invoice only after full payment</p>
            <div className="flex flex-wrap gap-3">
              <ReceiptButton booking={booking} />
              <GSTBillButton booking={booking} />
            </div>
          </div>

          {/* Timestamps */}
          <div className="mt-6 text-white/30 text-xs flex gap-6 flex-wrap pb-8">
            <span>Created: {new Date(booking.created_at).toLocaleString('en-IN')}</span>
            {booking.checked_in_at && <span>Checked in: {new Date(booking.checked_in_at).toLocaleString('en-IN')}</span>}
            {booking.checked_out_at && <span>Checked out: {new Date(booking.checked_out_at).toLocaleString('en-IN')}</span>}
          </div>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/50">{label}</span>
      <span className="text-white text-right">{value}</span>
    </div>
  )
}