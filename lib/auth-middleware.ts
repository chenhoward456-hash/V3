import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

/**
 * 驗證請求者身份的中間件
 * @param request NextRequest 物件
 * @returns { user: any, error?: string } 驗證結果
 */
export async function verifyAuth(request: NextRequest): Promise<{ user: any; error?: string }> {
  try {
    // 1. 檢查 Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: '缺少 Authorization header 或格式錯誤' }
    }

    // 2. 提取 JWT token
    const token = authHeader.substring(7) // 移除 'Bearer ' 前綴
    if (!token) {
      return { user: null, error: 'JWT token 不能為空' }
    }

    // 3. 驗證 JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return { user: null, error: '無效的 JWT token' }
    }

    // 4. 檢查用戶角色（可選）
    const userRole = user.user_metadata?.role || user.app_metadata?.role
    if (!userRole) {
      return { user: null, error: '用戶缺少角色資訊' }
    }

    return { user: { ...user, role: userRole } }
    
  } catch (error) {
    console.error('身份驗證錯誤:', error)
    return { user: null, error: '身份驗證失敗' }
  }
}

/**
 * 檢查用戶是否為教練
 * @param user 用戶物件
 * @returns boolean 是否為教練
 */
export function isCoach(user: any): boolean {
  return user && user.role === 'coach'
}

/**
 * 檢查用戶是否為學員
 * @param user 用戶物件
 * @returns boolean 是否為學員
 */
export function isClient(user: any): boolean {
  return user && user.role === 'client'
}

/**
 * 建立標準化的錯誤回應
 * @param message 錯誤訊息
 * @param status HTTP 狀態碼
 * @returns NextResponse 錯誤回應
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
 * @param data 回應資料
 * @returns NextResponse 成功回應
 */
export function createSuccessResponse(data: any): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  })
}
