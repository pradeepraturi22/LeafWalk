import { NextResponse } from 'next/server'
import { getSupabaseAdmin, hasSupabaseServerEnv } from '@/lib/supabaseServer'
import { logError } from '@/lib/logger'
import { PUBLIC_ROOM_CATEGORIES } from '@/lib/room-categories'

export const revalidate = 300

export async function GET() {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ rooms: [] })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('rooms')
      .select('id,name,slug,category,description,max_guests,max_extra_beds,total_rooms,amenities,images,featured_image,is_active,display_price_from,offer_label,offer_badge_text,offer_discount_percent,offer_is_active,offer_valid_until')
      .eq('is_active', true)
      .in('category', [...PUBLIC_ROOM_CATEGORIES])
      .order('category')
      .order('display_price_from', { ascending: true }) as any

    if (error) {
      throw error
    }

    return NextResponse.json(
      { rooms: data || [] },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    logError('Public rooms fetch failed:', error)
    return NextResponse.json({ error: 'Could not load rooms' }, { status: 500 })
  }
}
