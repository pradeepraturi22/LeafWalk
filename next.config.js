const crypto = require('crypto')

const isDevelopment = process.env.NODE_ENV === 'development'
const isLocalTestMode = isDevelopment || process.env.LOCAL_TEST_MODE === 'true'
const allowLocalInlineScripts = isLocalTestMode && process.env.ALLOW_LOCAL_INLINE_SCRIPTS === 'true'
const allowLocalEvalScripts = isDevelopment || (isLocalTestMode && process.env.ALLOW_LOCAL_INLINE_SCRIPTS === 'true')
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://leafwalk.in'
const siteName = 'LeafWalk Resort'
const structuredDataJson = JSON.stringify({
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
})
const structuredDataHash = crypto.createHash('sha256').update(structuredDataJson).digest('base64')

// LOCAL TEST MODE ONLY
// REMOVE / DISABLE FOR PRODUCTION
const scriptDirectives = [
  "'self'",
  `'sha256-${structuredDataHash}'`,
  "'sha256-Q+8tPsjVtiDsjF/Cv8FMOpg2Yg91oKFKDAJat1PPb2g='",
  'https://checkout.razorpay.com',
  'https://api.razorpay.com',
]
if (isDevelopment || allowLocalInlineScripts) {
  scriptDirectives.splice(2, 0, "'unsafe-inline'")
}
if (allowLocalEvalScripts) {
  scriptDirectives.splice(scriptDirectives.length - 2, 0, "'unsafe-eval'")
}
const scriptSrc = `script-src ${scriptDirectives.join(' ')}`

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.supabase.co https://checkout.razorpay.com https://www.google.com https://maps.gstatic.com",
      "media-src 'self' blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co https://api.razorpay.com https://checkout.razorpay.com https://lumberjack.razorpay.com",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.google.com https://maps.google.com",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups',
  },
  {
    key: 'Cross-Origin-Resource-Policy',
    value: 'same-site',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'checkout.razorpay.com' },
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
