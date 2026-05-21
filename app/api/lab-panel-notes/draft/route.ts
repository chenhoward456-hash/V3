import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import {
  verifyCoachAuth,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/auth-middleware'
import { analyzeLabs, type LabResultRow } from '@/lib/lab-trend-analyzer'
import { generatePanelNoteDraft } from '@/lib/lab-draft-engine'

const supabase = createServiceSupabase()

/**
 * POST /api/lab-panel-notes/draft
 * body: { clientId: string (unique_code 或 internal id), panelDate?: string }
 *
 * - 拉該學員 lab_results
 * - 跑趨勢分析
 * - 呼叫 Claude 產出 panel note 草稿
 * - 回傳 { summary, priorities, findings, modelUsed } — 不寫 DB，由前端決定是否儲存
 */
export async function POST(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) {
      return createErrorResponse(authError || '權限不足', 403)
    }

    const body = await request.json()
    const { clientId, panelDate } = body
    if (!clientId) {
      return createErrorResponse('缺少 clientId', 400)
    }

    // 找 internal client（接受 unique_code 或 UUID）
    type ClientRow = {
      id: string
      name: string
      age: number | null
      gender: string | null
      client_mode: string | null
      subscription_tier: string | null
    }
    let client: ClientRow | null = null
    {
      const { data } = await supabase
        .from('clients')
        .select('id, name, age, gender, client_mode, subscription_tier')
        .eq('unique_code', clientId)
        .maybeSingle<ClientRow>()
      if (data) client = data
    }
    if (!client) {
      const { data } = await supabase
        .from('clients')
        .select('id, name, age, gender, client_mode, subscription_tier')
        .eq('id', clientId)
        .maybeSingle<ClientRow>()
      if (data) client = data
    }
    if (!client) {
      return createErrorResponse('找不到學員', 404)
    }

    // 拉所有 lab_results（最多近兩年，避免太大）
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const cutoff = twoYearsAgo.toISOString().slice(0, 10)

    const { data: labs, error: labsError } = await supabase
      .from('lab_results')
      .select('test_name, value, unit, date, status')
      .eq('client_id', client.id)
      .gte('date', cutoff)
      .order('date', { ascending: true })

    if (labsError) {
      console.error('[draft] lab fetch error:', labsError)
      return createErrorResponse('讀取血檢失敗', 500)
    }
    if (!labs || labs.length === 0) {
      return createErrorResponse('此學員尚無血檢資料', 400)
    }

    const gender =
      client.gender === '男性' || client.gender === '女性'
        ? client.gender
        : undefined

    const findings = analyzeLabs(labs as LabResultRow[], { gender })

    // 推斷 panel_date：若未指定，用 labs 中最新的日期
    const resolvedPanelDate =
      panelDate ||
      labs.reduce((max, r) => (r.date > max ? r.date : max), labs[0].date as string)

    const draft = await generatePanelNoteDraft({
      panelDate: resolvedPanelDate,
      clientName: client.name ?? undefined,
      clientAge: client.age,
      clientGender: gender ?? null,
      clientMode: client.client_mode,
      subscriptionTier: client.subscription_tier,
      findings,
    })

    const findingsBrief = findings.slice(0, 12).map(f => ({
      testName: f.testName,
      severity: f.severity,
      trend: f.trend,
      latestValue: f.latestValue,
      changePercent: f.changePercent,
      label: f.autoLabel,
    }))

    // Audit log — 不阻擋回應，錯誤只 log 不噴 user
    supabase
      .from('ai_draft_audit')
      .insert({
        client_id: client.id,
        panel_date: resolvedPanelDate,
        client_mode: client.client_mode,
        findings_count: draft.findingsCount,
        findings_brief: findingsBrief,
        ai_summary: draft.summary,
        ai_priorities: draft.priorities,
        model_used: draft.modelUsed,
      })
      .then(({ error }) => {
        if (error) console.error('[draft] audit log error:', error)
      })

    return createSuccessResponse({
      panelDate: resolvedPanelDate,
      summary: draft.summary,
      priorities: draft.priorities,
      modelUsed: draft.modelUsed,
      findingsCount: draft.findingsCount,
      findingsBrief,
    })
  } catch (err) {
    console.error('[draft] exception:', err)
    return createErrorResponse('產生草稿失敗', 500)
  }
}
