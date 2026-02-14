import { NextRequest, NextResponse } from 'next/server'
import { createAdminSession, rateLimit, getClientIP } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)

    // Rate limiting: 登入最多 5 次/分鐘
    const { allowed } = rateLimit(`admin-login:${ip}`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: '嘗試次數過多，請稍後再試' }, { status: 429 })
    }

    const { password } = await request.json()

    const correctPassword = process.env.ADMIN_PASSWORD
    if (!correctPassword) {
      return NextResponse.json({ error: '伺服器設定錯誤' }, { status: 500 })
    }

    if (password === correctPassword) {
      const sessionToken = createAdminSession()

      const response = NextResponse.json({ success: true })
      response.cookies.set('admin_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 86400, // 24 hours
      })

      return response
    } else {
      return NextResponse.json({ error: '密碼錯誤' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: '請求錯誤' }, { status: 400 })
  }
}
