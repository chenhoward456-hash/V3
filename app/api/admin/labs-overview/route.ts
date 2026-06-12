import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import {
  verifyCoachAuth,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/auth-middleware'
import { analyzeLabs, selectKeyFindings, type LabResultRow } from '@/lib/lab-trend-analyzer'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

/**
 * GET /api/admin/labs-overview
 * B3 跨學員血檢總覽：把每位 lab_enabled 學員的最新血檢跑過 analyzeLabs，
 * 回傳每人 critical/attention/improving 計數 + 明細 + 回檢狀態，給教練一次 triage。
 */
export async function GET(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) return createErrorResponse(authError || '權限不足', 403)

    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, unique_code, gender, next_checkup_date, lab_results(test_name, value, unit, date, status)')
      .eq('lab_enabled', true)
      .eq('is_active', true)

    if (error) {
      console.error('[labs-overview] error:', error)
      return createErrorResponse('讀取失敗', 500)
    }

    const todayMs = Date.now()
    const dayMs = 86400000

    type ClientRow = {
      id: string
      name: string
      unique_code: string
      gender: string | null
      next_checkup_date: string | null
      lab_results: LabResultRow[] | null
    }

    const items = ((clients as ClientRow[] | null) ?? []).map(c => {
      const labs = (c.lab_results ?? []) as LabResultRow[]
      const gender = c.gender === '女性' ? '女性' : c.gender === '男性' ? '男性' : undefined
      const findings = analyzeLabs(labs, { gender })
      const key = selectKeyFindings(findings)

      const dates = [...new Set(labs.map(l => l.date))].filter(Boolean).sort()
      const latestDate = dates.length ? dates[dates.length - 1] : null
      const daysSinceLatest = latestDate
        ? Math.round((todayMs - new Date(latestDate + 'T00:00:00').getTime()) / dayMs)
        : null

      let checkupDaysUntil: number | null = null
      if (c.next_checkup_date) {
        checkupDaysUntil = Math.round((new Date(c.next_checkup_date + 'T00:00:00').getTime() - todayMs) / dayMs)
      }

      // 該回檢：已設回檢日且 ≤14 天/逾期，或最新一次抽血超過 120 天
      const dueForRetest =
        (checkupDaysUntil !== null && checkupDaysUntil <= 14) ||
        (daysSinceLatest !== null && daysSinceLatest > 120)

      return {
        clientId: c.id,
        name: c.name,
        uniqueCode: c.unique_code,
        latestDate,
        daysSinceLatest,
        panelCount: dates.length,
        nextCheckupDate: c.next_checkup_date,
        checkupDaysUntil,
        dueForRetest,
        criticalCount: key.critical.length,
        attentionCount: key.attention.length,
        improvingCount: key.improving.length,
        critical: key.critical.map(f => ({ name: f.testName, value: f.latestValue, unit: f.unit, optimal: f.optimalText, changePercent: f.changePercent })),
        attention: key.attention.map(f => ({ name: f.testName, value: f.latestValue, unit: f.unit, optimal: f.optimalText, changePercent: f.changePercent })),
        improving: key.improving.map(f => ({ name: f.testName, from: f.previousValue, to: f.latestValue, unit: f.unit, changePercent: f.changePercent })),
      }
    })

    return createSuccessResponse({ items, generatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[labs-overview] exception:', err)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
