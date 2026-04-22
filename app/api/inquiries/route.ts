import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { logError } from '@/lib/logger'
import { parseJsonBody, sanitizeEmail, sanitizePhone, sanitizeString } from '@/lib/security'

const inquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(6).max(20),
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(5).max(2000),
})

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, inquirySchema)
  if (!parsed.success) {
    return parsed.response
  }

  try {
    const { name, email, phone, subject, message } = parsed.data

    const { error } = await getSupabaseAdmin()
      .from('inquiries')
      .insert({
        name: sanitizeString(name, 120),
        email: sanitizeEmail(email),
        phone: sanitizePhone(phone),
        subject: sanitizeString(subject, 160),
        message: sanitizeString(message, 2000),
      })

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logError('Inquiry create error:', error)
    return NextResponse.json({ error: 'Failed to submit inquiry' }, { status: 500 })
  }
}
