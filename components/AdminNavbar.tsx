'use client'

import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

const ADMIN_LINKS = [
  { href: '/admin/dashboard',       label: 'Dashboard',       icon: '📊' },
  { href: '/admin/bookings',        label: 'Bookings',        icon: '📋' },
  { href: '/admin/bookings/calendar', label: 'Calendar',      icon: '📅' },
  { href: '/admin/pricing',         label: 'Pricing',         icon: '💰' },
  { href: '/admin/tour-operators',  label: 'Tour Operators',  icon: '🤝' },
]

export default function AdminNavbar() {
  const router   = useRouter()
  const path     = usePathname()
  const [open, setOpen] = useState(false)

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <nav className="w-full bg-[#0d0d0d] text-white border-b border-white/10 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Brand */}
          <Link href="/admin/dashboard" className="font-playfair text-[#c9a14a] text-lg tracking-widest shrink-0">
            🌿 LeafWalk Admin
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {ADMIN_LINKS.map(l => (
              <Link key={l.href} href={l.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  path === l.href || path.startsWith(l.href + '/')
                    ? 'bg-[#c9a14a]/15 text-[#c9a14a] border border-[#c9a14a]/25'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}>
                <span>{l.icon}</span>
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link href="/" target="_blank"
              className="hidden md:flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Site
            </Link>
            <button onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>

            {/* Mobile hamburger */}
            <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-white/60 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div className="md:hidden py-3 border-t border-white/10 space-y-1">
            {ADMIN_LINKS.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all ${
                  path === l.href ? 'bg-[#c9a14a]/15 text-[#c9a14a]' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}>
                {l.icon} {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}