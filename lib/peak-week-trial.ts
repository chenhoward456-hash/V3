/**
 * 試灌（Trial Load）— 正式 peak week 前，先用「峰值量」灌一次看身體反應
 *
 * 為什麼要有（Temu 2026-11-01 健體的實戰流程）：
 *   充碳有效範圍是 3–12 g/kg（Helms Ch.7，四倍差距），公式算不出「這個人灌多少會飽而硬、
 *   灌多少會溢出」。peak_week_history 只能「比完賽才回填」——第一次比賽的人永遠沒有實測量，
 *   峰值只能用引擎的保守起點去賭。
 *   → 賽前約 10–11 天先試灌一次同樣的量，隔天早上看晨重+照片，用結果決定正式峰值。
 *     試灌那天離比賽還遠，就算溢出也有時間收回來。
 *
 * 判讀 → 正式峰值（Howard 帶 Temu 的分支：355 / 410 / 460 ≈ ×0.87 / ×1 / ×1.12）：
 *   · 偏扁（沒感覺、線條沒浮）→ 峰值往上 12%
 *   · 飽而硬                  → 就用這個量
 *   · 溢出（糊、肚子脹、皮下水）→ 峰值往下 13%
 *
 * ⚠️ 只給「建議值」——正式峰值仍由教練決定（peak week 核心哲學：引擎給草稿、教練給判斷）。
 */

export type TrialVisual = 'flat' | 'full_hard' | 'spilled'

/** 試灌預設放在賽前第幾天（Temu：10/21 試灌、11/1 比賽 = D-11） */
export const TRIAL_DEFAULT_DAYS_OUT = 11

const UP_RATIO = 1.12
const DOWN_RATIO = 0.87

const round5 = (n: number) => Math.round(n / 5) * 5

export interface TrialLoad {
  /** ISO date */
  date: string
  carbs: number
  protein?: number
  fat?: number
  trainingNote?: string
  foodNote?: string
  coachNote?: string
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().split('T')[0]
}

/** 產生試灌日（預設 D-11，量＝預計峰值量） */
export function buildTrialLoad(opts: {
  competitionDate: string
  peakCarbs: number
  protein?: number
  fat?: number
  daysOut?: number
}): TrialLoad {
  const daysOut = opts.daysOut ?? TRIAL_DEFAULT_DAYS_OUT
  return {
    date: addDays(opts.competitionDate, -daysOut),
    carbs: round5(opts.peakCarbs),
    ...(opts.protein != null ? { protein: opts.protein } : {}),
    ...(opts.fat != null ? { fat: opts.fat } : {}),
    trainingNote: '照平常練（建議排上半身、不要排腿）；練完 pump 一下把碳導進肌肉',
    foodNote: '跟正式峰值吃一模一樣的東西：高 GI 低纖（白飯/地瓜/米餅），低脂，分 5–6 餐白天吃掉大半。順便試上台前那次補鈉',
    coachNote: '今晚拍照＋明早空腹晨重，回報「扁 / 飽而硬 / 溢」——這個結果決定正式峰值要不要調',
  }
}

/** 試灌結果 → 正式峰值建議量 */
export function peakFromTrial(trialCarbs: number, visual: TrialVisual): number {
  if (visual === 'flat') return round5(trialCarbs * UP_RATIO)
  if (visual === 'spilled') return round5(trialCarbs * DOWN_RATIO)
  return round5(trialCarbs)
}

export const TRIAL_VISUAL_LABEL: Record<TrialVisual, string> = {
  flat: '偏扁',
  full_hard: '飽而硬',
  spilled: '溢出',
}

export function isTrialVisual(v: unknown): v is TrialVisual {
  return v === 'flat' || v === 'full_hard' || v === 'spilled'
}

/** 試灌日早上 / 晚上、以及隔天早上的推播文字（純函式，cron 呼叫） */
export function buildTrialReminder(
  trial: TrialLoad,
  today: string,
  slot: 'morning' | 'evening',
): { title: string; body: string } | null {
  const nextDay = addDays(trial.date, 1)
  if (today === trial.date && slot === 'morning') {
    return {
      title: `🧪 今天試灌：碳水 ${trial.carbs}g`,
      body: '跟正式峰值吃一樣的東西、一樣的量。今晚拍照，明早空腹量晨重。',
    }
  }
  if (today === trial.date && slot === 'evening') {
    return {
      title: '🧪 試灌：現在拍照',
      body: '固定燈光、同角度，正面放鬆／展背／側面／背面四張。明早空腹晨重量完一起看。',
    }
  }
  if (today === nextDay && slot === 'morning') {
    return {
      title: '🧪 試灌結果：扁、飽而硬、還是溢？',
      body: '先量空腹晨重，再跟昨晚的照片比。打開系統按一下結果，正式峰值就照這個調。',
    }
  }
  return null
}
