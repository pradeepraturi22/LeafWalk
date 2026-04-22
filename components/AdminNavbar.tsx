'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const ADMIN_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: 'DB' },
  { href: '/admin/bookings', label: 'Bookings', icon: 'BK' },
  { href: '/admin/bookings/calendar', label: 'Calendar', icon: 'CL' },
  { href: '/admin/rooms', label: 'Manage Rooms', icon: 'RM' },
  { href: '/admin/tariff', label: 'Tariff Console', icon: 'TR' },
  { href: '/admin/menu', label: 'Menu', icon: 'MN' },
  { href: '/admin/billing', label: 'Billing', icon: 'BL' },
  { href: '/admin/tour-operators', label: 'Tour Operators', icon: 'TO' },
]

export default function AdminNavbar() {
  const router = useRouter()
  const path = usePathname()
  const [open, setOpen] = useState(false)

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0d0d0d] text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link href="/admin/dashboard" className="shrink-0 font-playfair text-lg tracking-widest text-[#c9a14a]">
            LeafWalk Admin
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {ADMIN_LINKS.map((link) => {
              const active = path === link.href || path.startsWith(`${link.href}/`)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'border border-[#c9a14a]/25 bg-[#c9a14a]/15 text-[#c9a14a]'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">{link.icon}</span>
                  {link.label}
                </Link>
              )
            })}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="hidden items-center gap-1 text-xs text-white/40 transition-all hover:text-white/70 md:flex"
            >
              View Site
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/10 hover:text-red-300"
            >
              Logout
            </button>
            <button onClick={() => setOpen((current) => !current)} className="p-2 text-white/60 hover:text-white md:hidden">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <div className="space-y-1 border-t border-white/10 py-3 md:hidden">
            {ADMIN_LINKS.map((link) => {
              const active = path === link.href || path.startsWith(`${link.href}/`)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-all ${
                    active ? 'bg-[#c9a14a]/15 text-[#c9a14a]' : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">{link.icon}</span>
                  {link.label}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </nav>
  )
}
