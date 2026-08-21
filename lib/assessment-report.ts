import type { InBodyReading } from './inbody-ocr'

/**
 * 把一次體測讀數變成一份會員看得懂的報告。
 *
 * ⚠️ 這支是整條線的核心 —— 它做的事是**把教練的判讀編碼**，
 * 讓菜鳥教練不用會判讀也交付得出七十分（2026-08-20 Howard：
 * 「我不想做教學，那是慢慢培養的」）。
 *
 * 設計原則（跟 demo 頁一致）：
 * 1. 先給**一句話**，那是會員唯一會記住的東西 —— 所以它必須是對的那件事
 * 2. 三個數字，不是二十個（機器給二十個，那正是那張紙賣不動的原因）
 * 3. 每個數字都要能接「所以呢」
 * 4. 全程不用診斷語言；健康指標一律講「參考範圍」並導向專業諮詢
 *
 * ⚠️ 所有閾值都是**一般族群參考值**，不是診斷切點。來源標在各常數上。
 */

// ── 參考閾值 ────────────────────────────────────────────────
/** 腹圍中央型脂肪堆積參考線（WHO 亞太建議：男 90 / 女 80 cm） */
const WAIST_LIMIT = { male: 90, female: 80 }
/** 體脂率分段（男 / 女），一般族群參考 */
const BF_BANDS = {
  male: { lean: 15, normal: 20, high: 25 },
  female: { lean: 22, normal: 28, high: 33 },
}
/** SMI 骨骼肌質量指數低標（AWGS 2019：男 7.0 / 女 5.7 kg/m²） */
const SMI_LOW = { male: 7.0, female: 5.7 }
/** 軀幹脂肪佔全身脂肪比例，超過視為偏中央型 */
const TRUNK_FAT_RATIO = 0.45

/** 減脂速率：% 體重/週。跟 lib/goal-safety 同一套（Helms 2014） */
const CUT_RATE_PCT = 0.005      // 0.5%/週，體測報告用保守值
const BULK_RATE_PCT = 0.003
const DEFAULT_WEEKS = 12

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active'
const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.3,   // 幾乎不動
  light: 1.4,       // 一週練 1-2 次
  moderate: 1.55,   // 一週練 3-4 次
  active: 1.7,      // 一週練 5 次以上
}

export type ReportInput = {
  reading: InBodyReading
  /** OCR 讀不到時由教練補 */
  gender?: 'male' | 'female' | null
  age?: number | null
  activity?: ActivityLevel
  /** 目標期程（週），預設 12 */
  weeks?: number
  /** 上一次的體測讀數 —— 有的話會產出「這段時間變了什麼」 */
  previous?: InBodyReading | null
}

export type KeyStat = {
  label: string
  value: string
  unit: string
  tone: 'neutral' | 'watch' | 'good'
  /** 「所以呢」——沒有這句就只是報數 */
  soWhat: string
}

/** 兩次體測之間的變化 —— 這才是機器印不出來的東西（它不記得你） */
export type ProgressComparison = {
  fromDate: string | null
  toDate: string | null
  weeks: number | null
  /** 一句話：這段時間真正發生了什麼 */
  verdict: string
  /** 逐項變化，只列有意義的 */
  changes: { label: string; from: number; to: number; delta: number; unit: string; tone: 'good' | 'watch' | 'neutral' }[]
}

export type AssessmentReport = {
  /** 兩次體測的比對。第一次測沒有這個 */
  comparison?: ProgressComparison | null
  /** 一句話結論 */
  headline: string
  /** 支撐那句話的說明 */
  headlineDetail: string
  /** 三個要看的數字 */
  keyStats: KeyStat[]
  /** 目標 */
  goal: {
    weeks: number
    currentWeight: number
    targetWeight: number
    currentBodyFat: number | null
    targetBodyFat: number | null
    ratePerWeek: number
    /** 主要追蹤指標的說明（腹圍優先於體重） */
    primaryMetricNote: string | null
  } | null
  /** 每日營養 */
  nutrition: {
    bmr: number
    tdee: number
    calories: number
    protein: number
    carbs: number
    fat: number
    deficitNote: string
  } | null
  /** 訓練建議（三條） */
  training: { title: string; detail: string }[]
  /** 需要教練補的欄位（OCR 讀不到或不確定） */
  missing: string[]
  /** 依 uncertain 帶出的提醒 */
  warnings: string[]
}

function round1(n: number) { return Math.round(n * 10) / 10 }
/** 每週速率要兩位小數 —— round1(x*100)/100 會算出 0.342 這種三位數 */
function round2(n: number) { return Math.round(n * 100) / 100 }

function resolveGender(input: ReportInput): 'male' | 'female' {
  if (input.gender) return input.gender
  const g = input.reading.gender ?? ''
  if (g.includes('女')) return 'female'
  return 'male'
}

/**
 * 兩次體測的比對。
 *
 * ⚠️ 為什麼這段比報告本身重要（2026-08-21 Howard：「我不認為這個報告就能有多有差異」）：
 * 他說得對 —— 單一份報告不是差異化，好教練口頭也講得出來。
 *
 * ⚠️⚠️ **我一開始寫「因為機器不記得你」，那是錯的，Howard 當場指正**：
 * ACCUNIQ 報表右下角就有「身體組成變化」，會印出最近四次的
 * 體重／骨骼肌重／體脂肪百分比。機器記得。
 *
 * 真正的差別在別的地方：
 *   1. 機器記 **3 個指標、4 個點**；腹圍、分部位脂肪、內臟脂肪的變化它不留
 *   2. 機器 **只給一條折線，不解釋** —— 「掉了 2.8 公斤脂肪但肌肉一克沒少，
 *      這是最好的那種變化」這句話它講不出來
 *   3. 機器的紀錄 **綁在那台機器上**，印在一張會被丟掉的紙上；
 *      我們的綁在連結上，會員手機隨時打得開
 *   4. 那區 OCR 實測會整組讀錯（日期位移），所以我們自己存的比對反而更可靠
 *
 * 判讀重點：**體重變化本身沒有意義，脂肪與肌肉分別怎麼動才有。**
 * 掉了 3 公斤但肌肉掉 1.5 是壞事；體重沒動但脂肪掉 2 公斤是好事。
 */
function buildComparison(now: InBodyReading, prev: InBodyReading): ProgressComparison | null {
  if (now.weight == null || prev.weight == null) return null

  const from = prev.measured_at, to = now.measured_at
  const weeks = from && to
    ? Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 / 7)
    : null

  const changes: ProgressComparison['changes'] = []
  const push = (
    label: string, a: number | null | undefined, b: number | null | undefined,
    unit: string, betterWhen: 'down' | 'up',
  ) => {
    if (a == null || b == null) return
    const delta = round1(b - a)
    if (Math.abs(delta) < 0.1) return
    const good = betterWhen === 'down' ? delta < 0 : delta > 0
    changes.push({ label, from: a, to: b, delta, unit, tone: good ? 'good' : 'watch' })
  }

  push('體脂肪', prev.body_fat_mass, now.body_fat_mass, 'kg', 'down')
  push('骨骼肌', prev.skeletal_muscle, now.skeletal_muscle, 'kg', 'up')
  push('腹圍', prev.waist_cm, now.waist_cm, 'cm', 'down')
  push('體重', prev.weight, now.weight, 'kg', 'down')
  push('體脂率', prev.body_fat_pct, now.body_fat_pct, '%', 'down')

  // ── 一句話：分開看脂肪與肌肉，不要只講體重 ──
  const fatDelta = now.body_fat_mass != null && prev.body_fat_mass != null
    ? round1(now.body_fat_mass - prev.body_fat_mass) : null
  const muscleDelta = now.skeletal_muscle != null && prev.skeletal_muscle != null
    ? round1(now.skeletal_muscle - prev.skeletal_muscle) : null
  const waistDelta = now.waist_cm != null && prev.waist_cm != null
    ? round1(now.waist_cm - prev.waist_cm) : null

  const span = weeks ? `這 ${weeks} 週` : '上次到現在'
  let verdict: string

  if (fatDelta != null && muscleDelta != null) {
    if (fatDelta <= -0.5 && muscleDelta >= -0.3) {
      verdict = `${span}你掉了 ${Math.abs(fatDelta)} 公斤脂肪，肌肉${muscleDelta >= 0.3 ? `還多了 ${muscleDelta} 公斤` : '幾乎沒動'}。` +
        `這是最好的那種變化 —— 體重計看不出差別，但身體組成整個往對的方向走。`
    } else if (fatDelta <= -0.5 && muscleDelta < -0.3) {
      verdict = `${span}掉了 ${Math.abs(fatDelta)} 公斤脂肪，但肌肉也少了 ${Math.abs(muscleDelta)} 公斤。` +
        `脂肪有掉是好事，不過肌肉跟著走代表速度或蛋白質要調 —— 這個要處理。`
    } else if (fatDelta >= 0.5 && muscleDelta >= 0.3) {
      verdict = `${span}肌肉多了 ${muscleDelta} 公斤，脂肪也多了 ${fatDelta} 公斤。` +
        `如果這段時間目標是增肌，方向是對的，只是可以再乾淨一點。`
    } else if (fatDelta >= 0.5) {
      verdict = `${span}脂肪增加了 ${fatDelta} 公斤，肌肉沒有跟上。這通常不是努力的問題，是熱量或執行的細節。`
    } else {
      verdict = `${span}身體組成變化不大。這不算失敗 —— 但如果目標是往下，那要調整的是做法不是決心。`
    }
  } else {
    const wd = round1(now.weight - prev.weight)
    verdict = `${span}體重${wd === 0 ? '沒有變化' : wd < 0 ? `掉了 ${Math.abs(wd)} 公斤` : `增加了 ${wd} 公斤`}。` +
      `這次沒讀到完整的體脂與肌肉數據，所以只能看體重 —— 那個數字單獨看意義有限。`
  }

  if (waistDelta != null && waistDelta <= -1) {
    verdict += ` 另外腹圍少了 ${Math.abs(waistDelta)} 公分，那是衣服會先有感覺的地方。`
  }

  return { fromDate: from, toDate: to, weeks, verdict, changes }
}

export function buildAssessmentReport(input: ReportInput): AssessmentReport {
  const r = input.reading
  const gender = resolveGender(input)
  const age = input.age ?? r.age ?? null
  const weeks = input.weeks ?? DEFAULT_WEEKS
  const activity = input.activity ?? 'light'

  const missing: string[] = []
  const warnings: string[] = []
  if (r.weight == null) missing.push('體重')
  if (r.height == null) missing.push('身高')
  if (age == null) missing.push('年齡')
  if (r.body_fat_pct == null) missing.push('體脂率')

  // 只提醒「會影響報告」且「教練看得懂」的欄位。
  // ⚠️ history 相關的一律不提 —— 那組資料只要有一格沒把握就整組丟棄了（見 inbody-ocr），
  //    不影響報告內容，講出來只是雜訊；而且 `history[0].date` 這種鍵名對教練沒有意義。
  const FIELD_LABEL: Record<string, string> = {
    weight: '體重', height: '身高', age: '年齡', body_fat_pct: '體脂率',
    body_fat_mass: '體脂重', skeletal_muscle: '骨骼肌重', lean_mass: '除脂體重',
    smi: 'SMI', bmi: 'BMI', visceral_fat: '內臟脂肪程度', visceral_fat_area: '內臟脂肪面積',
    waist_cm: '腹圍', whr: '腰臀比', bmr: '基礎代謝率', machine_tdee: '機器估的每日消耗',
    body_water: '身體水份', protein: '蛋白質', mineral: '礦物質',
    obesity_degree: '肥胖度', health_score: '健康評分', edema_index: '水腫指數',
    target_weight: '機器建議目標體重', fat_control: '脂肪控制', muscle_control: '肌肉控制',
  }
  const shownUncertain = r.uncertain
    .filter(k => !k.startsWith('history'))
    .map(k => FIELD_LABEL[k] ?? k)
  if (shownUncertain.length > 0) {
    warnings.push(`這幾格系統讀得沒把握，講解前先跟報表核對一下：${shownUncertain.join('、')}`)
  }
  if (r.uncertain.some(k => k.startsWith('history'))) {
    warnings.push('報表右下的歷史趨勢那區沒讀準，已略過 —— 不影響上面的判讀。')
  }
  if (r.waist_was_inches) {
    warnings.push('報表的腹圍是英吋，系統已換算成公分。')
  }

  const w = r.weight
  const bf = r.body_fat_pct
  const fatMass = r.body_fat_mass
  const waist = r.waist_cm
  const smi = r.smi

  // ── 一句話：先判斷「主要問題」是什麼 ───────────────────────
  let headline = '這次的數字已經記錄下來了。'
  let headlineDetail = '把幾個關鍵欄位補齊之後，系統就能給出完整的判讀。'

  const trunkFat = r.segmental_fat?.['軀幹'] ?? null
  const centralRatio = trunkFat != null && fatMass ? trunkFat / fatMass : null
  const waistOver = waist != null && waist > WAIST_LIMIT[gender]
  const bands = BF_BANDS[gender]
  const smiLow = smi != null && smi < SMI_LOW[gender]

  if (w != null && bf != null) {
    if (smiLow) {
      // 肌肉量偏低優先講 —— 這種人先減脂會更糟
      headline = `你的體脂不是最急的事 —— 先把肌肉量拉起來。`
      headlineDetail =
        `骨骼肌質量指數 ${smi} 低於一般參考範圍（${SMI_LOW[gender]}）。` +
        `這個狀態下先做熱量赤字，掉的會有很大一部分是肌肉。先吃夠、先練起來，體態才有底。`
    } else if (waistOver && centralRatio != null && centralRatio > TRUNK_FAT_RATIO) {
      const pct = Math.round(centralRatio * 100)
      headline = `你的肌肉量是夠的 —— 要處理的是集中在肚子的那 ${round1(trunkFat!)} 公斤脂肪。`
      headlineDetail =
        `你全身有 ${round1(fatMass!)} 公斤脂肪，其中 ${round1(trunkFat!)} 公斤在軀幹 —— 佔了 ${pct}%。` +
        `所以你看起來「還好」但腰圍下不去，不是錯覺。`
    } else if (waistOver) {
      headline = `體重不是重點，你的腹圍 ${waist} 公分才是。`
      headlineDetail =
        `一般以 ${WAIST_LIMIT[gender]} 公分為參考線。腹部的脂肪比其他部位更值得先處理，` +
        `而且它掉下來的時候，衣服會比體重計先有感覺。`
    } else if (bf > bands.high) {
      headline = `目前體脂 ${bf}%，先把它往下帶，其他都好談。`
      headlineDetail = `一般族群參考範圍約 ${bands.normal}% 上下。這個階段的重點是穩定的赤字加上足夠的蛋白質。`
    } else if (bf > bands.normal) {
      headline = `你的底子不差，體脂再往下一點形狀就會出來。`
      headlineDetail = `目前 ${bf}%，${bands.lean}% 以下屬於精瘦區間。你不需要大改，需要的是把執行穩住。`
    } else {
      headline = `你的身體組成已經在不錯的位置了。`
      headlineDetail = `體脂 ${bf}%、骨骼肌 ${r.skeletal_muscle ?? '—'} 公斤。接下來的重點是維持與微調，不是再減。`
    }
  }

  // ── 三個數字 ─────────────────────────────────────────────
  const keyStats: KeyStat[] = []
  if (waist != null) {
    keyStats.push({
      label: '腹圍', value: String(waist), unit: 'cm',
      tone: waistOver ? 'watch' : 'good',
      soWhat: waistOver
        ? `${gender === 'male' ? '男性' : '女性'}一般以 ${WAIST_LIMIT[gender]} 公分為參考線，你高出 ${round1(waist - WAIST_LIMIT[gender])} 公分。這個數字比體重更值得追 —— 它掉下來的時候，衣服會先有感覺。`
        : `落在參考範圍內（${WAIST_LIMIT[gender]} 公分以下）。持續維持就好。`,
    })
  }
  if (bf != null) {
    keyStats.push({
      label: '體脂率', value: String(bf), unit: '%',
      tone: bf > bands.normal ? 'watch' : 'good',
      soWhat: `${gender === 'male' ? '男性' : '女性'} ${bands.lean}% 以下屬精瘦、${bands.normal}% 上下是一般範圍。` +
        (bf > bands.high ? '目前偏高，但這是最好處理的一項。'
          : bf > bands.normal ? '你不算超標，但還有空間。'
          : '這個數字沒有問題。'),
    })
  }
  if (r.skeletal_muscle != null) {
    keyStats.push({
      label: '骨骼肌重', value: String(r.skeletal_muscle), unit: 'kg',
      tone: smiLow ? 'watch' : 'good',
      soWhat: smiLow
        ? `SMI ${smi}，低於一般參考範圍（${SMI_LOW[gender]}）。減脂之前先把這個拉起來，否則掉的會有一半是肌肉。`
        : `SMI ${smi ?? '—'}，落在標準範圍。這是好消息 —— 你不用增肌，減脂時保住它就好。`,
    })
  }

  // ── 目標 ────────────────────────────────────────────────
  let goal: AssessmentReport['goal'] = null
  if (w != null && bf != null && !smiLow) {
    const leanMass = r.lean_mass ?? (fatMass != null ? w - fatMass : null)
    // 目標體脂：往下帶一個檔次，但不低於精瘦線
    const targetBf = Math.max(bands.lean, round1(bf - 4.5))
    const targetWeight = leanMass != null ? round1(leanMass / (1 - targetBf / 100)) : round1(w * (1 - CUT_RATE_PCT * weeks))
    const totalLoss = w - targetWeight
    const rate = round2(totalLoss / weeks)
    // 速率超過安全線就拉長期程（寧可慢，不要給一個做不到的數字）
    const maxRate = w * CUT_RATE_PCT
    const safeWeeks = rate > maxRate ? Math.ceil(totalLoss / maxRate) : weeks
    goal = {
      weeks: safeWeeks,
      currentWeight: w,
      targetWeight,
      currentBodyFat: bf,
      targetBodyFat: targetBf,
      ratePerWeek: round2(totalLoss / safeWeeks),
      primaryMetricNote: waistOver
        ? `同時腹圍會從 ${waist} 往 ${WAIST_LIMIT[gender]} 以下走。那是這次體測真正的目標，體重只是它的副產品。`
        : null,
    }
  } else if (w != null && smiLow) {
    const targetWeight = round1(w * (1 + BULK_RATE_PCT * weeks))
    goal = {
      weeks, currentWeight: w, targetWeight,
      currentBodyFat: bf, targetBodyFat: null,
      ratePerWeek: round2((targetWeight - w) / weeks),
      primaryMetricNote: '這個階段追的是肌肉量與主項重量，不是體重計上的數字。',
    }
  }

  // ── 每日營養 ─────────────────────────────────────────────
  let nutrition: AssessmentReport['nutrition'] = null
  if (w != null && r.height != null && age != null) {
    // Mifflin-St Jeor
    const bmrCalc = Math.round(10 * w + 6.25 * r.height - 5 * age + (gender === 'male' ? 5 : -161))
    const bmr = r.bmr ?? bmrCalc
    const tdee = Math.round(bmrCalc * ACTIVITY_FACTOR[activity])
    const cutting = !smiLow
    const delta = cutting ? -Math.round(tdee * 0.17) : Math.round(tdee * 0.10)
    const calories = Math.round((tdee + delta) / 10) * 10
    const protein = Math.round(w * 2.0)
    const fat = Math.round(w * 0.8)
    const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))
    nutrition = {
      bmr, tdee, calories, protein, carbs, fat,
      deficitNote: cutting
        ? `每天少吃約 ${Math.abs(delta)} 大卡 —— 那大概是一杯手搖加一份消夜的量，不是叫你餓肚子。`
        : `每天多吃約 ${delta} 大卡。這個幅度長的是肌肉不是脂肪。`,
    }
  } else {
    missing.push('無法計算每日熱量（需要體重、身高、年齡）')
  }

  // ── 訓練 ────────────────────────────────────────────────
  const training = smiLow
    ? [
        { title: '一週三次重訓，優先大肌群', detail: '深蹲、硬舉、臥推、划船這類多關節動作。你現在的目標是把肌肉量拉起來，那些動作 CP 值最高。' },
        { title: '重量要往上爬', detail: '每次記錄用了多重。重量進步才是肌肉真的有長的證據，體重計看不出來。' },
        { title: '先不要做有氧減脂', detail: '這個階段熱量要留給肌肉。想動的話走路就好，不要排高強度有氧。' },
      ]
    : [
        {
          title: `一週兩到三次重訓，全身`,
          detail: `你的目的是「減脂時保住 ${r.skeletal_muscle ?? ''} 公斤肌肉」，不是長更多。全身分化每個部位一週練到兩次，比分部位有效率。`.replace('  ', ' '),
        },
        { title: '重量不要退', detail: '熱量在赤字的時候，如果連重量都掉，身體就沒有理由留住肌肉。' },
        { title: '想加消耗就加走路，不要拿掉重訓', detail: '有氧幫你花熱量，重訓幫你保住肌肉 —— 兩件不同的事。' },
      ]

  const comparison = input.previous ? buildComparison(r, input.previous) : null

  return { comparison, headline, headlineDetail, keyStats: keyStats.slice(0, 3), goal, nutrition, training, missing, warnings }
}
