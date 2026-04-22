import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    success: false,
    error: {
      code: 'PASSWORD_LOGIN_DISABLED',
      message: 'Password login has been disabled. Please continue with OTP.',
    },
  }, { status: 410 })
}
