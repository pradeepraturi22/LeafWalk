export function isDevelopment() {
  return process.env.NODE_ENV === 'development'
}

export function isProduction() {
  return process.env.NODE_ENV === 'production'
}

export function isLocalTestMode() {
  return isDevelopment() || process.env.LOCAL_TEST_MODE === 'true'
}

export function allowLocalInlineScripts() {
  // LOCAL TEST MODE ONLY
  // In normal development we allow inline scripts automatically for local testing.
  if (isDevelopment()) return true
  return isLocalTestMode() && process.env.ALLOW_LOCAL_INLINE_SCRIPTS === 'true'
}

export function allowLocalEvalScripts() {
  // LOCAL TEST MODE ONLY
  // In normal development we allow eval for local tooling compatibility.
  if (isDevelopment()) return true
  return isLocalTestMode() && process.env.ALLOW_LOCAL_INLINE_SCRIPTS === 'true'
}

export function allowLocalInternalBypass() {
  return isLocalTestMode() && process.env.ALLOW_LOCAL_INTERNAL_BYPASS === 'true'
}

function hasRealEmailProviderConfigured() {
  return Boolean(
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ||
    process.env.RESEND_API_KEY ||
    process.env.SENDGRID_API_KEY
  )
}

export function getLocalNotificationMode() {
  if (process.env.LOCAL_NOTIFICATION_MODE) {
    return process.env.LOCAL_NOTIFICATION_MODE
  }

  if (!isLocalTestMode()) {
    return 'real'
  }

  // LOCAL TEST MODE ONLY
  // Prefer real send automatically when a mail provider is configured.
  // Explicitly set LOCAL_NOTIFICATION_MODE=mock if you want log-only behavior.
  return hasRealEmailProviderConfigured() ? 'real' : 'mock'
}

export function isLocalNotificationMockMode() {
  return isLocalTestMode() && getLocalNotificationMode() !== 'real'
}

export function isLocalHostValue(value?: string | null) {
  const host = String(value || '').toLowerCase()
  return host.includes('localhost') || host.includes('127.0.0.1') || host.includes('[::1]')
}

export function isLocalRequestLike(input: {
  host?: string | null
  origin?: string | null
  forwardedHost?: string | null
}) {
  return (
    isLocalHostValue(input.host) ||
    isLocalHostValue(input.forwardedHost) ||
    isLocalHostValue(input.origin)
  )
}

export function isRazorpayTestKey(key?: string | null) {
  return String(key || '').startsWith('rzp_test_')
}
