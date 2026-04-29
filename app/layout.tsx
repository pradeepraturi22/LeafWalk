import './globals.css'
import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Playfair_Display, Jost } from 'next/font/google'
import ConditionalLayout from '@/components/ConditionalLayout'
import { BookingProvider } from '@/context/BookingContext'

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })
const jost = Jost({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-jost', display: 'swap' })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.leafwalk.in'
const siteName = 'LeafWalk Resort'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'LeafWalk Resort | Nature Stay in Uttarkashi, Uttarakhand',
    template: `%s | ${siteName}`,
  },
  description: 'LeafWalk Resort is a nature resort in Uttarkashi, Uttarakhand near Yamunotri Road, offering deluxe rooms, premium cottages, mountain views, dining, and direct booking.',
  keywords: ['LeafWalk Resort', 'resort in Uttarkashi', 'Yamunotri resort', 'Uttarakhand nature resort', 'mountain resort Uttarkashi'],
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  applicationName: siteName,
  category: 'travel',
  alternates: { canonical: siteUrl },
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: siteUrl,
    siteName,
    title: 'LeafWalk Resort | Nature Stay in Uttarkashi',
    description: 'Stay close to nature at LeafWalk Resort, Uttarkashi with premium rooms, cottages, mountain views, and direct booking.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'LeafWalk Resort Uttarkashi' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LeafWalk Resort | Uttarkashi',
    description: 'Nature resort in Uttarkashi, Uttarakhand.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#c9a14a' }

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'Hotel',
  name: siteName,
  description: 'Nature resort in Uttarkashi, Uttarakhand offering deluxe rooms and premium cottages with Himalayan forest views.',
  url: siteUrl,
  telephone: ['+91-9368080535', '+91-8630227541'],
  email: 'info@leafwalk.in',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Vill- Banas, Narad Chatti, Hanuman Chatti, Yamunotri Road',
    addressLocality: 'Uttarkashi',
    addressRegion: 'Uttarakhand',
    postalCode: '249193',
    addressCountry: 'IN',
  },
  geo: { '@type': 'GeoCoordinates', latitude: '30.8513', longitude: '78.4534' },
  image: `${siteUrl}/og-image.jpg`,
  priceRange: 'INR',
  checkinTime: '15:00',
  checkoutTime: '11:00',
  currenciesAccepted: 'INR',
  paymentAccepted: 'Cash, Credit Card, UPI, Bank Transfer, Razorpay',
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'Mountain View', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Restaurant', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Free WiFi', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Parking', value: true },
  ],
}

const structuredDataJson = JSON.stringify(structuredData)

export default function RootLayout({ children }: { children: ReactNode }) {
  const nonce = headers().get('x-nonce') || undefined

  return (
    <html lang="en" className={`${playfair.variable} ${jost.variable}`}>
      <head>
        <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredDataJson }} />
      </head>
      <body className="antialiased" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
        <BookingProvider>
          <ConditionalLayout>{children}</ConditionalLayout>
        </BookingProvider>
      </body>
    </html>
  )
}
