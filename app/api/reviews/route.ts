import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('reviews')
      .select('id, rating, title, comment, reviewer_name, reviewer_image, created_at')
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(12)

    if (error) {
      throw error
    }

    const reviews = (data || []).map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      text: review.comment,
      name: review.reviewer_name || 'LeafWalk Guest',
      image: review.reviewer_image || null,
      created_at: review.created_at,
    }))

    return NextResponse.json({ reviews })
  } catch (error: any) {
    console.error('Reviews fetch error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load reviews' }, { status: 500 })
  }
}
