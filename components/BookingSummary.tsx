'use client'

import Image from 'next/image'
import type { StayTariffNight } from '@/lib/public-tariff'
import { formatDate } from '@/lib/utils'

type RoomSummary = {
  name: string
  featured_image?: string | null
}

export default function BookingSummary({
  room,
  checkIn,
  checkOut,
  nights,
  numRooms,
  adults,
  mealPlan,
  mealLabel,
  autoXbeds,
  nightlyBreakdown,
  roomSubtotalPerRoom,
  baseRoomSubtotalPerRoom,
  mealAddonAmount,
  mealAddonLabel,
  extraBedAmount,
  promoCode,
  promoDiscount,
  cgst,
  sgst,
  total,
}: {
  room: RoomSummary
  checkIn: string
  checkOut: string
  nights: number
  numRooms: number
  adults: number
  mealPlan: string
  mealLabel: string
  autoXbeds: number
  nightlyBreakdown: StayTariffNight[]
  roomSubtotalPerRoom: number
  baseRoomSubtotalPerRoom?: number
  mealAddonAmount?: number
  mealAddonLabel?: string
  extraBedAmount: number
  promoCode?: string
  promoDiscount?: number
  cgst: number
  sgst: number
  total: number
}) {
  const hasDates = Boolean(checkIn && checkOut && nights > 0)
  const displayRoomSubtotalPerRoom = baseRoomSubtotalPerRoom ?? roomSubtotalPerRoom
  const roomSubtotal = displayRoomSubtotalPerRoom * numRooms

  return (
    <div className="sticky top-28 rounded-2xl border border-white/8 p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <h3 className="mb-5 font-playfair text-xl text-white">Booking Summary</h3>

      {room.featured_image && (
        <div className="relative mb-5 h-28 overflow-hidden rounded-xl">
          <Image src={room.featured_image} alt={room.name} fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-3 text-xs font-semibold text-white">{room.name}</div>
        </div>
      )}

      <div className="space-y-2.5 text-sm">
        {hasDates && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {[
              ['Check-in', formatDate(`${checkIn}T12:00:00`)],
              ['Check-out', formatDate(`${checkOut}T12:00:00`)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="mb-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</div>
                <div className="text-xs font-medium text-white">{value}</div>
              </div>
            ))}
          </div>
        )}

        {[
          ['Nights', nights || '—'],
          ['Rooms', numRooms],
          ['Adults', adults],
          ['Meal Plan', `${mealPlan} — ${mealLabel}`],
          ...(autoXbeds > 0 ? [[`Extra Bed${autoXbeds > 1 ? 's' : ''} (auto)`, autoXbeds]] : []),
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between">
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
            <span className={String(label).includes('Extra') ? 'text-xs text-amber-400' : 'text-white'}>{value}</span>
          </div>
        ))}
      </div>

      {hasDates ? (
        <div className="mt-5 space-y-2 pt-5 text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="rounded-xl border border-white/8 px-3 py-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Nightly Tariff</div>
            <div className="space-y-2">
              {nightlyBreakdown.map((night) => (
                <div key={night.date} className="flex items-center justify-between text-sm">
                  <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {formatDate(`${night.date}T12:00:00`)}
                  </span>
                  <span className="text-white">₹{night.room_price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span>Only Room tariff × {numRooms} room{numRooms > 1 ? 's' : ''}</span>
            <span>₹{roomSubtotal.toLocaleString()}</span>
          </div>

          <div className="hidden" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span>Room tariff × {numRooms} room{numRooms > 1 ? 's' : ''}</span>
            <span>₹{roomSubtotal.toLocaleString()}</span>
          </div>

          {!!mealAddonAmount && mealAddonAmount > 0 && (
            <div className="flex justify-between" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <span>{mealAddonLabel || 'Meal add-on'} × {numRooms} room{numRooms > 1 ? 's' : ''}</span>
              <span>₹{mealAddonAmount.toLocaleString()}</span>
            </div>
          )}

          {autoXbeds > 0 && (
            <div className="flex justify-between text-amber-400/80">
              <span>Extra bed{autoXbeds > 1 ? 's' : ''}</span>
              <span>₹{extraBedAmount.toLocaleString()}</span>
            </div>
          )}

          {!!promoDiscount && promoDiscount > 0 && (
            <div className="flex justify-between font-medium text-green-400">
              <span>Promo{promoCode ? ` (${promoCode})` : ''}</span>
              <span>−₹{promoDiscount.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span>CGST @ 2.5%</span>
            <span>₹{cgst.toLocaleString()}</span>
          </div>
          <div className="flex justify-between" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span>SGST @ 2.5%</span>
            <span>₹{sgst.toLocaleString()}</span>
          </div>
          <div className="flex justify-between pt-3 text-lg font-bold text-[#c9a14a]" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span>Total</span>
            <span>₹{total.toLocaleString()}</span>
          </div>
        </div>
      ) : (
        <p className="mt-5 pt-5 text-center text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}>
          Select dates to see price
        </p>
      )}

      <a
        href="https://wa.me/919368080535?text=Hi,%20I%20need%20help%20with%20a%20booking"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all"
        style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}
      >
        Need help? Chat on WhatsApp
      </a>
    </div>
  )
}
