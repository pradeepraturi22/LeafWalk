const isDevelopment = process.env.NODE_ENV === 'development'
const isLocalTestMode = isDevelopment || process.env.LOCAL_TEST_MODE === 'true'
const allowLocalInlineScripts = isLocalTestMode && process.env.ALLOW_LOCAL_INLINE_SCRIPTS === 'true'
const allowLocalEvalScripts = isDevelopment || (isLocalTestMode && process.env.ALLOW_LOCAL_INLINE_SCRIPTS === 'true')

// LOCAL TEST MODE ONLY
// REMOVE / DISABLE FOR PRODUCTION
const scriptDirectives = ["'self'", 'https://checkout.razorpay.com', 'https://api.razorpay.com']
if (isDevelopment || allowLocalInlineScripts) {
  scriptDirectives.splice(1, 0, "'unsafe-inline'")
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
