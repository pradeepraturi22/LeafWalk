'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const LINKS = [
  { href: '/',            label: 'Home' },
  { href: '/rooms',       label: 'Rooms' },
  { href: '/gallery',     label: 'Gallery' },
  { href: '/experiences', label: 'Experiences' },
  { href: '/food',        label: 'Dining' },
  { href: '/contact',     label: 'Contact' },
]

const WA_ICON = <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>

export default function Navbar() {
  const [scrolled, setScrolled]     = useState(false)
  const [open, setOpen]             = useState(false)
  const [user, setUser]             = useState<any>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const path    = usePathname()
  const router  = useRouter()

  // Scroll listener
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setOpen(false); setUserMenuOpen(false) }, [path])

  // Auth listener — updates on login/logout
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const solid = scrolled || open

  async function handleLogout() {
    await supabase.auth.signOut()
    setUserMenuOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <header className={`fixed top-0 w-full z-50 transition-all duration-500 ${solid ? 'bg-black/90 backdrop-blur-xl border-b border-white/10 shadow-2xl' : 'bg-transparent'}`}>
      <nav className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className={`relative rounded-full bg-white shadow overflow-hidden transition-all duration-500 ${scrolled ? 'w-10 h-10' : 'w-14 h-14'}`}>
            <Image src="/logo/leafwalk-logo.jpeg" alt="LeafWalk Resort" fill className="object-contain p-1.5" priority />
          </div>
          <span className={`font-playfair text-[#c9a14a] transition-all duration-500 ${scrolled ? 'text-lg' : 'text-2xl'}`}>LeafWalk Resort</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-7 text-xs uppercase tracking-widest">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href}
              className={`transition-colors pb-0.5 border-b-2 ${path === l.href ? 'text-[#c9a14a] border-[#c9a14a]' : 'text-white/75 border-transparent hover:text-[#c9a14a] hover:border-[#c9a14a]/50'}`}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden lg:flex items-center gap-3">
          {/* WhatsApp */}
          <a href="https://wa.me/919368080535" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-green-500/15 border border-green-500/30 text-green-400 rounded-full text-xs font-semibold hover:bg-green-500/25 transition-all">
            {WA_ICON} WhatsApp
          </a>

          {/* Auth button */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 text-white rounded-full text-xs font-semibold hover:bg-white/15 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                My Account
                <svg className={`w-3 h-3 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-xs text-white/40">Signed in as</p>
                    <p className="text-sm text-white/80 truncate">{user.email}</p>
                  </div>
                  <Link href="/my-bookings" className="block px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all">
                    📋 My Bookings
                  </Link>
                  <button onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-all">
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/auth"
              className="flex items-center gap-1.5 px-4 py-2 bg-white/10 border border-white/20 text-white rounded-full text-xs font-semibold hover:bg-white/15 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Login
            </Link>
          )}

          {/* Book Now */}
          <Link href="/rooms" className="px-5 py-2.5 bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black rounded-full text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-[#c9a14a]/20">
            Book Now
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setOpen(!open)} className="lg:hidden w-10 h-10 flex flex-col justify-center items-center gap-1.5" aria-label="Menu">
          <span className={`w-6 h-0.5 bg-white block transition-all duration-300 ${open ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`w-6 h-0.5 bg-white block transition-all duration-300 ${open ? 'opacity-0' : ''}`} />
          <span className={`w-6 h-0.5 bg-white block transition-all duration-300 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </nav>

      {/* Mobile menu */}
      <div className={`lg:hidden overflow-hidden transition-all duration-300 ${open ? 'max-h-[600px]' : 'max-h-0'}`}>
        <div className="px-5 pb-6 pt-2 border-t border-white/10 space-y-1">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href}
              className={`block py-3 px-4 rounded-xl text-sm uppercase tracking-widest transition-all ${path === l.href ? 'text-[#c9a14a] bg-[#c9a14a]/10' : 'text-white/70 hover:text-[#c9a14a] hover:bg-white/5'}`}>
              {l.label}
            </Link>
          ))}

          {/* Mobile auth section */}
          {user ? (
            <>
              <div className="px-4 py-2 text-xs text-white/40 border-t border-white/10 mt-2 pt-3">
                Signed in: <span className="text-white/60">{user.email}</span>
              </div>
              <Link href="/my-bookings" className="block py-3 px-4 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all">
                📋 My Bookings
              </Link>
              <button onClick={handleLogout} className="w-full text-left py-3 px-4 rounded-xl text-sm text-red-400 hover:bg-red-500/5 transition-all">
                🚪 Sign Out
              </button>
            </>
          ) : (
            <Link href="/auth" className="block py-3 px-4 rounded-xl text-sm text-white/70 hover:text-[#c9a14a] hover:bg-white/5 transition-all uppercase tracking-widest">
              🔑 Login / Sign Up
            </Link>
          )}

          <div className="pt-3 space-y-2">
            <Link href="/rooms" className="block py-3 text-center bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black rounded-xl font-bold text-sm uppercase tracking-widest">
              Book Now
            </Link>
            <a href="https://wa.me/919368080535" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-green-500/15 border border-green-500/30 text-green-400 rounded-xl text-sm font-semibold">
              {WA_ICON} WhatsApp Us
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}