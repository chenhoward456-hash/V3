/**
 * Peak Week 模板 — 把「節奏」變成可複製的東西
 *
 * 為什麼是模板而不是寫死進引擎：
 *   Helms 自己說 peak week 沒有標準答案（充碳範圍 3-12 g/kg 是四倍差距、要視覺校準）。
 *   把任何一套節奏寫死進引擎，就是重蹈「9 g/kg 公式」的覆轍。
 *   但「節奏」本身（哪天低碳、哪天灌到峰值、哪天收）是可複製的——會變的是「量」。
 *   → 所以：節奏用模板，量用學員的實測值。
 *
 * Back-Load 節奏（Helms Ch.7 Table 7.1）：
 *   Day 7–3  Low（照學員平常的減脂日/碳循環，**不刻意壓低**）
 *   Day 3    最後一次較重的訓練（之後不再有損傷性訓練）
 *   Day 2    🔺 峰值（用學員的實測量，不是體重公式）
 *   Day 1    收到 70–90%（給水分一整晚+一個白天平衡，賽日早上才 tighten up）
 *   Day 0    賽日 60–100%，看外觀決定
 *
 * ⚠️ 峰值放在「賽前 2 天」而不是「賽前 1 天」是這套節奏的關鍵：
 *   多數人灌完當下是「軟」的，12–24 小時後水分重新平衡才會 tighten up。
 *   賽前一天才灌 → 只隔一晚 → 線條可能還沒浮出來就上台。
 */

export interface PeakTemplateDay {
  date: string
  label?: string
  carbs?: number
  protein?: number
  fat?: number
  trainingNote?: string
  foodNote?: string
  coachNote?: string
}

export interface BackLoadOptions {
  /** 比賽日 ISO date */
  competitionDate: string
  /** 峰值碳水（g）— 用學員的實測量；沒有實測就用引擎建議值 */
  peakCarbs: number
  /** 平常減脂「訓練日」碳水（g） */
  trainingDayCarbs: number
  /** 平常減脂「休息日」碳水（g）；沒有碳循環就傳跟訓練日一樣 */
  restDayCarbs: number
  protein: number
  fat: number
  /** 週間訓練課表 — 用來判斷哪天是訓練日/休息日、以及賽前有沒有排到損傷動作 */
  trainingPlan?: { days?: { dayOfWeek: number; label?: string; exercises?: { name?: string }[] }[] } | null
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().split('T')[0]
}

/** 課表慣例 1=週一 … 7=週日；JS getUTCDay 0=週日 */
function isoDayOfWeek(dateStr: string): number {
  const jsDay = new Date(`${dateStr}T12:00:00Z`).getUTCDay()
  return jsDay === 0 ? 7 : jsDay
}

/**
 * 生成 Helms Back-Load 的 7 天課表。
 *
 * 量的來源：
 *   · 低碳日 = 學員平常的碳循環（訓練日/休息日各自的值）— Helms guideline #4：peak 早期別壓極低碳
 *   · 峰值   = 學員的實測量（peakCarbs）
 *   · 收     = 峰值 × 0.75（落在 70–90% 區間中段）
 *   · 賽日   = 峰值 × 0.65（60–100% 區間，實際看當天外觀）
 */
export function buildBackLoadPlan(opts: BackLoadOptions): PeakTemplateDay[] {
  const { competitionDate, peakCarbs, trainingDayCarbs, restDayCarbs, protein, fat, trainingPlan } = opts
  const days: PeakTemplateDay[] = []

  const round5 = (n: number) => Math.round(n / 5) * 5

  for (let daysOut = 7; daysOut >= 0; daysOut--) {
    const date = addDays(competitionDate, -daysOut)
    const dow = isoDayOfWeek(date)
    const planDay = trainingPlan?.days?.find(d => d.dayOfWeek === dow)
    const isTrainingDay = !!planDay?.exercises?.length

    if (daysOut >= 4) {
      // Day 7–4：照平常的碳循環，不刻意壓低（Helms guideline #4）
      days.push({
        date,
        label: isTrainingDay ? '照平常碳循環' : '休息日',
        carbs: isTrainingDay ? trainingDayCarbs : restDayCarbs,
        protein,
        fat,
        trainingNote: isTrainingDay
          ? '正常訓練，留 1-2 下不到力竭（RIR 1-2）'
          : '休息',
        coachNote: 'peak week 還沒開始，照平常吃',
      })
    } else if (daysOut === 3) {
      // Day 3：最後一次較重的訓練；之後不再有任何會造成損傷的訓練
      days.push({
        date,
        label: 'Low · 最後一次較重訓練',
        carbs: isTrainingDay ? trainingDayCarbs : restDayCarbs,
        protein,
        fat,
        trainingNote: '最後一次較重的訓練（RIR 1-2）。避免長肌長離心（硬舉/深蹲/RDL/早安/深飛鳥）— 肌肉損傷會損害之後的儲糖，賽日還要站著 posing',
        coachNote: '拍基準外觀照：固定燈光/角度/時間/餐數，之後每天同條件對比（條件不固定就沒有可比性）',
      })
    } else if (daysOut === 2) {
      // Day 2：🔺 峰值（用實測量，不是體重公式）
      days.push({
        date,
        label: '🔺 峰值',
        carbs: peakCarbs,
        protein,
        fat,
        trainingNote: '輕 pump 循環：2-3 輪 × 15-20 下、RIR 4-5、≤30 分鐘（把碳導進肌肉，不造成損傷）',
        foodNote: '高 GI 低纖（白飯/地瓜/米餅），低脂、正常鹽，分 5-6 餐白天吃掉大半。只吃你習慣的澱粉，別加新食物',
        coachNote: '晚上比外觀。⚠️ 灌完當下「軟」常常是暫時的，12-24h 會自己收 — 別急著判定溢出',
      })
    } else if (daysOut === 1) {
      // Day 1：收到 70–90%，給水分一整晚+一個白天平衡
      days.push({
        date,
        label: '收（70-90%）',
        carbs: round5(peakCarbs * 0.75),
        protein,
        fat,
        trainingNote: '全身 pump-up（含腿）+ 紮實的 posing 練習',
        coachNote: `⚠️ 今晚的外觀決定 80% 的賽日碳水：溢出/線條被蓋→取低標 ${round5(peakCarbs * 0.55)}g｜飽而硬→取中間 ${round5(peakCarbs * 0.7)}g｜扁→取高標 ${round5(peakCarbs * 0.9)}g`,
      })
    } else {
      // Day 0：賽日，60–100% 看外觀
      days.push({
        date,
        label: '賽日',
        carbs: round5(peakCarbs * 0.65),
        protein,
        fat,
        trainingNote: '短 pump-up（自備彈力帶；腿只做小腿 — 你整天要站著 posing）',
        coachNote: '每 2-3h 一餐，一半在預賽前吃完。上台 pump 前補鈉（約 1g 鈉 / 1000 kcal 當日攝取）。水喝到不渴、不限水',
      })
    }
  }

  return days
}
