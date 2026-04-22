'use client'

// components/ReceiptButton.tsx
import { useState } from 'react'
import toast from 'react-hot-toast'

type ReceiptButtonVariant = 'receipt' | 'check_in_pass'

export default function ReceiptButton({
  booking,
  variant = 'receipt',
  compact = false,
}: {
  booking: any
  variant?: ReceiptButtonVariant
  compact?: boolean
}) {
  const [generating, setGenerating] = useState(false)
  const isCheckInPass = variant === 'check_in_pass'

  async function openReceipt() {
    setGenerating(true)
    try {
      const { generateBookingReceipt, generateCheckInPass } = await import('@/lib/booking-receipt-generator')
      if (isCheckInPass) {
        generateCheckInPass(booking)
        toast.success('Check In Pass opened')
      } else {
        generateBookingReceipt(booking)
        toast.success('Receipt opened')
      }
    } catch (error) {
      console.error(error)
      toast.error(isCheckInPass ? 'Check In Pass generate nahi hua' : 'Receipt generate nahi hui')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <button
      type="button"
      onClick={openReceipt}
      disabled={generating}
      className={`flex items-center justify-center gap-2 rounded-lg font-semibold transition-all border cursor-pointer disabled:opacity-50 ${
        compact ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'
      } ${
        isCheckInPass
          ? 'bg-[#c9a14a]/20 hover:bg-[#c9a14a]/30 text-[#f6d98b] border-[#c9a14a]/35'
          : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30'
      }`}
    >
      {generating ? (
        <>
          <span className="animate-spin inline-block">...</span> Generating...
        </>
      ) : isCheckInPass ? (
        <>
          <span>Pass</span> {compact ? 'Pass' : 'Check In Pass'}
        </>
      ) : (
        <>
          <span>Receipt</span> Download Receipt
        </>
      )}
    </button>
  )
}
