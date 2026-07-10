/**
 * 作息規律檢查表 — 純前端計分（/tools/sleep）
 *
 * 用途：公開的 IG lead magnet。使用者填 7 天的上床/起床時間，算出「漂移」有多大。
 *
 * ⚠️ 合規紅線（別把這支變成醫療工具）：
 *   - 作息時間不是醫療數據，這裡也**不做任何個人健康判讀**。
 *   - 輸出只有「你的漂移是幾小時」＋「研究裡最規律組長怎樣」的**對照**，
 *     絕不輸出「你的死亡風險是 X」或任何個人化預測。文獻數字只描述研究族群。
 *   - 全部在瀏覽器算完，不打 API、不儲存。
 *
 * 研究背景（PubMed 實查，2026-07-10）：
 *   - Windred 2024, Sleep, PMID 37738616：n=60,977，作息最規律組全因死亡率低 20–48%，
 *     且統計上規律性比睡眠時數更能預測死亡。規律性指標＝Sleep Regularity Index（上床＋起床時間的一致性）。
 *   - Chaput 2025, J Epidemiol Community Health, PMID 39603689：n=72,269，作息最不規律者 MACE HR 1.26。
 *   - Yin 2017, JAHA, PMID 28889101：睡眠時數與死亡率呈 U 型，最低點約 7 小時。
 *
 * 本檔的「漂移」是給一般人看的簡化指標（時間全距），**不是** SRI 本身，別在文案上宣稱它是。
 */

export type DayEntry = {
  /** 上床時間 HH:MM（24 小時制），空字串 = 未填 */
  bed: string
  /** 起床時間 HH:MM，空字串 = 未填 */
  wake: string
}

export type DriftLevel = 'steady' | 'drifting' | 'chaotic' | 'insufficient'

export type SleepRegularityResult = {
  level: DriftLevel
  /** 起床時間全距（小時，1 位小數）；資料不足為 null */
  wakeDriftHours: number | null
  /** 上床時間全距（小時）；資料不足為 null */
  bedDriftHours: number | null
  /** 兩者取大者 = 對外顯示的主要數字 */
  driftHours: number | null
  /** 填了幾天（上床與起床都填才算一天） */
  daysFilled: number
  /** 平均睡眠時數（小時）；資料不足為 null */
  avgSleepHours: number | null
  headline: string
  detail: string
}

/** HH:MM → 分鐘。格式不合法回 null。 */
export function parseTime(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

/**
 * 把「一天中的時刻」轉成以某個參考點為中心的線性座標，避免跨午夜把 23:30 和 00:30 算成差 23 小時。
 * 作法：以 anchor 為中心，把時刻搬到 [anchor-720, anchor+720) 這個 24 小時視窗內。
 */
function unwrap(minutes: number, anchorMinutes: number): number {
  let v = minutes
  while (v - anchorMinutes >= 720) v -= 1440
  while (anchorMinutes - v > 720) v += 1440
  return v
}

/** 一組時刻的全距（分鐘），已處理跨午夜。少於 2 筆回 null。 */
export function timeRangeMinutes(times: number[]): number | null {
  if (times.length < 2) return null
  const anchor = times[0]
  const unwrapped = times.map(t => unwrap(t, anchor))
  return Math.max(...unwrapped) - Math.min(...unwrapped)
}

/** 單日睡眠時數（小時）：起床在上床之後，跨午夜自動 +24h。 */
export function sleepHours(bed: number, wake: number): number {
  const diff = wake >= bed ? wake - bed : wake + 1440 - bed
  return diff / 60
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function computeSleepRegularity(days: DayEntry[]): SleepRegularityResult {
  const parsed = days
    .map(d => ({ bed: parseTime(d.bed), wake: parseTime(d.wake) }))
    .filter((d): d is { bed: number; wake: number } => d.bed != null && d.wake != null)

  const daysFilled = parsed.length

  if (daysFilled < 3) {
    return {
      level: 'insufficient',
      wakeDriftHours: null,
      bedDriftHours: null,
      driftHours: null,
      daysFilled,
      avgSleepHours: null,
      headline: '至少填 3 天，才看得出漂移',
      detail: '一兩天看不出規律。把這週想得起來的日子填上，估到最接近的 15 分鐘就夠了。',
    }
  }

  const wakeRange = timeRangeMinutes(parsed.map(d => d.wake))
  const bedRange = timeRangeMinutes(parsed.map(d => d.bed))
  const wakeDriftHours = wakeRange == null ? null : round1(wakeRange / 60)
  const bedDriftHours = bedRange == null ? null : round1(bedRange / 60)
  const driftHours = round1(Math.max(wakeDriftHours ?? 0, bedDriftHours ?? 0))

  const avgSleepHours = round1(
    parsed.reduce((sum, d) => sum + sleepHours(d.bed, d.wake), 0) / daysFilled
  )

  let level: DriftLevel
  let headline: string
  let detail: string

  if (driftHours <= 1) {
    level = 'steady'
    headline = `你的作息漂移是 ${driftHours} 小時`
    detail =
      '很穩。研究裡「規律組」的長相就是這樣——每天上床和起床的時間幾乎固定。繼續守住這條線，比多睡半小時值錢。'
  } else if (driftHours <= 2) {
    level = 'drifting'
    headline = `你的作息漂移是 ${driftHours} 小時`
    detail =
      '有點漂，但救得回來。先固定起床時間（那是你唯一控制得了的一端），週末的補眠壓在 1 小時內，其餘會自己跟上。'
  } else {
    level = 'chaotic'
    headline = `你的作息漂移是 ${driftHours} 小時`
    detail =
      '這個幅度等於你每週都在幫自己調時差。從一件事開始就好：設一個七天都一樣的起床鬧鐘，包含週末。想補眠就白天小睡 20 分鐘，別動起床時間。'
  }

  return { level, wakeDriftHours, bedDriftHours, driftHours, daysFilled, avgSleepHours, headline, detail }
}
