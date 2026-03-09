// app/metadata.ts - SEO Configuration

import type { Metadata } from 'next'

export const siteMetadata: Metadata = {
  title: {
    default: 'Leafwalk Resort | Luxury Mountain Resort in Uttarakhand',
    template: '%s | Leafwalk Resort'
  },
  description: 'Experience luxury in nature at Leafwalk Resort, Uttarakhand. Premium rooms, cottages & suites surrounded by mountains, forests and waterfalls. Book your peaceful escape today.',
  keywords: [
    'Leafwalk Resort',
    'Uttarakhand Resort',
    'Mountain Resort',
    'Luxury Resort India',
    'Nature Resort',
    'Himalayan Resort',
    'Resort Booking',
    'Weekend Getaway',
    'Hill Station Resort',
    'Eco Resort'
  ],
  authors: [{ name: 'Leafwalk Resort' }],
  creator: 'Leafwalk Resort',
  publisher: 'Leafwalk Resort',
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://leafwalkresort.com'),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://leafwalkresort.com',
    siteName: 'Leafwalk Resort',
    title: 'Leafwalk Resort | Luxury Mountain Resort in Uttarakhand',
    description: 'Experience luxury in nature. Premium rooms, cottages & suites in Uttarakhand.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Leafwalk Resort - Luxury Mountain Resort'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Leafwalk Resort | Luxury Mountain Resort in Uttarakhand',
    description: 'Experience luxury in nature. Premium rooms, cottages & suites.',
    images: ['/twitter-image.jpg'],
    creator: '@leafwalkresort'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code'
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL || 'https://leafwalkresort.com'
  }
}

// JSON-LD Structured Data
export const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Hotel',
  name: 'Leafwalk Resort',
  description: 'Luxury mountain resort in Uttarakhand offering premium rooms, cottages and suites.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://leafwalkresort.com',
  telephone: '+918630227541',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Uttarakhand',
    addressCountry: 'IN'
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: '30.0668',
    longitude: '78.4380'
  },
  priceRange: '₹₹₹',
  starRating: {
    '@type': 'Rating',
    ratingValue: '5'
  },
  amenityFeature: [
    {
      '@type': 'LocationFeatureSpecification',
      name: 'Free WiFi',
      value: true
    },
    {
      '@type': 'LocationFeatureSpecification',
      name: 'Restaurant',
      value: true
    },
    {
      '@type': 'LocationFeatureSpecification',
      name: 'Mountain View',
      value: true
    }
  ],
  image: [
    `${process.env.NEXT_PUBLIC_SITE_URL}/og-image.jpg`
  ],
  sameAs: [
    'https://facebook.com/leafwalkresort',
    'https://instagram.com/leafwalkresort',
    'https://twitter.com/leafwalkresort'
  ]
}
