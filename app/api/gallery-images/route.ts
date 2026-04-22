import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('gallery_images')
      .select('id, title, description, image_url, category, is_featured, display_order')
      .order('is_featured', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ images: data || [] })
  } catch (error: any) {
    console.error('Gallery images fetch error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load gallery images' }, { status: 500 })
  }
}
