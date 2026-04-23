'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Toaster } from 'react-hot-toast'
import AvailabilityBar from '@/components/AvailabilityBar'
import RoomCard from '@/components/RoomCard'
import { useBookingDates } from '@/context/BookingContext'
import { formatDate } from '@/lib/utils'

interface Room {
  id: string
  name: string
  slug: string
  category: 'deluxe' | 'premium'
  description: string
  max_guests: number
  max_extra_beds: number
  total_rooms: number
  amenities: string[]
  images: string[]
  featured_image: string
  is_active: boolean
  display_price_from: number
  offer_label: string | null
  offer_badge_text: string | null
  offer_discount_percent: number
  offer_is_active: boolean
  offer_valid_until: string | null
}

type MealPlan = 'EP' | 'CP' | 'MAP' | 'AP'
type PublicMealPlan = 'EP' | 'CP'

type Card = {
  key: string
  cat: 'deluxe' | 'premium'
  room: Room
  price: number | null
  nights: number
}

type PricingQuote = {
  totalPrice: number
  nights: number
}

type AvailabilityQuote = {
  availableRooms: number
  totalRooms: number
  bookedRooms: number
}

const MEAL_PLAN_META: Record<MealPlan, { badge: string; subtitle: string; feature: string; whatsapp: string; accent: string }> = {
  EP: {
    badge: 'Room Only',
    subtitle: 'Room only stay',
    feature: 'Room only',
    whatsapp: 'Room Only',
    accent: 'bg-white/10 border-white/20 text-white/80',
  },
  CP: {
    badge: 'With Breakfast',
    subtitle: 'Breakfast included',
    feature: 'Daily breakfast',
    whatsapp: 'With Breakfast',
    accent: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
  },
  MAP: {
    badge: 'Breakfast + Dinner',
    subtitle: 'Breakfast and dinner included',
    feature: 'Breakfast + dinner',
    whatsapp: 'MAP',
    accent: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
  },
  AP: {
    badge: 'All Meals',
    subtitle: 'Breakfast, lunch and dinner included',
    feature: 'Breakfast + lunch + dinner',
    whatsapp: 'AP',
    accent: 'bg-rose-500/20 border-rose-500/50 text-rose-300',
  },
}

const PUBLIC_MEAL_PLANS: PublicMealPlan[] = ['EP', 'CP']

const FACILITY_GROUPS = [
  { title: 'Bathroom & Toiletries', items: ['Private bathroom', 'Shower', 'Towels', 'Toiletries'] },
  { title: 'Dining & Snacking', items: ['Coffee/tea maker', 'Kettle'] },
  { title: 'Safety & Security', items: ['Fire extinguisher', 'First aid kit', 'Non-smoking'] },
  { title: 'Comforts', items: ['Slippers', 'Room Heater (Paid)'] },
]

function isOfferActive(room: Room) {
  if (!room.offer_is_active || !room.offer_badge_text) return false
  if (room.offer_valid_until && new Date(room.offer_valid_until) < new Date()) return false
  return true
}

function FacilityModal({ room, onClose }: { room: Room; onClose: () => void }) {
  const isPremium = room.category === 'premium'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border"
        style={{ background: '#111', borderColor: isPremium ? 'rgba(201,161,74,0.3)' : 'rgba(255,255,255,0.1)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-5">
          <div>
            <h3 className="font-playfair text-xl text-white">{room.name}</h3>
            <p className="mt-0.5 text-xs capitalize text-white/40">{room.category} room facilities</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-white/50 transition-all hover:bg-white/10 hover:text-white">
            x
          </button>
        </div>

        <div className="mx-6 mt-5 rounded-xl border border-[#c9a14a]/20 px-4 py-3 text-xs text-[#c9a14a]/80" style={{ background: 'rgba(201,161,74,0.06)' }}>
          Meal plans can be selected at the time of booking.
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
          {FACILITY_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="mb-3 text-sm font-semibold text-white">{group.title}</h4>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-lg border border-white/6 px-3 py-2 text-xs text-white/60"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isPremium ? 'bg-[#c9a14a]' : 'bg-blue-400'}`} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {room.amenities?.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-white">Additional Amenities</h4>
              <div className="grid grid-cols-2 gap-2">
                {room.amenities.map((amenity) => (
                  <div
                    key={amenity}
                    className="flex items-center gap-2 rounded-lg border border-white/6 px-3 py-2 text-xs text-white/60"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isPremium ? 'bg-[#c9a14a]' : 'bg-blue-400'}`} />
                    {amenity}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-all"
            style={{ background: isPremium ? 'linear-gradient(135deg,#c9a14a,#e6c87a)' : '#3b82f6', color: isPremium ? '#000' : '#fff' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function RoomsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { checkInDate, checkOutDate, hasDates } = useBookingDates()
  const [rooms, setRooms] = useState<Room[]>([])
  const [priceQuotes, setPriceQuotes] = useState<Record<string, PricingQuote | null>>({})
  const [availabilityQuotes, setAvailabilityQuotes] = useState<Record<string, AvailabilityQuote | null>>({})
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<'all' | 'deluxe' | 'premium'>('all')
  const [lightbox, setLightbox] = useState<{ imgs: string[]; idx: number; title?: string } | null>(null)
  const [facRoom, setFacRoom] = useState<Room | null>(null)

  useEffect(() => {
    const cat = searchParams.get('category')
    if (cat === 'deluxe' || cat === 'premium') setCategory(cat)
    fetch('/api/rooms', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load rooms')
        return response.json()
      })
      .then((payload) => {
        setRooms((payload.rooms || []) as Room[])
      })
      .catch(() => {
        setRooms([])
      })
      .finally(() => setLoading(false))
  }, [searchParams])

  useEffect(() => {
    if (!hasDates || !checkInDate || !checkOutDate || rooms.length === 0) {
      setPriceQuotes({})
      setAvailabilityQuotes({})
      return
    }

    const availableCombos = rooms.flatMap((room) => {
      return PUBLIC_MEAL_PLANS.map((meal) => ({ room, meal }))
    })

    Promise.all(
      availableCombos.map(async ({ room, meal }) => {
        const response = await fetch('/api/get-room-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_id: room.id,
            room_category: room.category,
            checkInDate,
            checkOutDate,
            meal_plan: meal,
          }),
        })
        if (!response.ok) return [`${room.id}:${meal}`, null] as const
        const quote = await response.json()
        return [`${room.id}:${meal}`, { totalPrice: Number(quote.total?.[meal] || 0), nights: Array.isArray(quote.nights) ? quote.nights.length : 0 }] as const
      })
    ).then((entries) => setPriceQuotes(Object.fromEntries(entries)))
  }, [hasDates, checkInDate, checkOutDate, rooms])

  useEffect(() => {
    if (!hasDates || !checkInDate || !checkOutDate || rooms.length === 0) {
      setAvailabilityQuotes({})
      return
    }

    Promise.all(
      rooms.map(async (room) => {
        const response = await fetch('/api/check-availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: room.id,
            checkIn: checkInDate,
            checkOut: checkOutDate,
          }),
        })

        if (!response.ok) return [room.id, null] as const
        const data = await response.json()
        return [room.id, {
          availableRooms: Number(data.availableRooms || 0),
          totalRooms: Number(data.totalRooms || 0),
          bookedRooms: Number(data.bookedRooms || 0),
        }] as const
      })
    ).then((entries) => setAvailabilityQuotes(Object.fromEntries(entries)))
  }, [hasDates, checkInDate, checkOutDate, rooms])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightbox(null)
        setFacRoom(null)
      }
      if (event.key === 'ArrowRight' && lightbox) {
        setLightbox((current) => (current ? { ...current, idx: (current.idx + 1) % current.imgs.length } : null))
      }
      if (event.key === 'ArrowLeft' && lightbox) {
        setLightbox((current) => (current ? { ...current, idx: (current.idx - 1 + current.imgs.length) % current.imgs.length } : null))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightbox])

  const cards: Card[] = []
  ;(['deluxe', 'premium'] as const).forEach((cat) => {
    const room = rooms.find((entry) => entry.category === cat)
    if (!room) return

    cards.push({
      key: cat,
      cat,
      room,
      price: priceQuotes[`${room.id}:EP`]?.totalPrice ?? null,
      nights: priceQuotes[`${room.id}:EP`]?.nights ?? 0,
    })
  })

  const filtered = category === 'all' ? cards : cards.filter((card) => card.cat === category)
  const counts = {
    all: cards.length,
    deluxe: cards.filter((card) => card.cat === 'deluxe').length,
    premium: cards.filter((card) => card.cat === 'premium').length,
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b0b' }}>
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#c9a14a] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-16" style={{ background: '#0b0b0b' }}>
      <Toaster position="top-center" />
      {facRoom && <FacilityModal room={facRoom} onClose={() => setFacRoom(null)} />}

      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#c9a14a]">Accommodations</p>
          <h1 className="mb-4 font-playfair text-5xl text-[#c9a14a]">Our Rooms & Cottages</h1>
          <p className="mx-auto max-w-xl text-white/50">Beautifully appointed rooms with Himalayan views and curated comforts</p>
                  </div>

        <div className="mb-10 flex flex-wrap justify-center gap-3">
          {(['all', 'deluxe', 'premium'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setCategory(value)}
              className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all ${
                category === value ? 'bg-[#c9a14a] text-black' : 'border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${category === value ? 'bg-black/20 text-black' : 'bg-white/10 text-white/40'}`}>
                {counts[value]}
              </span>
            </button>
          ))}
        </div>

          <div className="mb-10">
            <AvailabilityBar
              compact
              title="Check Availability"
              subtitle=""
            />
          </div>

          <div className="mb-10 text-center">
            <a
              href="https://wa.me/919368080535?text=Hi,%20I%20want%20to%20book%20directly%20with%20LeafWalk%20Resort%20and%20check%20the%20best%20discount"
              target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-green-500/25 bg-green-500/10 px-5 py-2.5 text-sm font-semibold text-green-400 transition-all hover:bg-green-500/15"
          >
            Book direct on WhatsApp and get extra discount
          </a>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {filtered.map(({ key, cat, room, price, nights }) => {
            const isPremium = cat === 'premium'
            const hasOffer = isOfferActive(room)
            const allImages = [room.featured_image, ...(room.images || [])].filter(Boolean) as string[]
            const availability = availabilityQuotes[room.id]
            const isAvailable = !hasDates ? false : (availability?.availableRooms || 0) > 0
            const availabilityMessage = !hasDates
              ? 'Select dates to check live availability for this category.'
              : availability
                ? isAvailable
                  ? `${availability.availableRooms} room(s) available for selected dates`
                  : 'Not available for selected dates'
                : 'Checking availability for selected dates...'
            const availabilityTone = !hasDates
              ? 'neutral'
              : availability
                ? isAvailable ? 'success' : 'danger'
                : 'warning'
            const hasPrice = price !== null
            const canBook = hasDates && hasPrice && isAvailable
            const primaryLabel = !hasDates
              ? 'Select Dates First'
              : !isAvailable
                ? 'Not available for selected dates'
                : !hasPrice
                  ? 'Price not available for selected dates'
                  : `Book Now - Rs. ${price!.toLocaleString()}`

            return (
              <RoomCard
                key={key}
                title={room.name}
                subtitle="Room Only"
                description={room.description}
                image={room.featured_image}
                galleryImages={allImages}
                imageAlt={room.name}
                badge={isPremium ? 'Premium' : 'Deluxe'}
                cornerBadge={hasOffer ? room.offer_badge_text || undefined : undefined}
                accent={isPremium ? 'premium' : 'deluxe'}
                price={price}
                hasDates={hasDates}
                priceUnavailable={hasDates && price === null}
                priceSuffix={nights > 0 ? `for ${nights} night${nights > 1 ? 's' : ''}` : 'for your selected stay'}
                onImageClick={() => setLightbox({ imgs: allImages, idx: 0, title: room.name })}
                onGalleryImageClick={(index) => setLightbox({ imgs: allImages, idx: index, title: room.name })}
                features={['2 guests', ...(room.max_extra_beds > 0 ? ['Extra guest on chargeable bed'] : [])]}
                facilitiesAction={{ label: '+ See all facilities', onClick: () => setFacRoom(room) }}
                expiryNote={hasOffer && room.offer_valid_until ? `Offer expires: ${formatDate(room.offer_valid_until)}` : null}
                availabilityMessage={availabilityMessage}
                availabilityTone={availabilityTone as 'success' | 'warning' | 'danger' | 'neutral'}
                primaryCta={{
                  label: primaryLabel,
                  onClick: () => router.push(`/booking?room=${room.slug}&meal=EP${hasDates ? `&checkIn=${checkInDate}&checkOut=${checkOutDate}` : ''}`),
                  disabled: !canBook,
                }}
                secondaryCta={{
                  label: 'Enquire',
                  href: `https://wa.me/919368080535?text=Hi,%20I%20am%20interested%20in%20${encodeURIComponent(room.name)}%20(${encodeURIComponent('Room Only')})%20at%20LeafWalk%20Resort`,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                }}
              />
            )
          })}

          {filtered.length === 0 && <div className="col-span-2 py-20 text-center text-white/30">No room tariffs found for the selected category.</div>}
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-[#050505]/95 p-3 backdrop-blur-xl md:p-6" onClick={() => setLightbox(null)}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,161,74,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%)]" />

          <div className="relative mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-black/45 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#c9a14a]">LeafWalk Gallery</p>
                <h3 className="mt-1 font-playfair text-xl text-white md:text-2xl">{lightbox.title || 'Room Photos'}</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/55">
                  {lightbox.idx + 1} / {lightbox.imgs.length}
                </span>
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-white/70 transition hover:bg-white/10 hover:text-white"
                  onClick={() => setLightbox(null)}
                  aria-label="Close gallery"
                >
                  x
                </button>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 px-2 py-4 md:px-8 md:py-6">
              <button
                className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-2xl text-white/75 shadow-xl backdrop-blur transition hover:border-[#c9a14a]/60 hover:text-[#c9a14a] md:left-8"
                onClick={(event) => {
                  event.stopPropagation()
                  setLightbox((current) => (current ? { ...current, idx: (current.idx - 1 + current.imgs.length) % current.imgs.length } : null))
                }}
                aria-label="Previous photo"
              >
                {'‹'}
              </button>

              <div className="relative h-full min-h-[360px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                <Image
                  src={lightbox.imgs[lightbox.idx]}
                  alt={`${lightbox.title || 'Room photo'} ${lightbox.idx + 1}`}
                  fill
                  className="object-contain p-2 md:p-4"
                  priority
                />
              </div>

              <button
                className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-2xl text-white/75 shadow-xl backdrop-blur transition hover:border-[#c9a14a]/60 hover:text-[#c9a14a] md:right-8"
                onClick={(event) => {
                  event.stopPropagation()
                  setLightbox((current) => (current ? { ...current, idx: (current.idx + 1) % current.imgs.length } : null))
                }}
                aria-label="Next photo"
              >
                {'›'}
              </button>
            </div>

            <div className="border-t border-white/10 px-3 py-3 md:px-6">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {lightbox.imgs.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setLightbox((current) => (current ? { ...current, idx: index } : null))}
                    className={`relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-2xl border transition ${
                      index === lightbox.idx
                        ? 'border-[#c9a14a] opacity-100 shadow-[0_0_0_2px_rgba(201,161,74,0.18)]'
                        : 'border-white/10 opacity-55 hover:border-white/35 hover:opacity-100'
                    }`}
                  >
                    <Image src={image} alt={`Thumbnail ${index + 1}`} fill className="object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RoomsPageInner() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b0b' }}><div className="h-12 w-12 animate-spin rounded-full border-2 border-[#c9a14a] border-t-transparent" /></div>}>
      <RoomsContent />
    </Suspense>
  )
}

export default function RoomsPage() {
  return <Suspense fallback={<></>}><RoomsPageInner /></Suspense>
}
