import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createAdminSession, rateLimit, getClientIP } from '@/lib/auth-middleware'
import crypto from 'crypto'

const logger = createLogger('api-admin-login')

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)

    // Rate limiting: 登入最多 5 次/分鐘
    const { allowed } = await rateLimit(`admin-login:${ip}`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: '嘗試次數過多，請稍後再試' }, { status: 429 })
    }

    const { password } = await request.json()

    const correctPassword = process.env.ADMIN_PASSWORD
    if (!correctPassword) {
      return NextResponse.json({ error: '伺服器設定錯誤' }, { status: 500 })
    }

    if (typeof password !== 'string' || !password) {
      return NextResponse.json({ error: '登入失敗' }, { status: 401 })
    }

    // 使用 timing-safe comparison 防止計時攻擊
    const passwordBuffer = Buffer.from(password)
    const correctBuffer = Buffer.from(correctPassword)

    const isValid = passwordBuffer.length === correctBuffer.length &&
      crypto.timingSafeEqual(passwordBuffer, correctBuffer)

    if (isValid) {
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
      // 統一錯誤訊息，避免洩漏是否為有效帳號
      return NextResponse.json({ error: '登入失敗' }, { status: 401 })
    }
  } catch (error) {
    logger.error('POST /api/admin/login unexpected error', error)
    return NextResponse.json({ error: '登入失敗' }, { status: 401 })
  }
}
