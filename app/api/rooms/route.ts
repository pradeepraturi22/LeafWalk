import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('rooms')
      .select('id,name,slug,category,description,max_guests,max_extra_beds,total_rooms,amenities,images,featured_image,is_active,display_price_from,offer_label,offer_badge_text,offer_discount_percent,offer_is_active,offer_valid_until')
      .eq('is_active', true)
      .order('category')
      .order('display_price_from', { ascending: true }) as any

    if (error) {
      throw error
    }

    return NextResponse.json({ rooms: data || [] })
  } catch (error) {
    logError('Public rooms fetch failed:', error)
    return NextResponse.json({ error: 'Could not load rooms' }, { status: 500 })
  }
}
