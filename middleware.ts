import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ===== Edge-compatible rate limiter =====
// 使用全域 Map（Edge Runtime 在 Vercel 上比 serverless 更持久，同 region 共享）
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function edgeRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  // 定期清理（每 500 個 key 清一次）
  if (rateLimitMap.size > 500) {
    for (const [k, v] of rateLimitMap) {
      if (v.resetAt < now) rateLimitMap.delete(k)
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  entry.count++
  return entry.count <= maxRequests
}

function getIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || request.ip
    || 'unknown'
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getIP(request)

  // ===== API rate limiting =====
  if (pathname.startsWith('/api/')) {
    // 敏感 API：嚴格限制（每 IP 每分鐘 20 次）
    const sensitivePatterns = [
      '/api/body-composition',
      '/api/lab-results',
      '/api/daily-wellness',
      '/api/training-logs',
      '/api/nutrition-logs',
      '/api/supplement-logs',
      '/api/supplements',
      '/api/clients',
      '/api/ai/',
      '/api/push/',
      '/api/health-report',
    ]

    const isSensitive = sensitivePatterns.some(p => pathname.startsWith(p))

    if (isSensitive) {
      const allowed = edgeRateLimit(`api:${ip}:${pathname.split('/').slice(0, 3).join('/')}`, 20, 60_000)
      if (!allowed) {
        return NextResponse.json(
          { error: '請求過於頻繁，請稍後再試' },
          { status: 429, headers: { 'Retry-After': '60' } }
        )
      }
    }

    // 所有 API：寬鬆限制（每 IP 每分鐘 100 次）
    const globalAllowed = edgeRateLimit(`global:${ip}`, 100, 60_000)
    if (!globalAllowed) {
      return NextResponse.json(
        { error: '請求過於頻繁，請稍後再試' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }

  // ===== /admin 路由保護 =====
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login') && !pathname.startsWith('/api/')) {
    const sessionToken = request.cookies.get('admin_session')?.value

    if (!sessionToken) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // 驗證 admin session 簽名（Edge Runtime 使用 Web Crypto）
    try {
      const parts = sessionToken.split('.')
      if (parts.length !== 2) {
        const res = NextResponse.redirect(new URL('/admin/login', request.url))
        res.cookies.delete('admin_session')
        return res
      }
      const [expiresAtStr] = parts
      const expiresAt = parseInt(expiresAtStr, 10)
      if (isNaN(expiresAt) || expiresAt < Date.now()) {
        const res = NextResponse.redirect(new URL('/admin/login', request.url))
        res.cookies.delete('admin_session')
        return res
      }
    } catch {
      const res = NextResponse.redirect(new URL('/admin/login', request.url))
      res.cookies.delete('admin_session')
      return res
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
}
