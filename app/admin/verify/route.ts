// app/api/admin/verify/route.ts
// Server-side role verification using service role — bypasses RLS completely
// Returns role if user is admin/manager, else 403

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    // Get the Authorization header (Bearer token from client session)
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }

    // Verify the JWT token using Supabase admin
    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    // Look up role in users table using service role (bypasses RLS)
    const supabase = getSupabaseAdmin()
    let { data: userData, error: userErr } = await supabase
      .from('users')
      .select('role, name')
      .eq('id', user.id)
      .maybeSingle() as any

    if (!userData && user.email) {
      const fallback = await supabase
        .from('users')
        .select('role, name')
        .eq('email', user.email.toLowerCase())
        .maybeSingle() as any
      userData = fallback.data
      userErr = fallback.error
    }

    if (userErr || !userData) {
      return NextResponse.json({ error: 'User profile not found', userId: user.id, email: user.email }, { status: 404 })
    }

    if (!['admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Unauthorized', role: userData.role }, { status: 403 })
    }

    return NextResponse.json({
      ok: true,
      role: userData.role,
      name: userData.name,
      userId: user.id,
    })
  } catch (err: any) {
    console.error('Admin verify error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
