import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { maskOtpTarget, sendEmailOtp } from '@/lib/otp'
import { parseJsonBody, sanitizeEmail } from '@/lib/security'

const sendOtpSchema = z.object({
  email: z.string().email(),
  bookingId: z.string().uuid().optional().or(z.literal('')),
  purpose: z.enum(['login', 'booking_claim', 'email_fallback']).optional(),
})

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, sendOtpSchema)
  if (!parsed.success) {
    return parsed.response
  }

  try {
    const email = sanitizeEmail(parsed.data.email)
    const sent = await sendEmailOtp(email)

    return NextResponse.json({
      success: true,
      channel: sent.channel,
      maskedTarget: maskOtpTarget(sent.contact),
    })
  } catch (error: any) {
    const code = error?.code || 'OTP_SEND_FAILED'
    const status = code === 'RATE_LIMITED' ? 429 : 500

    return NextResponse.json({
      success: false,
      error: { code, message: error.message || 'Could not send OTP' },
    }, { status })
  }
}
