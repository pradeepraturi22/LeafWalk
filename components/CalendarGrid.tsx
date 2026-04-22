'use client'

import DateCell from '@/components/DateCell'

type CalendarDay = {
  date: string
  dayNumber: number
  inCurrentMonth: boolean
}

type PricingValue = {
  base_price: number
  extra_bed_price: number
  child_price: number
}

type CalendarGridProps = {
  days: CalendarDay[]
  selectedDates: string[]
  pricing: Record<string, PricingValue>
  priceType: 'lwweb' | 'ota'
  editable: boolean
  loading?: boolean
  isDateEditable?: (date: string, inCurrentMonth: boolean) => boolean
  onDateMouseDown: (date: string) => void
  onDateMouseEnter: (date: string) => void
  onDateClick: (date: string) => void
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarGrid({
  days,
  selectedDates,
  pricing,
  priceType,
  editable,
  loading,
  isDateEditable,
  onDateMouseDown,
  onDateMouseEnter,
  onDateClick,
}: CalendarGridProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-4 grid grid-cols-7 gap-3">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="px-2 text-center text-xs font-semibold uppercase tracking-[0.24em] text-white/30">
            {day}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex h-[420px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#c9a14a] border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {days.map((day) => (
            <div
              key={day.date}
              onClick={() => {
                const editableForDay = isDateEditable ? isDateEditable(day.date, day.inCurrentMonth) : editable && day.inCurrentMonth
                if (editableForDay) onDateClick(day.date)
              }}
            >
              <DateCell
                date={day.date}
                dayNumber={day.dayNumber}
                inCurrentMonth={day.inCurrentMonth}
                isSelected={selectedDates.includes(day.date)}
                isEditable={isDateEditable ? isDateEditable(day.date, day.inCurrentMonth) : editable && day.inCurrentMonth}
                pricing={pricing[day.date]}
                priceType={priceType}
                onMouseDown={onDateMouseDown}
                onMouseEnter={onDateMouseEnter}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
