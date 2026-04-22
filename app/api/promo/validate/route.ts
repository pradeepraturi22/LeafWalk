// app/api/promo/validate/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { formatDate } from '@/lib/utils'
import { logError } from '@/lib/logger'
import { parseJsonBody } from '@/lib/security'

const promoSchema = z.object({
  code: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9_-]+$/),
  room_category: z.enum(['deluxe', 'premium']),
  nights: z.coerce.number().int().min(1).max(4),
  base_amount: z.coerce.number().positive().max(1000000),
})

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, promoSchema)
  if (!parsed.success) {
    return parsed.response
  }

  try {
    const supabase = getSupabaseAdmin()
    const { code, room_category, nights, base_amount } = parsed.data

    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

    // Fetch offer
    const { data: offer, error } = await supabase
      .from('offers')
      .select('id,title,code,discount_type,discount_value,valid_from,valid_until,min_nights,max_uses,used_count,applicable_categories,is_active,max_discount_amount')
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
      return NextResponse.json({ valid: false, error: `This code is valid from ${formatDate(offer.valid_from)}` }, { status: 200 })
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
    logError('Promo validation error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
