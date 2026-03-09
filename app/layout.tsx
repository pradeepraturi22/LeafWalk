import './globals.css'
import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Jost } from 'next/font/google'
import ConditionalLayout from '@/components/ConditionalLayout'
import Script from 'next/script'

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })
const jost = Jost({ subsets: ['latin'], weight: ['300','400','500','600','700'], variable: '--font-jost', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL('https://leafwalk.in'),
  title: {
    default: 'LeafWalk Resort | Luxury Nature Stay in Uttarkashi, Uttarakhand',
    template: '%s | LeafWalk Resort',
  },
  description: 'LeafWalk Resort — luxury mountain resort in Uttarkashi, Uttarakhand on Yamunotri Road. Deluxe rooms from ₹3,500/night & premium cottages from ₹6,500/night. Himalayan forest views, all meal plans, free WiFi. Book directly for best rates.',
  keywords: ['LeafWalk Resort','resort in Uttarkashi','Yamunotri resort','hotel near Hanuman Chatti','Uttarakhand nature resort','luxury resort Uttarkashi','mountain view hotel Uttarakhand','resort near Yamunotri dham','forest resort Uttarakhand','weekend getaway hills','family resort Uttarkashi','Narad Chatti resort','Banas Uttarkashi hotel'],
  authors: [{ name: 'LeafWalk Resort', url: 'https://leafwalk.in' }],
  creator: 'LeafWalk Resort',
  openGraph: {
    type: 'website', locale: 'en_IN', url: 'https://leafwalk.in',
    siteName: 'LeafWalk Resort',
    title: 'LeafWalk Resort | Luxury Nature Stay in Uttarkashi',
    description: 'Experience Himalayan luxury at LeafWalk Resort, Uttarkashi. Premium rooms & cottages with breathtaking mountain views.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'LeafWalk Resort Uttarkashi' }],
  },
  twitter: { card: 'summary_large_image', title: 'LeafWalk Resort | Uttarkashi', description: 'Luxury mountain resort in Uttarkashi, Uttarakhand.', images: ['/og-image.jpg'] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  alternates: { canonical: 'https://leafwalk.in' },
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  verification: { google: 'ADD_YOUR_GOOGLE_SEARCH_CONSOLE_CODE_HERE' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#c9a14a' }

const structuredData = {
  '@context': 'https://schema.org', '@type': 'Hotel',
  name: 'LeafWalk Resort',
  description: 'Luxury mountain resort in Uttarkashi, Uttarakhand offering premium rooms and cottages with Himalayan forest views.',
  url: 'https://leafwalk.in',
  telephone: ['+91-9368080535', '+91-8630227541'],
  email: 'info@leafwalk.in',
  address: { '@type': 'PostalAddress', streetAddress: 'Vill- Banas, Narad Chatti, Hanuman Chatti, Yamunotri Road', addressLocality: 'Uttarkashi', addressRegion: 'Uttarakhand', postalCode: '249193', addressCountry: 'IN' },
  geo: { '@type': 'GeoCoordinates', latitude: '30.8513', longitude: '78.4534' },
  image: 'https://leafwalk.in/og-image.jpg',
  priceRange: '₹₹₹',
  starRating: { '@type': 'Rating', ratingValue: '4.5' },
  checkinTime: '15:00', checkoutTime: '11:00',
  currenciesAccepted: 'INR',
  paymentAccepted: 'Cash, Credit Card, UPI, Bank Transfer, Razorpay',
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'Mountain View', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Restaurant', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Free WiFi', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Parking', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Bonfire Area', value: true },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${jost.variable}`}>
      <head>
        <Script id="schema-org" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </head>
      <body className="antialiased" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  )
}
