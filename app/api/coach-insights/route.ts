import { NextRequest, NextResponse } from 'next/server'
import { verifyCoachAuth } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('coach-insights')

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

const DAY_MS = 86400000

/**
 * GET /api/coach-insights
 * 給「賴助手」的主動洞察引擎用：算出「沒被 morning digest 講到、但值得 Howard 知道」的
 * 深層訊號（減脂卡關 / 狀態下滑）。bot 端再用一次 LLM 挑最尖的 1–2 條講人話。
 * 認證：admin_session cookie（verifyCoachAuth）。SELECT-only。
 *
 * 跟 /api/coach-digest 分工：digest = 行政面(草稿/到期/脫離)；insights = 生理面(卡關/狀態)。
 */
export async function GET(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) return NextResponse.json({ error: authError || '權限不足' }, { status: 403 })

    const now = Date.now()
    const d21 = new Date(now - 21 * DAY_MS).toISOString().split('T')[0]
    const d10 = new Date(now - 10 * DAY_MS).toISOString().split('T')[0]

    const [clientsResult, bodyResult, wellnessResult] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, is_active, goal_type, diet_start_date, subscription_tier, status, next_checkup_date')
        .eq('is_active', true)
        .in('subscription_tier', ['coached', 'self_managed']),
      supabase
        .from('body_composition')
        .select('client_id, date, weight')
        .gte('date', d21)
        .not('weight', 'is', null)
        .order('date', { ascending: true }),
      supabase
        .from('daily_wellness')
        .select('client_id, date, energy_level, device_recovery_score')
        .gte('date', d10)
        .order('date', { ascending: true }),
    ])

    for (const [name, r] of [['clients', clientsResult], ['body', bodyResult], ['wellness', wellnessResult]] as const) {
      if (r.error) logger.warn(`查詢 ${name} 失敗`, { error: r.error })
    }

    const clients = clientsResult.data || []
    const nameById = new Map(clients.map(c => [c.id, c.name as string]))

    // 依 client 分組
    const bodyByClient = new Map<string, { date: string; weight: number }[]>()
    for (const r of bodyResult.data || []) {
      const arr = bodyByClient.get(r.client_id) || []
      arr.push({ date: r.date as string, weight: Number(r.weight) })
      bodyByClient.set(r.client_id, arr)
    }
    const wellByClient = new Map<string, { date: string; energy: number | null; recovery: number | null }[]>()
    for (const r of wellnessResult.data || []) {
      const arr = wellByClient.get(r.client_id) || []
      arr.push({ date: r.date as string, energy: r.energy_level as number | null, recovery: r.device_recovery_score as number | null })
      wellByClient.set(r.client_id, arr)
    }

    const signals: { client: string; type: string; detail: string }[] = []

    for (const c of clients) {
      const name = nameById.get(c.id) || '(未知)'
      const gt = (c.goal_type || '').toLowerCase()
      const isFatLoss = gt.includes('loss') || gt === 'cut' || gt.includes('fat') || (c.goal_type || '').includes('減')

      // ── 訊號 1：減脂卡關（有在量、但體重 14 天幾乎沒動）──
      if (isFatLoss && c.diet_start_date) {
        const body = (bodyByClient.get(c.id) || []).filter(b => new Date(b.date).getTime() >= now - 14 * DAY_MS)
        if (body.length >= 4) {
          const first = body[0].weight, last = body[body.length - 1].weight
          const pct = first > 0 ? Math.abs(last - first) / first * 100 : 0
          const spanDays = Math.round((new Date(body[body.length - 1].date).getTime() - new Date(body[0].date).getTime()) / DAY_MS)
          if (pct < 0.7 && spanDays >= 10) {
            const weeks = Math.max(1, Math.floor((now - new Date(c.diet_start_date as string).getTime()) / (7 * DAY_MS)))
            signals.push({ client: name, type: 'plateau', detail: `減脂第 ${weeks} 週，體重近 ${spanDays} 天幾乎沒動（${first}→${last}kg），仍有在量但卡住` })
          }
        }
      }

      // ── 訊號 2：狀態下滑（近 3 天能量低 / recovery 明顯掉）──
      const well = wellByClient.get(c.id) || []
      if (well.length >= 4) {
        const recent3 = well.slice(-3)
        const energies = recent3.map(w => w.energy).filter((e): e is number => e != null)
        if (energies.length >= 2) {
          const avg = energies.reduce((a, b) => a + b, 0) / energies.length
          if (avg <= 2.5) signals.push({ client: name, type: 'low_energy', detail: `近 3 天能量偏低（平均 ${avg.toFixed(1)}/5）` })
        }
        const recRecent = recent3.map(w => w.recovery).filter((r): r is number => r != null)
        const recPrior = well.slice(0, -3).map(w => w.recovery).filter((r): r is number => r != null)
        if (recRecent.length >= 2 && recPrior.length >= 2) {
          const aR = recRecent.reduce((a, b) => a + b, 0) / recRecent.length
          const aP = recPrior.reduce((a, b) => a + b, 0) / recPrior.length
          if (aP - aR >= 20) signals.push({ client: name, type: 'recovery_drop', detail: `recovery 從 ${Math.round(aP)} 掉到 ${Math.round(aR)}` })
        }
      }

      // ── 訊號 3：血檢狀態（跟教練後台「誰要顧」同一套：clients.status 由 lab trigger 同步）──
      if (c.status === 'alert') signals.push({ client: name, type: 'lab_alert', detail: '血檢有警示項目，需追蹤/回診' })
      else if (c.status === 'attention') signals.push({ client: name, type: 'lab_attention', detail: '血檢有需注意項目' })

      // ── 訊號 4：回檢逾期 ──
      if (c.next_checkup_date) {
        const overdue = Math.floor((now - new Date(c.next_checkup_date as string).getTime()) / DAY_MS)
        if (overdue > 0) signals.push({ client: name, type: 'checkup_overdue', detail: `回檢已逾期 ${overdue} 天` })
      }
    }

    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())
    return NextResponse.json({ date, signals, count: signals.length })
  } catch (error) {
    logger.warn('coach-insights 失敗', { error })
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
