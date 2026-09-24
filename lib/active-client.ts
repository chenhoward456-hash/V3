/**
 * 學員端 API 共用：用 unique_code 找學員，並擋掉「停用」或「已過期」的帳號。
 *
 * 為什麼要抽出來（稽核 S-13）：寫入 API 大多有檢查 is_active／expires_at，但一堆讀取 API
 * （lab-findings、lab-panel-notes、insights、recovery-assessment、training-readiness、
 * supplements/history、garmin/status、training-sets、nutrition-logs、daily-wellness、
 * auto-draft-status、lab-results）只查「碼存不存在」。結果「停用帳號」擋不住碼外流——
 * 停用或過期的碼照樣讀得到血檢、筆記等資料。每支各寫一次容易漏，統一走這裡。
 *
 * 教練例外：後台（admin_session cookie / coach PIN / coach JWT）有時要看停用或過期學員的資料
 * （例如封存補品清單、血檢解讀編輯器），所以傳入 request 時，教練身份可略過停用／過期檢查。
 */
import type { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createErrorResponse, verifyCoachAuth } from '@/lib/auth-middleware'

export type ClientAccessBlock = { status: 403; message: string } | null

/**
 * 純函式：判斷這個學員帳號能不能被學員端存取。
 * expires_at 為 NULL 代表永不過期（與 GET /api/clients 一致）。
 */
export function getClientAccessBlock(
  client: { is_active?: boolean | null; expires_at?: string | null },
  now: Date = new Date(),
): ClientAccessBlock {
  if (client.is_active === false) return { status: 403, message: '此帳號已暫停，請聯繫教練' }
  if (client.expires_at && new Date(client.expires_at) < now) return { status: 403, message: '帳號已過期' }
  return null
}

type ResolveResult<T> =
  | { client: T; response?: undefined }
  | { client?: undefined; response: NextResponse }

/**
 * 用 unique_code 查學員；找不到回 404，停用／過期回 403（教練身份可略過）。
 * @param select 要額外撈的欄位（會自動補上 id, is_active, expires_at）
 * @param request 傳入時，教練身份可略過停用／過期檢查
 */
export async function resolveActiveClient<T extends Record<string, unknown> = Record<string, unknown>>(
  supabase: SupabaseClient,
  code: string,
  opts: { select?: string; request?: NextRequest } = {},
): Promise<ResolveResult<T & { id: string; is_active: boolean | null; expires_at: string | null }>> {
  const extra = opts.select ? `, ${opts.select}` : ''
  const { data: client } = await supabase
    .from('clients')
    .select(`id, is_active, expires_at${extra}`)
    .eq('unique_code', code)
    .maybeSingle()

  if (!client) return { response: createErrorResponse('找不到客戶', 404) }

  const typed = client as unknown as T & { id: string; is_active: boolean | null; expires_at: string | null }
  const denied = await denyInactiveClient(typed, opts.request)
  if (denied) return { response: denied }
  return { client: typed }
}

/**
 * 已經自己查好 client（select 記得帶 is_active, expires_at）的路由用這支：
 * 停用／過期回 403 的 NextResponse，否則回 null。傳入 request 時教練身份可略過。
 */
export async function denyInactiveClient(
  client: { is_active?: boolean | null; expires_at?: string | null },
  request?: NextRequest,
): Promise<NextResponse | null> {
  const block = getClientAccessBlock(client)
  if (!block) return null
  if (request) {
    const { authorized } = await verifyCoachAuth(request)
    if (authorized) return null
  }
  return createErrorResponse(block.message, block.status)
}
