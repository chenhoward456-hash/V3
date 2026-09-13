/**
 * 血檢到期 —— 「該回檢了、這次要盯哪幾項」唯一會主動找上門的地方。
 *
 * ## 為什麼有這支（2026-09-13）
 *
 * Howard：「我九月要血檢，我覺得使用上很不直覺、根本不知道我到底要驗什麼，很不智能。」
 *
 * 查下去發現**系統其實早就知道**，只是從來沒有人會看到：
 *   - `clients.next_checkup_date` 陳胤豪＝09-26、謝佳峻＝09-08（**已逾期 5 天**）
 *   - `lab_panel_notes.next_review_date` 陳胤豪＝09-03（**已逾期 10 天**）
 *   - `/admin/labs` 那頁早就會算 `dueForRetest` 並標「該回檢」
 *
 * 三份資料、一整頁 UI，全部安靜地躺在後台等人自己想起來去開。
 * Howard 的原話是「我都懶得開後台」——**所以這不是資料問題，是投遞問題**。
 *
 * ⚠️ 兩個「下次抽血日」欄位是各寫各的，沒有任何地方對帳：
 *   `clients.next_checkup_date`（教練在學員頁設）與
 *   `lab_panel_notes.next_review_date`（教練寫該次報告總結時設）。
 *   陳胤豪身上就差 23 天。這裡**取較早者**——寧可早提醒也不要漏，
 *   而且兩個日期不一致本身就該被看見（`conflictingDates` 會標出來）。
 *
 * 判定沿用 `/admin/labs` 原本的規則（`analyzeLabs` + `selectKeyFindings`），
 * 讓晨報講的跟那頁顯示的是同一件事，不會兩邊各說各話。
 */

import { analyzeLabs, selectKeyFindings, type LabResultRow } from './lab-trend-analyzer'
import { DAY_MS } from './date-utils'

/** 幾天內到期就開始提醒（跟 /admin/labs 原本的 dueForRetest 同一條線） */
export const DUE_SOON_DAYS = 14
/** 沒設回檢日時，距上次抽血超過這麼久就算過期 */
export const STALE_DAYS = 120
/** 一個人最多列幾項要盯的 —— 列太多等於沒列，晨報會被滑過去 */
export const MAX_WATCH_ITEMS = 4

/**
 * 基因型指標：驗一次就終身有效，**不列入「這次要盯」**。
 *
 * Howard 的原話是「不知道要驗什麼、很不智能」——叫人去重驗一個生下來就不會變的數字
 * 正是那種不智能。謝佳峻 Lp(a) 76.84 是紅字沒錯，但它一輩子都會是紅字，
 * 重抽一管血不會得到新資訊；那是「已知的長期風險」，不是「這次要追的東西」。
 *
 * ⚠️ 這份清單原本寫死在 `components/HealthReportDocument.tsx` 的 PDF 產生器裡（紅線 6：
 * 同一概念散在多處）。移到這裡讓晨報與健康報告用同一份。
 * ⚠️ 原本有一條裸的 `'脂蛋白'`，那會連 ApoB 的中文名「脂蛋白元 B」一起吃掉
 * （`'脂蛋白元 B'.includes('脂蛋白')` 是 true）——ApoB 是**需要**追蹤的，改成不會誤傷的寫法。
 */
export const GENETIC_ONCE_MARKERS = ['lp(a)', 'lpa', '脂蛋白(a)', '脂蛋白a', 'apoe', 'mthfr']

/** 這個指標是不是「驗一次就好」的基因型 */
export function isGeneticOnce(testName: string): boolean {
  const n = testName.toLowerCase()
  return GENETIC_ONCE_MARKERS.some(g => n.includes(g))
}

export type LabDueClientInput = {
  id: string
  name: string
  unique_code?: string | null
  gender?: string | null
  /** clients.next_checkup_date */
  next_checkup_date?: string | null
  /** 最新一筆 lab_panel_notes.next_review_date */
  panel_next_review_date?: string | null
  labs: LabResultRow[]
}

export type LabWatchItem = {
  name: string
  value: number
  unit: string | null
  /** 最佳區間文字，沒定義就 null */
  optimal: string | null
  /** 這個項目上次抽是哪天 */
  lastDate: string
}

export type LabDueItem = {
  clientId: string
  name: string
  uniqueCode: string | null
  /** 兩個來源取較早者 */
  dueDate: string | null
  /** 負數＝已逾期幾天；null＝沒設回檢日（靠 stale 判定） */
  daysUntil: number | null
  latestDate: string | null
  daysSinceLatest: number | null
  reason: 'scheduled' | 'stale'
  /** 兩個「下次抽血日」欄位不一致 —— 該去對帳 */
  conflictingDates: boolean
  watch: LabWatchItem[]
}

/** 'YYYY-MM-DD' 兩個日期字串相差幾天。兩邊都是 UTC 午夜，所以不吃時區。 */
function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(toDay) - Date.parse(fromDay)) / DAY_MS)
}

/** DB 的 unit 有 umol/µmol/μmol 三種歷史寫法，顯示統一成 μ（同 /admin/labs 的 fmtUnit） */
function normalizeUnit(u: string | null): string | null {
  return u ? u.replace(/^u/, 'μ').replace(/^µ/, 'μ') : u
}

function normalizeGender(g?: string | null): '男性' | '女性' | undefined {
  return g === '女性' ? '女性' : g === '男性' ? '男性' : undefined
}

/**
 * 誰的血檢到期了，以及這次該盯哪幾項。
 *
 * `today` 一律由呼叫端給台灣日（'YYYY-MM-DD'），這支保持純函式好測。
 * 回傳依「最急的排前面」：逾期最久 → 最快到期 → 沒設日期但放最久。
 */
export function findLabsDue(clients: LabDueClientInput[], today: string): LabDueItem[] {
  const items: LabDueItem[] = []

  for (const c of clients) {
    const { item, due } = evaluateLabDue(c, today)
    if (due) items.push(item)
  }

  // 逾期最久的排最前面；沒設日期的（stale）一律排在有日期的後面
  return items.sort((a, b) => {
    if (a.daysUntil === null && b.daysUntil === null) {
      return (b.daysSinceLatest ?? 0) - (a.daysSinceLatest ?? 0)
    }
    if (a.daysUntil === null) return 1
    if (b.daysUntil === null) return -1
    return a.daysUntil - b.daysUntil
  })
}

/**
 * 單一學員的到期判定。
 *
 * ⚠️ 抽出來是因為紅線 6：「該回檢」原本只寫在 `/api/admin/labs-overview` 裡，
 * 晨報再實作一次就會變成同一個概念兩份定義、各自漂移
 * ——那頁說該回檢、信裡沒講，或反過來。兩邊都走這支。
 */
export function evaluateLabDue(
  c: LabDueClientInput,
  today: string,
): { item: LabDueItem; due: boolean } {
  const dates = [...new Set((c.labs ?? []).map(l => l.date))].filter(Boolean).sort()
  const latestDate = dates.length ? dates[dates.length - 1] : null
  const daysSinceLatest = latestDate ? daysBetween(latestDate, today) : null

  const candidates = [c.next_checkup_date, c.panel_next_review_date].filter(
    (d): d is string => !!d,
  )
  const dueDate = candidates.length ? candidates.slice().sort()[0] : null
  const daysUntil = dueDate ? daysBetween(today, dueDate) : null

  const scheduled = daysUntil !== null && daysUntil <= DUE_SOON_DAYS
  // ⚠️ 只有在「沒排回檢日」時才用 stale 兜底。
  // 已經排了 3 個月後的人不該因為上次抽血很久以前就天天被唸。
  const stale = dueDate === null && daysSinceLatest !== null && daysSinceLatest > STALE_DAYS

  const findings = analyzeLabs(c.labs ?? [], { gender: normalizeGender(c.gender) })
  const key = selectKeyFindings(findings)
  const watch = [...key.critical, ...key.attention]
    .filter(f => !isGeneticOnce(f.testName))
    .slice(0, MAX_WATCH_ITEMS)
    .map(f => ({
      name: f.testName,
      value: f.latestValue,
      unit: normalizeUnit(f.unit),
      optimal: f.optimalText,
      lastDate: f.latestDate,
    }))

  return {
    due: scheduled || stale,
    item: {
      clientId: c.id,
      name: c.name,
      uniqueCode: c.unique_code ?? null,
      dueDate,
      daysUntil,
      latestDate,
      daysSinceLatest,
      reason: scheduled ? 'scheduled' : 'stale',
      conflictingDates:
        !!c.next_checkup_date &&
        !!c.panel_next_review_date &&
        c.next_checkup_date !== c.panel_next_review_date,
      watch,
    },
  }
}

/** 把一筆到期資料寫成晨報裡的那幾行（LINE 純文字，沒有 markdown） */
export function formatLabDueLines(item: LabDueItem): string[] {
  const lines: string[] = []
  const when =
    item.daysUntil === null
      ? `沒排回檢日，上次抽血是 ${item.latestDate}（${item.daysSinceLatest} 天前）`
      : item.daysUntil < 0
        ? `排 ${item.dueDate}，已逾期 ${-item.daysUntil} 天`
        : item.daysUntil === 0
          ? `就是今天（${item.dueDate}）`
          : `${item.dueDate}，剩 ${item.daysUntil} 天`
  lines.push(`  • ${item.name}：${when}`)

  if (item.watch.length > 0) {
    const detail = item.watch
      .map(w => `${w.name} ${w.value}${w.unit ? w.unit : ''}${w.optimal ? `（最佳 ${w.optimal}）` : ''}`)
      .join('、')
    lines.push(`      這次要盯：${detail}`)
  }
  if (item.conflictingDates) {
    lines.push('      ⚠️ 學員頁與報告總結的回檢日不一致，去對一下')
  }
  return lines
}
