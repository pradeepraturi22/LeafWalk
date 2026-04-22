import { NextRequest, NextResponse } from 'next/server'
import { requireInternalSecret } from '@/lib/internal-auth'
import { reconcileBookingById } from '@/lib/payment-recovery'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

async function loadCandidateBookingIds(limit: number) {
  const { data } = await getSupabaseAdmin()
    .from('bookings')
    .select('id')
    .not('razorpay_order_id', 'is', null)
    .in('payment_status', ['pending', 'payment_processing'])
    .order('updated_at', { ascending: true })
    .limit(limit) as any

  return (data || []).map((row: any) => row.id).filter(Boolean)
}

export async function POST(request: NextRequest) {
  const unauthorized = requireInternalSecret(request)
  if (unauthorized) return unauthorized

  let body: any = {}
  try {
    body = await request.json()
  } catch {}

  const explicitBookingId = typeof body?.booking_id === 'string' ? body.booking_id : null
  const limit = Math.min(Math.max(Number(body?.limit || 25), 1), 100)
  const bookingIds = explicitBookingId ? [explicitBookingId] : await loadCandidateBookingIds(limit)

  const results = []
  for (const bookingId of bookingIds) {
    const result = await reconcileBookingById(bookingId)
    results.push({
      booking_id: bookingId,
      code: result.code,
      ok: result.ok,
      message: result.message,
      payment_status: result.booking?.payment_status || null,
      booking_status: result.booking?.booking_status || null,
    })
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
  })
}
