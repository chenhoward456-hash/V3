import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'
import { analyzeLabs, type LabResultRow } from '@/lib/lab-trend-analyzer'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

/**
 * GET /api/lab-findings?clientId=<unique_code>
 * 公開（學員可看自己的）— 只跑趨勢分析，不呼叫 AI。
 * 用途：學員端 timeline 顯示「N 個指標需要注意」警示 banner。
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    if (!clientId) {
      return createErrorResponse('缺少 clientId', 400)
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id, gender')
      .eq('unique_code', clientId)
      .maybeSingle<{ id: string; gender: string | null }>()

    if (!client) {
      return createErrorResponse('找不到客戶', 404)
    }

    // 拉近兩年 lab_results
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const cutoff = twoYearsAgo.toISOString().slice(0, 10)

    const { data: labs, error } = await supabase
      .from('lab_results')
      .select('test_name, value, unit, date, status')
      .eq('client_id', client.id)
      .gte('date', cutoff)
      .order('date', { ascending: true })

    if (error) {
      return createErrorResponse('讀取失敗', 500)
    }

    const gender =
      client.gender === '男性' || client.gender === '女性'
        ? client.gender
        : undefined

    const findings = analyzeLabs((labs || []) as LabResultRow[], { gender })

    // 給前端只回傳必要欄位，不洩漏內部 sortWeight 等
    const brief = findings.map(f => ({
      testName: f.testName,
      severity: f.severity,
      trend: f.trend,
      latestValue: f.latestValue,
      latestDate: f.latestDate,
      previousValue: f.previousValue,
      previousDate: f.previousDate,
      changePercent: f.changePercent,
      latestStatus: f.latestStatus,
      inOptimal: f.inOptimal,
      optimalText: f.optimalText,
    }))

    const counts = {
      critical:  findings.filter(f => f.severity === 'critical').length,
      attention: findings.filter(f => f.severity === 'attention').length,
      watch:     findings.filter(f => f.severity === 'watch').length,
      improving: findings.filter(f => f.severity === 'improving').length,
      optimal:   findings.filter(f => f.severity === 'optimal').length,
    }

    return createSuccessResponse({ findings: brief, counts })
  } catch (err) {
    console.error('[lab-findings] exception:', err)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
