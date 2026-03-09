import Link from 'next/link'

const WA_ICON = <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-[#080808] border-t border-white/8 mt-24">
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-14">

          {/* Brand column */}
          <div>
            <h2 className="font-playfair text-2xl text-[#c9a14a] mb-2">LeafWalk Resort</h2>
            <p className="text-white/40 text-sm leading-relaxed mb-6">
              A luxury mountain retreat in the Himalayan forests of Uttarkashi, Uttarakhand — where nature meets comfort.
            </p>
            {/* Social icons */}
            <div className="flex gap-2.5">
              {[
                { href: 'https://www.instagram.com/leafwalkresort', label: 'Instagram', icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg> },
                { href: 'https://www.facebook.com/leafwalkresort', label: 'Facebook', icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
                { href: 'https://wa.me/919368080535', label: 'WhatsApp', icon: WA_ICON },
              ].map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-[#c9a14a] hover:border-[#c9a14a]/40 hover:bg-[#c9a14a]/10 transition-all">
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Explore */}
          <div>
            <h3 className="text-white text-sm font-semibold uppercase tracking-widest mb-5">Explore</h3>
            <ul className="space-y-2.5">
              {[
                ['/rooms','All Rooms'],
                ['/rooms?category=deluxe','Deluxe Rooms'],
                ['/rooms?category=premium','Premium Cottages'],
                ['/gallery','Photo Gallery'],
                ['/experiences','Experiences'],
                ['/food','Dining & Food'],
                ['/contact','Contact Us'],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-white/45 hover:text-[#c9a14a] text-sm transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h3 className="text-white text-sm font-semibold uppercase tracking-widest mb-5">Policies</h3>
            <ul className="space-y-2.5">
              {[
                ['/terms','Terms & Conditions'],
                ['/privacy','Privacy Policy'],
                ['/terms#cancellation','Cancellation Policy'],
                ['/terms#refund','Refund Policy'],
                ['/terms#checkin','Check-in / Check-out'],
                ['/terms#children','Children Policy'],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-white/45 hover:text-[#c9a14a] text-sm transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
            <div className="mt-5 p-3 bg-white/3 border border-white/8 rounded-xl">
              <p className="text-white/35 text-xs leading-relaxed">Check-in: After 3:00 PM<br/>Check-out: Before 11:00 AM</p>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white text-sm font-semibold uppercase tracking-widest mb-5">Get in Touch</h3>
            <address className="not-italic space-y-4">
              <div className="flex gap-2.5 text-sm">
                <span className="text-[#c9a14a] mt-0.5 flex-shrink-0">📍</span>
                <p className="text-white/45 leading-relaxed">Vill- Banas, Narad Chatti,<br/>Hanuman Chatti, Yamunotri Road,<br/>Uttarkashi, Uttarakhand — 249193</p>
              </div>
              <div className="flex gap-2.5 text-sm">
                <span className="text-[#c9a14a] flex-shrink-0">📞</span>
                <div className="space-y-1">
                  <a href="tel:+919368080535" className="block text-white/45 hover:text-[#c9a14a] transition-colors">+91-9368080535</a>
                  <a href="tel:+918630227541" className="block text-white/45 hover:text-[#c9a14a] transition-colors">+91-8630227541</a>
                </div>
              </div>
              <div className="flex gap-2.5 text-sm">
                <span className="text-[#c9a14a] flex-shrink-0">✉</span>
                <a href="mailto:info@leafwalk.in" className="text-white/45 hover:text-[#c9a14a] transition-colors">info@leafwalk.in</a>
              </div>
            </address>
            <a href="https://wa.me/919368080535?text=Hi,%20I%20want%20to%20book%20a%20room%20at%20LeafWalk%20Resort"
              target="_blank" rel="noopener noreferrer"
              className="mt-5 flex items-center justify-center gap-2 py-3 bg-green-500/15 border border-green-500/25 text-green-400 rounded-xl text-sm font-semibold hover:bg-green-500/25 transition-all">
              {WA_ICON} Book via WhatsApp
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/25 text-xs">© {year} LeafWalk Resort, Uttarkashi. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-white/25">
            <Link href="/terms" className="hover:text-[#c9a14a] transition-colors">Terms</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-[#c9a14a] transition-colors">Privacy</Link>
            <span>·</span>
            <span>Powered by Razorpay</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
