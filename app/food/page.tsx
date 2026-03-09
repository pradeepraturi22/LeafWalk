'use client'
import { useState } from 'react'

// ── Demo menu data — replace with real data later ─────────────────────────────
const MENU_CATEGORIES = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    icon: '🍳',
    desc: 'Served 7:30 AM – 10:30 AM',
    items: [
      { name: 'Aloo Paratha',          desc: 'Whole wheat flatbread stuffed with spiced potatoes, served with curd & pickle',  price: 120, veg: true,  popular: true  },
      { name: 'Uttarakhand Thali',     desc: 'Dal, rice, roti, seasonal sabzi, raita — a wholesome local spread',               price: 180, veg: true,  popular: true  },
      { name: 'Poha',                  desc: 'Flattened rice with mustard seeds, green chilli, coriander, lemon',               price: 90,  veg: true,  popular: false },
      { name: 'Bread Omelette',        desc: 'Two-egg omelette with toasted bread, butter, masala or plain',                    price: 110, veg: false, popular: false },
      { name: 'Upma',                  desc: 'Semolina cooked with vegetables, mustard, curry leaves & nuts',                   price: 90,  veg: true,  popular: false },
      { name: 'Pancakes',              desc: 'Fluffy pancakes served with honey & seasonal fruit jam',                          price: 130, veg: true,  popular: false },
      { name: 'Masala Chai + Biscuits',desc: 'Freshly brewed ginger-cardamom tea with local biscuits',                         price: 50,  veg: true,  popular: true  },
    ],
  },
  {
    id: 'lunch',
    name: 'Lunch',
    icon: '🍛',
    desc: 'Served 12:30 PM – 3:00 PM',
    items: [
      { name: 'Garhwali Dal Fry',      desc: 'Local black lentils slow-cooked with mountain spices & ghee tadka',              price: 150, veg: true,  popular: true  },
      { name: 'Aloo Palak Sabzi',      desc: 'Potatoes and fresh spinach in a ginger-garlic masala',                           price: 130, veg: true,  popular: false },
      { name: 'Rajma Chawal',          desc: 'Red kidney bean curry served with steamed basmati rice',                          price: 160, veg: true,  popular: true  },
      { name: 'Chicken Curry',         desc: 'Free-range mountain chicken cooked in Garhwali spices',                           price: 220, veg: false, popular: true  },
      { name: 'Mutton Curry',          desc: 'Slow-cooked mutton in whole spice gravy, best paired with rotis',                 price: 280, veg: false, popular: false },
      { name: 'Jeera Rice',            desc: 'Fragrant basmati rice tempered with cumin seeds & bay leaf',                      price: 100, veg: true,  popular: false },
      { name: 'Full Lunch Thali',      desc: 'Dal, 2 sabzi, rice, roti, salad, papad, raita & dessert',                        price: 250, veg: true,  popular: true  },
    ],
  },
  {
    id: 'snacks',
    name: 'Snacks & Beverages',
    icon: '☕',
    desc: 'Available all day',
    items: [
      { name: 'Maggi Noodles',         desc: 'The mountain classic — instant noodles with veggies, served hot',                 price: 80,  veg: true,  popular: true  },
      { name: 'Pakodas',               desc: 'Crispy fried fritters — paneer, onion, or mix veg with chutney',                  price: 100, veg: true,  popular: true  },
      { name: 'Samosa (2 pcs)',        desc: 'Potato-pea stuffed pastry, fried golden with tamarind chutney',                   price: 70,  veg: true,  popular: false },
      { name: 'Masala Chai',           desc: 'House spiced ginger-cardamom tea',                                                price: 40,  veg: true,  popular: true  },
      { name: 'Cold Coffee',           desc: 'Chilled milk blended with coffee, ice cream & sugar',                             price: 90,  veg: true,  popular: false },
      { name: 'Fresh Lime Soda',       desc: 'Nimbu paani — sweet, salty or masala',                                            price: 60,  veg: true,  popular: false },
      { name: 'Seasonal Fresh Juice',  desc: 'Apple, peach, or guava depending on the season',                                  price: 80,  veg: true,  popular: false },
    ],
  },
  {
    id: 'dinner',
    name: 'Dinner',
    icon: '🍽️',
    desc: 'Served 7:30 PM – 10:00 PM',
    items: [
      { name: 'Paneer Butter Masala',  desc: 'Cottage cheese in a rich tomato-butter-cream gravy',                             price: 190, veg: true,  popular: true  },
      { name: 'Dal Makhani',           desc: 'Slow-cooked black lentils in a buttery tomato base',                              price: 160, veg: true,  popular: true  },
      { name: 'Veg Biryani',           desc: 'Fragrant basmati rice layered with seasonal vegetables & whole spices',           price: 180, veg: true,  popular: false },
      { name: 'Chicken Biryani',       desc: 'Slow-cooked rice with tender chicken, saffron & fried onions',                    price: 260, veg: false, popular: true  },
      { name: 'Mixed Veg Kadai',       desc: 'Seasonal vegetables in a tangy kadai masala gravy',                               price: 150, veg: true,  popular: false },
      { name: 'Roti / Paratha',        desc: 'Freshly made whole-wheat roti or butter paratha (2 pcs)',                         price: 40,  veg: true,  popular: false },
      { name: 'Gulab Jamun (2 pcs)',   desc: 'Soft milk-solid dumplings soaked in rose-cardamom syrup',                        price: 70,  veg: true,  popular: true  },
      { name: 'Full Dinner Thali',     desc: 'Dal, 2 sabzi, rice, roti, salad, papad, raita & dessert',                        price: 280, veg: true,  popular: false },
    ],
  },
]

const MEAL_PLANS = [
  { code: 'EP', label: 'Room Only',           desc: 'No meals included. Order à la carte anytime from our menu.', icon: '🛏️', price: 'Included in room rate' },
  { code: 'CP', label: 'With Breakfast',      desc: 'Buffet / set breakfast every morning for all guests.',        icon: '☕', price: '₹150/person/day', note: 'Included in online bookings' },
  { code: 'MAP', label: 'Breakfast + Dinner', desc: 'Morning breakfast plus dinner every evening.',                icon: '🍽️', price: '₹350/person/day' },
  { code: 'AP',  label: 'All Meals',          desc: 'Three meals a day — breakfast, lunch, and dinner.',           icon: '🥘', price: '₹550/person/day' },
]

export default function FoodPage() {
  const [activeCategory, setActiveCategory] = useState('breakfast')
  const [vegOnly, setVegOnly] = useState(false)

  const current = MENU_CATEGORIES.find(c => c.id === activeCategory)!
  const items    = vegOnly ? current.items.filter(i => i.veg) : current.items

  return (
    <div className="min-h-screen" style={{ background: '#0b0b0b' }}>

      {/* Hero */}
      <div className="relative py-24 px-6 overflow-hidden" style={{ background: 'linear-gradient(to bottom, #0f0c00, #0b0b0b)' }}>
        <div className="absolute inset-0 flex items-center justify-center opacity-5 text-[20rem] select-none pointer-events-none">🍽️</div>
        <div className="relative max-w-4xl mx-auto text-center">
          <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-4">Dining at LeafWalk</p>
          <h1 className="font-playfair text-5xl md:text-6xl text-white mb-5">Food & Dining</h1>
          <p className="text-white/55 text-lg max-w-2xl mx-auto leading-relaxed">
            Authentic Garhwali cuisine crafted from local ingredients, served with the warmth of mountain hospitality.
            Every meal is a celebration of the Himalayan region.
          </p>
        </div>
      </div>

      {/* Meal Plans */}
      <section className="py-16 px-6 bg-[#0d0d0d]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-playfair text-3xl text-[#c9a14a] mb-2">Meal Plans</h2>
            <p className="text-white/40 text-sm">Choose the plan that suits your stay. CP (Breakfast) is included in all online bookings.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MEAL_PLANS.map(p => (
              <div key={p.code} className={`p-5 rounded-2xl border ${p.code === 'CP' ? 'border-[#c9a14a]/40' : 'border-white/8'}`}
                style={{ background: p.code === 'CP' ? 'rgba(201,161,74,0.06)' : 'rgba(255,255,255,0.025)' }}>
                <div className="text-3xl mb-3">{p.icon}</div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[#c9a14a] font-bold text-sm">{p.code}</span>
                  {p.code === 'CP' && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#c9a14a]/20 text-[#c9a14a] font-bold">Online</span>}
                </div>
                <p className="text-white font-semibold text-sm mb-2">{p.label}</p>
                <p className="text-white/45 text-xs leading-relaxed mb-3">{p.desc}</p>
                {p.note && <p className="text-[#c9a14a] text-xs font-medium">✓ {p.note}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Menu */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-playfair text-3xl text-white mb-2">Our Menu</h2>
            <p className="text-white/40 text-sm">All prices are per serving. Menu may vary by season.</p>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 flex-wrap justify-center mb-6">
            {MENU_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${activeCategory === cat.id ? 'bg-[#c9a14a] text-black' : 'bg-white/5 border border-white/12 text-white/60 hover:text-white hover:bg-white/10'}`}>
                <span>{cat.icon}</span>{cat.name}
              </button>
            ))}
          </div>

          {/* Veg toggle + timing */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <p className="text-white/40 text-sm">{current.desc}</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={vegOnly} onChange={e => setVegOnly(e.target.checked)} />
                <div className={`w-10 h-5 rounded-full transition-all ${vegOnly ? 'bg-green-500' : 'bg-white/15'}`} />
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${vegOnly ? 'left-5' : 'left-0.5'}`} />
              </div>
              <span className="text-sm text-white/60">Veg only 🌿</span>
            </label>
          </div>

          {/* Items grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {items.map(item => (
              <div key={item.name} className={`flex items-start gap-4 p-4 rounded-2xl border transition-all hover:border-white/15 ${item.popular ? 'border-[#c9a14a]/15' : 'border-white/6'}`}
                style={{ background: item.popular ? 'rgba(201,161,74,0.04)' : 'rgba(255,255,255,0.02)' }}>
                <div className="flex-shrink-0 mt-0.5">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${item.veg ? 'border-green-500' : 'border-red-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${item.veg ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white font-semibold text-sm">{item.name}</span>
                    {item.popular && <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#c9a14a]/20 text-[#c9a14a] font-bold">Popular</span>}
                  </div>
                  <p className="text-white/45 text-xs leading-relaxed">{item.desc}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="text-[#c9a14a] font-bold text-sm">₹{item.price}</span>
                </div>
              </div>
            ))}
          </div>

          {items.length === 0 && (
            <p className="text-center text-white/30 py-10">No items found for this filter.</p>
          )}
        </div>
      </section>

      {/* Dining experience highlights */}
      <section className="py-16 px-6 bg-[#0d0d0d]">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-playfair text-3xl text-[#c9a14a] text-center mb-10">The Dining Experience</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: '🌿', title: 'Farm to Table',      desc: 'Ingredients sourced from local farms and forests. Fresh, seasonal, and organic wherever possible.' },
              { icon: '🏔️', title: 'Mountain Recipes',   desc: 'Traditional Garhwali recipes passed down through generations, cooked in authentic mountain style.' },
              { icon: '🔥', title: 'Bonfire Dining',     desc: 'Special dinner under the stars by the bonfire on request — an unforgettable mountain experience.' },
              { icon: '🧘', title: 'Satvik Options',     desc: 'Pure vegetarian, onion-garlic free satvik meals available for pilgrims and spiritual travellers.' },
              { icon: '👶', title: 'Kids Friendly',      desc: 'Simple, mild dishes and special kids menu available. We accommodate dietary restrictions happily.' },
              { icon: '📦', title: 'Packed Lunch',       desc: 'Heading for a trek? We pack hearty lunches with paranthas, pickle, and fruits for your journey.' },
            ].map(h => (
              <div key={h.title} className="flex gap-4 p-5 bg-white/3 border border-white/8 rounded-2xl hover:border-[#c9a14a]/20 transition-all">
                <span className="text-2xl flex-shrink-0">{h.icon}</span>
                <div>
                  <h3 className="text-white font-semibold text-sm mb-1">{h.title}</h3>
                  <p className="text-white/45 text-xs leading-relaxed">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Note about menu */}
      <section className="py-10 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-white/30 text-sm leading-relaxed">
            Menu items and prices are indicative and may vary by season and availability.
            For special dietary requirements or large group meals, please contact us in advance.
          </p>
          <a href="https://wa.me/919368080535?text=Hi,%20I%20want%20to%20enquire%20about%20dining%20at%20LeafWalk"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-full text-sm font-semibold transition-all"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Ask about dining options
          </a>
        </div>
      </section>
    </div>
  )
}