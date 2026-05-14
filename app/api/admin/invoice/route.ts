import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateReceiptAttachment } from '@/lib/email-service'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { isLocalTestMode } from '@/lib/runtime-mode'
import { logError } from '@/lib/logger'
import { buildGSTBillHtml } from '@/lib/gst-bill-generator'

export const runtime = 'nodejs'

const schema = z.object({
  booking_id: z.string().uuid(),
  output: z.enum(['pdf', 'html']).optional(),
})

function getJwtSubjectForLocalFallback(token: string) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    const parsed = JSON.parse(decoded)
    return typeof parsed.sub === 'string' ? parsed.sub : null
  } catch {
    return null
  }
}

async function requireAdmin(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return null

  let userId: string | null = null
  try {
    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
    if (error || !user) return null
    userId = user.id
  } catch (error) {
    if (!isLocalTestMode()) return null
    userId = getJwtSubjectForLocalFallback(token)
    logError('LOCAL TEST MODE invoice POST auth.getUser failed; using local JWT subject fallback', error)
  }

  if (!userId) return null
  const { data: u } = await getSupabaseAdmin().from('users').select('role').eq('id', userId).single() as any
  if (!u || !['admin', 'manager'].includes(u.role)) return null
  return { userId, role: u.role }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid booking_id is required' }, { status: 400 })
    }

    const { booking_id, output = 'pdf' } = parsed.data

    const { data: booking, error } = await getSupabaseAdmin()
      .from('bookings')
      .select(`
        id, booking_number, invoice_number, guest_name, guest_email, guest_phone, guest_phone_country,
        guest_address, guest_district, guest_state, guest_country,
        check_in, check_out, nights, rooms_booked, adults, children_5_to_12, children_below_5, extra_beds,
        meal_plan, total_amount, subtotal, cgst, sgst, gst_total, advance_amount, balance_amount,
        payment_method, payment_status, booking_status, booking_source, created_at, confirmed_at,
        gst_invoice_requested, gst_company_name, gst_number, gst_state,
        room:rooms(name, category),
        tour_operator_id,
        tour_operator:tour_operators(company_name, contact_person, email, cc_email, phone, gst_number, pan_number, address, city, state)
      `)
      .eq('id', booking_id)
      .single() as any

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.payment_status !== 'fully_paid') {
      return NextResponse.json({ error: 'Invoice can be generated only after full payment' }, { status: 400 })
    }

    if (output === 'html') {
      const html = buildGSTBillHtml(booking)
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    }

    const attachment = await generateReceiptAttachment(booking, { documentMode: 'invoice' })
    const content =
      typeof attachment.content === 'string'
        ? Buffer.from(attachment.content, 'base64')
        : Buffer.from(attachment.content)

    return new Response(new Uint8Array(content), {
      status: 200,
      headers: {
        'Content-Type': attachment.contentType || 'application/pdf',
        'Content-Disposition': `attachment; filename="${attachment.filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    logError('Admin invoice POST download failed', error)
    return NextResponse.json({ error: error?.message || 'Invoice generate nahi hui' }, { status: 500 })
  }
}
