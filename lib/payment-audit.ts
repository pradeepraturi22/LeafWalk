import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { logError } from '@/lib/logger'

type PaymentAuditInput = {
  eventType: string
  status: 'info' | 'success' | 'warning' | 'failed'
  source: string
  bookingId?: string | null
  orderId?: string | null
  paymentId?: string | null
  amount?: number | null
  currency?: string | null
  requestId?: string | null
  message?: string | null
  payload?: Record<string, unknown> | null
}

export async function logPaymentAudit(input: PaymentAuditInput) {
  try {
    await getSupabaseAdmin().from('payment_audit_logs').insert({
      booking_id: input.bookingId || null,
      razorpay_order_id: input.orderId || null,
      razorpay_payment_id: input.paymentId || null,
      event_type: input.eventType,
      status: input.status,
      source: input.source,
      request_id: input.requestId || null,
      amount: typeof input.amount === 'number' ? input.amount : null,
      currency: input.currency || null,
      message: input.message || null,
      payload_json: input.payload || null,
      created_at: new Date().toISOString(),
    } as any)
  } catch (error) {
    logError('Failed to write payment audit log:', error)
  }
}
