'use client'

import { useEffect, useState } from 'react'

type BulkEditModalProps = {
  open: boolean
  dates: string[]
  title?: string
  subtitle?: string
  initialValues?: {
    base_price?: number
    extra_bed_price?: number
    child_price?: number
  }
  onClose: () => void
  onSave: (payload: { base_price: number; extra_bed_price: number; child_price: number }) => Promise<void> | void
}

const INPUT_CLASS =
  'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#c9a14a] focus:outline-none'

export default function BulkEditModal({
  open,
  dates,
  title,
  subtitle,
  initialValues,
  onClose,
  onSave,
}: BulkEditModalProps) {
  const [basePrice, setBasePrice] = useState('')
  const [extraBedPrice, setExtraBedPrice] = useState('')
  const [childPrice, setChildPrice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setBasePrice(initialValues?.base_price ? String(initialValues.base_price) : '')
    setExtraBedPrice(initialValues?.extra_bed_price ? String(initialValues.extra_bed_price) : '0')
    setChildPrice(initialValues?.child_price ? String(initialValues.child_price) : '0')
  }, [open, initialValues])

  if (!open) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsedBase = Number(basePrice)
    const parsedExtra = Number(extraBedPrice || 0)
    const parsedChild = Number(childPrice || 0)

    if (!Number.isFinite(parsedBase) || parsedBase <= 0) return

    setSaving(true)
    try {
      await onSave({
        base_price: parsedBase,
        extra_bed_price: Math.max(0, parsedExtra),
        child_price: Math.max(0, parsedChild),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111111] p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-playfair text-2xl text-white">
              {title || (dates.length > 1 ? 'Bulk Pricing Update' : 'Set Date Price')}
            </h3>
            <p className="mt-1 text-sm text-white/45">
              {subtitle || (dates.length > 1 ? `${dates.length} dates selected` : dates[0])}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/45">
              Base Price (EP)
            </label>
            <input
              type="number"
              min={1}
              value={basePrice}
              onChange={(event) => setBasePrice(event.target.value)}
              className={INPUT_CLASS}
              placeholder="e.g. 3800"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/45">
                Extra Bed Price
              </label>
              <input
                type="number"
                min={0}
                value={extraBedPrice}
                onChange={(event) => setExtraBedPrice(event.target.value)}
                className={INPUT_CLASS}
                placeholder="e.g. 1300"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/45">
                Child Price
              </label>
              <input
                type="number"
                min={0}
                value={childPrice}
                onChange={(event) => setChildPrice(event.target.value)}
                className={INPUT_CLASS}
                placeholder="e.g. 600"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-white/55">
            {dates.length > 1 ? (
              <div className="space-y-1">
                <p className="font-medium text-white/80">Selected range</p>
                <p>{dates[0]} to {dates[dates.length - 1]}</p>
              </div>
            ) : (
              <p>Set exact date-wise EP base pricing for the selected day.</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] px-5 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : dates.length > 1 ? 'Save All Dates' : 'Save Price'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
