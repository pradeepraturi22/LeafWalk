// app/api/promo/validate/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseServer'

export async function POST(req: Request) {
  try {
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

    const { code, room_category, nights, base_amount } = body

    if (!code || typeof code !== 'string' || code.length > 30) {
      return NextResponse.json({ error: 'Invalid promo code format' }, { status: 400 })
    }
    if (!nights || nights < 1) {
      return NextResponse.json({ error: 'Select your dates before applying a promo code' }, { status: 400 })
    }

    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

    // Fetch offer
    const { data: offer, error } = await supabase
      .from('offers')
      .select('*')
      .eq('code', cleanCode)
      .single() as any

    if (error || !offer) {
      return NextResponse.json({ valid: false, error: 'Promo code not found' }, { status: 200 })
    }
    if (!offer.is_active) {
      return NextResponse.json({ valid: false, error: 'This promo code is no longer active' }, { status: 200 })
    }

    const today = new Date().toISOString().split('T')[0]
    if (offer.valid_from > today) {
      return NextResponse.json({ valid: false, error: `This code is valid from ${new Date(offer.valid_from).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}` }, { status: 200 })
    }
    if (offer.valid_until < today) {
      return NextResponse.json({ valid: false, error: 'This promo code has expired' }, { status: 200 })
    }
    if (nights < offer.min_nights) {
      return NextResponse.json({ valid: false, error: `This code requires a minimum stay of ${offer.min_nights} nights` }, { status: 200 })
    }
    if (offer.max_uses !== null && offer.used_count >= offer.max_uses) {
      return NextResponse.json({ valid: false, error: 'This promo code has reached its maximum usage limit' }, { status: 200 })
    }
    if (offer.applicable_categories?.length > 0 && !offer.applicable_categories.includes(room_category)) {
      const catList = offer.applicable_categories.join(' or ')
      return NextResponse.json({ valid: false, error: `This code is only valid for ${catList} rooms` }, { status: 200 })
    }

    // Calculate discount — schema uses discount_type + discount_value
    let discountRaw = 0
    let displayMsg = ''
    if (offer.discount_type === 'percentage') {
      discountRaw = Math.round(base_amount * (offer.discount_value / 100))
      displayMsg = `${offer.discount_value}% off applied`
    } else {
      discountRaw = offer.discount_value  // fixed amount
      displayMsg = `₹${offer.discount_value} off applied`
    }
    const discount = offer.max_discount_amount ? Math.min(discountRaw, offer.max_discount_amount) : discountRaw

    return NextResponse.json({
      valid: true,
      offer_id: offer.id,
      code: cleanCode,
      title: offer.title,
      discount_type: offer.discount_type,
      discount_value: offer.discount_value,
      discount_percentage: offer.discount_type === 'percentage' ? offer.discount_value : 0,
      discount_amount: discount,
      max_discount_amount: offer.max_discount_amount,
      message: displayMsg + (offer.max_discount_amount ? ` (max ₹${offer.max_discount_amount.toLocaleString()})` : ''),
    })
  } catch (err) {
    console.error('Promo validation error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}