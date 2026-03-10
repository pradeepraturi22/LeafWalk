'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'
import toast, { Toaster } from 'react-hot-toast'

interface Room {
  id: string; name: string; slug: string; category: 'deluxe' | 'premium'
  description: string; max_guests: number; max_extra_beds: number
  total_rooms: number; amenities: string[]; images: string[]
  featured_image: string; is_active: boolean; display_price_from: number
  offer_label: string | null; offer_badge_text: string | null
  offer_discount_percent: number; offer_is_active: boolean; offer_valid_until: string | null
}

// ── Fixed amenities shown inline on card (no meal plan) ──
const INLINE_FEATURES = [
  { icon: '☕', text: 'Breakfast included' },
  { icon: '🅿️', text: 'Free parking' },
  { icon: '🫖', text: 'Kettle' },
  { icon: '🚿', text: 'Shower' },
  { icon: '🚪', text: 'Private bathroom' },
  { icon: '🚭', text: 'Non-smoking' },
  { icon: '🛏️', text: '1 double bed' },
]

// ── Facilities shown in "See more" popup, grouped by category ──
const FACILITY_GROUPS = [
  {
    title: 'Bathroom & Toiletries',
    icon: '🚿',
    items: ['Private bathroom', 'Shower', 'Towels', 'Toiletries'],
  },
  {
    title: 'Dining, Drinking & Snacking',
    icon: '☕',
    items: ['Coffee/tea maker', 'Kettle'],
  },
  {
    title: 'Safety & Security',
    icon: '🔒',
    items: ['Fire extinguisher', 'First aid kit', 'Non-smoking'],
  },
  {
    title: 'Comforts',
    icon: '✨',
    items: ['Slippers', 'Room Heater (Paid)'],
  },
]

function isOfferActive(room: Room): boolean {
  if (!room.offer_is_active || !room.offer_badge_text) return false
  if (room.offer_valid_until && new Date(room.offer_valid_until) < new Date()) return false
  return true
}

// ── Facility Modal (See More popup) ──────────────────────────────────────────
function FacilityModal({ room, onClose }: { room: Room; onClose: () => void }) {
  const isPremium = room.category === 'premium'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-3xl border overflow-hidden"
        style={{ background: '#111', borderColor: isPremium ? 'rgba(201,161,74,0.3)' : 'rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div>
            <h3 className="text-white font-playfair text-xl">{room.name}</h3>
            <p className="text-white/40 text-xs mt-0.5 capitalize">{room.category} Room Facilities</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all text-lg">✕</button>
        </div>

        {/* CP note */}
        <div className="mx-6 mt-5 px-4 py-3 rounded-xl border border-[#c9a14a]/20 text-xs text-[#c9a14a]/80" style={{ background: 'rgba(201,161,74,0.06)' }}>
          ☕ <strong>Breakfast (CP) included</strong> in all online bookings. Other meal plans (MAP/AP) available on request.
        </div>

        {/* Grouped facilities */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {FACILITY_GROUPS.map(group => (
            <div key={group.title}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{group.icon}</span>
                <h4 className="text-white font-semibold text-sm">{group.title}</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map(item => (
                  <div key={item} className="flex items-center gap-2 text-white/60 text-xs px-3 py-2 rounded-lg border border-white/6" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPremium ? 'bg-[#c9a14a]' : 'bg-blue-400'}`} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* DB amenities if any extra */}
          {room.amenities?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🏨</span>
                <h4 className="text-white font-semibold text-sm">Additional Amenities</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {room.amenities.map(a => (
                  <div key={a} className="flex items-center gap-2 text-white/60 text-xs px-3 py-2 rounded-lg border border-white/6" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPremium ? 'bg-[#c9a14a]' : 'bg-blue-400'}`} />
                    {a}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-5">
          <button onClick={onClose}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
            style={{ background: isPremium ? 'linear-gradient(135deg,#c9a14a,#e6c87a)' : '#3b82f6', color: isPremium ? '#000' : '#fff' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Rooms Content ────────────────────────────────────────────────────────
function RoomsContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<'all' | 'deluxe' | 'premium'>('all')
  const [lightbox, setLightbox] = useState<{ imgs: string[]; idx: number } | null>(null)
  const [facilityRoom, setFacilityRoom] = useState<Room | null>(null)

  useEffect(() => {
    const cat = sp.get('category')
    if (cat === 'deluxe' || cat === 'premium') setCategory(cat)
    loadRooms()
  }, [])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setLightbox(null); setFacilityRoom(null) }
      if (e.key === 'ArrowRight' && lightbox) setLightbox(l => l ? { ...l, idx: (l.idx + 1) % l.imgs.length } : null)
      if (e.key === 'ArrowLeft'  && lightbox) setLightbox(l => l ? { ...l, idx: (l.idx - 1 + l.imgs.length) % l.imgs.length } : null)
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [lightbox])

  async function loadRooms() {
    const { data, error } = await supabase
      .from('rooms')
      .select('id,name,slug,category,description,max_guests,max_extra_beds,total_rooms,amenities,images,featured_image,is_active,display_price_from,offer_label,offer_badge_text,offer_discount_percent,offer_is_active,offer_valid_until')
      .eq('is_active', true).order('category').order('display_price_from', { ascending: true })

    if (error) {
      const { data: fb } = await supabase.from('rooms')
        .select('id,name,slug,category,description,max_guests,max_extra_beds,total_rooms,amenities,images,featured_image,is_active,display_price_from')
        .eq('is_active', true).order('category')
      setRooms((fb || []) as Room[])
    } else {
      setRooms(data || [])
    }
    setLoading(false)
  }

  const filtered = rooms.filter(r => category === 'all' || r.category === category)
  const counts = { all: rooms.length, deluxe: rooms.filter(r => r.category === 'deluxe').length, premium: rooms.filter(r => r.category === 'premium').length }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b0b' }}>
      <div className="w-12 h-12 border-2 border-[#c9a14a] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen py-16 px-4" style={{ background: '#0b0b0b' }}>
      <Toaster position="top-center" />
      {facilityRoom && <FacilityModal room={facilityRoom} onClose={() => setFacilityRoom(null)} />}

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-3">Accommodations</p>
          <h1 className="font-playfair text-5xl text-[#c9a14a] mb-4">Our Rooms & Cottages</h1>
          <p className="text-white/50 max-w-xl mx-auto">17 beautifully appointed rooms across two categories, each with Himalayan views and curated comforts</p>
        </div>

        {/* Filter */}
        <div className="flex gap-3 justify-center mb-10 flex-wrap">
          {(['all', 'deluxe', 'premium'] as const).map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${category === c ? 'bg-[#c9a14a] text-black' : 'bg-white/5 border border-white/15 text-white/60 hover:text-white hover:bg-white/10'}`}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${category === c ? 'bg-black/20 text-black' : 'bg-white/10 text-white/40'}`}>{counts[c]}</span>
            </button>
          ))}
        </div>

        {/* Room Cards */}
        <div className="space-y-8">
          {filtered.map(room => {
            const isPremium  = room.category === 'premium'
            const basePrice  = room.display_price_from || (isPremium ? 6500 : 3500)
            const hasOffer   = isOfferActive(room)
            const discounted = hasOffer && room.offer_discount_percent > 0
              ? Math.round(basePrice * (1 - room.offer_discount_percent / 100)) : null
            const allImgs = [room.featured_image, ...(room.images || [])].filter(Boolean) as string[]

            return (
              <div key={room.id} className={`rounded-3xl border overflow-hidden flex flex-col md:flex-row group hover:shadow-2xl transition-all duration-300 ${isPremium ? 'border-[#c9a14a]/20 hover:border-[#c9a14a]/40' : 'border-white/8 hover:border-white/20'}`}
                style={{ background: 'rgba(255,255,255,0.025)' }}>

                {/* Image */}
                <div className="relative md:w-80 lg:w-96 flex-shrink-0 h-64 md:h-auto overflow-hidden">
                  {room.featured_image ? (
                    <Image src={room.featured_image} alt={room.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                      onClick={() => setLightbox({ imgs: allImgs, idx: 0 })} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      {isPremium ? '🏡' : '🏔️'}
                    </div>
                  )}
                  {hasOffer && room.offer_badge_text && (
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                      <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg">🔥 {room.offer_badge_text}</span>
                      {room.offer_label && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-black/70 text-white/90 backdrop-blur">{room.offer_label}</span>}
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur ${isPremium ? 'bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black' : 'bg-blue-500/80 text-white'}`}>
                      {isPremium ? '★ Premium' : 'Deluxe'}
                    </span>
                  </div>
                  {allImgs.length > 1 && (
                    <button onClick={() => setLightbox({ imgs: allImgs, idx: 0 })}
                      className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-xs bg-black/60 text-white/80 backdrop-blur hover:bg-black/80 transition-all">
                      📷 {allImgs.length} photos
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 p-6 lg:p-8 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h2 className="font-playfair text-2xl text-white">{room.name}</h2>
                      <div className="text-right flex-shrink-0">
                        {discounted ? (
                          <>
                            <div className="text-white/35 text-sm line-through">₹{basePrice.toLocaleString()}</div>
                            <div className="text-[#c9a14a] font-bold text-2xl">₹{discounted.toLocaleString()}</div>
                          </>
                        ) : (
                          <div className="text-[#c9a14a] font-bold text-2xl">₹{basePrice.toLocaleString()}</div>
                        )}
                        <div className="text-white/35 text-xs">per night</div>
                      </div>
                    </div>

                    <p className="text-white/55 text-sm leading-relaxed mb-4 line-clamp-2">{room.description}</p>

                    {/* Specs */}
                    <div className="flex flex-wrap gap-3 mb-4 text-xs text-white/50">
                      <span className="flex items-center gap-1"><span>👥</span> Up to {room.max_guests} guests</span>
                      <span className="flex items-center gap-1"><span>🏠</span> {room.total_rooms} unit{room.total_rooms > 1 ? 's' : ''}</span>
                    </div>

                    {/* Fixed features (no meal plan badges) */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {INLINE_FEATURES.map(f => (
                        <span key={f.text} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border"
                          style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
                          {f.icon} {f.text}
                        </span>
                      ))}
                    </div>

                    {/* See more */}
                    <button type="button" onClick={() => setFacilityRoom(room)}
                      className="text-xs mt-1 hover:underline transition-all"
                      style={{ color: isPremium ? 'rgba(201,161,74,0.7)' : 'rgba(96,165,250,0.7)' }}>
                      + See all facilities →
                    </button>
                  </div>

                  {/* Offer expiry */}
                  {hasOffer && room.offer_valid_until && (
                    <div className="mt-4 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(248,113,113,0.9)' }}>
                      ⏰ Offer expires: {new Date(room.offer_valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 flex-wrap mt-5">
                    <button onClick={() => router.push(`/booking?room=${room.slug}`)}
                      className="flex-1 min-w-[140px] py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                      style={{ background: isPremium ? 'linear-gradient(135deg, #c9a14a, #e6c87a)' : '#3b82f6', color: isPremium ? '#000' : '#fff' }}>
                      Book Now →
                    </button>
                    <a href={`https://wa.me/919368080535?text=Hi,%20I%20am%20interested%20in%20booking%20${encodeURIComponent(room.name)}%20at%20LeafWalk%20Resort`}
                      target="_blank" rel="noopener noreferrer"
                      className="px-5 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2"
                      style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Enquire
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <div className="text-center py-20 text-white/30">No rooms found.</div>}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white text-3xl z-10" onClick={() => setLightbox(null)}>✕</button>
          <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-4xl z-10 px-3"
            onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, idx: (l.idx - 1 + l.imgs.length) % l.imgs.length } : null) }}>‹</button>
          <div className="relative w-full max-w-4xl max-h-[80vh] aspect-video" onClick={e => e.stopPropagation()}>
            <Image src={lightbox.imgs[lightbox.idx]} alt="Room photo" fill className="object-contain" />
          </div>
          <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-4xl z-10 px-3"
            onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, idx: (l.idx + 1) % l.imgs.length } : null) }}>›</button>
          <div className="absolute bottom-4 text-white/40 text-sm">{lightbox.idx + 1} / {lightbox.imgs.length}</div>
        </div>
      )}
    </div>
  )
}

function RoomsPageInner() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b0b' }}><div className="w-12 h-12 border-2 border-[#c9a14a] border-t-transparent rounded-full animate-spin" /></div>}>
      <RoomsContent />
    </Suspense>
  )
}
export default function RoomsPage() {
  return (
    <Suspense fallback={}>
      <RoomsPageInner />
    </Suspense>
  )
}