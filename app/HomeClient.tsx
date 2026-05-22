'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import AvailabilityBar from '@/components/AvailabilityBar'
import RoomCard from '@/components/RoomCard'
import { useBookingDates } from '@/context/BookingContext'
import { normalizeRoomImageUrl, toLocalDateString } from '@/lib/utils'

type ReviewCard = {
  id: string
  name: string
  rating: number
  text: string
  image?: string | null
}

type PricingQuote = {
  totalPrice: number
  nights: number
}

type AvailabilityQuote = {
  availableRooms: number
  totalRooms: number
  bookedRooms: number
  allowedRooms?: number
  blockedRooms?: number
}

const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000
const HOME_ROOMS_CACHE_KEY = 'leafwalk-home-rooms'
const HOME_REVIEWS_CACHE_KEY = 'leafwalk-home-reviews'
const HOME_PRICING_CACHE_KEY = 'leafwalk-home-pricing'
const HOME_AVAILABILITY_CACHE_KEY = 'leafwalk-home-availability'

function readSessionCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { ts?: number; data?: T }
    if (!parsed?.ts || Date.now() - parsed.ts > CLIENT_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(key)
      return null
    }
    return parsed.data ?? null
  } catch {
    return null
  }
}

function writeSessionCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

const FALLBACK_REVIEWS: ReviewCard[] = [
  { id: 'fallback-1', name: 'Priya Sharma', rating: 5, text: 'Absolutely stunning property. The mountain views from our room were breathtaking. Staff was incredibly warm and the food was delicious. Will definitely return!' },
  { id: 'fallback-2', name: 'Rahul Mehta', rating: 5, text: 'Perfect getaway from city life. The forest walks, bonfire evenings, and the cozy rooms made it a memorable trip for our family. Highly recommend.' },
  { id: 'fallback-3', name: 'Ananya Patel', rating: 5, text: 'LeafWalk is a hidden gem. The premium cottage was spacious and well-appointed. The views of the Himalayan forests are unreal. Loved every moment.' },
]

const EXPERIENCES = [
  { title: 'Forest Trekking', desc: 'Guided treks through Himalayan forests with expert local guides' },
  { title: 'Evening Bonfire', desc: 'Cozy bonfire evenings under a sky full of stars' },
  { title: 'Mountain Views', desc: 'Wake up to panoramic Himalayan mountain and valley views' },
  { title: 'Local Cuisine', desc: 'Authentic Garhwali dishes and regional specialties' },
  { title: 'Photography', desc: 'Stunning natural landscapes for photography enthusiasts' },
  { title: 'Nature Walks', desc: 'Leisurely walks through dense alpine forests and meadows' },
]

const FAQS = [
  { q: 'What is the check-in and check-out time?', a: 'Check-in is at 3:00 PM and check-out is at 11:00 AM. Early check-in and late check-out can be arranged subject to availability.' },
  { q: 'How do I reach LeafWalk Resort?', a: 'We are located on Yamunotri Road, at Narad Chatti, approximately 1.5 km from Hanuman Chatti towards Yamunotri, Uttarkashi. The nearest railhead is Dehradun (180 km).We can arrange pickup services from Dehradun, Rishikesh, and Haridwar upon request.' },
  
  { q: 'Is the resort suitable for children?', a: 'Yes, we warmly welcome families with children. Children below 5 years stay free. We have safe outdoor areas and child-friendly menus.' },
  { q: 'What is the cancellation policy?', a: 'Free cancellation up to 15 days before check-in. 50% refund for 15-7 days. No refund within 7 days. Full details on our Terms page.No cancellations or refunds will be permitted during the Yatra season.' },
  { q: 'Do you accept online payments?', a: 'Yes, we accept all major payment methods through Razorpay - UPI, credit/debit cards, net banking, and wallets.' },
]

type HomeRoom = {
  id: string
  name: string
  slug: string
  category: 'deluxe' | 'premium'
  description: string | null
  max_guests: number
  featured_image?: string | null
  images?: string[] | null
  display_price_from?: number | null
}

export default function HomeClient({ pageName }: { pageName?: string }) {
  const aboutRef = useRef<HTMLElement>(null)
  const stayRef = useRef<HTMLDivElement>(null)
  const homepageDatesInitializedRef = useRef(false)
  const { checkInDate, checkOutDate, hydrated, setDates } = useBookingDates()
  const today = toLocalDateString(new Date())
  const tomorrow = (() => {
    const date = new Date(`${today}T12:00:00`)
    date.setDate(date.getDate() + 1)
    return toLocalDateString(date)
  })()
  const effectiveCheckInDate = checkInDate || today
  const effectiveCheckOutDate = checkOutDate && checkOutDate > effectiveCheckInDate ? checkOutDate : tomorrow
  const pricingReady = Boolean(effectiveCheckInDate && effectiveCheckOutDate)
  const [rooms, setRooms] = useState<HomeRoom[]>([])
  const [priceQuotes, setPriceQuotes] = useState<Record<string, PricingQuote | null>>({})
  const [availabilityQuotes, setAvailabilityQuotes] = useState<Record<string, AvailabilityQuote | null>>({})
  const [reviews, setReviews] = useState<ReviewCard[]>(FALLBACK_REVIEWS)
  const featuredRooms = useMemo(() => {
    const deluxe = rooms.find((room) => room.category === 'deluxe') || null
    const premium = rooms.find((room) => room.category === 'premium') || null
    return [deluxe, premium].filter(Boolean) as HomeRoom[]
  }, [rooms])

  useEffect(() => {
    if (!hydrated || homepageDatesInitializedRef.current) return

    homepageDatesInitializedRef.current = true
    setDates({ checkInDate: today, checkOutDate: tomorrow })
  }, [hydrated, setDates, today, tomorrow])

  useEffect(() => {
    const cachedRooms = readSessionCache<HomeRoom[]>(HOME_ROOMS_CACHE_KEY)
    const cachedReviews = readSessionCache<ReviewCard[]>(HOME_REVIEWS_CACHE_KEY)

    if (cachedRooms) setRooms(cachedRooms)
    if (cachedReviews?.length) setReviews(cachedReviews)
    if (cachedRooms && cachedReviews?.length) return

    Promise.all([
      fetch('/api/rooms', { cache: 'force-cache' }),
      fetch('/api/reviews', { cache: 'force-cache' }),
    ])
      .then(async ([roomsResponse, reviewsResponse]) => {
        const roomsPayload = roomsResponse.ok ? await roomsResponse.json() : { rooms: [] }
        const reviewsPayload = reviewsResponse.ok ? await reviewsResponse.json() : { reviews: [] }

        const nextRooms = (roomsPayload.rooms || []) as HomeRoom[]
        const nextReviews = reviewsPayload.reviews?.length ? reviewsPayload.reviews.slice(0, 3) as ReviewCard[] : FALLBACK_REVIEWS
        setRooms(nextRooms)
        setReviews(nextReviews)
        writeSessionCache(HOME_ROOMS_CACHE_KEY, nextRooms)
        writeSessionCache(HOME_REVIEWS_CACHE_KEY, nextReviews)
      })
      .catch((error) => {
        console.error(error)
        if (!cachedRooms) setRooms([])
      })
  }, [])

  function scrollToStaySection() {
    const target = document.getElementById('choose-your-perfect-stay')
    if (!target) return
    const top = target.getBoundingClientRect().top + window.scrollY - 110
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }

  useEffect(() => {
    if (!hydrated || !pricingReady || featuredRooms.length === 0) {
      setPriceQuotes({})
      return
    }

    const pricingCacheKey = `${HOME_PRICING_CACHE_KEY}:${effectiveCheckInDate}:${effectiveCheckOutDate}`
    const cachedPricing = readSessionCache<Record<string, PricingQuote | null>>(pricingCacheKey)
    if (cachedPricing) {
      setPriceQuotes(cachedPricing)
      return
    }

    Promise.all(
      featuredRooms.map(async (room) => {
        const response = await fetch('/api/get-room-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_id: room.id,
            room_category: room.category,
            checkInDate: effectiveCheckInDate,
            checkOutDate: effectiveCheckOutDate,
            meal_plan: 'EP',
          }),
        })
        if (!response.ok) return [room.id, null] as const
        const quote = await response.json()
        return [room.id, { totalPrice: Number(quote.total?.EP || 0), nights: Array.isArray(quote.nights) ? quote.nights.length : 0 }] as const
      })
    ).then((entries) => {
      const nextPricing = Object.fromEntries(entries)
      setPriceQuotes(nextPricing)
      writeSessionCache(pricingCacheKey, nextPricing)
    })
  }, [effectiveCheckInDate, effectiveCheckOutDate, featuredRooms, hydrated, pricingReady])

  useEffect(() => {
    if (!hydrated || !pricingReady || featuredRooms.length === 0) {
      setAvailabilityQuotes({})
      return
    }

    const availabilityCacheKey = `${HOME_AVAILABILITY_CACHE_KEY}:${effectiveCheckInDate}:${effectiveCheckOutDate}`
    const cachedAvailability = readSessionCache<Record<string, AvailabilityQuote | null>>(availabilityCacheKey)
    if (cachedAvailability) {
      setAvailabilityQuotes(cachedAvailability)
      return
    }

    Promise.all(
      featuredRooms.map(async (room) => {
        const response = await fetch('/api/check-availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: room.id,
            checkIn: effectiveCheckInDate,
            checkOut: effectiveCheckOutDate,
          }),
        })
        if (!response.ok) return [room.id, null] as const
        const data = await response.json()
        return [room.id, {
          availableRooms: Number(data.availableRooms || 0),
          totalRooms: Number(data.totalRooms || 0),
          bookedRooms: Number(data.bookedRooms || 0),
          allowedRooms: Number(data.allowedRooms || 0),
          blockedRooms: Number(data.blockedRooms || 0),
        }] as const
      })
    ).then((entries) => {
      const nextAvailability = Object.fromEntries(entries)
      setAvailabilityQuotes(nextAvailability)
      writeSessionCache(availabilityCacheKey, nextAvailability)
    })
  }, [effectiveCheckInDate, effectiveCheckOutDate, featuredRooms, hydrated, pricingReady])

  function getCategoryRoom(category: 'deluxe' | 'premium') {
    return rooms.find((room) => room.category === category) || null
  }

  function getRoomImage(room: HomeRoom | null) {
    if (!room) return null
    return normalizeRoomImageUrl(room.featured_image || room.images?.[0] || null, room.category)
  }

  const deluxeRoom = getCategoryRoom('deluxe')
  const premiumRoom = getCategoryRoom('premium')
  const deluxePrice = deluxeRoom ? (priceQuotes[deluxeRoom.id] ?? null) : null
  const premiumPrice = premiumRoom ? (priceQuotes[premiumRoom.id] ?? null) : null
  const deluxeAvailability = deluxeRoom ? (availabilityQuotes[deluxeRoom.id] ?? null) : null
  const premiumAvailability = premiumRoom ? (availabilityQuotes[premiumRoom.id] ?? null) : null
  const reviewAverage = reviews.length
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : '4.8'

  return (
    <>
      <div className="hero">
        <video autoPlay muted loop playsInline preload="none" controlsList="nodownload noremoteplayback nofullscreen" disablePictureInPicture onContextMenu={(event) => event.preventDefault()}>
          <source src="/videos/Hero-Demo2.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay">
          <p className="text-[#c9a14a] text-xs uppercase tracking-[0.4em] font-semibold mb-4 opacity-90">Uttarkashi, Uttarakhand</p>
          <h1 className="hero-title text-white font-playfair">LeafWalk Resort</h1>
          <p className="hero-tagline text-white">Stay in the Lap of Nature</p>
          <div className="flex flex-wrap gap-4 mt-8 justify-center">
            <Link href="/rooms" className="btn-primary luxury-cta">Book Your Stay</Link>
            <a href="https://wa.me/919368080535?text=Hello%20LeafWalk%20Resort,%20I%20want%20to%20make%20a%20booking" target="_blank" rel="noopener noreferrer" className="btn-secondary luxury-cta">WhatsApp Us</a>
          </div>
          <div className="grid grid-cols-3 gap-8 mt-14 max-w-lg mx-auto">
            {[{ val: '15+', label: 'Luxury Rooms' }, { val: `${reviewAverage}/5`, label: 'Guest Rating' }, { val: '100%', label: 'Nature View' }].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-bold text-[#c9a14a]">{s.val}</p>
                <p className="text-xs text-white/65 mt-1 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
          <button onClick={() => aboutRef.current?.scrollIntoView({ behavior: 'smooth' })} className="scroll-indicator" aria-label="Scroll to content">Scroll</button>
        </div>
      </div>

      <div className="section-divider" />

      <section ref={aboutRef} className="about">
        <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-4">About Us</p>
        <h2 className="about-title">Where Nature Meets Luxury</h2>
        <p className="about-text">
          Nestled in the serene Himalayan forests of Uttarkashi on the sacred Yamunotri Road,
          LeafWalk Resort is a luxury mountain retreat offering an unparalleled blend of comfort
          and natural beauty. With breathtaking valley views, fresh mountain air, and personalised
          service, we create experiences that last a lifetime.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          <Link href="/rooms" className="btn-primary">Explore Rooms</Link>
          <Link href="/experiences" className="btn-secondary">Our Experiences</Link>
        </div>
      </section>

      <section className="py-16 px-6 bg-[#0d0d0d]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Prime Location', desc: 'Yamunotri Road, Uttarkashi - gateway to the sacred Yamunotri Dham' },
              { title: 'Pleasant Climate', desc: 'Cool mountain weather year-round. Perfect summer escape and magical winters' },
              { title: 'Easy Access', desc: '180 km from Rishikesh. Pickup available from Uttarkashi town on request' },
            ].map((item) => (
              <div key={item.title} className="flex gap-4 p-5 bg-white/3 border border-white/8 rounded-2xl">
                <div>
                  <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-[#111]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <AvailabilityBar
              title="Check Availability"
              subtitle="Select your stay dates to reveal live pricing for your chosen dates."
              autoApplyDefaultDates
              onChecked={() => window.setTimeout(scrollToStaySection, 80)}
            />
          </div>
          <div id="choose-your-perfect-stay" ref={stayRef} className="scroll-mt-28 text-center mb-14">
            <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-3">Accommodations</p>
            <h2 className="font-playfair text-4xl md:text-5xl text-[#c9a14a] mb-4">Choose Your Perfect Stay</h2>
            <p className="text-white/50 max-w-xl mx-auto">Thoughtfully designed stays across our deluxe rooms and premium cottages, each crafted for comfort with Himalayan views</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <RoomCard
              title={deluxeRoom?.name || 'Deluxe Rooms'}
              image={getRoomImage(deluxeRoom)}
              imageAlt={deluxeRoom?.name || 'Deluxe Rooms'}
              description={deluxeRoom?.description || 'Elegant mountain-view rooms with premium interiors and modern amenities. Ideal for couples and small families seeking comfort in nature.'}
              badge="Deluxe"
              accent="deluxe"
              price={deluxePrice?.totalPrice ?? null}
              hasDates={pricingReady}
              priceUnavailable={pricingReady && deluxePrice === null}
              priceSuffix={deluxePrice ? `for ${deluxePrice.nights} night${deluxePrice.nights > 1 ? 's' : ''} · room only` : 'for your selected stay'}
              primaryCta={{ label: 'View Deluxe Rooms', href: '/rooms?category=deluxe' }}
            />

            <RoomCard
              title={premiumRoom?.name || 'Premium Cottages'}
              image={getRoomImage(premiumRoom)}
              imageAlt={premiumRoom?.name || 'Premium Cottages'}
              description={premiumRoom?.description || 'Luxurious private cottages and spacious suites with premium amenities. Perfect for memorable family stays and romantic getaways.'}
              badge="Premium"
              cornerBadge="MOST POPULAR"
              accent="premium"
              price={premiumPrice?.totalPrice ?? null}
              hasDates={pricingReady}
              priceUnavailable={pricingReady && premiumPrice === null}
              priceSuffix={premiumPrice ? `for ${premiumPrice.nights} night${premiumPrice.nights > 1 ? 's' : ''} · room only` : 'for your selected stay'}
              primaryCta={{ label: 'View Premium Cottages', href: '/rooms?category=premium' }}
            />
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-3">Activities</p>
            <h2 className="font-playfair text-4xl text-white mb-4">Experiences at LeafWalk</h2>
            <p className="text-white/45 max-w-xl mx-auto text-sm">From forest treks to starlit bonfires - every day at LeafWalk is an adventure</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {EXPERIENCES.map((exp) => (
              <div key={exp.title} className="flex gap-4 p-5 bg-white/3 border border-white/8 rounded-2xl hover:border-[#c9a14a]/25 transition-all group">
                <div>
                  <h3 className="text-white font-semibold mb-1 text-sm">{exp.title}</h3>
                  <p className="text-white/45 text-xs leading-relaxed">{exp.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/experiences" className="btn-secondary">View All Experiences</Link>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-[#0d0d0d]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-3">Guest Reviews</p>
            <h2 className="font-playfair text-4xl text-white mb-3">What Our Guests Say</h2>
            <div className="flex items-center justify-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((i) => <span key={i} className="text-[#c9a14a] text-xl">*</span>)}
              <span className="text-white/50 text-sm ml-2">{reviewAverage}/5 from recent guests</span>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white/3 border border-white/8 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">{Array.from({ length: review.rating }).map((_, i) => <span key={i} className="text-[#c9a14a]">*</span>)}</div>
                <p className="text-white/65 text-sm leading-relaxed mb-5 italic">&ldquo;{review.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/8">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c9a14a] to-[#e6c87a] flex items-center justify-center text-black font-bold text-sm">
                    {review.name[0]}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{review.name}</p>
                    <p className="text-white/40 text-xs">Verified guest review</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-3">FAQs</p>
            <h2 className="font-playfair text-4xl text-white">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details key={i} className="group bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer px-6 py-5 text-white font-medium text-sm list-none hover:text-[#c9a14a] transition-colors">
                  {faq.q}
                  <span className="text-[#c9a14a] text-lg group-open:rotate-45 transition-transform duration-200 flex-shrink-0 ml-4">+</span>
                </summary>
                <div className="px-6 pb-5 text-white/55 text-sm leading-relaxed border-t border-white/8 pt-4">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-[#0d0d0d]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-4">Ready?</p>
          <h2 className="font-playfair text-4xl md:text-5xl text-white mb-5">Book Your Mountain Escape</h2>
          <p className="text-white/55 text-base mb-10 leading-relaxed">
            Rooms fill up fast, especially during peak season. Book directly for the best rates and personalised service.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/rooms" className="btn-primary luxury-cta">Check Availability</Link>
            <a href="https://wa.me/919368080535?text=Hi,%20I%20want%20to%20book%20a%20room%20at%20LeafWalk%20Resort" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 px-8 py-4 bg-green-500/15 border border-green-500/30 text-green-400 font-semibold rounded-full hover:bg-green-500/25 transition-all">
              WhatsApp Enquiry
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
