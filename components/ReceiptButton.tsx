'use client'
// components/ReceiptButton.tsx
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function ReceiptButton({ booking }: { booking: any }) {
  const [generating, setGenerating] = useState(false)

  async function openReceipt() {
    setGenerating(true)
    try {
      const { generateBookingReceipt } = await import('@/lib/booking-receipt-generator')
      generateBookingReceipt(booking)
      toast.success('Receipt opened — Print ya PDF save karo (Ctrl+P)')
    } catch (e) {
      console.error(e)
      toast.error('Receipt generate nahi hui')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <button
      type="button"
      onClick={openReceipt}
      disabled={generating}
      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 cursor-pointer disabled:opacity-50"
    >
      {generating
        ? <><span className="animate-spin inline-block">⟳</span> Generating...</>
        : <><span>🧾</span> Download Receipt</>
      }
    </button>
  )
}
