import { NextResponse } from 'next/server'
import { getSupabaseAdmin, hasSupabaseServerEnv } from '@/lib/supabaseServer'

export const revalidate = 300

export async function GET() {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ reviews: [] })
    }

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

    return NextResponse.json(
      { reviews },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error: any) {
    console.error('Reviews fetch error:', error)
    return NextResponse.json({ error: 'Failed to load reviews' }, { status: 500 })
  }
}
