'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'

export default function SendInvoiceButton({ booking, compact = false }: { booking: any; compact?: boolean }) {
  const [sending, setSending] = useState(false)
  const canSend = booking?.payment_status === 'fully_paid'

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  async function sendInvoice() {
    if (!canSend) {
      toast.error('Invoice sirf fully paid booking par send hogi')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/admin/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({
          type: 'send_invoice',
          booking_id: booking.id,
          channel: 'email',
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Invoice send failed')

      toast.success('GST invoice mail sent')
    } catch (error: any) {
      toast.error(error.message || 'Invoice send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={sendInvoice}
      disabled={sending || !canSend}
      title={!canSend ? 'Only available after full payment' : 'Send GST invoice by email'}
      className={`flex items-center justify-center gap-2 rounded-lg font-semibold transition-all border cursor-pointer disabled:opacity-50 ${
        compact ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'
      } ${
        canSend
          ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-400/30'
          : 'bg-white/5 text-white/25 border border-white/10 cursor-not-allowed'
      }`}
    >
      {sending ? (
        <>
          <span className="animate-spin inline-block">...</span> Sending...
        </>
      ) : (
        <>
          <span>Mail</span> Send Invoice
        </>
      )}
    </button>
  )
}
