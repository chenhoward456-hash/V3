import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { validateLabValue, validateDate, sanitizeInput } from '@/utils/validation'
import {
  verifyCoachAuth,
  createErrorResponse,
  createSuccessResponse,
  rateLimit,
  getClientIP,
} from '@/lib/auth-middleware'
import { LAB_THRESHOLDS } from '@/utils/labStatus'
import { fireAutoDraftsForDates } from '@/lib/auto-draft'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()
const MAX_ROWS_PER_REQUEST = 50

interface IncomingRow {
  test_name?: string
  value?: number | string
  unit?: string
  reference_range?: string
  date?: string
}

interface NormalizedRow {
  test_name: string
  value: number
  unit: string
  reference_range: string
  date: string
}

function autoStatus(testName: string, value: number, referenceRange: string): 'normal' | 'attention' | 'alert' {
  // 先看 reference_range；沒提供就用 LAB_THRESHOLDS 推
  const t = (LAB_THRESHOLDS as Record<string, { normal: number | { min: number; max: number }; attention: number | { min: number; max: number } }>)[testName]
  if (t) {
    if (typeof t.normal === 'object') {
      const nr = t.normal as { min: number; max: number }
      const ar = t.attention as { min: number; max: number }
      if (value >= nr.min && value <= nr.max) return 'normal'
      if (value >= ar.min && value <= ar.max) return 'attention'
      return 'alert'
    }
    const n = t.normal as number
    const a = t.attention as number
    // HIGHER_IS_BETTER subset — same as utils/labStatus
    const higherBetter = ['HDL-C', 'HDL-C_female', '白蛋白', 'eGFR'].includes(testName)
    if (higherBetter) {
      if (value >= n) return 'normal'
      if (value >= a) return 'attention'
      return 'alert'
    }
    if (value <= n) return 'normal'
    if (value <= a) return 'attention'
    return 'alert'
  }
  return 'normal'
}

/**
 * POST /api/lab-results/bulk
 * body: { clientId: string (unique_code), rows: IncomingRow[], selfEntry?: boolean }
 *
 * 用於自助上傳（手打、CSV parse 後、OCR 確認後）一次寫多筆。
 * selfEntry=true 時走學員 rate-limit，否則需教練權限。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, rows, selfEntry } = body
    if (!clientId || !Array.isArray(rows) || rows.length === 0) {
      return createErrorResponse('缺少 clientId 或 rows', 400)
    }
    if (rows.length > MAX_ROWS_PER_REQUEST) {
      return createErrorResponse(`單次最多 ${MAX_ROWS_PER_REQUEST} 筆，請分批`, 400)
    }

    // Auth
    if (selfEntry) {
      const ip = getClientIP(request)
      const { allowed } = await rateLimit(`lab-bulk-self:${ip}`, 5, 60_000)
      if (!allowed) return createErrorResponse('請求過於頻繁', 429)
    } else {
      const { authorized, error: authError } = await verifyCoachAuth(request)
      if (!authorized) return createErrorResponse(authError || '權限不足', 403)
    }

    // Resolve client
    const { data: client } = await supabase
      .from('clients')
      .select('id, is_active, expires_at, lab_enabled')
      .eq('unique_code', clientId)
      .single()
    if (!client) return createErrorResponse('找不到客戶', 404)
    if (selfEntry) {
      if (client.is_active === false) return createErrorResponse('帳號已停用', 403)
      if (client.expires_at && new Date(client.expires_at) < new Date()) return createErrorResponse('帳號已過期', 403)
      if (client.lab_enabled === false) return createErrorResponse('血檢功能未啟用', 403)
    }

    const errors: { index: number; error: string }[] = []
    const normalized: NormalizedRow[] = []

    rows.forEach((r: IncomingRow, idx: number) => {
      if (!r.test_name) { errors.push({ index: idx, error: '缺少 test_name' }); return }
      const value = typeof r.value === 'string' ? parseFloat(r.value) : r.value
      if (value === undefined || !Number.isFinite(value)) {
        errors.push({ index: idx, error: '無效的 value' }); return
      }
      const date = r.date || new Date().toISOString().slice(0, 10)
      const dateValidation = validateDate(date)
      if (!dateValidation.isValid) {
        errors.push({ index: idx, error: dateValidation.error || '無效的 date' }); return
      }
      const testName = sanitizeInput(r.test_name)
      const labValidation = validateLabValue(testName, value)
      if (!labValidation.isValid) {
        errors.push({ index: idx, error: labValidation.error || '數值超出範圍' }); return
      }
      const unit = sanitizeInput(r.unit || '')
      const reference_range = sanitizeInput(r.reference_range || '')
      normalized.push({ test_name: testName, value, unit, reference_range, date })
    })

    if (normalized.length === 0) {
      return createErrorResponse(
        `沒有可寫入的有效資料 (${errors.length} 筆都失敗): ${errors.slice(0, 3).map(e => `#${e.index} ${e.error}`).join('; ')}`,
        400
      )
    }

    const insertRows = normalized.map(r => ({
      client_id: client.id,
      test_name: r.test_name,
      value: r.value,
      unit: r.unit,
      reference_range: r.reference_range,
      date: r.date,
      status: autoStatus(r.test_name, r.value, r.reference_range),
    }))

    const { data, error } = await supabase
      .from('lab_results')
      .insert(insertRows)
      .select('id, test_name, value, unit, date, status')

    if (error) {
      console.error('[lab-results/bulk] insert error:', error)
      return createErrorResponse('寫入失敗', 500)
    }

    // selfEntry mode → 背景觸發 AI 草稿（每個 unique panel_date 一份）
    if (selfEntry && insertRows.length > 0) {
      const dateCountMap = new Map<string, number>()
      for (const r of insertRows) {
        dateCountMap.set(r.date, (dateCountMap.get(r.date) ?? 0) + 1)
      }
      fireAutoDraftsForDates(client.id, dateCountMap)
    }

    return createSuccessResponse({
      inserted: data?.length ?? 0,
      rows: data ?? [],
      skipped: errors,
      autoDraftQueued: selfEntry ? Array.from(new Set(insertRows.map(r => r.date))) : [],
    })
  } catch (err) {
    console.error('[lab-results/bulk] exception:', err)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
