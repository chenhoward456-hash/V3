/**
 * 賽前清單 — 備賽最後兩週「不是吃跟練」的那些事
 *
 * 為什麼要有：上色、除毛、比賽褲、報到、打包……每一件都不難，但每一件忘了都會在台上出事，
 * 而且這些事沒有任何引擎會提醒。Temu 2026-11-01 健體是 Howard 用 Notion＋LINE 記事本手動追的；
 * 這裡把它變成系統預設，每個選手都一樣。
 *
 * 設計：
 *   · 清單綁「距比賽第幾天」，不綁日曆 —— 換一場比賽整套自動平移
 *   · 試灌（lib/peak-week-trial.ts）有排才會出現試灌那兩項
 *   · 勾選狀態存 peak_week_checks（client_id + competition_date + item_key），換比賽日期就是新的一份
 */

export type ChecklistSlot = '早上' | '白天' | '晚上' | '今天'

export interface ChecklistItem {
  key: string
  date: string
  daysOut: number
  slot: ChecklistSlot
  title: string
  detail?: string
  /** 需要學員回報結果（例：試灌結果），不是單純打勾 */
  kind?: 'check' | 'trial_result'
}

interface ItemSpec {
  key: string
  daysOut: number
  slot: ChecklistSlot
  title: string
  detail?: string
}

const BASE_ITEMS: ItemSpec[] = [
  { key: 'logistics', daysOut: 14, slot: '今天', title: '確認報到時間、地點、組別', detail: '還有報到要帶的證件、繳費證明。截圖存手機' },
  { key: 'trunks', daysOut: 14, slot: '今天', title: '比賽褲／比基尼試穿', detail: '穿著走動、完整 posing 一次，不合現在還來得及換' },
  { key: 'tan_prep', daysOut: 14, slot: '今天', title: '上色：預約或買好', detail: '自己上的話先在小面積試一次顏色' },
  { key: 'shave', daysOut: 5, slot: '今天', title: '除毛', detail: '上色前至少 3 天做完，之後不要再刮（刮完馬上上色會刺痛、上色不均）' },
  { key: 'baseline_photo', daysOut: 3, slot: '晚上', title: '拍基準照', detail: '固定燈光、角度、時間、餐數，之後每晚同條件比' },
  { key: 'last_heavy', daysOut: 3, slot: '白天', title: '最後一次較重的訓練', detail: '避開硬舉、深蹲、RDL、深飛鳥這類長肌長離心，肌肉受損會影響儲存肝醣（碳水）' },
  { key: 'show_food', daysOut: 2, slot: '今天', title: '備好賽日食物', detail: '只用這週吃過的東西，不試新食物' },
  { key: 'tan', daysOut: 1, slot: '白天', title: '上色' },
  { key: 'pack', daysOut: 1, slot: '晚上', title: '打包', detail: '比賽褲、上色用品、彈力帶、賽日食物、水、鹽、毛巾、拖鞋、外套、證件' },
  { key: 'mirror', daysOut: 1, slot: '晚上', title: '鏡子判讀定賽日碳水', detail: '溢出→取低標｜飽而硬→中間｜扁→取高標' },
  { key: 'checkin', daysOut: 0, slot: '早上', title: '報到' },
  { key: 'pump_sodium', daysOut: 0, slot: '白天', title: '上台 pump 前補鈉' },
  { key: 'record', daysOut: 0, slot: '晚上', title: '記下峰值實際吃了幾 g、台上飽不飽', detail: '傳給教練，下次備賽的峰值就照這筆' },
]

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().split('T')[0]
}

function diffDays(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime()
  const b = new Date(`${to}T12:00:00Z`).getTime()
  return Math.round((b - a) / 86400000)
}

const SLOT_ORDER: Record<ChecklistSlot, number> = { 早上: 0, 今天: 1, 白天: 2, 晚上: 3 }

/** 產生整份賽前清單（依日期、時段排序） */
export function buildPrepChecklist(
  competitionDate: string,
  opts: { trial?: { date: string; carbs: number } | null } = {},
): ChecklistItem[] {
  const items: ChecklistItem[] = BASE_ITEMS.map(s => ({
    key: s.key,
    daysOut: s.daysOut,
    date: addDays(competitionDate, -s.daysOut),
    slot: s.slot,
    title: s.title,
    ...(s.detail ? { detail: s.detail } : {}),
    kind: 'check' as const,
  }))

  const trial = opts.trial
  if (trial?.date && trial.date < competitionDate) {
    const trialDaysOut = diffDays(trial.date, competitionDate)
    items.push({
      key: 'trial_load',
      daysOut: trialDaysOut,
      date: trial.date,
      slot: '今天',
      title: `試灌：碳水 ${trial.carbs}g`,
      detail: '跟正式峰值吃一樣的東西、一樣的量。今晚拍照',
      kind: 'check',
    })
    items.push({
      key: 'trial_result',
      daysOut: trialDaysOut - 1,
      date: addDays(trial.date, 1),
      slot: '早上',
      title: '回報試灌結果',
      detail: '空腹晨重量完，跟昨晚照片比',
      kind: 'trial_result',
    })
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot])
}

/**
 * 學員首頁要顯示哪幾項：今天的＋過期沒勾的＋接下來最近一天的（預告）。
 * 已勾的過期項不再顯示；今天的就算勾了也留著（看得到自己做完）。
 */
export function selectVisibleItems(
  items: ChecklistItem[],
  today: string,
  checked: Set<string>,
): { overdue: ChecklistItem[]; today: ChecklistItem[]; upcoming: ChecklistItem[] } {
  const overdue = items.filter(i => i.date < today && !checked.has(i.key))
  const todays = items.filter(i => i.date === today)
  const future = items.filter(i => i.date > today)
  const nextDate = future[0]?.date
  const upcoming = nextDate ? future.filter(i => i.date === nextDate) : []
  return { overdue, today: todays, upcoming }
}
