import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    success: false,
    error: {
      code: 'PASSWORD_DISABLED',
      message: 'Password login is disabled. Use OTP login instead.',
    },
  }, { status: 410 })
}
