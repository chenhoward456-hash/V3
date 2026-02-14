import { NextRequest, NextResponse } from 'next/server'
import { destroyAdminSession } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('admin_session')?.value
  if (sessionToken) {
    destroyAdminSession(sessionToken)
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('admin_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })

  return response
}
