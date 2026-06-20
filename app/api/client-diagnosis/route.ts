import { NextRequest, NextResponse } from 'next/server'
import { verifyCoachAuth } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { calculateLabStatus } from '@/utils/labStatus'

const logger = createLogger('client-diagnosis')

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

const DAY_MS = 86400000

/**
 * GET /api/client-diagnosis?name=Eddie
 * 賴助手「完整診斷」用：比 client-brief 更深，回傳單一學員的
 *   - 核心狀態 + 引擎路由（client_mode / prep_phase / goal_type）
 *   - 體重/體脂 + 14 日變化 + 近 4 週軌跡
 *   - 目前 macro 目標 + 教練覆寫鎖定狀態 + 最近一次自動調整
 *   - 最近一批血檢值 + 「用 calculateLabStatus 重算」的判讀（前端真相，非 DB status）
 * 讓 bot 用真數字產出 Howard 級診斷 + 可轉傳訊息。
 * 認證：admin_session cookie（verifyCoachAuth）。**SELECT-only，不寫任何學員資料。**
 */
export async function GET(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) return NextResponse.json({ error: authError || '權限不足' }, { status: 403 })

    const name = (request.nextUrl.searchParams.get('name') || '').trim()
    if (!name) return NextResponse.json({ error: '缺少 name' }, { status: 400 })

    const { data: matches, error: cErr } = await supabase
      .from('clients')
      .select('id, name, status, client_mode, goal_type, prep_phase, gender, age, diet_start_date, target_weight, body_fat_target, target_date, calories_target, protein_target, carbs_target, fat_target, coach_macro_override, auto_adjust_enabled, subscription_tier, is_active')
      .ilike('name', `%${name}%`)
      .limit(5)
    if (cErr) logger.warn('查 clients 失敗', { error: cErr })

    if (!matches || matches.length === 0) {
      return NextResponse.json({ found: false, note: `找不到叫「${name}」的學員` })
    }
    if (matches.length > 1) {
      return NextResponse.json({
        found: false,
        ambiguous: true,
        candidates: matches.map((m) => m.name),
        note: '名字對到多人，請說更明確',
      })
    }

    const c = matches[0]
    const now = Date.now()
    const d90 = new Date(now - 90 * DAY_MS).toISOString().split('T')[0]

    const [bodyR, labR, macroR] = await Promise.all([
      supabase
        .from('body_composition')
        .select('date, weight, body_fat')
        .eq('client_id', c.id)
        .gte('date', d90)
        .order('date', { ascending: true }),
      // 抓最近一批血檢（最多 60 筆，足以涵蓋一次完整套組）
      supabase
        .from('lab_results')
        .select('test_name, value, unit, date')
        .eq('client_id', c.id)
        .order('date', { ascending: false })
        .limit(60),
      supabase
        .from('macro_adjustment_log')
        .select('applied_at, applied_by, trigger_source, new_macros, reason')
        .eq('client_id', c.id)
        .order('applied_at', { ascending: false })
        .limit(1),
    ])

    // --- 體重 / 體脂 軌跡 ---
    const body = (bodyR.data || []).filter((b) => b.weight != null)
    const latestWeight = body.length ? Number(body[body.length - 1].weight) : null
    const latestBodyFat = (() => {
      for (let i = body.length - 1; i >= 0; i--) if (body[i].body_fat != null) return Number(body[i].body_fat)
      return null
    })()
    const w14 = body.filter((b) => new Date(b.date).getTime() >= now - 14 * DAY_MS)
    const weightChange14 =
      w14.length >= 2 ? +(Number(w14[w14.length - 1].weight) - Number(w14[0].weight)).toFixed(1) : null
    // 近 4 週週均體重（week 0 = 最近一週）
    const weeklyWeights: { weeksAgo: number; avgWeight: number }[] = []
    for (let wk = 0; wk < 4; wk++) {
      const end = now - wk * 7 * DAY_MS
      const start = end - 7 * DAY_MS
      const ws = body.filter((b) => {
        const t = new Date(b.date).getTime()
        return t > start && t <= end
      })
      if (ws.length) {
        weeklyWeights.push({
          weeksAgo: wk,
          avgWeight: +(ws.reduce((a, b) => a + Number(b.weight), 0) / ws.length).toFixed(1),
        })
      }
    }

    // --- 血檢：只留每項最新一筆，並用 calculateLabStatus 重算（前端真相，非 DB status）---
    const seen = new Set<string>()
    const labsLatest = (labR.data || []).filter((l) => {
      if (seen.has(l.test_name)) return false
      seen.add(l.test_name)
      return true
    })
    const gender = c.gender === '男性' || c.gender === '女性' ? c.gender : undefined
    const labs = labsLatest.map((l) => ({
      test_name: l.test_name,
      value: l.value,
      unit: l.unit,
      date: l.date,
      status: calculateLabStatus(l.test_name, Number(l.value), gender),
    }))
    const labFlags = labs.filter((l) => l.status !== 'normal')
    const labDate = labsLatest.length ? labsLatest[0].date : null

    // --- 目標 / 引擎 ---
    const gt = (c.goal_type || '').toLowerCase()
    const isFatLoss = gt.includes('loss') || gt === 'cut' || gt.includes('fat') || (c.goal_type || '').includes('減')
    const dietWeeks = c.diet_start_date
      ? Math.max(1, Math.floor((now - new Date(c.diet_start_date as string).getTime()) / (7 * DAY_MS)))
      : null

    return NextResponse.json({
      found: true,
      name: c.name,
      status: c.status,
      clientMode: c.client_mode, // standard/health/bodybuilding/athletic → 引擎路由
      prepPhase: c.prep_phase, // off_season/cut/peak_week/...
      goal: c.goal_type,
      isFatLoss,
      gender: c.gender,
      age: c.age,
      dietWeeks,
      // 體組成
      latestWeight,
      latestBodyFat,
      weightChange14d: weightChange14,
      weeklyWeights, // [{weeksAgo, avgWeight}]
      targetWeight: c.target_weight,
      bodyFatTarget: c.body_fat_target,
      targetDate: c.target_date,
      // macro 目標 + 鎖定狀態
      macroTargets: {
        calories: c.calories_target,
        protein: c.protein_target,
        carbs: c.carbs_target,
        fat: c.fat_target,
      },
      coachOverrideLocked: !!c.coach_macro_override,
      autoAdjustEnabled: c.auto_adjust_enabled,
      lastMacroAdjustment: macroR.data?.[0] || null,
      // 血檢
      labDate,
      labCount: labs.length,
      labFlags, // 只列 attention/alert 的，bot 重點講這些
      labs, // 完整重算清單
      // meta
      subscriptionTier: c.subscription_tier,
      isActive: c.is_active,
    })
  } catch (error) {
    logger.warn('client-diagnosis 失敗', { error })
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
