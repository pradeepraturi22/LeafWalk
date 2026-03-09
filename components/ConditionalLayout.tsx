'use client'
// components/ConditionalLayout.tsx
// Hides Navbar + Footer on /maintenance and /admin/* routes

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ScrollAnimation from '@/components/ScrollAnimation'

const NO_CHROME_ROUTES = ['/maintenance', '/admin']

export default function ConditionalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  // Hide Navbar/Footer on maintenance page and all admin pages
  const hideChrome = NO_CHROME_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/') || pathname.startsWith(r))

  if (hideChrome) {
    return <>{children}</>
  }

  return (
    <>
      <Navbar />
      <ScrollAnimation />
      <main className="pt-24">{children}</main>
      <Footer />
    </>
  )
}