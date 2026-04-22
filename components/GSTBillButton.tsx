// components/GSTBillButton.tsx
'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function GSTBillButton({ booking, disabled, primary }: { booking: any; disabled?: boolean; primary?: boolean }) {
  const [generating, setGenerating] = useState(false)

  async function downloadBill() {
    if (booking.payment_status !== 'fully_paid') {
      toast.error('GST bill sirf fully paid bookings ke liye generate hoti hai')
      return
    }
    setGenerating(true)
    try {
      const { generateBookingReceipt } = await import('@/lib/booking-receipt-generator')
      generateBookingReceipt(booking)
      toast.success('Invoice opened successfully')
    } catch (e) {
      console.error(e)
      toast.error('Bill generate nahi hui')
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
