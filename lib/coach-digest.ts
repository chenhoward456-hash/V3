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

import { loadHypothesisUpdates, coachLine, type HypothesisUpdate } from '@/lib/hypothesis-updates'
import { loadExperimentUpdates, coachExperimentLine, type ExperimentUpdate } from '@/lib/body-experiments'
import { buildCoachingDrafts } from '@/lib/coaching-drafts'
import { buildCoachWorkflow, isActionable, type CoachWorkflowClient, type CoachWorkItem } from './coach-workflow'

/** 週一（台灣）才算：本週可發的訊息草稿，排除近 6 天已發過的、與這週幾乎沒資料的（最多 5 位） */
async function loadMondayDrafts(supabase: QueryLike, today: string): Promise<{ name: string; headline: string; needsCoachReview: boolean }[]> {
  if (new Date(`${today}T12:00:00+08:00`).getUTCDay() !== 1) return []
  const drafts = await buildCoachingDrafts(supabase as never)
  const since = new Date(Date.parse(today) - 6 * DAY_MS).toISOString()
  const { data: sent } = await supabase.from('coach_messages').select('client_id').gte('created_at', since)
  const sentIds = new Set(((sent ?? []) as { client_id: string }[]).map(r => r.client_id))
  // 教練自己也是學員（陳胤豪）→ 不用發訊息給自己
  const coachIds = new Set<string>()
  if (COACH_LINE_USER_ID) {
    const { data: me } = await supabase.from('clients').select('id').eq('line_user_id', COACH_LINE_USER_ID)
    for (const r of (me ?? []) as { id: string }[]) coachIds.add(r.id)
  }
  return drafts
    .filter(d => !sentIds.has(d.clientId) && !coachIds.has(d.clientId) && d.dataDays >= 3)
    .slice(0, 5)
    .map(d => ({ name: d.name, headline: d.headline, needsCoachReview: d.needsCoachReview }))
}
import type { SupabaseClient } from '@supabase/supabase-js'
import { daysUntilDateTW, DAY_MS } from './date-utils'
import { COACH_LINE_USER_ID } from './line-links'
import { findLabsDue, formatLabDueLines, type LabDueItem, type LabDueClientInput } from './lab-due'
import { isProposalExpired, describeProposal, type ProposalRow } from './proposal-actions'
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
  /** 還等著他處理的引擎提案（已掃掉過期的） */
  proposals: { name: string; clientId: string; items: ProposalRow[] }[]
  /** 後台網址（信尾的可點連結） */
  adminUrl: string
  /** 血檢預測對答案（lib/hypothesis-updates）：新判決＋過了重測日 */
  hypotheses?: { graded: HypothesisUpdate[]; overdue: HypothesisUpdate[] }
  /** 身體實驗結束、有判決（lib/body-experiments） */
  experiments?: ExperimentUpdate[]
  /** 週一才有：本週可以發的教練訊息草稿（lib/coaching-drafts），已排除這週發過的與沒資料的 */
  weeklyDrafts?: { name: string; headline: string; needsCoachReview: boolean }[]
  /** Same read-only queue shown in the coach backend. */
  workflowClients?: CoachWorkflowClient[]
}

export type CoachDigest = {
  /** 沒東西好講就是 null —— 不發空信 */
  text: string | null
  workflow: CoachWorkItem[]
  offline: { name: string; days: number }[]
  /** cron 用：推學員＋標記已通知 */
  hypothesisUpdates?: { graded: HypothesisUpdate[]; overdue: HypothesisUpdate[] }
  /** cron 用：推學員＋標記已通知 */
  experimentUpdates?: ExperimentUpdate[]
}

export function buildCoachDigest(input: CoachDigestInput): CoachDigest {
  const {
    today, clients, yesterdayWeightIds, yesterdayNutritionIds,
    yesterdayTraining, yesterdayWellness, lastActiveByClient,
    recentWeights, competitions, labsDue, proposals, adminUrl, hypotheses, experiments = [], weeklyDrafts = [],
  } = input

  const hadWeight = new Set(yesterdayWeightIds)
  const hadNutrition = new Set(yesterdayNutritionIds)
  const hadTraining = new Set(yesterdayTraining.map(t => t.client_id))
  const hadWellness = new Set(yesterdayWellness.map(w => w.client_id))
  const nameOf = (id: string) => clients.find(c => c.id === id)?.name || '未知'

  const lines: string[] = []
  const workflow = input.workflowClients ? buildCoachWorkflow(input.workflowClients, today) : []
  if (workflow.length) {
    lines.push(`今天先處理這 ${Math.min(3, workflow.length)} 位：`)
    for (const w of workflow.slice(0, 3)) {
      lines.push(`  • ${w.name}：${w.reason}`)
      lines.push(`    下一步：${w.action}`)
      // 沒有既有日期就不印這行：每人都掛一句「目前未設定」只是雜訊
      if (w.review.date) lines.push(`    ${w.reasons[0]?.kind === 'result' ? '資料日期' : '複核'}：${w.review.date}｜${w.review.label}`)
      lines.push(`    ${adminUrl}${w.href}`)
    }
    if (workflow.length > 3) lines.push(`    其餘 ${workflow.length - 3} 位在後台同一份處理清單`)
    lines.push('')
  }

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

  // 超過 30 天沒動的人：每天唸會變雜訊，但完全不提就會被忘記
  // （2026-09-24 謝佳峻：6/11 之後沒任何紀錄，晨報三個月都看不到他，Howard 其實很想顧他）。
  // → 只在週一列一次名字。
  const isMonday = new Date(`${today}T00:00:00Z`).getUTCDay() === 1
  const longGone = isMonday
    ? clients.filter(c => {
        const la = lastActiveByClient[c.id]
        return !la || Math.round((todayMs - Date.parse(la)) / DAY_MS) > OFFLINE_MAX_DAYS
      }).map(c => c.name)
    : []

  if (offline.length > 0) {
    lines.push(`🚨 ${offline.length} 個人掉線了：`)
    offline.forEach(o => lines.push(`  • ${o.name}：${o.days} 天沒動`))
    lines.push('')
  }
  if (longGone.length > 0) {
    lines.push(`🕳️ 超過 ${OFFLINE_MAX_DAYS} 天沒有任何紀錄（每週一提醒）：${longGone.join('、')}`)
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
    lines.push(`     回「回檢 ${labsDue[0].name}」看要傳給他的抽血單，「發回檢 ${labsDue[0].name}」直接送出`)
    lines.push('')
  }

  // 0.55 血檢預測對答案 —— V3 初衷的那個循環：結果進來了要有人知道，不然只是默默對完
  if (hypotheses && hypotheses.graded.length > 0) {
    lines.push('🔬 預測對答案了：')
    for (const u of hypotheses.graded) lines.push(coachLine(u))
    lines.push('')
  }
  if (hypotheses && hypotheses.overdue.length > 0) {
    lines.push('⏰ 預測過了重測日還沒結果：')
    for (const u of hypotheses.overdue) lines.push(coachLine(u))
    lines.push('')
  }
  // 0.56 身體實驗有結果 —— 同一個循環，只是用每天的數據、兩週一輪
  if (experiments.length > 0) {
    lines.push('🧪 身體實驗有結果：')
    for (const u of experiments) lines.push(coachExperimentLine(u))
    lines.push('')
  }

  // 0.6 等你處理的提案 —— 排在血檢後面、例行雜訊前面。
  //
  // ⚠️ 存在理由同血檢那段：**投遞**。引擎從 8/24 到 9/05 幫 Sean 連提 10 筆，
  // 一筆都沒被處理，因為唯一的出口是 /admin。
  // 現在每一條都附可以直接回的指令（見 lib/line-coach-commands.ts）。
  if (proposals.length > 0) {
    lines.push(`📥 ${proposals.length} 個人有提案等你：`)
    for (const p of proposals) {
      lines.push(`  • ${p.name}：${describeProposal(p.items[0])}`)
      // 說明書條目彼此獨立，全部列出；熱量類多筆才是「同一決定被重算」
      const independent = (x: { proposal_type: string }) => x.proposal_type === 'body_profile_entry' || x.proposal_type === 'coach_summary_draft' || x.proposal_type === 'target_date_change'
      for (const extra of p.items.slice(1).filter(independent)) lines.push(`      ${describeProposal(extra)}`)
      if (p.items.some(x => x.proposal_type === 'coach_summary_draft')) lines.push('      回「提案」看草稿全文')
      const macroExtra = p.items.slice(1).filter(x => !independent(x)).length
      if (macroExtra > 0) lines.push(`      ⚠️ 還有 ${macroExtra} 筆，多半是同一個決定被重算，別一次全套`)
    }
    lines.push('     回「套用 <名字>」就改、「不要 <名字>」就退掉')
    lines.push('')
  }

  // 0.65 本週教練訊息（週一）—— 草稿一直都算得出來（LINE 打「訊息」），但晨報從沒提過，
  // 2026-10-03 查：30 天 coach_messages＝0 則。不提醒＝不存在。
  if (weeklyDrafts.length > 0) {
    lines.push(`📝 本週訊息 ${weeklyDrafts.length} 則可以發：`)
    for (const d of weeklyDrafts) lines.push(`  • ${d.name}：${d.needsCoachReview ? '⚠️ 要你看過 ' : ''}${d.headline}`)
    lines.push(`     回「訊息 ${weeklyDrafts[0].name}」看全文，「發 ${weeklyDrafts[0].name}」送出`)
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

  if (lines.length === 0) return { text: null, workflow, offline, hypothesisUpdates: hypotheses, experimentUpdates: experiments }

  // 開頭先講結論（跟 /admin 首頁「今日主線」同一句話），
  // 結尾給可點連結 —— 沒有連結的通知等於還是要他自己想起來去開後台。
  // 逾期的血檢跟掉線一樣是「要他出手」，所以也要進開頭那句，
  // 否則整封信的第一行會說「沒人掉線」而把逾期 49 天的回檢藏在下面。
  const overdueLabs = labsDue.filter(l => l.daysUntil !== null && l.daysUntil < 0).length
  const leadBits: string[] = []
  if (offline.length > 0) leadBits.push(`${offline.length} 個人掉線`)
  if (overdueLabs > 0) leadBits.push(`${overdueLabs} 個血檢逾期`)
  if (proposals.length > 0) leadBits.push(`${proposals.length} 個提案等你`)
  if (weeklyDrafts.length > 0) leadBits.push(`${weeklyDrafts.length} 則週訊可以發`)
  if (experiments.length > 0) leadBits.unshift(`${experiments.length} 個實驗有結果`)
  if (hypotheses && hypotheses.graded.length > 0) leadBits.unshift(`${hypotheses.graded.length} 個預測對答案了`)
  const actionableCount = workflow.filter(isActionable).length
  const lead =
    actionableCount > 0 ? `${actionableCount} 位要處理，先看下面的順序`
    : workflow.length > 0 ? '沒有要處理的人，只有近期結果可查看'
    : leadBits.length === 0 ? '沒人掉線，其餘看下面'
    : overdueLabs === 0 && proposals.length === 0 && experiments.length === 0 && weeklyDrafts.length === 0 && !(hypotheses && hypotheses.graded.length > 0) ? `${offline.length} 個人需要你出手`
    : `${leadBits.join('、')}，要你出手`
  const body = lines.join('\n').replace(/\n+$/, '')
  return {
    text: `☀️ 教練晨報 ${today}\n${lead}\n\n${body}\n\n👉 打開後台：${adminUrl}/admin`,
    workflow,
    offline,
    hypothesisUpdates: hypotheses,
    experimentUpdates: experiments,
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
      .select('id, name, calories_target, protein_target, body_composition_enabled, nutrition_enabled, training_enabled, wellness_enabled')
      .eq('is_active', true),
    supabase.from('body_composition').select('client_id, date, weight').gte('date', offlineSince),
    supabase.from('nutrition_logs').select('client_id, date, calories, protein_grams, carbs_grams').gte('date', offlineSince),
    supabase.from('training_logs').select('client_id, date, note').gte('date', offlineSince),
    supabase.from('daily_wellness').select('client_id, date').gte('date', offlineSince),
    supabase.from('body_composition').select('client_id, weight').gte('date', plateauSince),
    supabase.from('clients').select('name, competition_date')
      .eq('is_active', true)
      .in('client_mode', ['bodybuilding', 'athletic'])
      .not('competition_date', 'is', null),
    // 血檢：只撈 lab_enabled 的人，連 lab_results 一起帶回來
    // （跟 /api/admin/labs-overview 同一個查法，兩邊算出來的東西才會一致）
    supabase.from('clients')
      .select('id, name, unique_code, gender, next_checkup_date, training_enabled, lab_results(test_name, value, unit, date, status, reference_range)')
      .eq('lab_enabled', true)
      .eq('is_active', true),
    supabase.from('lab_panel_notes').select('client_id, panel_date, next_review_date'),
    // 開單公版：性別 × 目標導向。沒有對應公版的人就不出開單建議（不是錯誤）
    supabase.from('lab_panel_templates').select('gender, goal_orientation, add_on_items, base_price'),
  ])

  // Missing data is not evidence of no activity. Do not turn a failed query into an empty work queue.
  for (const result of [yW, yN, yT, yWe, clientsRes, oBody, oNut, oTrain, oWell, recentW, comps, labClientsRes, panelNotesRes, templatesRes]) {
    if (result.error) throw new Error('教練晨報資料讀取失敗')
  }
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
    training_enabled: boolean | null
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
      training_enabled: c.training_enabled,
      panel_next_review_date: latestPanelReview[c.id]?.nextReview ?? null,
      labs: c.lab_results ?? [],
      templateItems: tpl?.add_on_items ?? undefined,
      templateBasePrice: tpl?.base_price ?? null,
    }
  })

  // Read-only proposal listing with explicit failures; expiry filtering uses the existing rule.
  const { data: proposalData, error: proposalError } = await supabase.from('pending_proposals')
    .select('id, client_id, proposed_by, proposed_at, expires_at, status, proposal_type, current_state, proposed_changes, reasoning, trajectory_data')
    .eq('status', 'pending').order('proposed_at', { ascending: false })
  if (proposalError) throw new Error('教練提案讀取失敗')
  const actionable = ((proposalData ?? []) as ProposalRow[]).filter(p => !isProposalExpired(p))
  const proposalNames: Record<string, string> = {}
  if (actionable.length > 0) {
    const { data, error: nameError } = await supabase.from('clients').select('id, name')
      .in('id', [...new Set(actionable.map(p => p.client_id))])
    if (nameError) throw new Error('提案學員資料讀取失敗')
    for (const c of (data ?? []) as { id: string; name: string }[]) proposalNames[c.id] = c.name
  }
  const grouped: Record<string, ProposalRow[]> = {}
  for (const p of actionable) (grouped[p.client_id] ||= []).push(p)

  const hypotheses = await loadHypothesisUpdates(supabase, today).catch(() => ({ graded: [], overdue: [] }))
  const experiments = await loadExperimentUpdates(supabase, today).catch(() => [])
  const weeklyDrafts = await loadMondayDrafts(supabase, today).catch(() => [])

  // Notification delivery is not coach completion: the work view reads all current results.
  const [workflowHypotheses, workflowExperiments] = await Promise.all([
    loadHypothesisUpdates(supabase, today, { includeNotified: true, throwOnReadError: true }),
    loadExperimentUpdates(supabase, today, { includeNotified: true, throwOnReadError: true }),
  ])
  const labsDue = findLabsDue(labDueInput, today)
  const latestMessages = new Map<string, { sentAt: string; readAt: string | null }>()
  // Per-client limit avoids Supabase's global row cap hiding an older student's latest delivery.
  await Promise.all(((clientsRes.data ?? []) as DigestClient[]).map(async c => {
    const { data, error } = await supabase.from('coach_messages').select('created_at, read_at')
      .eq('client_id', c.id).order('created_at', { ascending: false }).limit(1)
    if (error) throw new Error('教練訊息紀錄讀取失敗')
    const m = (data as { created_at: string; read_at: string | null }[] | null)?.[0]
    if (m) latestMessages.set(c.id, { sentAt: m.created_at, readAt: m.read_at })
  }))
  const workflowClients: CoachWorkflowClient[] = ((clientsRes.data ?? []) as (DigestClient & { calories_target: number | null; protein_target: number | null })[]).map(c => {
    const weights = ((oBody.data ?? []) as { client_id: string; date: string; weight: number | null }[])
      .filter(r => r.client_id === c.id && r.weight != null).map(r => ({ date: r.date, weight: Number(r.weight) })).sort((a, b) => a.date.localeCompare(b.date))
    const lab = labsDue.find(l => l.clientId === c.id)
    const proposals = grouped[c.id] ?? []
    const results = workflowHypotheses.graded.filter(h => h.clientId === c.id && h.resultDate != null && h.resultDate >= offlineSince && h.resultDate <= today)
    const dueHypotheses = workflowHypotheses.overdue.filter(h => h.clientId === c.id)
    const endedExperiments = workflowExperiments.filter(e => e.clientId === c.id && e.exp.end_date >= offlineSince && e.exp.end_date <= today)
    return {
      id: c.id, name: c.name, lastActive: lastActiveByClient[c.id] ?? null,
      latestMessage: latestMessages.get(c.id) ?? null,
      signalInput: { today, caloriesTarget: c.calories_target, proteinTarget: c.protein_target, weights,
        nutrition: ((oNut.data ?? []) as { client_id: string; date: string; calories: number | null; protein_grams: number | null; carbs_grams: number | null }[]).filter(r => r.client_id === c.id),
        training: ((oTrain.data ?? []) as { client_id: string; date: string; note: string | null }[]).filter(r => r.client_id === c.id) },
      reasons: [
        ...results.map(h => ({ kind: 'result' as const, priority: 20, reason: coachLine(h).trim().replace(/^•\s*/, ''),
          action: '預測結果已產出，可查看；系統未記錄是否已複核', review: { date: h.resultDate, label: '結果日期；不是複核預約，也不代表尚未處理' } })),
        ...endedExperiments.map(e => ({ kind: 'result' as const, priority: 20, reason: coachExperimentLine(e).trim().replace(/^•\s*/, ''),
          action: '實驗結果已產出，可查看；系統未記錄是否已複核', review: { date: e.exp.end_date, label: '實驗結束日期；不是複核預約，也不代表尚未處理' } })),
        ...dueHypotheses.map(h => ({ kind: 'lab' as const, priority: 90, reason: coachLine(h).trim().replace(/^•\s*/, ''),
          action: '確認原先重測安排與最新結果', review: { date: h.retestBy, label: h.retestBy ? '既有重測日，待你確認' : '尚未設定重測日' } })),
        ...(lab ? [{ kind: 'lab' as const, priority: lab.daysUntil != null && lab.daysUntil < 0 ? 90 : 45,
          reason: lab.daysUntil != null && lab.daysUntil < 0 ? `血檢回檢逾期 ${-lab.daysUntil} 天` : '血檢已到回檢提醒範圍',
          action: '確認回檢安排與要追蹤的項目', review: { date: lab.dueDate, label: lab.dueDate ? '既有回檢日，待你確認' : '未設定回檢日，請先確認' } }] : []),
        ...(proposals.length ? [{ kind: 'proposal' as const, priority: 40, reason: `${proposals.length} 筆提案待你審核：${describeProposal(proposals[0])}${proposals[0].reasoning ? `；${proposals[0].reasoning}` : ''}`,
          action: '打開提案檢查依據，再決定套用或退回', review: { date: null, label: '審核後約定複核日；目前未設定' } }] : []),
      ],
    }
  })
  return buildCoachDigest({
    today,
    workflowClients,
    hypotheses,
    experiments,
    weeklyDrafts,
    labsDue,
    proposals: Object.entries(grouped).map(([clientId, items]) => ({
      clientId, name: proposalNames[clientId] ?? '?', items,
    })),
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
