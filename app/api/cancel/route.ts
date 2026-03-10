// app/api/bookings/cancel/route.ts
// Called by client when payment is cancelled/failed — uses service role to update status

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const { booking_id } = await request.json()
    if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

    await supabaseAdmin
      .from('bookings')
      .update({ booking_status: 'cancelled', payment_status: 'failed' } as any)
      .eq('id', booking_id)
      .in('booking_status', ['pending']) // only cancel if still pending

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}