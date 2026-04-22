import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { clearAdminSession, setAdminSession } from '@/lib/security'
import { logError } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return clearAdminSession(NextResponse.json({ error: 'No token provided' }, { status: 401 }))
    }

    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)

    if (error || !user) {
      return clearAdminSession(NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 }))
    }

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
      return clearAdminSession(NextResponse.json({
        error: 'User profile not found',
      }, { status: 404 }))
    }

    if (!['admin', 'manager'].includes(userData.role)) {
      return clearAdminSession(NextResponse.json({ error: 'Unauthorized', role: userData.role }, { status: 403 }))
    }

    const response = NextResponse.json({
      ok: true,
      role: userData.role,
      name: userData.name,
      userId: user.id,
    })

    return setAdminSession(response, user.id, userData.role)
  } catch (error) {
    logError('Admin verify error:', error)
    return clearAdminSession(NextResponse.json({ error: 'Server error' }, { status: 500 }))
  }
}
