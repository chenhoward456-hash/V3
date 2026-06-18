import { NextRequest, NextResponse } from 'next/server'
import { verifyCoachAuth } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('coach-digest')

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

const DAY_MS = 86400000

/**
 * GET /api/coach-digest
 * 給「賴助手」LINE bot 每天早上拉的「今日教練檯面」摘要（server 對 server）。
 * 認證：x-coach-pin header（verifyCoachAuth 三擇一之一）。
 * 只回「現在該動的」：待審草稿數、快到期/逾期、4–30 天還救得回的減脂脫離。
 * 刻意不回「誰今天沒記錄」這種噪音流（Howard 明確不要學員狀態洗版）。
 */
export async function GET(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) return NextResponse.json({ error: authError || '權限不足' }, { status: 403 })

    const now = Date.now()
    const ninetyDaysAgoStr = new Date(now - 90 * DAY_MS).toISOString().split('T')[0]

    const [clientsResult, draftsResult, actBody, actNutrition, actWellness, actTraining] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, is_active, expires_at, subscription_tier, goal_type, diet_start_date')
        .limit(500),
      supabase
        .from('ai_draft_audit')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'auto_after_upload')
        .is('coach_saved_at', null)
        .is('superseded_by_id', null),
      supabase.from('body_composition').select('client_id, date').gte('date', ninetyDaysAgoStr),
      supabase.from('nutrition_logs').select('client_id, date').gte('date', ninetyDaysAgoStr),
      supabase.from('daily_wellness').select('client_id, date').gte('date', ninetyDaysAgoStr),
      supabase.from('training_logs').select('client_id, date').gte('date', ninetyDaysAgoStr),
    ])

    for (const [name, r] of [['clients', clientsResult], ['drafts', draftsResult]] as const) {
      if (r.error) logger.warn(`查詢 ${name} 失敗`, { error: r.error })
    }

    const clients = clientsResult.data || []
    const pendingDrafts = draftsResult.count || 0

    // 各活動類型 → 每人最後活動日期
    const lastAct: Record<string, string> = {}
    const upd = (rows: { client_id: string; date: string }[] | null) => {
      for (const r of rows || []) {
        if (!lastAct[r.client_id] || r.date > lastAct[r.client_id]) lastAct[r.client_id] = r.date
      }
    }
    upd(actBody.data); upd(actNutrition.data); upd(actWellness.data); upd(actTraining.data)

    // 快到期 / 逾期（active、有 expires_at）→ days<0 逾期，0–7 快到期
    const expiring = clients
      .filter(c => c.is_active && c.expires_at)
      .map(c => ({ name: c.name as string, days: Math.ceil((new Date(c.expires_at as string).getTime() - now) / DAY_MS) }))
      .filter(c => c.days <= 7)
      .sort((a, b) => a.days - b.days)

    // 減脂脫離（4–30 天救得回的窗口）— 與 admin 行動佇列同一套判定
    const churn = clients
      .filter(c => {
        if (!c.is_active || !c.diet_start_date) return false
        if (c.expires_at && new Date(c.expires_at as string).getTime() < now) return false
        const gt = (c.goal_type || '').toLowerCase()
        const isFatLoss = gt.includes('loss') || gt === 'cut' || gt.includes('fat') || (c.goal_type || '').includes('減')
        if (!isFatLoss) return false
        const la = lastAct[c.id]
        if (!la) return false
        const daysSilent = Math.floor((now - new Date(la).getTime()) / DAY_MS)
        return daysSilent >= 4 && daysSilent <= 30
      })
      .map(c => ({
        name: c.name as string,
        weeks: Math.max(1, Math.floor((now - new Date(c.diet_start_date as string).getTime()) / (7 * DAY_MS))),
        daysSilent: Math.floor((now - new Date(lastAct[c.id]).getTime()) / DAY_MS),
      }))
      .sort((a, b) => a.daysSilent - b.daysSilent)

    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())

    return NextResponse.json({
      date,
      pendingDrafts,
      expiring,
      churn,
      total: pendingDrafts + expiring.length + churn.length,
    })
  } catch (error) {
    logger.warn('coach-digest 失敗', { error })
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
