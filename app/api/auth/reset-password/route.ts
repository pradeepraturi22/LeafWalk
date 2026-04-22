import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    success: false,
    error: {
      code: 'PASSWORD_RESET_DISABLED',
      message: 'Password reset is disabled. Please continue with OTP login.',
    },
  }, { status: 410 })
}
