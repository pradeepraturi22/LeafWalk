'use client'
import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'

type Category = 'All' | 'Rooms' | 'Nature' | 'Food' | 'Experiences' | 'Winters'

interface GalleryItem {
  src: string
  category: Category
  alt: string
  span?: 'wide' | 'tall' | 'normal'
}

type GalleryImageRow = {
  id: string
  title?: string | null
  description?: string | null
  image_url: string
  category?: string | null
  is_featured?: boolean | null
  display_order?: number | null
}

const FALLBACK_IMAGES: GalleryItem[] = [
  { src: '/gallery/room1.jpg', category: 'Rooms', alt: 'Deluxe Room at LeafWalk Resort', span: 'wide' },
  { src: '/gallery/room2.jpg', category: 'Rooms', alt: 'Premium Cottage interior' },
  { src: '/gallery/room3.jpg', category: 'Rooms', alt: 'Cozy mountain view bedroom', span: 'tall' },
  { src: '/gallery/room4.jpg', category: 'Rooms', alt: 'Room balcony with valley view' },
  { src: '/gallery/room5.jpg', category: 'Rooms', alt: 'Luxurious premium suite' },
  { src: '/gallery/room6.jpg', category: 'Rooms', alt: 'Deluxe room amenities' },
  { src: '/gallery/nature1.jpg', category: 'Nature', alt: 'Himalayan forest view from resort', span: 'wide' },
  { src: '/gallery/nature2.jpg', category: 'Nature', alt: 'Mountain sunrise at Uttarkashi' },
  { src: '/gallery/nature3.jpg', category: 'Nature', alt: 'Dense forest around LeafWalk Resort', span: 'tall' },
  { src: '/gallery/nature4.jpg', category: 'Nature', alt: 'Valley and river views Uttarkashi' },
  { src: '/gallery/food1.jpg', category: 'Food', alt: 'Authentic Garhwali cuisine', span: 'wide' },
  { src: '/gallery/experience1.jpg', category: 'Experiences', alt: 'Trekking in Uttarkashi forests', span: 'wide' },
  { src: '/gallery/2.jpg', category: 'Winters', alt: 'Snow-covered resort in winter', span: 'wide' },
]

const CATS: Category[] = ['All', 'Rooms', 'Nature', 'Food', 'Experiences', 'Winters']

function normalizeCategory(raw?: string | null): Category {
  const value = (raw || '').trim().toLowerCase()
  if (value.includes('room')) return 'Rooms'
  if (value.includes('food') || value.includes('dining')) return 'Food'
  if (value.includes('experience') || value.includes('activity')) return 'Experiences'
  if (value.includes('winter') || value.includes('snow')) return 'Winters'
  if (value.includes('nature') || value.includes('view') || value.includes('forest')) return 'Nature'
  return 'Nature'
}

function mapGalleryRows(rows: GalleryImageRow[]): GalleryItem[] {
  return rows.map((row, index) => ({
    src: row.image_url,
    category: normalizeCategory(row.category),
    alt: row.title || row.description || `LeafWalk Gallery Image ${index + 1}`,
    span: row.is_featured ? 'wide' : index % 5 === 2 ? 'tall' : 'normal',
  }))
}

export default function GalleryPage() {
  const [active, setActive] = useState<Category>('All')
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [images, setImages] = useState<GalleryItem[]>(FALLBACK_IMAGES)

  useEffect(() => {
    let cancelled = false

    fetch('/api/gallery-images')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load gallery')
        return res.json()
      })
      .then((payload) => {
        if (cancelled) return
        const mapped = mapGalleryRows(payload.images || [])
        if (mapped.length > 0) setImages(mapped)
      })
      .catch((error) => {
        console.error(error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const filtered = active === 'All' ? images : images.filter((item) => item.category === active)

  const close = useCallback(() => setLightbox(null), [])
  const prev = useCallback(
    () => setLightbox((i) => (i !== null ? (i - 1 + filtered.length) % filtered.length : null)),
    [filtered.length]
  )
  const next = useCallback(
    () => setLightbox((i) => (i !== null ? (i + 1) % filtered.length : null)),
    [filtered.length]
  )

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
      {lightbox !== null && (
        <div className="fixed inset-0 z-[100] bg-black/97 flex items-center justify-center" onClick={close}>
          <button onClick={close} className="absolute top-5 right-6 text-white/50 hover:text-white text-4xl font-light z-10 transition-colors">x</button>
          <div className="absolute top-6 left-1/2 -translate-x-1/2 text-white/40 text-sm z-10">{lightbox + 1} / {filtered.length}</div>
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white/50 hover:text-white text-3xl z-10 bg-white/5 hover:bg-white/10 rounded-full transition-all"
          >
            {'<'}
          </button>
          <div className="relative max-w-5xl max-h-[85vh] w-full mx-24 aspect-video" onClick={(e) => e.stopPropagation()}>
            <Image src={filtered[lightbox].src} alt={filtered[lightbox].alt} fill className="object-contain" priority />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white/50 hover:text-white text-3xl z-10 bg-white/5 hover:bg-white/10 rounded-full transition-all"
          >
            {'>'}
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm text-center px-8">
            {filtered[lightbox].alt}
          </div>
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-2xl px-4">
            {filtered.map((img, i) => (
              <button
                key={`${img.src}-${i}`}
                onClick={(e) => { e.stopPropagation(); setLightbox(i) }}
                className={`relative w-14 h-10 rounded overflow-hidden flex-shrink-0 transition-all ${i === lightbox ? 'ring-2 ring-[#c9a14a] opacity-100' : 'opacity-40 hover:opacity-70'}`}
              >
                <Image src={img.src} alt={img.alt} fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-screen bg-[#0b0b0b]">
        <section className="relative py-20 text-center px-6">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(201,161,74,0.07) 0%, transparent 60%)' }} />
          <div className="relative max-w-2xl mx-auto">
            <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-4">Visual Journey</p>
            <h1 className="font-playfair text-5xl md:text-6xl text-white mb-5">Gallery</h1>
            <p className="text-white/50 text-lg">Explore LeafWalk Resort through our lens — rooms, nature, food, and experiences in the Himalayan forests of Uttarkashi.</p>
          </div>
        </section>

        <div className="flex justify-center gap-3 flex-wrap px-6 mb-12">
          {CATS.map((cat) => {
            const count = cat === 'All' ? images.length : images.filter((item) => item.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`px-5 py-2 rounded-full text-xs uppercase tracking-widest font-semibold transition-all ${
                  active === cat
                    ? 'bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black shadow-lg shadow-[#c9a14a]/20'
                    : 'border border-white/15 text-white/55 hover:border-[#c9a14a]/40 hover:text-white bg-white/3'
                }`}
              >
                {cat} {count > 0 && <span className="opacity-60">({count})</span>}
              </button>
            )
          })}
        </div>

        <div className="max-w-7xl mx-auto px-6 pb-24">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-white/30">No photos available in this category yet.</div>
          ) : (
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
              {filtered.map((img, i) => (
                <div
                  key={`${active}-${img.src}-${i}`}
                  className="group relative overflow-hidden rounded-2xl cursor-pointer break-inside-avoid bg-white/5"
                  onClick={() => setLightbox(i)}
                >
                  <div className={`relative w-full ${img.span === 'tall' ? 'h-[500px]' : img.span === 'wide' ? 'h-72' : 'h-56'}`}>
                    <Image
                      src={img.src}
                      alt={img.alt}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <p className="text-white/80 text-xs uppercase tracking-wider">{img.category}</p>
                      <p className="text-white text-sm font-medium mt-0.5 leading-tight">{img.alt}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="max-w-3xl mx-auto px-6 pb-24 text-center">
          <div className="bg-white/3 border border-white/10 rounded-2xl p-10">
            <h3 className="font-playfair text-3xl text-white mb-3">Ready to Experience This?</h3>
            <p className="text-white/50 mb-7">Book your stay at LeafWalk Resort and create your own memories in the Himalayan forests</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/rooms" className="px-8 py-4 bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black font-bold rounded-full hover:opacity-90 transition-all">Book Your Stay</a>
              <a
                href="https://wa.me/919368080535?text=Hi,%20I%20saw%20your%20gallery%20and%20want%20to%20book%20a%20room"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-green-500/15 border border-green-500/25 text-green-400 font-semibold rounded-full hover:bg-green-500/25 transition-all flex items-center justify-center gap-2"
              >
                WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
