'use client'
import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'

type Category = 'All' | 'Rooms' | 'Nature' | 'Food' | 'Experiences' | 'Winters'

interface GalleryItem {
  src: string; category: Category; alt: string; span?: 'wide' | 'tall' | 'normal'
}

const IMAGES: GalleryItem[] = [
  // Rooms
  { src: '/gallery/room1.jpg',       category: 'Rooms',       alt: 'Deluxe Room at LeafWalk Resort',        span: 'wide' },
  { src: '/gallery/room2.jpg',       category: 'Rooms',       alt: 'Premium Cottage interior' },
  { src: '/gallery/room3.jpg',       category: 'Rooms',       alt: 'Cozy mountain view bedroom',            span: 'tall' },
  { src: '/gallery/room4.jpg',       category: 'Rooms',       alt: 'Room balcony with valley view' },
  { src: '/gallery/room5.jpg',       category: 'Rooms',       alt: 'Luxurious premium suite' },
  { src: '/gallery/room6.jpg',       category: 'Rooms',       alt: 'Deluxe room amenities' },
  // Nature
  { src: '/gallery/nature1.jpg',     category: 'Nature',      alt: 'Himalayan forest view from resort',     span: 'wide' },
  { src: '/gallery/nature2.jpg',     category: 'Nature',      alt: 'Mountain sunrise at Uttarkashi' },
  { src: '/gallery/nature3.jpg',     category: 'Nature',      alt: 'Dense forest around LeafWalk Resort',   span: 'tall' },
  { src: '/gallery/nature4.jpg',     category: 'Nature',      alt: 'Valley and river views Uttarkashi' },
  // Food
  { src: '/gallery/food1.jpg',       category: 'Food',        alt: 'Authentic Garhwali cuisine',            span: 'wide' },
  // Experiences
  { src: '/gallery/experience1.jpg', category: 'Experiences', alt: 'Trekking in Uttarkashi forests',        span: 'wide' },
  // Winters
  { src: '/gallery/2.jpg',           category: 'Winters',     alt: 'Snow-covered resort in winter',         span: 'wide' },
]

const CATS: Category[] = ['All', 'Rooms', 'Nature', 'Food', 'Experiences', 'Winters']

export default function GalleryPage() {
  const [active, setActive]     = useState<Category>('All')
  const [lightbox, setLightbox] = useState<number | null>(null)

  const filtered = active === 'All' ? IMAGES : IMAGES.filter(i => i.category === active)

  const close = useCallback(() => setLightbox(null), [])
  const prev  = useCallback(() => setLightbox(i => i !== null ? (i - 1 + filtered.length) % filtered.length : null), [filtered.length])
  const next  = useCallback(() => setLightbox(i => i !== null ? (i + 1) % filtered.length : null), [filtered.length])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [close, prev, next])

  return (
    <>
      {/* ── Lightbox ───────────────────────────────────────────────────────── */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-[100] bg-black/97 flex items-center justify-center" onClick={close}>
          {/* Close */}
          <button onClick={close} className="absolute top-5 right-6 text-white/50 hover:text-white text-4xl font-light z-10 transition-colors">×</button>

          {/* Counter */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 text-white/40 text-sm z-10">{lightbox + 1} / {filtered.length}</div>

          {/* Prev */}
          <button onClick={e => { e.stopPropagation(); prev() }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white/50 hover:text-white text-3xl z-10 bg-white/5 hover:bg-white/10 rounded-full transition-all">
            ‹
          </button>

          {/* Image */}
          <div className="relative max-w-5xl max-h-[85vh] w-full mx-24 aspect-video" onClick={e => e.stopPropagation()}>
            <Image src={filtered[lightbox].src} alt={filtered[lightbox].alt} fill className="object-contain" priority />
          </div>

          {/* Next */}
          <button onClick={e => { e.stopPropagation(); next() }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white/50 hover:text-white text-3xl z-10 bg-white/5 hover:bg-white/10 rounded-full transition-all">
            ›
          </button>

          {/* Caption */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm text-center px-8">
            {filtered[lightbox].alt}
          </div>

          {/* Thumbnail strip */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-2xl px-4">
            {filtered.map((img, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setLightbox(i) }}
                className={`relative w-14 h-10 rounded overflow-hidden flex-shrink-0 transition-all ${i === lightbox ? 'ring-2 ring-[#c9a14a] opacity-100' : 'opacity-40 hover:opacity-70'}`}>
                <Image src={img.src} alt={img.alt} fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-screen bg-[#0b0b0b]">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative py-20 text-center px-6">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(201,161,74,0.07) 0%, transparent 60%)' }} />
          <div className="relative max-w-2xl mx-auto">
            <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-4">Visual Journey</p>
            <h1 className="font-playfair text-5xl md:text-6xl text-white mb-5">Gallery</h1>
            <p className="text-white/50 text-lg">Explore LeafWalk Resort through our lens — rooms, nature, food, and experiences in the Himalayan forests of Uttarkashi.</p>
          </div>
        </section>

        {/* ── Filter tabs ───────────────────────────────────────────────────── */}
        <div className="flex justify-center gap-3 flex-wrap px-6 mb-12">
          {CATS.map(cat => {
            const count = cat === 'All' ? IMAGES.length : IMAGES.filter(i => i.category === cat).length
            return (
              <button key={cat} onClick={() => setActive(cat)}
                className={`px-5 py-2 rounded-full text-xs uppercase tracking-widest font-semibold transition-all ${
                  active === cat
                    ? 'bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black shadow-lg shadow-[#c9a14a]/20'
                    : 'border border-white/15 text-white/55 hover:border-[#c9a14a]/40 hover:text-white bg-white/3'
                }`}>
                {cat} {count > 0 && <span className="opacity-60">({count})</span>}
              </button>
            )
          })}
        </div>

        {/* ── Masonry Grid ──────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-6 pb-24">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-white/30">Is category mein abhi photos nahi hain</div>
          ) : (
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
              {filtered.map((img, i) => (
                <div key={`${active}-${i}`}
                  className={`group relative overflow-hidden rounded-2xl cursor-pointer break-inside-avoid bg-white/5 ${
                    img.span === 'wide' ? 'sm:col-span-2' : img.span === 'tall' ? 'row-span-2' : ''
                  }`}
                  onClick={() => setLightbox(i)}>
                  <div className={`relative w-full ${img.span === 'tall' ? 'h-[500px]' : img.span === 'wide' ? 'h-72' : 'h-56'}`}>
                    <Image
                      src={img.src}
                      alt={img.alt}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {/* Labels */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <p className="text-white/80 text-xs uppercase tracking-wider">{img.category}</p>
                      <p className="text-white text-sm font-medium mt-0.5 leading-tight">{img.alt}</p>
                    </div>
                    {/* Zoom icon */}
                    <div className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur rounded-full flex items-center justify-center text-white/60 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto px-6 pb-24 text-center">
          <div className="bg-white/3 border border-white/10 rounded-2xl p-10">
            <h3 className="font-playfair text-3xl text-white mb-3">Ready to Experience This?</h3>
            <p className="text-white/50 mb-7">Book your stay at LeafWalk Resort and create your own memories in the Himalayan forests</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/rooms" className="px-8 py-4 bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black font-bold rounded-full hover:opacity-90 transition-all">Book Your Stay</a>
              <a href="https://wa.me/919368080535?text=Hi,%20I%20saw%20your%20gallery%20and%20want%20to%20book%20a%20room"
                target="_blank" rel="noopener noreferrer"
                className="px-8 py-4 bg-green-500/15 border border-green-500/25 text-green-400 font-semibold rounded-full hover:bg-green-500/25 transition-all flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
