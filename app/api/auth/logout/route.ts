import { NextResponse } from 'next/server'
import { clearCustomerSessionCookie } from '@/lib/customer-auth'

export async function POST() {
  clearCustomerSessionCookie()
  return NextResponse.json({ success: true })
}
