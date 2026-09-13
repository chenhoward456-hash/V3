import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import {
  verifyCoachAuth,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/auth-middleware'
import { analyzeLabs, selectKeyFindings, type LabResultRow } from '@/lib/lab-trend-analyzer'
import { evaluateLabDue } from '@/lib/lab-due'

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

    const [{ data: clients, error }, panelNotesRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, unique_code, gender, next_checkup_date, lab_results(test_name, value, unit, date, status)')
        .eq('lab_enabled', true)
        .eq('is_active', true),
      // 回檢日有兩個來源（見 lib/lab-due.ts 檔頭），這頁原本只看 clients.next_checkup_date，
      // 所以陳胤豪 panel note 上排的 09-03 從來沒被這頁算進去過。
      supabase.from('lab_panel_notes').select('client_id, panel_date, next_review_date'),
    ])

    if (error) {
      console.error('[labs-overview] error:', error)
      return createErrorResponse('讀取失敗', 500)
    }

    // 台灣日（UTC+8）；lab-due 的判定全部用日期字串比，不吃執行環境時區
    const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]

    const latestPanelReview: Record<string, { panelDate: string; nextReview: string | null }> = {}
    for (const r of (panelNotesRes.data ?? []) as { client_id: string; panel_date: string; next_review_date: string | null }[]) {
      const cur = latestPanelReview[r.client_id]
      if (!cur || r.panel_date > cur.panelDate) {
        latestPanelReview[r.client_id] = { panelDate: r.panel_date, nextReview: r.next_review_date }
      }
    }

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

      // 判定交給 lib/lab-due.ts —— 這頁跟教練晨報必須講同一件事（紅線 6）
      const { item: due, due: dueForRetest } = evaluateLabDue({
        id: c.id,
        name: c.name,
        unique_code: c.unique_code,
        gender: c.gender,
        next_checkup_date: c.next_checkup_date,
        panel_next_review_date: latestPanelReview[c.id]?.nextReview ?? null,
        labs,
      }, today)

      return {
        clientId: c.id,
        name: c.name,
        uniqueCode: c.unique_code,
        latestDate: due.latestDate,
        daysSinceLatest: due.daysSinceLatest,
        panelCount: dates.length,
        nextCheckupDate: due.dueDate,
        checkupDaysUntil: due.daysUntil,
        dueForRetest,
        conflictingDates: due.conflictingDates,
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
