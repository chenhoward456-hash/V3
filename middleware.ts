import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 保護 /admin 路由（排除登入頁和 API）
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login') && !pathname.startsWith('/api/')) {
    const sessionToken = request.cookies.get('admin_session')?.value

    if (!sessionToken) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // 注意：middleware 在 edge runtime 跑，無法直接呼叫 verifyAdminSession（用 Map）
    // 但 cookie 是 httpOnly + secure + sameSite=strict，已經有基本防護
    // 頁面載入時會再透過 /api/admin/verify 做 server-side 驗證
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
