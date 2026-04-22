import Image from 'next/image'
import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

export default async function FoodPage() {
  const supabase = getSupabaseAdmin()
  let settings: any = null
  let sections: any[] = []
  let items: any[] = []

  try {
    const [settingsRes, sectionsRes, itemsRes] = await Promise.all([
      supabase.from('restaurant_menu_settings').select('*').eq('key', 'primary').single(),
      supabase.from('restaurant_menu_sections').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase
        .from('restaurant_menu_items')
        .select('*')
        .eq('is_active', true)
        .eq('is_visible_on_website', true)
        .eq('is_veg', true)
        .order('sort_order', { ascending: true }),
    ])

    settings = settingsRes.data
    sections = sectionsRes.data || []
    items = itemsRes.data || []
  } catch {
    sections = []
    items = []
  }

  const showPrices = Boolean(settings?.show_prices_on_website)
  const note = settings?.menu_note || 'Pure veg menu. Seasonal availability may affect a few dishes.'
  const groupedSections = (sections || [])
    .map((section) => ({
      ...section,
      items: (items || []).filter((item) => item.section_id === section.id),
    }))
    .filter((section) => section.items.length > 0)

  const featuredSections = groupedSections.slice(0, 3)
  const remainingSections = groupedSections.slice(3)

  if (!groupedSections.length) {
    return (
      <div className="min-h-screen bg-[#080808] px-6 py-24 text-white">
        <div className="mx-auto max-w-4xl rounded-[32px] border border-[#c9a14a]/15 bg-[#101010] p-10 text-center">
          <div className="mx-auto mb-5 h-24 w-24 overflow-hidden rounded-full border border-[#c9a14a]/20 bg-white">
            <Image src="/logo/leafwalk-logo.jpeg" alt="LeafWalk Resort" width={96} height={96} className="h-full w-full object-contain p-1" />
          </div>
          <h1 className="font-playfair text-4xl text-[#c9a14a]">Food Menu Coming Live</h1>
          <p className="mt-4 text-white/55">Restaurant menu database setup is pending. Run the menu SQL in Supabase and the live menu will appear here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <section className="relative overflow-hidden border-b border-[#c9a14a]/15 bg-[radial-gradient(circle_at_top_left,_rgba(201,161,74,0.22),_transparent_32%),linear-gradient(180deg,#121212_0%,#080808_100%)] px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[260px_1fr] lg:items-stretch">
          <div className="rounded-[32px] border border-[#c9a14a]/20 bg-white p-8 text-center text-black shadow-2xl shadow-black/30">
            <div className="mx-auto mb-5 h-24 w-24 overflow-hidden rounded-full border border-[#c9a14a]/20">
              <Image src="/logo/leafwalk-logo.jpeg" alt="LeafWalk Resort" width={96} height={96} className="h-full w-full object-contain p-1" />
            </div>
            <h1 className="font-playfair text-4xl leading-tight">LeafWalk Resort</h1>
            <p className="mt-3 text-xl font-semibold">(Pure Veg)</p>
            <p className="mt-8 text-sm leading-6 text-black/65">
              Fresh mountain kitchen with regional Uttarakhand dishes, comfort food, breakfast favourites, and hot beverages.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#c9a14a]">Dining</p>
                <h2 className="mt-2 font-playfair text-5xl text-white">Food Menu</h2>
              </div>
                          </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {featuredSections.map((section, index) => (
                <div
                  key={section.id}
                  className={`rounded-[28px] border px-6 py-6 ${index === 1 ? 'border-[#c9a14a]/30 bg-[#c9a14a] text-black' : 'border-white/10 bg-[#0f0f0f] text-white'}`}
                >
                  <h3 className="font-playfair text-3xl">{section.website_heading || section.name}</h3>
                  {section.description && (
                    <p className={`mt-2 text-sm leading-6 ${index === 1 ? 'text-black/75' : 'text-white/55'}`}>{section.description}</p>
                  )}
                  <div className="mt-5 space-y-3">
                    {section.items.slice(0, 7).map((item: any) => (
                      <div key={item.id} className="flex items-start justify-between gap-4 border-b border-current/10 pb-3">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          {(item.unit || item.portion_label) && <p className={`text-xs ${index === 1 ? 'text-black/60' : 'text-white/40'}`}>{item.unit || item.portion_label}</p>}
                        </div>
                        {showPrices && item.is_visible_on_website !== false && item.is_active !== false && (
                          <span className="shrink-0 font-bold">
                            {Number(item.discount_price ?? item.price).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-playfair text-3xl text-[#c9a14a]">Full Vegetarian Menu</h3>
              <p className="mt-2 text-sm text-white/45">{note}</p>
            </div>
            <Link
              href="https://wa.me/919368080535?text=Hi,%20I%20want%20to%20order%20food%20or%20ask%20about%20the%20LeafWalk%20menu"
              target="_blank"
              className="rounded-full border border-green-500/30 bg-green-500/10 px-5 py-3 text-sm font-semibold text-green-400 transition hover:bg-green-500/20"
            >
              Ask on WhatsApp
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {remainingSections.map((section) => (
              <div key={section.id} className="rounded-[28px] border border-white/10 bg-[#0f0f0f] p-6">
                <h4 className="font-playfair text-3xl text-[#c9a14a]">{section.website_heading || section.name}</h4>
                {section.description && <p className="mt-2 text-sm leading-6 text-white/50">{section.description}</p>}
                <div className="mt-5 space-y-3">
                  {section.items.map((item: any) => (
                    <div key={item.id} className="flex items-start justify-between gap-4 border-b border-white/8 pb-3">
                      <div>
                        <p className="font-semibold text-white">{item.name}</p>
                        {(item.unit || item.portion_label) && <p className="text-xs text-white/40">{item.unit || item.portion_label}</p>}
                        {item.description && <p className="mt-1 text-xs leading-5 text-white/30">{item.description}</p>}
                      </div>
                      {showPrices && item.is_visible_on_website !== false && item.is_active !== false && (
                        <span className="shrink-0 font-bold text-[#c9a14a]">
                          {Number(item.discount_price ?? item.price).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
