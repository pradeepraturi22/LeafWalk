import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendEmailOtp } from '@/lib/otp'
import { logWarn } from '@/lib/logger'
import { parseJsonBody, sanitizeEmail } from '@/lib/security'

const sendOtpSchema = z.object({
  email: z.string().email(),
  bookingId: z.string().uuid().optional().or(z.literal('')),
  purpose: z.enum(['login', 'booking_claim', 'email_fallback']).optional(),
})

const GENERIC_OTP_RESPONSE = {
  success: true,
  message: 'If the account exists, an OTP has been sent.',
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, sendOtpSchema)
  if (!parsed.success) {
    return parsed.response
  }

  try {
    const email = sanitizeEmail(parsed.data.email)
    await sendEmailOtp(email)

    return NextResponse.json(GENERIC_OTP_RESPONSE)
  } catch (error: any) {
    logWarn('OTP send request did not complete normally', {
      code: error?.code || 'OTP_SEND_FAILED',
      message: error?.message || 'Could not send OTP',
    })
    return NextResponse.json(GENERIC_OTP_RESPONSE)
  }
}
