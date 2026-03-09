// app/api/auth/reset-password/route.ts
// Uses Supabase admin to update user password — requires service role key

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const { email, new_password } = await request.json()

    if (!email || !new_password) {
      return NextResponse.json({ error: 'Email and new_password are required' }, { status: 400 })
    }
    if (new_password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Find user by email in auth
    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
    if (listErr) return NextResponse.json({ error: 'Failed to find user' }, { status: 500 })

    const authUser = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!authUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Update password
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      password: new_password,
    })
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}