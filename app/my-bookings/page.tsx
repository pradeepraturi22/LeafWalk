'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import toast, { Toaster } from 'react-hot-toast'
import Image from 'next/image'

interface Booking {
  id: string; check_in: string; check_out: string; nights: number
  rooms_booked: number; adults: number; meal_plan: string
  total_amount: number; discount_amount: number; promo_code: string | null
  booking_status: string; payment_status: string
  guest_name: string; guest_email: string; guest_phone: string
  razorpay_payment_id: string | null; created_at: string
  special_requests: string | null
  room: { name: string; category: string; featured_image: string; slug: string } | null
}

const STATUS_STYLE: Record<string, string> = {
  confirmed:   'bg-green-500/15 text-green-400 border-green-500/25',
  pending:     'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  cancelled:   'bg-red-500/15 text-red-400 border-red-500/25',
  completed:   'bg-blue-500/15 text-blue-400 border-blue-500/25',
  checked_in:  'bg-purple-500/15 text-purple-400 border-purple-500/25',
  checked_out: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
}
const PAY_STYLE: Record<string, string> = {
  fully_paid:     'bg-green-500/15 text-green-400',
  partially_paid: 'bg-yellow-500/15 text-yellow-400',
  pending:        'bg-yellow-500/15 text-yellow-400',
  failed:         'bg-red-500/15 text-red-400',
  refunded:       'bg-blue-500/15 text-blue-400',
}

const MEAL_LABELS: Record<string, string> = { EP: 'Room Only', CP: 'With Breakfast', MAP: 'Breakfast + Dinner', AP: 'All Meals' }

export default function MyBookingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { window.location.href = '/auth?redirect=/my-bookings'; return }
      setUser(session.user)
      loadBookings(session.user.id, session.user.email)
    })
  }, [])

  async function loadBookings(userId: string, userEmail?: string) {
    // Query by user_id first; also match by guest_email for bookings made before login
    let query = supabase
      .from('bookings')
      .select(`
        id, check_in, check_out, nights, rooms_booked, adults, meal_plan,
        total_amount, discount_amount, promo_code, booking_status, payment_status,
        guest_name, guest_email, guest_phone, razorpay_payment_id, created_at, special_requests,
        room:rooms(name, category, featured_image, slug)
      `)
      .order('created_at', { ascending: false })

    // Use OR filter: user_id match OR email match
    if (userEmail) {
      query = query.or(`user_id.eq.${userId},guest_email.eq.${userEmail}`)
    } else {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query
    if (error) { toast.error('Failed to load bookings'); console.error(error) }
    // De-duplicate in case both conditions match same booking
    const seen = new Set<string>()
    const unique = (data || []).filter(b => { if (seen.has(b.id)) return false; seen.add(b.id); return true })
    setBookings(unique)
    setLoading(false)
  }

  async function downloadReceipt(booking: Booking) {
    setDownloading(booking.id)
    try {
      // Dynamic import to keep bundle small
      const { generateBookingReceipt } = await import('@/lib/booking-receipt-generator')
      await generateBookingReceipt(booking)
      toast.success('Receipt downloaded successfully')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate receipt. Please try again.')
    } finally {
      setDownloading(null)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b0b' }}>
      <div className="w-12 h-12 border-2 border-[#c9a14a] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: '#0b0b0b' }}>
      <Toaster position="top-right" />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-[#c9a14a] text-xs uppercase tracking-[0.3em] font-semibold mb-1">My Account</p>
            <h1 className="font-playfair text-3xl text-white">My Bookings</h1>
          </div>
          <a href="/rooms" className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ background: 'linear-gradient(135deg, #c9a14a, #e6c87a)', color: '#000' }}>
            + New Booking
          </a>
        </div>

        {bookings.length === 0 ? (
          <div className="text-center py-24 border border-white/8 rounded-3xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-6xl mb-5">🏔️</div>
            <h2 className="font-playfair text-2xl text-white mb-3">No bookings yet</h2>
            <p className="text-white/40 text-sm mb-8">Your booking history will appear here after your first reservation.</p>
            <a href="/rooms" className="inline-block px-8 py-3 rounded-xl font-bold text-sm" style={{ background: 'linear-gradient(135deg, #c9a14a, #e6c87a)', color: '#000' }}>Explore Our Rooms</a>
          </div>
        ) : (
          <div className="space-y-5">
            {bookings.map(booking => {
              const isPast     = new Date(booking.check_out) < new Date()
              const isExpanded = expanded === booking.id
              const canDownload = ['confirmed','completed','checked_in','checked_out'].includes(booking.booking_status) && booking.payment_status !== 'failed'

              return (
                <div key={booking.id} className={`rounded-2xl border overflow-hidden transition-all ${isPast ? 'border-white/5 opacity-80' : 'border-white/10'}`} style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {/* Card header */}
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Room image */}
                      <div className="relative w-20 h-14 rounded-xl overflow-hidden flex-shrink-0">
                        {booking.room?.featured_image ? (
                          <Image src={booking.room.featured_image} alt={booking.room.name || 'Room'} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl" style={{ background: 'rgba(255,255,255,0.06)' }}>🏔️</div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <h3 className="text-white font-semibold">{booking.room?.name || 'Room'}</h3>
                            <p className="text-white/40 text-xs mt-0.5">
                              {new Date(booking.check_in + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {' → '}
                              {new Date(booking.check_out + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {' · '}{booking.nights} night{booking.nights > 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-[#c9a14a] font-bold text-lg">₹{booking.total_amount.toLocaleString()}</div>
                            <div className="text-white/30 text-xs">Total paid</div>
                          </div>
                        </div>

                        {/* Status badges */}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[booking.booking_status] || 'bg-white/10 text-white/50'}`}>
                            {booking.booking_status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${PAY_STYLE[booking.payment_status] || 'bg-white/10 text-white/50'}`}>
                            {booking.payment_status === 'fully_paid' ? 'Paid' : booking.payment_status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                          {booking.promo_code && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-[#c9a14a]/15 text-[#c9a14a] border border-[#c9a14a]/20">
                              🎁 {booking.promo_code}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action row */}
                    <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-white/8">
                      <button onClick={() => setExpanded(isExpanded ? null : booking.id)}
                        className="text-xs font-semibold transition-colors hover:text-[#c9a14a]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {isExpanded ? '▲ Less details' : '▼ View details'}
                      </button>
                      <div className="flex gap-2">
                        {canDownload && (
                          <button onClick={() => downloadReceipt(booking)} disabled={downloading === booking.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                            style={{ background: 'rgba(201,161,74,0.12)', border: '1px solid rgba(201,161,74,0.25)', color: '#c9a14a' }}>
                            {downloading === booking.id ? (
                              <><span className="w-3.5 h-3.5 border border-[#c9a14a]/50 border-t-[#c9a14a] rounded-full animate-spin" />Generating...</>
                            ) : (
                              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Receipt / Invoice</>
                            )}
                          </button>
                        )}
                        <a href={`https://wa.me/919368080535?text=Hi,%20I%20have%20a%20query%20about%20booking%20ID%20${booking.id.slice(0, 8).toUpperCase()}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          Help
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 border-t border-white/5">
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <h4 className="text-white/50 text-xs uppercase tracking-wider font-semibold mb-2">Stay Details</h4>
                          {[
                            ['Rooms', `${booking.rooms_booked} room${booking.rooms_booked > 1 ? 's' : ''}`],
                            ['Guests', `${booking.adults} adult${booking.adults > 1 ? 's' : ''}`],
                            ['Meal Plan', `${booking.meal_plan} — ${MEAL_LABELS[booking.meal_plan] || booking.meal_plan}`],
                            booking.special_requests ? ['Special Request', booking.special_requests] : null,
                          ].filter(Boolean).map(([l, v]) => (
                            <div key={String(l)} className="flex justify-between gap-4">
                              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{l}</span>
                              <span className="text-white text-right text-xs">{v}</span>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-white/50 text-xs uppercase tracking-wider font-semibold mb-2">Payment Details</h4>
                          {[
                            ['Booking ID', booking.id.slice(0, 8).toUpperCase() + '...'],
                            booking.razorpay_payment_id ? ['Payment ID', booking.razorpay_payment_id.slice(0, 16) + '...'] : null,
                            booking.promo_code ? ['Promo Code', booking.promo_code] : null,
                            booking.discount_amount > 0 ? ['Discount', `−₹${booking.discount_amount.toLocaleString()}`] : null,
                            ['Total Amount', `₹${booking.total_amount.toLocaleString()}`],
                            ['Booked On', new Date(booking.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
                          ].filter(Boolean).map(([l, v]) => (
                            <div key={String(l)} className="flex justify-between gap-4">
                              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{l}</span>
                              <span className="text-white text-right text-xs font-mono">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}