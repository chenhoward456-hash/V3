import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { rateLimit, getClientIP, createErrorResponse } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 attempts per minute per IP
    const ip = getClientIP(request)
    const { allowed } = rateLimit(`verify-pin:${ip}`, 10, 60_000)
    if (!allowed) {
      return createErrorResponse('嘗試次數過多，請稍後再試', 429)
    }

    const body = await request.json()
    const { pin } = body

    if (!pin || typeof pin !== 'string') {
      return createErrorResponse('缺少 PIN', 400)
    }

    const serverPin = process.env.COACH_PIN
    if (!serverPin) {
      console.error('COACH_PIN environment variable is not set')
      return createErrorResponse('伺服器設定錯誤', 500)
    }

    // Timing-safe comparison to prevent timing attacks
    let valid = false
    if (pin.length === serverPin.length) {
      try {
        valid = crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(serverPin))
      } catch {
        valid = false
      }
    }

    if (!valid) {
      return NextResponse.json({ valid: false }, { status: 401 })
    }

    return NextResponse.json({ valid: true })
  } catch {
    return createErrorResponse('伺服器錯誤', 500)
  }
}
