'use client'

import { formatCurrency } from '@/lib/utils'

type DateCellProps = {
  date: string
  dayNumber: number
  inCurrentMonth: boolean
  isSelected: boolean
  isEditable: boolean
  priceType?: 'lwweb' | 'ota'
  pricing?: {
    base_price: number
    extra_bed_price: number
    child_price: number
  }
  onMouseDown?: (date: string) => void
  onMouseEnter?: (date: string) => void
}

export default function DateCell({
  date,
  dayNumber,
  inCurrentMonth,
  isSelected,
  isEditable,
  priceType = 'lwweb',
  pricing,
  onMouseDown,
  onMouseEnter,
}: DateCellProps) {
  const hasPrice = Boolean(pricing && pricing.base_price > 0)
  const tooltip = pricing
    ? `${date}\nBase: ${formatCurrency(pricing.base_price)}\nExtra bed: ${formatCurrency(pricing.extra_bed_price || 0)}\nChild: ${formatCurrency(pricing.child_price || 0)}`
    : `${date}\nNo price set`

  const pricedClass =
    priceType === 'ota'
      ? 'border-purple-500/25 bg-purple-500/12 text-purple-100'
      : 'border-blue-500/25 bg-blue-500/12 text-blue-100'

  const dotClass =
    priceType === 'ota'
      ? 'bg-purple-400'
      : 'bg-blue-400'

  const stateClass = isSelected
    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
    : hasPrice
      ? pricedClass
      : 'border-white/10 bg-white/5 text-white/55'

  const interactivityClass = isEditable ? 'cursor-pointer hover:bg-white/10' : 'cursor-not-allowed opacity-70'

  return (
    <button
      type="button"
      title={tooltip}
      onMouseDown={isEditable ? () => onMouseDown?.(date) : undefined}
      onMouseEnter={isEditable ? () => onMouseEnter?.(date) : undefined}
      className={[
        'min-h-[112px] rounded-2xl border p-3 text-left transition-all select-none',
        stateClass,
        interactivityClass,
        !inCurrentMonth ? 'opacity-45' : '',
      ].join(' ')}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{dayNumber}</span>
        <span className={['h-2.5 w-2.5 rounded-full', hasPrice ? dotClass : 'bg-white/20'].join(' ')} />
      </div>

      {hasPrice ? (
        <div className="space-y-1">
          <p className="text-sm font-bold">{formatCurrency(pricing.base_price)}</p>
          <p className="text-[11px] text-white/50">{priceType.toUpperCase()} EP base</p>
        </div>
      ) : (
        <p className="text-xs text-white/35">No price</p>
      )}
    </button>
  )
}
