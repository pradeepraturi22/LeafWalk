// app/api/payments/verify/route.ts
// Fixed: correct payment_status='fully_paid', increments promo used_count, logs to payments table
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin as supabase } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, booking_id } = await request.json()

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !booking_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // ── Verify Razorpay signature ────────────────────────────────────────────
    const generatedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (generatedSig !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // ── Fetch booking to get total & promo details ───────────────────────────
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, total_amount, promo_code, payment_status, booking_status')
      .eq('id', booking_id)
      .single() as any

    if (fetchErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Don't double-process
    if (booking.payment_status === 'fully_paid') {
      return NextResponse.json({ success: true, message: 'Already verified', booking })
    }

    // ── Update booking ───────────────────────────────────────────────────────
    const { data: updatedBooking, error: updateErr } = await supabase
      .from('bookings')
      .update({
        payment_status:      'fully_paid',   // ✅ correct enum value
        payment_method:      'razorpay',
        booking_status:      'confirmed',
        advance_amount:      booking.total_amount,
        balance_amount:      0,
        advance_paid_at:     new Date().toISOString(),
        payment_id:          razorpay_payment_id,
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        confirmed_at:        new Date().toISOString(),
        updated_at:          new Date().toISOString(),
      })
      .eq('id', booking_id)
      .select()
      .single() as any

    if (updateErr) {
      console.error('Booking update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update booking: ' + updateErr.message }, { status: 500 })
    }

    // ── Log to payments table ────────────────────────────────────────────────
    await supabase.from('payments').insert({
      booking_id,
      amount:              booking.total_amount,
      currency:            'INR',
      payment_type:        'full',
      payment_method:      'razorpay',
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      status:              'success',
    })

    // ── Increment promo used_count if a code was used ────────────────────────
    if (booking.promo_code) {
      const { data: offer } = await supabase
        .from('offers')
        .select('id, used_count')
        .eq('code', booking.promo_code)
        .single() as any

      if (offer) {
        await supabase.from('offers')
          .update({ used_count: (offer.used_count || 0) + 1, updated_at: new Date().toISOString() })
          .eq('id', offer.id)

        // Log promo usage
        await supabase.from('promo_code_usage').insert({
          offer_id:        offer.id,
          booking_id,
          guest_phone:     updatedBooking.guest_phone,
          guest_email:     updatedBooking.guest_email,
          discount_amount: updatedBooking.discount_amount || 0,
        })
      }
    }

    return NextResponse.json({ success: true, booking: updatedBooking, message: 'Payment verified successfully' })

  } catch (err: any) {
    console.error('Payment verify error:', err)
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 })
  }
}