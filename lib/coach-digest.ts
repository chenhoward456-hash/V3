/**
 * 教練晨報 —— Howard 不打開後台時，唯一會知道學員狀況的管道。
 *
 * ⚠️ 為什麼要從 cron 裡抽出來（2026-08-23）：
 * 原本這段邏輯埋在 `app/api/cron/daily/route.ts` 一千九百行的排程中間，
 * 造成三個問題：
 *   1. **沒辦法預覽**。Howard 說「你直接發一封我看」，但唯一能觸發它的方法
 *      是跑整支 daily cron —— 那會把提醒推播給所有學員，不能為了看一封信做這種事。
 *   2. **沒辦法測**。它是這封信的內容產生器，卻一支測試都沒有。
 *   3. 沒人看得到它長怎樣，所以「有沒有連結」這種破口可以放著好幾個月沒人發現。
 *
 * 現在拆成兩層：`buildCoachDigest` 純函式（可測、可預覽）＋ `loadCoachDigest` 負責抓資料。
 * cron 與 `/api/admin/coach-digest` 都走同一條，**預覽看到的就是排程會送的**。
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { daysUntilDateTW, DAY_MS } from './date-utils'
import { COACH_LINE_USER_ID } from './line-links'
import { findLabsDue, formatLabDueLines, type LabDueItem, type LabDueClientInput } from './lab-due'
import type { LabResultRow } from './lab-trend-analyzer'
import type { TemplateItem } from './lab-order'

export { COACH_LINE_USER_ID }

/**
 * 掉線判定的下限，跟 `/admin` 戰情室同一條線。
 * 上限 30 天：超過的是叫不回來的鬼魂，歸留存數字不歸晨報 ——
 * 天天在信裡唸同一個三個月前就走掉的人，只會讓整封信變成雜訊被略過。
 */
export const OFFLINE_MIN_DAYS = 3
export const OFFLINE_MAX_DAYS = 30

export type DigestClient = {
  id: string
  name: string
  body_composition_enabled?: boolean | null
  nutrition_enabled?: boolean | null
  training_enabled?: boolean | null
  wellness_enabled?: boolean | null
}

export type CoachDigestInput = {
  /** 台灣日 YYYY-MM-DD */
  today: string
  clients: DigestClient[]
  /** 昨天有記錄的 client_id */
  yesterdayWeightIds: string[]
  yesterdayNutritionIds: string[]
  yesterdayTraining: { client_id: string; rpe?: number | null }[]
  yesterdayWellness: { client_id: string; energy_level?: number | null }[]
  /** 每位學員最後一次有任何紀錄的日期 YYYY-MM-DD */
  lastActiveByClient: Record<string, string>
  /** 近 10 天體重（判停滯用） */
  recentWeights: { client_id: string; weight: number | null }[]
  /** 30 天內的比賽 */
  competitions: { name: string; competition_date: string }[]
  /** 該回檢的血檢（已由 findLabsDue 算好、依急迫度排序） */
  labsDue: LabDueItem[]
  /** 後台網址（信尾的可點連結） */
  adminUrl: string
}

export type CoachDigest = {
  /** 沒東西好講就是 null —— 不發空信 */
  text: string | null
  offline: { name: string; days: number }[]
}

export function buildCoachDigest(input: CoachDigestInput): CoachDigest {
  const {
    today, clients, yesterdayWeightIds, yesterdayNutritionIds,
    yesterdayTraining, yesterdayWellness, lastActiveByClient,
    recentWeights, competitions, labsDue, adminUrl,
  } = input

  const hadWeight = new Set(yesterdayWeightIds)
  const hadNutrition = new Set(yesterdayNutritionIds)
  const hadTraining = new Set(yesterdayTraining.map(t => t.client_id))
  const hadWellness = new Set(yesterdayWellness.map(w => w.client_id))
  const nameOf = (id: string) => clients.find(c => c.id === id)?.name || '未知'

  const lines: string[] = []

  // 0. 掉線名單 —— 這才是他該開後台的理由，所以排最前面
  const todayMs = Date.parse(today)
  const offline = clients
    .map(c => {
      const la = lastActiveByClient[c.id]
      return { name: c.name, days: la ? Math.round((todayMs - Date.parse(la)) / DAY_MS) : null }
    })
    .filter((x): x is { name: string; days: number } =>
      x.days != null && x.days >= OFFLINE_MIN_DAYS && x.days <= OFFLINE_MAX_DAYS)
    .sort((a, b) => b.days - a.days)

  if (offline.length > 0) {
    lines.push(`🚨 ${offline.length} 個人掉線了：`)
    offline.forEach(o => lines.push(`  • ${o.name}：${o.days} 天沒動`))
    lines.push('')
  }

  // 0.5 血檢到期 —— 排在「昨日未記錄」前面，因為這是有期限、會過期的事。
  //
  // ⚠️ 這段存在的唯一理由是**投遞**：`/admin/labs` 早就會算「該回檢」，
  // 但那要他自己想起來去開後台。他的原話是「我都懶得開後台」，
  // 結果謝佳峻的回檢日 09-08 過了 5 天沒有任何人知道。
  if (labsDue.length > 0) {
    const overdue = labsDue.filter(l => l.daysUntil !== null && l.daysUntil < 0).length
    lines.push(overdue > 0 ? `🩸 血檢：${overdue} 個逾期` : '🩸 血檢該回檢了：')
    for (const l of labsDue) lines.push(...formatLabDueLines(l))
    lines.push('')
  }

  // 1. 昨天沒記錄
  const missedOf = (c: DigestClient) => {
    const m: string[] = []
    if (c.body_composition_enabled && !hadWeight.has(c.id)) m.push('體重')
    if (c.nutrition_enabled && !hadNutrition.has(c.id)) m.push('飲食')
    if (c.training_enabled && !hadTraining.has(c.id)) m.push('訓練')
    if (c.wellness_enabled && !hadWellness.has(c.id)) m.push('感受')
    return m
  }
  // 兩種人不進「昨日未記錄」：
  //   ① 已經在掉線名單上的 —— 他昨天當然沒記錄，講兩次只是灌長度
  //   ② 鬼魂（>30 天沒動或從來沒記錄過）—— 掉線名單特地把他們濾掉了，
  //      結果他們天天從這裡爬回信裡（謝佳峻 73 天、William 從沒記錄），
  //      等於過濾白做。他們不會突然開始記錄，天天唸只會讓整封信變雜訊被略過。
  const offlineIds = new Set(offline.map(o => o.name))
  const isGhost = (c: DigestClient) => {
    const la = lastActiveByClient[c.id]
    if (!la) return true
    return Math.round((todayMs - Date.parse(la)) / DAY_MS) > OFFLINE_MAX_DAYS
  }
  const missedClients = clients.filter(c => !offlineIds.has(c.name) && !isGhost(c) && missedOf(c).length > 0)
  if (missedClients.length > 0) {
    lines.push('📋 昨日未記錄：')
    for (const mc of missedClients.slice(0, 10)) lines.push(`  • ${mc.name}：${missedOf(mc).join('、')}`)
  }

  // 2. 精力偏低 / RPE 過高
  const lowEnergy = yesterdayWellness.filter(w => w.energy_level != null && w.energy_level <= 2)
  const highRPE = yesterdayTraining.filter(t => t.rpe != null && t.rpe >= 9)
  if (lowEnergy.length > 0 || highRPE.length > 0) {
    lines.push('')
    lines.push('⚠️ 需關注：')
    for (const w of lowEnergy) lines.push(`  • ${nameOf(w.client_id)}：精力 ${w.energy_level}/5`)
    for (const t of highRPE) lines.push(`  • ${nameOf(t.client_id)}：RPE ${t.rpe}`)
  }

  // 3. 體重停滯（近 10 天 ≥7 筆、全距 ≤0.2kg）
  const weightsByClient: Record<string, number[]> = {}
  for (const w of recentWeights) {
    if (w.weight == null) continue
    ;(weightsByClient[w.client_id] ||= []).push(w.weight)
  }
  const plateau = Object.entries(weightsByClient)
    .filter(([, ws]) => ws.length >= 7 && Math.max(...ws) - Math.min(...ws) <= 0.2)
    .map(([cid]) => nameOf(cid))
  if (plateau.length > 0) {
    lines.push('')
    lines.push('📊 體重停滯（>7天 ±0.2kg）：')
    plateau.forEach(n => lines.push(`  • ${n}`))
  }

  // 4. 備賽倒數（30 天內）
  const urgent = competitions
    .map(c => ({ name: c.name, days: daysUntilDateTW(c.competition_date) }))
    .filter(c => c.days > 0 && c.days <= 30)
    .sort((a, b) => a.days - b.days)
  if (urgent.length > 0) {
    lines.push('')
    lines.push('🏆 備賽倒數：')
    urgent.forEach(u => lines.push(`  • ${u.name}：${u.days} 天`))
  }

  if (lines.length === 0) return { text: null, offline }

  // 開頭先講結論（跟 /admin 首頁「今日主線」同一句話），
  // 結尾給可點連結 —— 沒有連結的通知等於還是要他自己想起來去開後台。
  // 逾期的血檢跟掉線一樣是「要他出手」，所以也要進開頭那句，
  // 否則整封信的第一行會說「沒人掉線」而把逾期 49 天的回檢藏在下面。
  const overdueLabs = labsDue.filter(l => l.daysUntil !== null && l.daysUntil < 0).length
  const leadBits: string[] = []
  if (offline.length > 0) leadBits.push(`${offline.length} 個人掉線`)
  if (overdueLabs > 0) leadBits.push(`${overdueLabs} 個血檢逾期`)
  const lead =
    leadBits.length === 0 ? '沒人掉線，其餘看下面'
    : overdueLabs === 0 ? `${offline.length} 個人需要你出手`
    : `${leadBits.join('、')}，要你出手`
  const body = lines.join('\n').replace(/\n+$/, '')
  return {
    text: `☀️ 教練晨報 ${today}\n${lead}\n\n${body}\n\n👉 打開後台：${adminUrl}/admin`,
    offline,
  }
}

/**
 * ⚠️ 2026-08-26：這裡原本是 `from: (t: string) => any` 加一行
 * `// eslint-disable-line @typescript-eslint/no-explicit-any`。
 * 那條規則在本專案的 ESLint 設定裡**沒有定義**，於是 next build 對「停用一條不存在的規則」
 * 本身報 Error → build exit 1 → **連續 5 次 production 部署失敗**。
 * tsc 不跑 ESLint，所以 pre-commit 的 tsc 一路綠燈，我卻以為東西上線了。
 * 用真正的型別，不需要 any 也不需要停用任何規則。
 */
type QueryLike = SupabaseClient

/**
 * 抓資料 + 組信。cron 與 `/api/admin/coach-digest` 共用，
 * 所以**預覽看到的就是排程會送的那一封**。
 */
export async function loadCoachDigest(
  supabase: QueryLike,
  opts: { today: string; adminUrl: string },
): Promise<CoachDigest> {
  const { today, adminUrl } = opts
  const yesterdayStr = new Date(Date.parse(today) - DAY_MS).toISOString().split('T')[0]
  const offlineSince = new Date(Date.parse(today) - (OFFLINE_MAX_DAYS + 1) * DAY_MS).toISOString().split('T')[0]
  const plateauSince = new Date(Date.parse(today) - 10 * DAY_MS).toISOString().split('T')[0]

  const [yW, yN, yT, yWe, clientsRes, oBody, oNut, oTrain, oWell, recentW, comps, labClientsRes, panelNotesRes, templatesRes] = await Promise.all([
    supabase.from('body_composition').select('client_id').eq('date', yesterdayStr),
    supabase.from('nutrition_logs').select('client_id').eq('date', yesterdayStr),
    supabase.from('training_logs').select('client_id, rpe').eq('date', yesterdayStr),
    supabase.from('daily_wellness').select('client_id, energy_level').eq('date', yesterdayStr),
    // 晨報看的是「所有活躍學員」，不是「有綁 LINE 的」——
    // 否則沒綁 LINE 的學員（例：Eddie）等於從教練視野裡整個消失。
    supabase.from('clients')
      .select('id, name, body_composition_enabled, nutrition_enabled, training_enabled, wellness_enabled')
      .eq('is_active', true),
    supabase.from('body_composition').select('client_id, date').gte('date', offlineSince),
    supabase.from('nutrition_logs').select('client_id, date').gte('date', offlineSince),
    supabase.from('training_logs').select('client_id, date').gte('date', offlineSince),
    supabase.from('daily_wellness').select('client_id, date').gte('date', offlineSince),
    supabase.from('body_composition').select('client_id, weight').gte('date', plateauSince),
    supabase.from('clients').select('name, competition_date')
      .eq('is_active', true)
      .in('client_mode', ['bodybuilding', 'athletic'])
      .not('competition_date', 'is', null),
    // 血檢：只撈 lab_enabled 的人，連 lab_results 一起帶回來
    // （跟 /api/admin/labs-overview 同一個查法，兩邊算出來的東西才會一致）
    supabase.from('clients')
      .select('id, name, unique_code, gender, next_checkup_date, lab_results(test_name, value, unit, date, status)')
      .eq('lab_enabled', true)
      .eq('is_active', true),
    supabase.from('lab_panel_notes').select('client_id, panel_date, next_review_date'),
    // 開單公版：性別 × 目標導向。沒有對應公版的人就不出開單建議（不是錯誤）
    supabase.from('lab_panel_templates').select('gender, goal_orientation, add_on_items, base_price'),
  ])

  const lastActiveByClient: Record<string, string> = {}
  for (const rows of [oBody.data, oNut.data, oTrain.data, oWell.data]) {
    for (const r of (rows ?? []) as { client_id: string; date: string }[]) {
      if (!lastActiveByClient[r.client_id] || r.date > lastActiveByClient[r.client_id]) {
        lastActiveByClient[r.client_id] = r.date
      }
    }
  }

  // 每位學員取「最新一份 panel note」的 next_review_date —— 舊的那些已經被新的取代
  const latestPanelReview: Record<string, { panelDate: string; nextReview: string | null }> = {}
  for (const r of (panelNotesRes.data ?? []) as { client_id: string; panel_date: string; next_review_date: string | null }[]) {
    const cur = latestPanelReview[r.client_id]
    if (!cur || r.panel_date > cur.panelDate) {
      latestPanelReview[r.client_id] = { panelDate: r.panel_date, nextReview: r.next_review_date }
    }
  }
  type LabClientRow = {
    id: string
    name: string
    unique_code: string | null
    gender: string | null
    next_checkup_date: string | null
    lab_results: LabResultRow[] | null
  }
  type TemplateRow = {
    gender: string | null
    goal_orientation: string | null
    add_on_items: TemplateItem[] | null
    base_price: number | null
  }
  const templates = (templatesRes.data ?? []) as TemplateRow[]
  // 目標導向優先（比賽/健體客群），找不到就退一般健康
  const templateFor = (gender: string | null) =>
    templates.find(t => t.gender === (gender || '男性') && t.goal_orientation === 'target')
    ?? templates.find(t => t.gender === (gender || '男性'))

  const labDueInput: LabDueClientInput[] = ((labClientsRes.data ?? []) as LabClientRow[]).map(c => {
    const tpl = templateFor(c.gender)
    return {
      id: c.id,
      name: c.name,
      unique_code: c.unique_code,
      gender: c.gender,
      next_checkup_date: c.next_checkup_date,
      panel_next_review_date: latestPanelReview[c.id]?.nextReview ?? null,
      labs: c.lab_results ?? [],
      templateItems: tpl?.add_on_items ?? undefined,
      templateBasePrice: tpl?.base_price ?? null,
    }
  })

  return buildCoachDigest({
    today,
    labsDue: findLabsDue(labDueInput, today),
    clients: (clientsRes.data ?? []) as DigestClient[],
    yesterdayWeightIds: ((yW.data ?? []) as { client_id: string }[]).map(r => r.client_id),
    yesterdayNutritionIds: ((yN.data ?? []) as { client_id: string }[]).map(r => r.client_id),
    yesterdayTraining: (yT.data ?? []) as { client_id: string; rpe: number | null }[],
    yesterdayWellness: (yWe.data ?? []) as { client_id: string; energy_level: number | null }[],
    lastActiveByClient,
    recentWeights: (recentW.data ?? []) as { client_id: string; weight: number | null }[],
    competitions: (comps.data ?? []) as { name: string; competition_date: string }[],
    adminUrl,
  })
}
