import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

/** Authenticated user returned from verifyAuth */
export interface AuthUser {
  id: string
  email?: string
  role: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
  [key: string]: unknown
}

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

// ===== Admin Session (HMAC-signed, stateless) =====
const ADMIN_SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

function getSessionSecret(): string {
  // 使用獨立的 SESSION_SECRET，不再 fallback 到 ADMIN_PASSWORD
  // 避免密碼洩漏時連帶影響 session 簽名安全性
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    // 向下相容：如果 SESSION_SECRET 未設定，使用 ADMIN_PASSWORD 並記錄警告
    const fallback = process.env.ADMIN_PASSWORD
    if (!fallback) throw new Error('SESSION_SECRET 環境變數未設定')
    console.warn('[安全警告] 建議設定獨立的 SESSION_SECRET 環境變數，而非使用 ADMIN_PASSWORD')
    return fallback
  }
  return secret
}

/**
 * 建立 admin session，回傳 HMAC-signed token（stateless，不依賴 in-memory）
 * 格式: expiresAt.signature
 */
export function createAdminSession(): string {
  const expiresAt = Date.now() + ADMIN_SESSION_DURATION
  const payload = `admin:${expiresAt}`
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex')
  return `${expiresAt}.${signature}`
}

/**
 * 驗證 admin session token（stateless）
 */
export function verifyAdminSession(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return false

    const [expiresAtStr, signature] = parts
    const expiresAt = parseInt(expiresAtStr, 10)

    // 檢查是否過期
    if (isNaN(expiresAt) || expiresAt < Date.now()) return false

    // 驗證簽名
    const payload = `admin:${expiresAt}`
    const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex')

    // timing-safe 比較
    if (signature.length !== expectedSig.length) return false
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
  } catch {
    return false
  }
}

/**
 * 銷毀 admin session（stateless 版本不需要 server-side 清理，cookie 會被覆蓋）
 */
export function destroyAdminSession(_token: string): void {
  // no-op: stateless token, 由 cookie 刪除處理
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
 * 驗證教練權限（Admin Session Cookie / Coach PIN / JWT 三擇一）
 * 適用於需要教練身份的操作
 */
export async function verifyCoachAuth(request: NextRequest): Promise<{ authorized: boolean; error?: string }> {
  // 方法一：Admin Session Cookie（後台頁面自動帶 cookie）
  const sessionToken = request.cookies.get('admin_session')?.value
  if (sessionToken && verifyAdminSession(sessionToken)) {
    return { authorized: true }
  }

  // 方法二：Coach PIN
  if (verifyCoachPin(request)) {
    return { authorized: true }
  }

  // 方法三：JWT + coach role
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
 * @returns { user: AuthUser | null, error?: string } 驗證結果
 */
export async function verifyAuth(request: NextRequest): Promise<{ user: AuthUser | null; error?: string }> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: '身份驗證失敗' }
    }

    const token = authHeader.substring(7)
    if (!token) {
      return { user: null, error: '身份驗證失敗' }
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return { user: null, error: '身份驗證失敗' }
    }

    // 只從 app_metadata 讀取 role（user_metadata 可被使用者自行修改，有提權風險）
    const userRole = user.app_metadata?.role
    if (!userRole) {
      return { user: null, error: '身份驗證失敗' }
    }

    return { user: { ...user, role: userRole } }

  } catch {
    return { user: null, error: '身份驗證失敗' }
  }
}

/**
 * 檢查用戶是否為教練
 */
export function isCoach(user: AuthUser | null): boolean {
  return !!user && user.role === 'coach'
}

/**
 * 檢查用戶是否為學員
 */
export function isClient(user: AuthUser | null): boolean {
  return !!user && user.role === 'client'
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
export function createSuccessResponse(data: unknown): NextResponse {
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
  let result = input.trim().slice(0, maxLength)
  // 遞迴移除危險模式
  let prev = ''
  while (prev !== result) {
    prev = result
    result = result
      .replace(/[<>]/g, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/vbscript\s*:/gi, '')
      .replace(/data\s*:\s*text\/html/gi, '')
      .replace(/on[a-z]{2,15}\s*=/gi, '')
  }
  return result
}

/**
 * 驗證數值在合理範圍內
 */
export function validateNumericField(value: unknown, min: number, max: number, fieldName: string): { isValid: boolean; error: string } {
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
  // request.ip 由 Vercel 平台提供，不可被 header 偽造；API route 中可能為 undefined
  return (request as any).ip
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}
