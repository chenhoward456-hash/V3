import Anthropic from '@anthropic-ai/sdk'

/**
 * 從 ACCUNIQ / InBody 列印報表萃取體組成數值。
 *
 * ⚠️ 為什麼做這個（2026-08-20 Howard：「我想做一個系統讓這間健身房不一樣，
 * 不然我們就是一間普通健身房」＋「我不想做教學，那是慢慢培養的」）：
 *
 * 北屯館現在的動線是「辦卡送原價 800 體測 → 做完給一張機器印的紙 → 結束」。
 * 那張紙每間健身房都一樣，會員看不懂、回家就丟，而且**教練要靠嘴巴解釋** ——
 * 嘴巴的品質等於教練資歷，那正是南屯四個菜鳥賣不動教練課的原因。
 *
 * 這支的作用是把那張紙變成資料，後面接引擎產出「你的問題是什麼 / 三個月能到哪」
 * 的報告 —— **讓系統做判斷、教練只要執行**，不需要先培養人。
 *
 * 機型：ACCUNIQ BC380（Howard 2026-08-20 確認），只有列印輸出、無匯出功能，
 * 所以走拍照 OCR。跟血檢 OCR（lib/lab-ocr.ts）同一套 Vision 路徑。
 */

let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY 未設定')
    _anthropic = new Anthropic({ apiKey })
  }
  return _anthropic
}

const VALID_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export type InBodyHistoryPoint = {
  date: string
  weight: number | null
  skeletal_muscle: number | null
  body_fat_pct: number | null
}

export type InBodyReading = {
  measured_at: string | null      // YYYY-MM-DD，讀不到就 null
  gender: string | null
  weight: number | null           // kg
  height: number | null           // cm
  age: number | null
  body_fat_pct: number | null     // %
  body_fat_mass: number | null    // kg
  skeletal_muscle: number | null  // 骨骼肌重 kg
  lean_mass: number | null        // 除脂肪體重 kg
  smi: number | null              // 骨骼肌質量指數 kg/m²
  bmi: number | null
  visceral_fat: number | null     // 內臟脂肪程度
  visceral_fat_area: number | null // cm²
  /** 腹圍，**已正規化成公分**（見 waist_was_inches） */
  waist_cm: number | null
  /** ⚠️ true = 報表印的是英吋、程式已 ×2.54 轉成公分 */
  waist_was_inches: boolean
  whr: number | null              // 腰臀比
  bmr: number | null              // 基礎代謝率 kcal
  /** 機器估的每日消耗總能量。⚠️ 對久坐者高估，別直接採用（見 project_lin_youren） */
  machine_tdee: number | null
  body_water: number | null       // ℓ
  protein: number | null          // kg
  mineral: number | null          // kg
  obesity_degree: number | null   // 肥胖度 %
  health_score: number | null     // 身體健康評分
  edema_index: number | null      // 水腫指數
  /** 機器自己算的控制指南 —— 只當參考，教練的目標以 clients.target_weight 為準 */
  target_weight: number | null
  fat_control: number | null
  muscle_control: number | null
  segmental_muscle: Record<string, number> | null
  segmental_fat: Record<string, number> | null
  /** 報表右下「身體組成變化」的歷史趨勢（由舊到新） */
  history: InBodyHistoryPoint[]
  /** 沒把握的欄位名（給前端標黃要教練確認） */
  uncertain: string[]
}

const SYSTEM_PROMPT = `你是體組成報表的資料萃取器。輸入是 ACCUNIQ BC380（台灣 SELVAS Healthcare）的列印報表照片。

報表版面（由左上到右下）：
- 表頭：ID/姓名、身高 cm、年齡、性別、測量日期/時間
- 「身體組成分析」：身體水份(ℓ)、蛋白質(kg)、礦物質(kg)、體脂肪(kg)、軟組織重、除脂重、體重
- 「肌肉/脂肪分析」：體重、骨骼肌肉重、脂肪重（橫條圖，數字在條上）
- 「肥胖分析」：BMI、體脂肪百分比
- 「腹部肥胖分析」：腰臀比、內臟脂肪程度、內臟脂肪面積(cm²)
- 「區段性肌肉和脂肪分析」：人形圖，軀幹/左臂/右臂/左腿/右腿 各有肌肉重與脂肪重（kg 與 %）、SMI
- 「身體組成變化」：**歷史趨勢表**，最多 4 次測量的 體重／骨骼肌肉重／體脂肪百分比／測量日期
- 右欄「綜合評估」：身體類型、身體健康年齡、基礎代謝率(kcal)、每日消耗總能量(kcal)、細胞重量、內臟脂肪重量、肥胖度(%)、腹圍、身體健康評分
- 右欄「控制指南」：目標體重、體重控制、肌肉控制、脂肪控制、水腫指數
- 右欄「區段性肌肉」：各部位 kg + 標準範圍 + 評價（標準／標準以上／標準以下）

規則：
1. 只輸出純 JSON 物件，不要說明文字、不要 markdown 圍欄。
2. 讀不到的欄位一律 null，**絕對不要猜測或填入合理估計值**。這是醫療相關資料，寧可空白也不要錯。
3. 數值只填數字不帶單位。小數點照報表原樣。
4. measured_at 用 YYYY-MM-DD。
5. ⚠️ **腹圍（waist）照抄報表上的數字，不要換算**。這台機器的腹圍常以英吋列印卻標成 cm，換算由程式處理。
6. history 依報表「身體組成變化」由舊到新排列；沒有這區就給空陣列。
7. uncertain 填入「有讀到但字跡模糊、可能誤判」的欄位名。

輸出格式：
{
  "measured_at": "2026-08-15",
  "weight": 75.8, "height": 175, "age": 35, "gender": "男性",
  "body_fat_pct": 20.9, "body_fat_mass": 15.9, "skeletal_muscle": 33.5,
  "lean_mass": 59.9, "smi": 8.16, "bmi": 24.8,
  "visceral_fat": 8, "visceral_fat_area": 83, "whr": 0.90, "waist_raw": 37.0,
  "bmr": 1664, "machine_tdee": 2562,
  "body_water": 44.0, "protein": 11.9, "mineral": 4.1,
  "obesity_degree": 12.5, "health_score": 80, "edema_index": 0.373,
  "target_weight": 72.7, "fat_control": -3.1, "muscle_control": 0.0,
  "segmental_muscle": { "軀幹": 26.40, "左臂": 3.37, "右臂": 3.40, "左腿": 9.11, "右腿": 9.12 },
  "segmental_fat": { "軀幹": 8.40, "左臂": 0.85, "右臂": 0.83, "左腿": 2.23, "右腿": 2.26 },
  "history": [
    { "date": "2026-07-06", "weight": 75.8, "skeletal_muscle": 33.7, "body_fat_pct": 20.6 }
  ],
  "uncertain": []
}`

const NUM_FIELDS = [
  'weight', 'height', 'age', 'body_fat_pct', 'body_fat_mass', 'skeletal_muscle',
  'lean_mass', 'smi', 'bmi', 'visceral_fat', 'visceral_fat_area', 'whr',
  'bmr', 'machine_tdee', 'body_water', 'protein', 'mineral',
  'obesity_degree', 'health_score', 'edema_index',
  'target_weight', 'fat_control', 'muscle_control',
] as const

/** 合理範圍守門：OCR 讀錯一位數的話這裡要擋下來，不要讓離譜值進到引擎 */
const RANGES: Record<string, [number, number]> = {
  weight: [25, 300],
  height: [100, 230],
  age: [10, 100],
  body_fat_pct: [2, 70],
  body_fat_mass: [1, 150],
  skeletal_muscle: [10, 80],
  lean_mass: [20, 150],
  smi: [3, 15],
  bmi: [10, 60],
  visceral_fat: [1, 30],
  visceral_fat_area: [10, 400],
  whr: [0.5, 1.5],
  bmr: [700, 3500],
  machine_tdee: [900, 6000],
  body_water: [15, 90],
  protein: [3, 30],
  mineral: [1, 10],
  obesity_degree: [-50, 150],
  health_score: [0, 100],
  edema_index: [0.2, 0.5],
  target_weight: [25, 300],
  fat_control: [-100, 100],
  muscle_control: [-50, 50],
}

export type OcrFile = { mediaType: string; data: string }

export async function extractInBody(files: OcrFile[]): Promise<InBodyReading> {
  type AnthropicContent = Exclude<Anthropic.MessageCreateParams['messages'][0]['content'], string>
  const content: AnthropicContent = []

  for (const f of files) {
    if (!f?.mediaType || !f?.data) continue
    if (f.mediaType === 'application/pdf') {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: f.data },
      } as AnthropicContent[number])
    } else if (VALID_IMAGE_TYPES.has(f.mediaType)) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: f.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: f.data,
        },
      })
    } else {
      throw new Error(`不支援的檔案類型：${f.mediaType}`)
    }
  }
  if (content.length === 0) throw new Error('沒有有效檔案')
  content.push({ type: 'text', text: '請萃取這份體組成報表，輸出純 JSON 物件。' })

  const model = process.env.INBODY_OCR_MODEL || 'claude-sonnet-4-6'
  const response = await getClient().messages.create({
    model,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  const raw = textBlock && 'text' in textBlock ? textBlock.text : ''

  let jsonStr = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  const first = jsonStr.indexOf('{')
  const last = jsonStr.lastIndexOf('}')
  if (first >= 0 && last > first) jsonStr = jsonStr.slice(first, last + 1)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    console.error('[inbody-ocr] JSON parse failed, raw head:', raw.slice(0, 200))
    throw new Error('報表萃取結果無法解析，換一張清楚一點的照片試試')
  }

  const uncertain = new Set<string>(
    Array.isArray(parsed.uncertain) ? (parsed.uncertain as unknown[]).map(String) : [],
  )

  const out = { measured_at: null } as unknown as InBodyReading
  const md = parsed.measured_at
  out.measured_at = typeof md === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(md) ? md : null

  for (const key of NUM_FIELDS) {
    const v = parsed[key]
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
    if (!Number.isFinite(n)) { out[key] = null; continue }
    const range = RANGES[key]
    if (range && (n < range[0] || n > range[1])) {
      // 超出生理合理範圍 → 當成讀錯，標記讓人工確認
      out[key] = null
      uncertain.add(key)
      continue
    }
    out[key] = n
  }

  // 性別（字串，不走數值守門）
  out.gender = typeof parsed.gender === 'string' && parsed.gender.trim() ? parsed.gender.trim() : null

  // ⚠️ 腹圍陷阱：這台機器把腹圍印成**英吋**卻標單位 cm
  //    （實測 2026-08-15 那張：「腹圍 37.0 (少於 90 cm) cm」——37 吋 ≈ 94 公分）。
  //    若原樣採用會得到「腹圍 37 公分」這種荒謬值，而且它會流進中央肥胖判斷。
  //    20–60 之間一律視為英吋轉公分；已經是公分範圍的就照用。
  {
    const rawW = parsed.waist_raw ?? parsed.waist_cm
    const n = typeof rawW === 'number' ? rawW : Number(rawW)
    if (Number.isFinite(n)) {
      if (n >= 20 && n <= 60) {
        out.waist_cm = Math.round(n * 2.54 * 10) / 10
        out.waist_was_inches = true
      } else if (n > 60 && n <= 200) {
        out.waist_cm = n
        out.waist_was_inches = false
      } else {
        out.waist_cm = null
        out.waist_was_inches = false
        uncertain.add('waist_cm')
      }
    } else {
      out.waist_cm = null
      out.waist_was_inches = false
    }
  }

  const readSeg = (src: unknown): Record<string, number> | null => {
    if (!src || typeof src !== 'object') return null
    const seg: Record<string, number> = {}
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n)) seg[k] = n
    }
    return Object.keys(seg).length > 0 ? seg : null
  }
  out.segmental_muscle = readSeg(parsed.segmental_muscle)
  out.segmental_fat = readSeg(parsed.segmental_fat)

  // 歷史趨勢（報表右下「身體組成變化」）—— 這區白送一條趨勢線，別浪費
  out.history = []
  if (Array.isArray(parsed.history)) {
    for (const h of parsed.history as Record<string, unknown>[]) {
      const date = typeof h?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.date) ? h.date : null
      if (!date) continue
      const num = (v: unknown) => {
        const n = typeof v === 'number' ? v : Number(v)
        return Number.isFinite(n) ? n : null
      }
      out.history.push({
        date,
        weight: num(h.weight),
        skeletal_muscle: num(h.skeletal_muscle),
        body_fat_pct: num(h.body_fat_pct),
      })
    }
    out.history.sort((a, b) => a.date.localeCompare(b.date))
  }

  // ═══ 交叉驗證：報表內部本來就有冗餘，用它來校正 OCR 的小數點誤讀 ═══
  // 2026-08-20 實測（Howard 提供的真實 ACCUNIQ 報表）抓到的三個錯：
  //   body_fat_pct 讀 20.8（實際 20.9）、lean_mass 讀 59.8（實際 59.9）、
  //   右臂脂肪讀 0.63（實際 0.83）。前兩個可以用其他欄位反算出來。
  {
    const w = out.weight, fm = out.body_fat_mass
    if (w && fm != null) {
      // 體脂率 = 體脂重 / 體重。兩個獨立讀數推出來的值比直接讀那格可靠。
      const derivedPct = Math.round((fm / w) * 1000) / 10
      if (out.body_fat_pct == null) {
        out.body_fat_pct = derivedPct
      } else if (Math.abs(out.body_fat_pct - derivedPct) > 1.5) {
        // 差太多 → 兩邊至少一個讀錯，不自作主張，交給人
        uncertain.add('body_fat_pct')
      } else if (out.body_fat_pct !== derivedPct) {
        out.body_fat_pct = derivedPct   // 小數點級別的誤差 → 用反算值
      }

      // 除脂體重 = 體重 − 體脂重
      const derivedLean = Math.round((w - fm) * 10) / 10
      if (out.lean_mass == null) {
        out.lean_mass = derivedLean
      } else if (Math.abs(out.lean_mass - derivedLean) > 2) {
        uncertain.add('lean_mass')
      } else if (out.lean_mass !== derivedLean) {
        out.lean_mass = derivedLean
      }
    }
  }

  // ═══ history 驗證：這區最容易錯位，寧可整組丟掉 ═══
  // 實測時 OCR 把四次測量的日期全讀錯（07.06→01-08 等）、數值往前位移一格。
  // 唯一可靠的校驗是「最後一筆應該等於這次測量」——對不上就代表整組錯位。
  if (out.history.length > 0) {
    const last = out.history[out.history.length - 1]
    const dateOk = !out.measured_at || out.history.every(h => h.date <= out.measured_at!)
    const lastMatches =
      out.weight == null || last.weight == null || Math.abs(last.weight - out.weight) < 0.15
    // 模型只要對 history 任何一格沒把握就整組丟 —— 實測那次它把 07.06 讀成 01-08、
    // 數值往前位移一格，但日期仍然遞增且落在合理區間，光靠邏輯檢查抓不出來。
    // **錯的趨勢比沒有趨勢更糟**（會讓教練誤判方向），所以寧可不要。
    const modelUnsure = [...uncertain].some(k => k.startsWith('history'))
    if (!dateOk || !lastMatches || modelUnsure) {
      out.history = []
      uncertain.add('history')
    }
  }

  out.uncertain = [...uncertain]
  return out
}

/** 至少要讀到體重才算有效 —— 沒有體重的話後面什麼都算不出來 */
export function isUsable(r: InBodyReading | null): boolean {
  return !!r && r.weight != null
}
