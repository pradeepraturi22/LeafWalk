import { NextResponse } from 'next/server'
import { clearCustomerSessionCookie } from '@/lib/customer-auth'
import { clearAdminSession } from '@/lib/security'

export async function POST() {
  clearCustomerSessionCookie()
  return clearAdminSession(NextResponse.json({ success: true }))
}
