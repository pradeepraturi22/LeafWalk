// components/GSTBillButton.tsx
'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'

export default function GSTBillButton({ booking, disabled, primary }: { booking: any; disabled?: boolean; primary?: boolean }) {
  const [generating, setGenerating] = useState(false)

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  async function downloadBill() {
    if (booking.payment_status !== 'fully_paid') {
      toast.error('GST bill sirf fully paid bookings ke liye generate hoti hai')
      return
    }
    setGenerating(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/invoice/${booking.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const result = await res.json().catch(() => null)
        throw new Error(result?.error || 'Invoice generate nahi hui')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `leafwalk-gst-invoice-${booking.invoice_number || booking.booking_number || booking.id}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Invoice downloaded successfully')
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Bill generate nahi hui')
    } finally {
      setGenerating(false)
    }
  }

  const canGenerate = booking?.payment_status === 'fully_paid'

  return (
    <div>
      <button
        type="button"
        onClick={downloadBill}
        disabled={disabled || generating || !canGenerate}
        title={!canGenerate ? 'Only available after full payment' : 'Generate invoice'}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all
          ${canGenerate
            ? primary
              ? 'bg-[#c9a14a] hover:opacity-90 text-black border border-[#c9a14a] cursor-pointer'
              : 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 cursor-pointer'
            : 'bg-white/5 text-white/25 border border-white/10 cursor-not-allowed'
          }`}
      >
        {generating
          ? <><span className="animate-spin inline-block">⟳</span> Generating...</>
          : <><span>📄</span> {canGenerate ? 'Generate Invoice' : 'Invoice (After Full Payment)'}</>
        }
      </button>
      {!canGenerate && (
        <p className="text-white/30 text-xs mt-1.5">Payment fully paid mark karne ke baad available hogi</p>
      )}
    </div>
  )
}
