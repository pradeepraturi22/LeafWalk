import crypto from 'crypto'
import { renderOtpEmail, sendSmtpOnlyEmail } from '@/lib/email'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

const OTP_TTL_MINUTES = 5
const OTP_RESEND_COOLDOWN_SECONDS = 30
const OTP_MAX_ATTEMPTS = 5

function getOtpSecret() {
  const secret = process.env.OTP_SECRET || process.env.CUSTOM_AUTH_SECRET || process.env.AUTH_SESSION_SECRET
  if (!secret) throw new Error('OTP_SECRET or CUSTOM_AUTH_SECRET is not configured')
  return secret
}

export function maskOtpTarget(contact: string) {
  if (contact.includes('@')) {
    const [local, domain] = contact.split('@')
    return `${local.slice(0, 2)}***@${domain}`
  }

  return `${contact.slice(0, Math.max(0, contact.length - 4)).replace(/\d/g, '*')}${contact.slice(-4)}`
}

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase()
}

function generateNumericOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

function hashOtp(email: string, otp: string) {
  return crypto
    .createHmac('sha256', getOtpSecret())
    .update(`${normalizeEmail(email)}:${otp}`)
    .digest('hex')
}

function secureCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function getOtpError(code: string, message: string) {
  return Object.assign(new Error(message), { code })
}

export async function sendEmailOtp(emailInput: string) {
  const email = normalizeEmail(emailInput)
  if (!email) throw getOtpError('VALIDATION_ERROR', 'Valid email is required')

  const supabase = getSupabaseAdmin()
  const since = new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000).toISOString()
  const { data: recentOtp } = await supabase
    .from('otps')
    .select('id')
    .eq('contact', email)
    .gte('created_at', since)
    .limit(1) as any

  if (recentOtp?.length) {
    throw getOtpError('RATE_LIMITED', `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another OTP.`)
  }

  await supabase
    .from('otps')
    .delete()
    .eq('contact', email)

  const otp = generateNumericOtp()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

  const { error: insertError } = await supabase
    .from('otps')
    .insert({
      contact: email,
      otp_hash: hashOtp(email, otp),
      expires_at: expiresAt,
      attempts: 0,
      created_at: new Date().toISOString(),
    } as any)

  if (insertError) {
    throw getOtpError('OTP_STORE_FAILED', insertError.message || 'Could not create OTP')
  }

  const sendResult = await sendSmtpOnlyEmail({
    to: email,
    subject: 'Your Leafwalk Resort Login Code',
    html: renderOtpEmail('Guest', otp),
    fromEmail: process.env.FROM_EMAIL_AUTH || 'no-reply@leafwalk.in',
    fromName: 'Leafwalk Resort',
    emailType: 'otp_login',
  })

  if (!sendResult.success) {
    throw getOtpError('OTP_SEND_FAILED', sendResult.error || 'Could not send OTP email')
  }

  return {
    contact: email,
    channel: 'email' as const,
    expiresAt,
  }
}

export async function verifyEmailOtp(emailInput: string, otpInput: string) {
  const email = normalizeEmail(emailInput)
  const otp = String(otpInput || '').replace(/\D/g, '').slice(0, 6)
  if (!email || otp.length !== 6) {
    throw getOtpError('VALIDATION_ERROR', 'Email and valid 6-digit OTP are required')
  }

  const supabase = getSupabaseAdmin()
  const { data: otpRows, error } = await supabase
    .from('otps')
    .select('id, otp_hash, expires_at, attempts')
    .eq('contact', email)
    .order('created_at', { ascending: false })
    .limit(1) as any

  if (error) {
    throw getOtpError('OTP_VERIFY_FAILED', error.message || 'Could not verify OTP')
  }

  const otpRow = otpRows?.[0]
  if (!otpRow) {
    throw getOtpError('INVALID_OTP', 'Invalid OTP. Please request a new code.')
  }

  if (new Date(otpRow.expires_at).getTime() < Date.now()) {
    await supabase
      .from('otps')
      .delete()
      .eq('id', otpRow.id)
    throw getOtpError('OTP_EXPIRED', 'This OTP has expired. Please request a new code.')
  }

  if (Number(otpRow.attempts || 0) >= OTP_MAX_ATTEMPTS) {
    await supabase
      .from('otps')
      .delete()
      .eq('id', otpRow.id)
    throw getOtpError('TOO_MANY_ATTEMPTS', 'Too many invalid attempts. Please request a new OTP.')
  }

  const expectedHash = hashOtp(email, otp)
  if (!secureCompare(expectedHash, otpRow.otp_hash)) {
    await supabase
      .from('otps')
      .update({ attempts: Number(otpRow.attempts || 0) + 1 } as any)
      .eq('id', otpRow.id)
    throw getOtpError('INVALID_OTP', 'Invalid OTP. Please check the code and try again.')
  }

  await supabase
    .from('otps')
    .delete()
    .eq('id', otpRow.id)

  return {
    email,
    verifiedAt: new Date().toISOString(),
  }
}
