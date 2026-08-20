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

export type InBodyReading = {
  measured_at: string | null      // YYYY-MM-DD，讀不到就 null
  weight: number | null           // kg
  height: number | null           // cm
  body_fat_pct: number | null     // %
  body_fat_mass: number | null    // kg
  skeletal_muscle: number | null  // 骨骼肌重 kg
  lean_mass: number | null        // 除脂肪體重 kg
  smi: number | null              // 骨骼肌質量指數
  visceral_fat: number | null     // 內臟脂肪程度
  waist_cm: number | null         // 腹圍
  whr: number | null              // 腰臀比
  bmr: number | null              // 基礎代謝率 kcal
  /** 機器自己估的 TDEE。⚠️ 對久坐者會高估，別直接採用（見 project_lin_youren） */
  machine_tdee: number | null
  /** 四肢+軀幹的肌肉/脂肪分佈，讀得到才有 */
  segmental: Record<string, number> | null
  /** 沒把握的欄位名（給前端標黃要教練確認） */
  uncertain: string[]
}

const SYSTEM_PROMPT = `你是體組成報表的資料萃取器。輸入是 ACCUNIQ 或 InBody 的列印報表照片。

規則：
1. 只輸出純 JSON 物件，不要任何說明文字、不要 markdown 圍欄。
2. 讀不到的欄位一律填 null，**絕對不要猜測或填入合理估計值**。這是醫療相關資料，寧可空白也不要錯。
3. 數值只填數字，不要帶單位。小數點照報表原樣保留。
4. measured_at 用 YYYY-MM-DD；報表上若只有日期時間，取日期部分。
5. uncertain 陣列填入「有讀到但字跡模糊/可能誤判」的欄位名稱，讓人工複核。

輸出格式：
{
  "measured_at": "2026-08-12",
  "weight": 91.7,
  "height": 183,
  "body_fat_pct": 26.2,
  "body_fat_mass": 24.0,
  "skeletal_muscle": 37.8,
  "lean_mass": 67.7,
  "smi": 8.70,
  "visceral_fat": 8,
  "waist_cm": 98.6,
  "whr": 0.85,
  "bmr": 1916,
  "machine_tdee": 2819,
  "segmental": { "右手肌肉": 4.1, "左手肌肉": 4.0, "軀幹肌肉": 30.2, "右腿肌肉": 10.84, "左腿肌肉": 10.74 },
  "uncertain": []
}`

const NUM_FIELDS = [
  'weight', 'height', 'body_fat_pct', 'body_fat_mass', 'skeletal_muscle',
  'lean_mass', 'smi', 'visceral_fat', 'waist_cm', 'whr', 'bmr', 'machine_tdee',
] as const

/** 合理範圍守門：OCR 讀錯一位數的話這裡要擋下來，不要讓離譜值進到引擎 */
const RANGES: Record<string, [number, number]> = {
  weight: [25, 300],
  height: [100, 230],
  body_fat_pct: [2, 70],
  body_fat_mass: [1, 150],
  skeletal_muscle: [10, 80],
  lean_mass: [20, 150],
  smi: [3, 15],
  visceral_fat: [1, 30],
  waist_cm: [40, 200],
  whr: [0.5, 1.5],
  bmr: [700, 3500],
  machine_tdee: [900, 6000],
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

  const out = { measured_at: null, segmental: null } as unknown as InBodyReading
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

  if (parsed.segmental && typeof parsed.segmental === 'object') {
    const seg: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed.segmental as Record<string, unknown>)) {
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n)) seg[k] = n
    }
    out.segmental = Object.keys(seg).length > 0 ? seg : null
  }

  out.uncertain = [...uncertain]
  return out
}

/** 至少要讀到體重才算有效 —— 沒有體重的話後面什麼都算不出來 */
export function isUsable(r: InBodyReading | null): boolean {
  return !!r && r.weight != null
}
