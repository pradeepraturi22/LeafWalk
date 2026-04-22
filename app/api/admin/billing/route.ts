import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

async function requireStaff(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !user) return null
  const { data } = await getSupabaseAdmin().from('users').select('role').eq('id', user.id).single() as any
  if (!data || !['admin', 'manager'].includes(data.role)) return null
  return user
}

export async function GET(request: NextRequest) {
  const staff = await requireStaff(request)
  if (!staff) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('restaurant_bills')
      .select('*, items:restaurant_bill_items(*)')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return NextResponse.json({ success: true, bills: data || [] })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to load bills' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const staff = await requireStaff(request)
  if (!staff) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const customerName = String(body.customerName || '').trim()
    const mobile = String(body.mobile || '').trim()
    const tableNo = String(body.tableNo || '').trim() || null
    const items = Array.isArray(body.items) ? body.items : []

    if (!customerName) {
      return NextResponse.json({ success: false, error: 'Customer name is required' }, { status: 400 })
    }

    if (!items.length) {
      return NextResponse.json({ success: false, error: 'At least one item is required' }, { status: 400 })
    }

    const normalizedItems = items.map((item: any) => {
      const quantity = Number(item.quantity || 0)
      const price = Number(item.price || 0)
      if (!item.itemId || !item.name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
        throw new Error('Invalid billing item payload')
      }
      return {
        item_id: item.itemId,
        item_name: item.name,
        quantity,
        price,
        total: quantity * price,
        unit: item.unit || null,
      }
    })

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.total, 0)
    const gst = Number(((subtotal * 5) / 100).toFixed(2))
    const grandTotal = Number((subtotal + gst).toFixed(2))

    const { data: bill, error: billError } = await getSupabaseAdmin()
      .from('restaurant_bills')
      .insert({
        customer_name: customerName,
        mobile: mobile || null,
        table_no: tableNo,
        subtotal,
        gst,
        grand_total: grandTotal,
        created_by: staff.id,
      })
      .select('*')
      .single()

    if (billError) throw billError

    const { error: itemError } = await getSupabaseAdmin()
      .from('restaurant_bill_items')
      .insert(
        normalizedItems.map((item) => ({
          bill_id: bill.id,
          item_id: item.item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.price,
          line_total: item.total,
          unit: item.unit,
        }))
      )

    if (itemError) throw itemError

    return NextResponse.json({
      success: true,
      message: 'Bill created successfully',
      bill: {
        ...bill,
        items: normalizedItems.map((item) => ({
          itemId: item.item_id,
          name: item.item_name,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          unit: item.unit,
        })),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to create bill' }, { status: 500 })
  }
}
