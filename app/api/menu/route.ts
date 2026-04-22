import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

function normalizeItem(item: any) {
  return {
    id: item.id,
    name: item.name,
    categoryId: item.section_id,
    unit: item.unit || item.portion_label || '',
    price: Number(item.price || 0),
    discountPrice: item.discount_price == null ? null : Number(item.discount_price),
    isActive: Boolean(item.is_active),
    showOnWebsite: Boolean(item.is_visible_on_website),
    description: item.description || '',
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const [{ data: settings, error: settingsError }, { data: categories, error: categoriesError }, { data: items, error: itemsError }] =
      await Promise.all([
        supabase.from('restaurant_menu_settings').select('*').eq('key', 'primary').single(),
        supabase
          .from('restaurant_menu_sections')
          .select('id, name, slug, description, website_heading, sort_order, is_active')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('restaurant_menu_items')
          .select('*')
          .eq('is_active', true)
          .eq('is_visible_on_website', true)
          .eq('is_veg', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
      ])

    if (settingsError && settingsError.code !== 'PGRST116') throw settingsError
    if (categoriesError) throw categoriesError
    if (itemsError) throw itemsError

    const normalizedCategories = (categories || [])
      .map((category: any) => {
        const categoryItems = (items || [])
          .filter((item: any) => item.section_id === category.id && item.is_visible_on_website === true && item.is_active === true)
          .map(normalizeItem)

        return {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description || '',
          websiteHeading: category.website_heading || category.name,
          items: categoryItems,
        }
      })
      .filter((category) => category.items.length > 0)

    return NextResponse.json({
      success: true,
      settings: {
        showPricesOnWebsite: Boolean(settings?.show_prices_on_website),
        showNonVeg: Boolean(settings?.show_non_veg),
        menuNote: settings?.menu_note || '',
      },
      categories: normalizedCategories,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to load menu' }, { status: 500 })
  }
}
