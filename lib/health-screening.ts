/**
 * 入會健康篩檢 — 決定營養目標要不要降級呈現
 *
 * 為什麼需要：系統會對任何人吐出精確到克的 macro。對健康成人來說，那是實務上普遍的
 * 教練工作；但對**疾病族群**（慢性病／服藥／孕哺／術後／飲食失調史）而言，
 * 精確到克的個人化營養處方接近營養師與醫師的專業範圍，那才是法規真正的紅線。
 *
 * Howard 自己帶的人他知道底細。但多教練上線後，別的教練不一定有同樣的判斷力——
 * **系統擴大等於風險擴大**，所以這道 gate 必須做在系統裡，不能靠教練自覺。
 *
 * ⚠️ 這裡只做「呈現方式」的降級與轉介提示，不做診斷、也不阻擋教練的專業判斷。
 *    教練仍可設定 macros；差別在學員端看到的是「參考範圍＋請諮詢專業」而不是「你的目標」。
 */

export interface HealthScreening {
  screened_at?: string
  screened_by?: string
  chronic_condition?: boolean
  on_medication?: boolean
  pregnant_or_lactating?: boolean
  recent_surgery?: boolean
  eating_disorder_history?: boolean
  note?: string | null
}

/** 每個 flag 對應的白話說明（給教練端看，不直接顯示給學員） */
const FLAG_LABELS: Array<{ key: keyof HealthScreening; label: string }> = [
  { key: 'chronic_condition', label: '慢性疾病' },
  { key: 'on_medication', label: '規則性服藥' },
  { key: 'pregnant_or_lactating', label: '懷孕或哺乳' },
  { key: 'recent_surgery', label: '近期手術或重大傷病' },
  { key: 'eating_disorder_history', label: '飲食失調病史' },
]

/** 有沒有做過篩檢。沒做過 ≠ 安全，只是還不知道——教練端要看得到這個狀態。 */
export function isScreened(s: HealthScreening | null | undefined): boolean {
  return !!s?.screened_at
}

/** 任一風險 flag 為真 → 學員端的營養目標要降級為參考範圍並提示轉介 */
export function needsProfessionalReferral(s: HealthScreening | null | undefined): boolean {
  if (!s) return false
  return FLAG_LABELS.some(f => s[f.key] === true)
}

/** 命中的項目（教練端用；不對學員顯示病況細節） */
export function referralReasons(s: HealthScreening | null | undefined): string[] {
  if (!s) return []
  return FLAG_LABELS.filter(f => s[f.key] === true).map(f => f.label)
}

/**
 * 學員端的提示文字。刻意不提任何病名或個別狀況——只說「你填的健康狀況需要專業評估」，
 * 避免把健康資訊呈現在可能被他人看見的畫面上，也避免任何診斷語氣。
 */
export const REFERRAL_NOTICE =
  '你在入會時填寫的健康狀況，需要由醫師或營養師做個別評估。下面的數字只是依你的身高體重估算的一般參考範圍，不是為你的狀況設計的飲食計畫——調整前請先諮詢專業人員。'

/** 尚未篩檢時給教練端的提示（不顯示給學員） */
export const UNSCREENED_COACH_NOTICE =
  '這位學員還沒做入會健康篩檢。系統目前以一般健康成人的假設給營養目標，先完成篩檢再交付。'

/**
 * 把精確目標轉成參考範圍（±5%，取整到 10）。
 * 用意是把「處方感」拿掉：2250 kcal → 「約 2140–2360」。
 */
export function toReferenceRange(value: number | null | undefined, tolerance = 0.05): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  const lo = Math.round((value * (1 - tolerance)) / 10) * 10
  const hi = Math.round((value * (1 + tolerance)) / 10) * 10
  return `${lo}–${hi}`
}
