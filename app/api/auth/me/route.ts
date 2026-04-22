import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedCustomer, refreshCustomerSessionCookie } from '@/lib/customer-auth'

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedCustomer(request)
  if (!auth) {
    return NextResponse.json({ success: true, user: null })
  }

  refreshCustomerSessionCookie({
    email: auth.session.email || auth.user.email || '',
    userId: auth.userId,
  })

  return NextResponse.json({
    success: true,
    user: auth.user,
    has_profile: auth.hasProfile,
    requires_profile_completion: !auth.hasProfile,
  })
}
