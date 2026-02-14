import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('admin_session')?.value

  if (!sessionToken || !verifyAdminSession(sessionToken)) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json({ authenticated: true })
}
