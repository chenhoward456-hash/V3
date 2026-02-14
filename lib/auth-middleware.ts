import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// 建立帶有 Service Role Key 的 Supabase 客戶端（用於驗證 JWT）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// ===== Rate Limiting =====
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

/**
 * 簡易 rate limiter（in-memory，適合單節點部署）
 * @param key 識別鍵（例如 IP + endpoint）
 * @param maxRequests 在時間窗口內最多允許幾次
 * @param windowMs 時間窗口毫秒數
 */
export function rateLimit(key: string, maxRequests: number = 10, windowMs: number = 60_000): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  // 清理過期條目（每 100 次呼叫做一次）
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore) {
      if (v.resetAt < now) rateLimitStore.delete(k)
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  entry.count++
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: maxRequests - entry.count }
}

// ===== Admin Session =====
const ADMIN_SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours
const adminSessions = new Map<string, { expiresAt: number }>()

/**
 * 建立 admin session，回傳 session token
 */
export function createAdminSession(): string {
  const token = crypto.randomBytes(32).toString('hex')
  adminSessions.set(token, { expiresAt: Date.now() + ADMIN_SESSION_DURATION })
  return token
}

/**
 * 驗證 admin session token
 */
export function verifyAdminSession(token: string): boolean {
  const session = adminSessions.get(token)
  if (!session) return false
  if (session.expiresAt < Date.now()) {
    adminSessions.delete(token)
    return false
  }
  return true
}

/**
 * 銷毀 admin session
 */
export function destroyAdminSession(token: string): void {
  adminSessions.delete(token)
}

// ===== Coach PIN 驗證（統一函數）=====

/**
 * 驗證 coach PIN（server-side only）
 * PIN 從 x-coach-pin header 取得，與 COACH_PIN env var 比對
 */
export function verifyCoachPin(request: NextRequest): boolean {
  const pin = request.headers.get('x-coach-pin')
  const serverPin = process.env.COACH_PIN
  if (!pin || !serverPin) return false
  // 使用 timing-safe comparison 防止 timing attack
  if (pin.length !== serverPin.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(serverPin))
  } catch {
    return false
  }
}

/**
 * 驗證教練權限（JWT 或 PIN 二擇一）
 * 適用於需要教練身份的 POST/PUT/DELETE 操作
 */
export async function verifyCoachAuth(request: NextRequest): Promise<{ authorized: boolean; error?: string }> {
  // 方法一：Coach PIN
  if (verifyCoachPin(request)) {
    return { authorized: true }
  }

  // 方法二：JWT + coach role
  const { user, error: authError } = await verifyAuth(request)
  if (authError || !user || !isCoach(user)) {
    return { authorized: false, error: '權限不足，需要教練身份' }
  }

  return { authorized: true }
}

// ===== JWT 驗證 =====

/**
 * 驗證請求者身份的中間件
 * @param request NextRequest 物件
 * @returns { user: any, error?: string } 驗證結果
 */
export async function verifyAuth(request: NextRequest): Promise<{ user: any; error?: string }> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: '缺少 Authorization header 或格式錯誤' }
    }

    const token = authHeader.substring(7)
    if (!token) {
      return { user: null, error: 'JWT token 不能為空' }
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return { user: null, error: '無效的 JWT token' }
    }

    const userRole = user.user_metadata?.role || user.app_metadata?.role
    if (!userRole) {
      return { user: null, error: '用戶缺少角色資訊' }
    }

    return { user: { ...user, role: userRole } }

  } catch {
    return { user: null, error: '身份驗證失敗' }
  }
}

/**
 * 檢查用戶是否為教練
 */
export function isCoach(user: any): boolean {
  return user && user.role === 'coach'
}

/**
 * 檢查用戶是否為學員
 */
export function isClient(user: any): boolean {
  return user && user.role === 'client'
}

// ===== 回應工具 =====

/**
 * 建立標準化的錯誤回應
 */
export function createErrorResponse(message: string, status: number = 401): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code: status,
      timestamp: new Date().toISOString()
    },
    { status }
  )
}

/**
 * 建立標準化的成功回應
 */
export function createSuccessResponse(data: any): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  })
}

// ===== 輸入清理 =====

/**
 * 清理文字欄位（note 等自由輸入）
 * 限制長度 + 移除危險字元
 */
export function sanitizeTextField(input: string | null | undefined, maxLength: number = 500): string | null {
  if (!input || typeof input !== 'string') return null
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
}

/**
 * 驗證數值在合理範圍內
 */
export function validateNumericField(value: any, min: number, max: number, fieldName: string): { isValid: boolean; error: string } {
  if (value === null || value === undefined) return { isValid: true, error: '' }
  if (typeof value !== 'number' || isNaN(value)) {
    return { isValid: false, error: `${fieldName} 必須是有效的數字` }
  }
  if (value < min || value > max) {
    return { isValid: false, error: `${fieldName} 的有效範圍是 ${min} - ${max}` }
  }
  return { isValid: true, error: '' }
}

/**
 * 取得用戶端 IP（用於 rate limiting）
 */
export function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}
