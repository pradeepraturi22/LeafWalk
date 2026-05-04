import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { isAdminRoomCategory } from '@/lib/room-categories'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomCategory = String(searchParams.get('room_category') || '').trim().toLowerCase()
    const rateType = String(searchParams.get('rate_type') || 'lwweb').trim().toLowerCase()
    const month = String(searchParams.get('month') || '').trim()

    if (!isAdminRoomCategory(roomCategory)) return NextResponse.json({ error: 'Valid room_category is required' }, { status: 400 })
    if (!['lwweb', 'ota'].includes(rateType)) return NextResponse.json({ error: 'rate_type must be lwweb or ota' }, { status: 400 })
    if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })

    const monthStart = `${month}-01`
    const [year, monthNumber] = month.split('-').map(Number)
    const nextMonth = monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${`${monthNumber + 1}`.padStart(2, '0')}-01`

    const { data, error } = await getSupabaseAdmin()
      .from('room_rates')
      .select('rate_date,base_price,extra_bed_price,child_price')
      .eq('room_category', roomCategory)
      .eq('rate_type', rateType)
      .gte('rate_date', monthStart)
      .lt('rate_date', nextMonth)
      .order('rate_date', { ascending: true }) as any

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      dates: (data || []).map((entry: any) => ({
        date: entry.rate_date,
        base_price: Number(entry.base_price || 0),
        extra_bed_price: Number(entry.extra_bed_price || 0),
        child_price: Number(entry.child_price || 0),
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
