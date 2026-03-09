'use client'
import { useState } from 'react'
import Link from 'next/link'

const EXPERIENCES = [
  {
    id: 'trekking',
    icon: '🥾',
    title: 'Forest Trekking',
    category: 'Adventure',
    duration: '3–6 hours',
    difficulty: 'Easy to Moderate',
    price: '₹500/person',
    desc: 'Guided treks through dense Himalayan oak and rhododendron forests. Our local guides know every trail, waterfall, and viewpoint. Suitable for beginners and seasoned trekkers alike.',
    highlights: ['Expert local guides', 'Packed lunch available', 'Multiple trail options', 'Bird watching along the route'],
    image: '🥾',
  },
  {
    id: 'bonfire',
    icon: '🔥',
    title: 'Evening Bonfire',
    category: 'Relaxation',
    duration: '2–3 hours',
    difficulty: 'Easy',
    price: '₹200/person',
    desc: 'Unwind by a crackling bonfire under a brilliant star-filled sky. Share stories, sip chai, and let the mountain silence wash over you. An unmissable LeafWalk tradition.',
    highlights: ['Stargazing session included', 'Chai & snacks served', 'Music on request', 'Blankets provided'],
    image: '🔥',
  },
  {
    id: 'views',
    icon: '🏔️',
    title: 'Sunrise & Sunset Views',
    category: 'Scenic',
    duration: 'Self-guided',
    difficulty: 'Easy',
    price: 'Complimentary',
    desc: 'Wake up before dawn and witness the Himalayan peaks set ablaze with golden light. Our property\'s position offers panoramic views that will leave you speechless.',
    highlights: ['360° mountain views', 'Photography guide tips', 'Best spots marked on map', 'Complimentary morning chai'],
    image: '🏔️',
  },
  {
    id: 'yamunotri',
    icon: '🙏',
    title: 'Yamunotri Dham Visit',
    category: 'Spiritual',
    duration: 'Full day',
    difficulty: 'Moderate',
    price: '₹1,200/person',
    desc: 'A sacred pilgrimage to one of the Char Dham — the source of the holy Yamuna river. We arrange transport, guide, and packed lunch for this spiritually enriching journey.',
    highlights: ['Pickup & drop included', 'Experienced guide', 'Best time: May–Nov', 'Temple rituals guidance'],
    image: '🙏',
  },
  {
    id: 'birdwatching',
    icon: '🦅',
    title: 'Bird Watching',
    category: 'Nature',
    duration: '2–3 hours',
    difficulty: 'Easy',
    price: '₹300/person',
    desc: 'The Himalayan forests around LeafWalk are home to over 200 bird species — Himalayan Monal, Koklass Pheasant, Verditer Flycatcher, and more. A birder\'s paradise.',
    highlights: ['Expert birding guide', 'Binoculars available', 'Best at dawn or dusk', 'Species checklist provided'],
    image: '🦅',
  },
  {
    id: 'photography',
    icon: '📸',
    title: 'Photography Walks',
    category: 'Creative',
    duration: '2–4 hours',
    difficulty: 'Easy',
    price: '₹400/person',
    desc: 'Capture the magic of the mountains with guidance from our photography enthusiast staff. From landscapes to macro shots of alpine flowers — every frame tells a story.',
    highlights: ['Golden hour walks', 'Best composition spots', 'Landscape & portrait tips', 'Weather guidance'],
    image: '📸',
  },
  {
    id: 'local-village',
    icon: '🏘️',
    title: 'Village Walk',
    category: 'Cultural',
    duration: '2–3 hours',
    difficulty: 'Easy',
    price: '₹250/person',
    desc: 'Walk through traditional Garhwali villages, interact with locals, see ancient stone temples, and learn about the mountain way of life. A genuine cultural immersion.',
    highlights: ['Local guide from village', 'Visit ancient temples', 'Traditional home visit', 'Local snacks tasting'],
    image: '🏘️',
  },
  {
    id: 'stargazing',
    icon: '🌟',
    title: 'Night Stargazing',
    category: 'Astronomy',
    duration: '1–2 hours',
    difficulty: 'Easy',
    price: '₹150/person',
    desc: 'Far from city lights, LeafWalk offers some of the clearest night skies you\'ll ever see. Identify constellations, spot the Milky Way, and marvel at the universe above.',
    highlights: ['Telescope available', 'Constellation guide', 'Hot soup served', 'Blankets provided'],
    image: '🌟',
  },
  {
    id: 'ayurveda',
    icon: '🌿',
    title: 'Herbal Walk & Ayurveda',
    category: 'Wellness',
    duration: '1.5 hours',
    difficulty: 'Easy',
    price: '₹350/person',
    desc: 'Learn about Himalayan medicinal plants and their traditional uses with a local vaid (Ayurvedic healer). Discover the pharmacy that grows wild in these forests.',
    highlights: ['Certified Ayurvedic guide', 'Herb identification', 'Herbal tea tasting', 'Take-home herb guide'],
    image: '🌿',
  },
]

const CATEGORIES = ['All', 'Adventure', 'Relaxation', 'Scenic', 'Spiritual', 'Nature', 'Creative', 'Cultural', 'Astronomy', 'Wellness']

const DIFFICULTY_COLOR: Record<string, string> = {
  'Easy': 'text-green-400 bg-green-500/10 border-green-500/20',
  'Easy to Moderate': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  'Moderate': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
}

export default function ExperiencesPage() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [selected, setSelected] = useState<typeof EXPERIENCES[0] | null>(null)

  const filtered = activeCategory === 'All' ? EXPERIENCES : EXPERIENCES.filter(e => e.category === activeCategory)

  return (
    <div className="min-h-screen" style={{ background: '#0b0b0b' }}>

      {/* Hero */}
      <div className="relative py-24 px-6 overflow-hidden" style={{ background: 'linear-gradient(to bottom, #060d0a, #0b0b0b)' }}>
        <div className="absolute inset-0 flex items-center justify-center opacity-5 text-[20rem] select-none pointer-events-none">🌿</div>
        <div className="relative max-w-4xl mx-auto text-center">
          <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-4">Activities & Experiences</p>
          <h1 className="font-playfair text-5xl md:text-6xl text-white mb-5">Experiences at LeafWalk</h1>
          <p className="text-white/55 text-lg max-w-2xl mx-auto leading-relaxed">
            Beyond a comfortable stay — every day at LeafWalk is an invitation to explore, discover,
            and reconnect with nature, culture, and yourself.
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="py-8 px-6 bg-[#0d0d0d] border-b border-white/5">
        <div className="max-w-6xl mx-auto flex gap-2 flex-wrap justify-center">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${activeCategory === cat ? 'bg-[#c9a14a] text-black' : 'bg-white/5 border border-white/10 text-white/55 hover:text-white hover:bg-white/10'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(exp => (
              <div key={exp.id}
                className="group flex flex-col bg-white/3 border border-white/8 rounded-2xl overflow-hidden hover:border-[#c9a14a]/30 transition-all duration-300 cursor-pointer"
                onClick={() => setSelected(exp)}>
                {/* Image / icon area */}
                <div className="h-32 flex items-center justify-center text-6xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(201,161,74,0.04))' }}>
                  {exp.image}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-white font-semibold">{exp.title}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs shrink-0" style={{ background: 'rgba(201,161,74,0.1)', color: '#c9a14a', border: '1px solid rgba(201,161,74,0.2)' }}>
                      {exp.category}
                    </span>
                  </div>
                  <p className="text-white/50 text-xs leading-relaxed mb-4 flex-1">{exp.desc.slice(0, 100)}...</p>
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs mt-auto">
                    <div className="flex gap-2">
                      <span className={`px-2 py-0.5 rounded-full border ${DIFFICULTY_COLOR[exp.difficulty] || 'text-white/40 border-white/10'}`}>{exp.difficulty}</span>
                      <span className="text-white/35">⏱ {exp.duration}</span>
                    </div>
                    <span className="text-[#c9a14a] font-semibold">{exp.price}</span>
                  </div>
                  <button className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold transition-all group-hover:opacity-100 opacity-0 border border-[#c9a14a]/30 text-[#c9a14a]"
                    style={{ background: 'rgba(201,161,74,0.08)' }}>
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-[#0d0d0d]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-playfair text-3xl text-white mb-4">Plan Your Perfect Day</h2>
          <p className="text-white/45 text-sm mb-8 leading-relaxed">
            Book your stay and let us curate a personalised activity itinerary. All experiences can be arranged during your stay — just ask at the front desk or WhatsApp us.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/rooms" className="px-8 py-3.5 rounded-full font-semibold text-sm transition-all" style={{ background: 'linear-gradient(135deg,#c9a14a,#e6c87a)', color: '#000' }}>
              Book Your Stay
            </Link>
            <a href="https://wa.me/919368080535?text=Hi,%20I%20want%20to%20know%20more%20about%20experiences%20at%20LeafWalk"
              target="_blank" rel="noopener noreferrer"
              className="px-8 py-3.5 rounded-full font-semibold text-sm transition-all flex items-center gap-2"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Enquire on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="relative w-full max-w-lg rounded-3xl border border-white/15 overflow-hidden max-h-[85vh] overflow-y-auto"
            style={{ background: '#111' }} onClick={e => e.stopPropagation()}>
            <div className="h-32 flex items-center justify-center text-7xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(201,161,74,0.05))' }}>
              {selected.image}
            </div>
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white/60 hover:text-white flex items-center justify-center text-lg transition-all">✕</button>
            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="font-playfair text-2xl text-white">{selected.title}</h3>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0" style={{ background: 'rgba(201,161,74,0.12)', color: '#c9a14a', border: '1px solid rgba(201,161,74,0.25)' }}>
                  {selected.category}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 mb-4 text-xs">
                <span className={`px-2.5 py-1 rounded-full border ${DIFFICULTY_COLOR[selected.difficulty] || 'text-white/40 border-white/10'}`}>{selected.difficulty}</span>
                <span className="text-white/40 flex items-center gap-1">⏱ {selected.duration}</span>
                <span className="text-[#c9a14a] font-semibold">{selected.price}</span>
              </div>
              <p className="text-white/60 text-sm leading-relaxed mb-5">{selected.desc}</p>
              <div className="mb-6">
                <h4 className="text-white font-semibold text-sm mb-3">Highlights</h4>
                <ul className="space-y-2">
                  {selected.highlights.map(h => (
                    <li key={h} className="flex items-center gap-2.5 text-white/60 text-sm">
                      <span className="w-4 h-4 rounded-full bg-[#c9a14a]/20 text-[#c9a14a] flex items-center justify-center text-xs flex-shrink-0">✓</span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              <a href={`https://wa.me/919368080535?text=Hi,%20I%20want%20to%20book%20${encodeURIComponent(selected.title)}%20experience%20at%20LeafWalk`}
                target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Book this experience on WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}