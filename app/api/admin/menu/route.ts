import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !user) return null
  const { data } = await getSupabaseAdmin().from('users').select('role').eq('id', user.id).single() as any
  if (!data || !['admin', 'manager'].includes(data.role)) return null
  return user
}

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
    itemCode: item.item_code || '',
    sortOrder: Number(item.sort_order || 0),
    isVeg: Boolean(item.is_veg),
  }
}

function normalizeCategory(category: any, items: any[] = []) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description || '',
    websiteHeading: category.website_heading || category.name,
    sortOrder: Number(category.sort_order || 0),
    isActive: Boolean(category.is_active),
    items: items.map(normalizeItem),
  }
}

async function ensureCategoryExists(categoryId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('restaurant_menu_sections')
    .select('id, name, slug, description, website_heading, sort_order, is_active')
    .eq('id', categoryId)
    .single()

  if (error || !data) {
    throw new Error('Selected category does not exist')
  }

  return data
}

function validatePrice(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error('Price must be a valid number')
  }
  return numeric
}

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const itemId = searchParams.get('itemId')
    const supabase = getSupabaseAdmin()

    const { data: settings, error: settingsError } = await supabase
      .from('restaurant_menu_settings')
      .select('*')
      .eq('key', 'primary')
      .single()

    if (settingsError && settingsError.code !== 'PGRST116') throw settingsError

    if (itemId) {
      const { data: item, error } = await supabase
        .from('restaurant_menu_items')
        .select('*')
        .eq('id', itemId)
        .single()

      if (error || !item) {
        return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        settings,
        item: normalizeItem(item),
      })
    }

    if (categoryId) {
      const category = await ensureCategoryExists(categoryId)
      const { data: items, error } = await supabase
        .from('restaurant_menu_items')
        .select('*')
        .eq('section_id', categoryId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error

      return NextResponse.json({
        success: true,
        settings,
        category: normalizeCategory(category, items || []),
      })
    }

    const [{ data: categories, error: categoriesError }, { data: counts, error: countsError }] = await Promise.all([
      supabase
        .from('restaurant_menu_sections')
        .select('id, name, slug, description, website_heading, sort_order, is_active')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('restaurant_menu_items')
        .select('section_id'),
    ])

    if (categoriesError) throw categoriesError
    if (countsError) throw countsError

    const itemCountByCategory = (counts || []).reduce<Record<string, number>>((acc, row: any) => {
      acc[row.section_id] = (acc[row.section_id] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      settings: settings || {
        show_prices_on_website: false,
        show_non_veg: false,
        menu_note: '',
      },
      categories: (categories || []).map((category: any) => ({
        ...normalizeCategory(category),
        itemCount: itemCountByCategory[category.id] || 0,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to load menu' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { entity } = body
    const supabase = getSupabaseAdmin()

    if (entity === 'settings') {
      const payload = {
        key: 'primary',
        show_prices_on_website: Boolean(body.show_prices_on_website),
        show_non_veg: Boolean(body.show_non_veg),
        menu_note: body.menu_note || null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('restaurant_menu_settings').upsert(payload, { onConflict: 'key' })
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Menu settings updated' })
    }

    if (entity === 'category') {
      if (!String(body.name || '').trim()) {
        return NextResponse.json({ success: false, error: 'Category name is required' }, { status: 400 })
      }

      const payload = {
        name: String(body.name).trim(),
        slug: String(body.slug || body.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        description: body.description || null,
        sort_order: Number(body.sort_order || 0),
        is_active: body.is_active !== false,
        website_heading: body.website_heading || body.name,
        created_by: user.id,
      }

      const { data, error } = await supabase.from('restaurant_menu_sections').insert(payload).select('*').single()
      if (error) throw error

      return NextResponse.json({ success: true, message: 'Category created', category: normalizeCategory(data) })
    }

    if (entity === 'item') {
      if (!String(body.name || '').trim()) {
        return NextResponse.json({ success: false, error: 'Item name is required' }, { status: 400 })
      }

      const category = await ensureCategoryExists(String(body.categoryId || body.section_id || ''))
      const price = validatePrice(body.price)
      const discountPrice = body.discountPrice === '' || body.discountPrice == null ? null : validatePrice(body.discountPrice)

      const payload = {
        section_id: category.id,
        name: String(body.name).trim(),
        description: body.description || null,
        portion_label: body.unit || body.portion_label || null,
        unit: body.unit || body.portion_label || null,
        price,
        discount_price: discountPrice,
        item_code: body.itemCode || body.item_code || null,
        sort_order: Number(body.sortOrder || body.sort_order || 0),
        is_active: body.isActive !== false && body.is_active !== false,
        is_veg: body.isVeg !== false && body.is_veg !== false,
        is_visible_on_website: body.showOnWebsite !== false && body.is_visible_on_website !== false,
        created_by: user.id,
      }

      const { data, error } = await supabase.from('restaurant_menu_items').insert(payload).select('*').single()
      if (error) throw error

      return NextResponse.json({ success: true, message: 'Item created', item: normalizeItem(data) })
    }

    return NextResponse.json({ success: false, error: 'Invalid entity' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to save menu data' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin(request)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { entity, id } = body
    const supabase = getSupabaseAdmin()

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 })
    }

    if (entity === 'category') {
      if (!String(body.name || '').trim()) {
        return NextResponse.json({ success: false, error: 'Category name is required' }, { status: 400 })
      }

      const payload = {
        name: String(body.name).trim(),
        slug: String(body.slug || body.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        description: body.description || null,
        website_heading: body.website_heading || body.name,
        sort_order: Number(body.sort_order || 0),
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }

      const { error } = await supabase.from('restaurant_menu_sections').update(payload).eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Category updated' })
    }

    if (entity === 'item') {
      if (!String(body.name || '').trim()) {
        return NextResponse.json({ success: false, error: 'Item name is required' }, { status: 400 })
      }

      const category = await ensureCategoryExists(String(body.categoryId || body.section_id || ''))
      const price = validatePrice(body.price)
      const discountPrice = body.discountPrice === '' || body.discountPrice == null ? null : validatePrice(body.discountPrice)

      const payload = {
        section_id: category.id,
        name: String(body.name).trim(),
        description: body.description || null,
        portion_label: body.unit || body.portion_label || null,
        unit: body.unit || body.portion_label || null,
        price,
        discount_price: discountPrice,
        item_code: body.itemCode || body.item_code || null,
        sort_order: Number(body.sortOrder || body.sort_order || 0),
        is_active: body.isActive !== false && body.is_active !== false,
        is_veg: body.isVeg !== false && body.is_veg !== false,
        is_visible_on_website: body.showOnWebsite !== false && body.is_visible_on_website !== false,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }

      const { error } = await supabase.from('restaurant_menu_items').update(payload).eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Item updated' })
    }

    return NextResponse.json({ success: false, error: 'Invalid entity' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to update menu data' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireAdmin(request)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const entity = searchParams.get('entity')
    const id = searchParams.get('id')
    const supabase = getSupabaseAdmin()

    if (!entity || !id) {
      return NextResponse.json({ success: false, error: 'entity and id required' }, { status: 400 })
    }

    if (entity === 'category') {
      const { data: existingItems, error: itemError } = await supabase
        .from('restaurant_menu_items')
        .select('id')
        .eq('section_id', id)

      if (itemError) throw itemError
      if ((existingItems || []).length > 0) {
        return NextResponse.json({
          success: false,
          error: `Cannot delete category while ${(existingItems || []).length} item(s) still exist in it`,
        }, { status: 409 })
      }

      const { error } = await supabase.from('restaurant_menu_sections').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Category deleted' })
    }

    if (entity === 'item') {
      const { error } = await supabase.from('restaurant_menu_items').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Item deleted' })
    }

    return NextResponse.json({ success: false, error: 'Invalid entity' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete menu data' }, { status: 500 })
  }
}
