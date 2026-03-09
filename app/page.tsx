import type { Metadata } from 'next'
import HomeClient from './HomeClient'

export const metadata: Metadata = {
  title: 'LeafWalk Resort | Luxury Nature Stay in Uttarkashi, Uttarakhand',
  description: 'LeafWalk Resort — luxury mountain resort on Yamunotri Road, Uttarkashi. Deluxe rooms from ₹3,500/night. Himalayan forests, all meal plans, free WiFi. Book directly for best rates. +91-9368080535',
  alternates: { canonical: 'https://leafwalk.in' },
  openGraph: {
    title: 'LeafWalk Resort | Uttarkashi',
    description: 'Luxury mountain stay in Himalayan forests. Deluxe rooms & premium cottages. Book directly.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
}

export default function HomePage() {
  return <HomeClient />
}
