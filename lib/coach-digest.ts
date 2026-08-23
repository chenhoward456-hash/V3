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

import { daysUntilDateTW, DAY_MS } from './date-utils'
import { COACH_LINE_USER_ID } from './line-links'

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
    recentWeights, competitions, adminUrl,
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
  const lead = offline.length > 0 ? `${offline.length} 個人需要你出手` : '沒人掉線，其餘看下面'
  const body = lines.join('\n').replace(/\n+$/, '')
  return {
    text: `☀️ 教練晨報 ${today}\n${lead}\n\n${body}\n\n👉 打開後台：${adminUrl}/admin`,
    offline,
  }
}

/** 最小 supabase 介面 —— 只為了讓這支不用 import 整包 client 型別 */
type QueryLike = {
  from: (t: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
}

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

  const [yW, yN, yT, yWe, clientsRes, oBody, oNut, oTrain, oWell, recentW, comps] = await Promise.all([
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
  ])

  const lastActiveByClient: Record<string, string> = {}
  for (const rows of [oBody.data, oNut.data, oTrain.data, oWell.data]) {
    for (const r of (rows ?? []) as { client_id: string; date: string }[]) {
      if (!lastActiveByClient[r.client_id] || r.date > lastActiveByClient[r.client_id]) {
        lastActiveByClient[r.client_id] = r.date
      }
    }
  }

  return buildCoachDigest({
    today,
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
