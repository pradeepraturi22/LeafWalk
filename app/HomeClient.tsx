'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

const REVIEWS = [
  { name: 'Priya Sharma', location: 'Delhi', rating: 5, text: 'Absolutely stunning property. The mountain views from our room were breathtaking. Staff was incredibly warm and the food was delicious. Will definitely return!' },
  { name: 'Rahul Mehta',  location: 'Mumbai', rating: 5, text: 'Perfect getaway from city life. The forest walks, bonfire evenings, and the cozy rooms made it a memorable trip for our family. Highly recommend.' },
  { name: 'Ananya Patel', location: 'Ahmedabad', rating: 5, text: 'LeafWalk is a hidden gem. The premium cottage was spacious and well-appointed. The views of the Himalayan forests are unreal. Loved every moment.' },
]

const EXPERIENCES = [
  { icon: '🥾', title: 'Forest Trekking',     desc: 'Guided treks through Himalayan forests with expert local guides' },
  { icon: '🔥', title: 'Evening Bonfire',      desc: 'Cozy bonfire evenings under a sky full of stars' },
  { icon: '🏔️', title: 'Mountain Views',       desc: 'Wake up to panoramic Himalayan mountain and valley views' },
  { icon: '🍽️', title: 'Local Cuisine',        desc: 'Authentic Garhwali dishes and regional specialties' },
  { icon: '📸', title: 'Photography',           desc: 'Stunning natural landscapes for photography enthusiasts' },
  { icon: '🌿', title: 'Nature Walks',          desc: 'Leisurely walks through dense alpine forests and meadows' },
]

const FAQS = [
  { q: 'What is the check-in and check-out time?', a: 'Check-in is at 3:00 PM and check-out is at 11:00 AM. Early check-in and late check-out can be arranged subject to availability.' },
  { q: 'How do I reach LeafWalk Resort?', a: 'We are located on Yamunotri Road, Village Banas, Narad Chatti, Hanuman Chatti, Uttarkashi. Nearest railhead is Rishikesh (180 km). We can arrange pickup from Uttarkashi town.' },
  { q: 'What meal plans are available?', a: 'We offer EP (Room Only), CP (with Breakfast), MAP (Breakfast + Dinner), and AP (All Meals). Meal plans can be selected during booking.' },
  { q: 'Is the resort suitable for children?', a: 'Yes, we warmly welcome families with children. Children below 5 years stay free. We have safe outdoor areas and child-friendly menus.' },
  { q: 'What is the cancellation policy?', a: 'Free cancellation up to 7 days before check-in. 50% refund for 3–7 days. No refund within 3 days. Full details on our Terms page.' },
  { q: 'Do you accept online payments?', a: 'Yes, we accept all major payment methods through Razorpay — UPI, credit/debit cards, net banking, and wallets.' },
]

interface RoomPrice { category: string; display_price_from: number }

export default function HomeClient() {
  const aboutRef = useRef<HTMLElement>(null)
  const [prices, setPrices] = useState<RoomPrice[]>([])

  // Fetch live display_price_from from DB
  useEffect(() => {
    supabase.from('rooms')
      .select('category, display_price_from')
      .eq('is_active', true)
      .then(({ data }) => { if (data) setPrices(data) })
  }, [])

  function getCategoryMinPrice(cat: string) {
    const arr = prices.filter(r => r.category === cat)
    if (!arr.length) return cat === 'premium' ? 6500 : 3500
    return Math.min(...arr.map(r => r.display_price_from))
  }

  const deluxePrice  = getCategoryMinPrice('deluxe')
  const premiumPrice = getCategoryMinPrice('premium')

  return (
    <>
      {/* HERO */}
      <div className="hero">
        <video autoPlay muted loop playsInline preload="metadata">
          <source src="/videos/hero-demo2.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay">
          <p className="text-[#c9a14a] text-xs uppercase tracking-[0.4em] font-semibold mb-4 opacity-90">Uttarkashi, Uttarakhand</p>
          <h1 className="hero-title text-white font-playfair">LeafWalk Resort</h1>
          <p className="hero-tagline text-white">Stay in the Lap of Nature</p>
          <div className="flex flex-wrap gap-4 mt-8 justify-center">
            <Link href="/rooms" className="btn-primary luxury-cta">Book Your Stay</Link>
            <a href="https://wa.me/919368080535?text=Hello%20LeafWalk%20Resort,%20I%20want%20to%20make%20a%20booking"
              target="_blank" rel="noopener noreferrer" className="btn-secondary luxury-cta">WhatsApp Us</a>
          </div>
          <div className="grid grid-cols-3 gap-8 mt-14 max-w-lg mx-auto">
            {[{ val: '17+', label: 'Luxury Rooms' }, { val: '5★', label: 'Guest Rating' }, { val: '100%', label: 'Nature View' }].map(s => (
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

      {/* ABOUT */}
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

      {/* LOCATION */}
      <section className="py-16 px-6 bg-[#0d0d0d]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '📍', title: 'Prime Location', desc: 'Yamunotri Road, Uttarkashi — gateway to the sacred Yamunotri Dham' },
              { icon: '🌡️', title: 'Pleasant Climate', desc: 'Cool mountain weather year-round. Perfect summer escape and magical winters' },
              { icon: '🚗', title: 'Easy Access', desc: '180 km from Rishikesh. Pickup available from Uttarkashi town on request' },
            ].map(item => (
              <div key={item.title} className="flex gap-4 p-5 bg-white/3 border border-white/8 rounded-2xl">
                <span className="text-3xl flex-shrink-0">{item.icon}</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROOM CATEGORIES — prices fetched live from DB */}
      <section className="py-20 px-6 bg-[#111]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-3">Accommodations</p>
            <h2 className="font-playfair text-4xl md:text-5xl text-[#c9a14a] mb-4">Choose Your Perfect Stay</h2>
            <p className="text-white/50 max-w-xl mx-auto">17 beautifully appointed rooms across two categories, each crafted for comfort with Himalayan views</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Deluxe */}
            <div className="bg-white/3 border border-white/10 rounded-3xl overflow-hidden group hover:border-blue-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/5">
              <div className="h-52 bg-gradient-to-br from-[#0d1520] to-[#0b0b0b] relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center"><span className="text-7xl opacity-15">🏔️</span></div>
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#111] to-transparent" />
                <div className="absolute top-4 left-4 px-3 py-1.5 bg-blue-500/80 text-white text-xs font-bold rounded-full uppercase tracking-wider">Deluxe</div>
                <div className="absolute bottom-4 left-6 text-white/40 text-xs">7 rooms available</div>
              </div>
              <div className="p-8">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-playfair text-2xl text-white">Deluxe Rooms</h3>
                  <div className="text-right">
                    <div className="text-[#c9a14a] font-bold text-xl">₹{deluxePrice.toLocaleString()}+</div>
                    <div className="text-white/35 text-xs">per night</div>
                  </div>
                </div>
                <p className="text-white/55 text-sm leading-relaxed mb-5">
                  Elegant mountain-view rooms with premium interiors and modern amenities. Ideal for couples and small families seeking comfort in nature.
                </p>
                <ul className="space-y-2 mb-6 text-sm">
                  {['Breakfast included', 'Private bathroom & shower', 'Free parking', 'Mountain & valley views'].map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-white/60">
                      <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs flex-shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/rooms?category=deluxe" className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-full font-semibold transition-all text-sm">
                  View Deluxe Rooms →
                </Link>
              </div>
            </div>

            {/* Premium */}
            <div className="bg-white/3 border border-[#c9a14a]/15 rounded-3xl overflow-hidden group hover:border-[#c9a14a]/50 transition-all duration-300 hover:shadow-2xl hover:shadow-[#c9a14a]/5 relative">
              <div className="absolute top-4 right-4 z-10 bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black px-3 py-1 rounded-full text-xs font-bold">MOST POPULAR</div>
              <div className="h-52 bg-gradient-to-br from-[#150f00] to-[#0b0b0b] relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center"><span className="text-7xl opacity-15">🏡</span></div>
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#111] to-transparent" />
                <div className="absolute top-4 left-4 px-3 py-1.5 bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black text-xs font-bold rounded-full uppercase tracking-wider">★ Premium</div>
                <div className="absolute bottom-4 left-6 text-white/40 text-xs">10 cottages available</div>
              </div>
              <div className="p-8">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-playfair text-2xl text-white">Premium Cottages</h3>
                  <div className="text-right">
                    <div className="text-[#c9a14a] font-bold text-xl">₹{premiumPrice.toLocaleString()}+</div>
                    <div className="text-white/35 text-xs">per night</div>
                  </div>
                </div>
                <p className="text-white/55 text-sm leading-relaxed mb-5">
                  Luxurious private cottages and spacious suites with premium amenities. Perfect for memorable family stays and romantic getaways.
                </p>
                <ul className="space-y-2 mb-6 text-sm">
                  {['Breakfast included', 'Private cottage — up to 6 guests', 'Living area & separate bedroom', 'Fireplace in select units'].map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-white/60">
                      <span className="w-4 h-4 rounded-full bg-[#c9a14a]/20 text-[#c9a14a] flex items-center justify-center text-xs flex-shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/rooms?category=premium" className="inline-block bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black px-8 py-3 rounded-full font-semibold hover:opacity-90 transition-all text-sm">
                  View Premium Cottages →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EXPERIENCES */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-3">Activities</p>
            <h2 className="font-playfair text-4xl text-white mb-4">Experiences at LeafWalk</h2>
            <p className="text-white/45 max-w-xl mx-auto text-sm">From forest treks to starlit bonfires — every day at LeafWalk is an adventure</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {EXPERIENCES.map(exp => (
              <div key={exp.title} className="flex gap-4 p-5 bg-white/3 border border-white/8 rounded-2xl hover:border-[#c9a14a]/25 transition-all group">
                <span className="text-3xl flex-shrink-0 group-hover:scale-110 transition-transform">{exp.icon}</span>
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

      {/* REVIEWS */}
      <section className="py-20 px-6 bg-[#0d0d0d]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-3">Guest Reviews</p>
            <h2 className="font-playfair text-4xl text-white mb-3">What Our Guests Say</h2>
            <div className="flex items-center justify-center gap-1 mt-2">
              {[1,2,3,4,5].map(i => <span key={i} className="text-[#c9a14a] text-xl">★</span>)}
              <span className="text-white/50 text-sm ml-2">4.9/5 · 200+ reviews</span>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {REVIEWS.map(r => (
              <div key={r.name} className="bg-white/3 border border-white/8 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">{Array.from({ length: r.rating }).map((_, i) => <span key={i} className="text-[#c9a14a]">★</span>)}</div>
                <p className="text-white/65 text-sm leading-relaxed mb-5 italic">&ldquo;{r.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/8">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c9a14a] to-[#e6c87a] flex items-center justify-center text-black font-bold text-sm">{r.name[0]}</div>
                  <div>
                    <p className="text-white text-sm font-semibold">{r.name}</p>
                    <p className="text-white/40 text-xs">{r.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
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

      {/* FINAL CTA */}
      <section className="py-20 px-6 bg-[#0d0d0d]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-4">Ready?</p>
          <h2 className="font-playfair text-4xl md:text-5xl text-white mb-5">Book Your Mountain Escape</h2>
          <p className="text-white/55 text-base mb-10 leading-relaxed">
            Rooms fill up fast, especially during peak season. Book directly for the best rates and personalised service.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/rooms" className="btn-primary luxury-cta">Check Availability</Link>
            <a href="https://wa.me/919368080535?text=Hi,%20I%20want%20to%20book%20a%20room%20at%20LeafWalk%20Resort"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-8 py-4 bg-green-500/15 border border-green-500/30 text-green-400 font-semibold rounded-full hover:bg-green-500/25 transition-all">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp Enquiry
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-12 pt-10 border-t border-white/8">
            {[{ icon: '🔒', text: 'Secure Payment via Razorpay' }, { icon: '✅', text: 'Instant Booking Confirmation' }, { icon: '📞', text: '24/7 Guest Support' }, { icon: '🏔️', text: 'Best Rate Guarantee' }].map(b => (
              <div key={b.text} className="flex items-center gap-2 text-white/35 text-xs"><span>{b.icon}</span><span>{b.text}</span></div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}