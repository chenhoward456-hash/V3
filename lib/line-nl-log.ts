/**
 * LINE 自然語言記錄 —— 一則訊息記完一天。
 *
 * ## 為什麼要有這支（2026-08-24，Howard：「有機會用 opus 5 優化官方賴回報進去系統的路徑嗎」）
 *
 * 先看真實資料再動手。`line_webhook_debug_log` 裡 Sean 送進來的 120 則訊息，
 * **沒有一則是自然語言，全部都是按鈕**。他 8/23 一天長這樣：
 *
 *   記飲食 → 達標                                          （2 則）
 *   記訓練 → 訓練 推 → 訓練完成 push 45 → 訓練儲存 push 45 7 （4 則）
 *   記身心 → 睡眠 3 → 精力 3 3 → 心情 3 3 3                 （4 則）
 *
 * 一天 10 則訊息只為了記三件事。而 `training_sets` 是空的 ——
 * 代表既有那條「深蹲 100x5x3」的 AI 解析路徑**從來沒被觸發過**；
 * 飲食的 AI 路徑要求開頭是「吃／早餐／午餐」，也沒人用。
 * 兩條 AI 路徑對真實使用者是死的，而真實使用者在按十次按鈕。
 *
 * 所以這支不是「把既有解析器變聰明」，是**把精靈流程壓成一則訊息**。
 *
 * ## 插入點刻意選在最後
 *
 * webhook 裡約 40 個關鍵字分支全部保留、優先順序不變（Sean 已經習慣按鈕，零風險），
 * 這支只接管原本走到最後一行、**什麼都不會發生**的那些訊息：
 *
 *   > `// 已綁定用戶的非指令訊息：不自動回覆`
 *
 * 也就是說：**它只可能把「沉默」變成「有回應」，不可能弄壞既有流程。**
 * 解析失敗就退回原本的沉默。
 *
 * ## 為什麼用 Opus 而不是 Haiku
 *
 * 這裡要處理的是「一句話裡混了四種資料、單位省略、口語」——
 * 「85.7 今天推日45分RPE7 飲食達標 睡眠精力心情都3」。
 * 既有兩條路徑用 Haiku 是因為它們只解析單一類別且格式受限。
 * 量體很小（一天不到 20 則）且 LINE 的**回覆**不吃 200 則／月的推播配額，
 * 所以這裡的限制條件是準確度不是成本。
 *
 * ## 安全邊界
 *
 * 模型只負責「把話翻成結構」，**能不能寫進 DB 由這支的驗證決定**。
 * 每個欄位都對照 docs/SCHEMA.md 的 CHECK 約束夾範圍，夾不進去就整個丟掉，
 * 不會為了「有記到東西」而寫入垃圾值污染引擎。
 */

export const NL_LOG_MODEL = 'claude-opus-5'

/** training_logs.training_type 的 DB CHECK 白名單（改這裡前先 grep，紅線 6） */
export const ALLOWED_TRAINING_TYPES = [
  'push', 'pull', 'legs', 'full_body', 'upper_body',
  'cardio', 'rest', 'chest', 'shoulder', 'arms',
] as const

export type NLParsed = {
  weight?: number | null
  training?: {
    training_type?: string | null
    duration?: number | null
    rpe?: number | null
  } | null
  nutrition?: {
    compliant?: boolean | null
    calories?: number | null
    protein_grams?: number | null
  } | null
  wellness?: {
    sleep_quality?: number | null
    energy_level?: number | null
    mood?: number | null
  } | null
  /** 模型覺得這則訊息根本不是在記錄（閒聊、發問、抱怨）→ 不要硬記 */
  not_a_log?: boolean | null
  /** 模型讀不出來時想問的一句話 */
  ask?: string | null
}

/** 驗證後真的要寫進 DB 的東西 —— 每一欄都已經過 CHECK 約束 */
export type NLWrite = {
  weight?: number
  training?: { training_type: string; duration?: number; rpe?: number }
  nutrition?: { compliant?: boolean; calories?: number; protein_grams?: number }
  wellness?: { sleep_quality?: number; energy_level?: number; mood?: number }
}

const clampInt = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return undefined
  const r = Math.round(n)
  return r >= lo && r <= hi ? r : undefined
}
const clampNum = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return undefined
  return n >= lo && n <= hi ? n : undefined
}

/**
 * 把模型吐的 JSON 收斂成「保證可以安全寫入」的東西。
 *
 * ⚠️ 這裡故意嚴格：範圍外一律丟掉而不是夾到邊界值。
 * 夾到邊界會產生「看起來合法但其實是模型幻覺」的資料，
 * 而這些數字會直接餵進 TDEE / 趨勢引擎去改學員的熱量 —— 寧可沒記到也不要記錯。
 */
export function validateNL(parsed: NLParsed): NLWrite {
  const out: NLWrite = {}
  if (parsed.not_a_log) return out

  // 體重：30-200kg（跟既有 bare-number 路徑同範圍）
  const w = clampNum(parsed.weight, 30, 200)
  if (w != null) out.weight = Math.round(w * 10) / 10

  // 訓練：type 必須在白名單內，否則整組丟掉（DB CHECK 會擋，先擋在這裡）
  const t = parsed.training
  if (t?.training_type && (ALLOWED_TRAINING_TYPES as readonly string[]).includes(t.training_type)) {
    const training: NLWrite['training'] = { training_type: t.training_type }
    // duration > 0 除非 rest（docs/SCHEMA.md）
    const dur = clampInt(t.duration, 1, 600)
    if (dur != null) training.duration = dur
    const rpe = clampNum(t.rpe, 1, 10)
    if (rpe != null) training.rpe = Math.round(rpe * 10) / 10
    out.training = training
  }

  // 營養
  const n = parsed.nutrition
  if (n) {
    const nut: NonNullable<NLWrite['nutrition']> = {}
    if (typeof n.compliant === 'boolean') nut.compliant = n.compliant
    const cal = clampInt(n.calories, 200, 10000)
    if (cal != null) nut.calories = cal
    const pro = clampInt(n.protein_grams, 1, 500)
    if (pro != null) nut.protein_grams = pro
    if (Object.keys(nut).length > 0) out.nutrition = nut
  }

  // 身心：全部 1-5（docs/SCHEMA.md）
  const we = parsed.wellness
  if (we) {
    const wel: NonNullable<NLWrite['wellness']> = {}
    const s = clampInt(we.sleep_quality, 1, 5); if (s != null) wel.sleep_quality = s
    const e = clampInt(we.energy_level, 1, 5); if (e != null) wel.energy_level = e
    const m = clampInt(we.mood, 1, 5); if (m != null) wel.mood = m
    if (Object.keys(wel).length > 0) out.wellness = wel
  }

  return out
}

export const hasAnything = (w: NLWrite): boolean =>
  w.weight != null || w.training != null || w.nutrition != null || w.wellness != null

/**
 * 回給學員的確認句 —— 一定要把「實際寫進去的值」念回去。
 *
 * 自然語言輸入最大的風險是學員以為系統聽懂了但其實沒有。
 * 念回去他才會發現「我說 RPE7 怎麼變成 8」，而不是兩週後看報表才發現資料是錯的。
 */
export function confirmText(w: NLWrite): string {
  const parts: string[] = []
  if (w.weight != null) parts.push(`體重 ${w.weight}kg`)
  if (w.training) {
    const label: Record<string, string> = {
      push: '推', pull: '拉', legs: '腿', full_body: '全身', upper_body: '上肢',
      cardio: '有氧', rest: '休息', chest: '胸', shoulder: '肩', arms: '手臂',
    }
    const bits = [label[w.training.training_type] || w.training.training_type]
    if (w.training.duration != null) bits.push(`${w.training.duration}分`)
    if (w.training.rpe != null) bits.push(`RPE ${w.training.rpe}`)
    parts.push(bits.join(' '))
  }
  if (w.nutrition) {
    const bits: string[] = []
    if (w.nutrition.compliant === true) bits.push('飲食達標')
    if (w.nutrition.compliant === false) bits.push('飲食未達標')
    if (w.nutrition.calories != null) bits.push(`${w.nutrition.calories} 大卡`)
    if (w.nutrition.protein_grams != null) bits.push(`蛋白 ${w.nutrition.protein_grams}g`)
    if (bits.length) parts.push(bits.join(' '))
  }
  if (w.wellness) {
    const bits: string[] = []
    if (w.wellness.sleep_quality != null) bits.push(`睡 ${w.wellness.sleep_quality}`)
    if (w.wellness.energy_level != null) bits.push(`精力 ${w.wellness.energy_level}`)
    if (w.wellness.mood != null) bits.push(`心情 ${w.wellness.mood}`)
    if (bits.length) parts.push(bits.join(' '))
  }
  return `記好了 ✅\n${parts.join('｜')}`
}

export const NL_SYSTEM_PROMPT = `你是健身記錄解析器。把學員用中文口語講的一天，解析成 JSON。

只回 JSON，不要解釋、不要 markdown 圍欄。格式：
{
  "weight": 體重公斤數或 null,
  "training": {"training_type": "push/pull/legs/full_body/upper_body/cardio/rest/chest/shoulder/arms 之一或 null", "duration": 分鐘數或 null, "rpe": 1-10 或 null},
  "nutrition": {"compliant": true/false/null, "calories": 數字或 null, "protein_grams": 數字或 null},
  "wellness": {"sleep_quality": 1-5 或 null, "energy_level": 1-5 或 null, "mood": 1-5 或 null},
  "not_a_log": true/false,
  "ask": "看不懂時想反問的一句話，或 null"
}

規則：
- 沒提到的欄位一律 null。**不要猜、不要補預設值。**
- 「推日／推」=push，「拉日／背」=pull，「腿日」=legs，「胸」=chest，「肩」=shoulder，「手」=arms，「有氧/跑步/腳踏車」=cardio，「休息/沒練」=rest。
- 「飲食有達標/有照吃/有做到」=compliant true；「沒達標/破功/亂吃/吃多了」=compliant false。
- 身心分數是 1-5。「都3」代表睡眠/精力/心情都是 3。「還行」不要自己換算成數字，留 null。
- 體重只認公斤。看到「85.7」「85.7kg」「早上85.7」都算。
- 這則訊息如果是在發問、閒聊、抱怨、或講未來計畫（不是回報今天做了什麼），not_a_log 設 true，其餘全 null。
- 讀得出一部分就回一部分，不用全部都有。

範例：
輸入「85.7 今天推日45分鐘RPE7 飲食達標 睡眠精力心情都3」
輸出 {"weight":85.7,"training":{"training_type":"push","duration":45,"rpe":7},"nutrition":{"compliant":true,"calories":null,"protein_grams":null},"wellness":{"sleep_quality":3,"energy_level":3,"mood":3},"not_a_log":false,"ask":null}

輸入「今天好累 沒練」
輸出 {"weight":null,"training":{"training_type":"rest","duration":null,"rpe":null},"nutrition":null,"wellness":null,"not_a_log":false,"ask":null}

輸入「教練我下週可以改課表嗎」
輸出 {"weight":null,"training":null,"nutrition":null,"wellness":null,"not_a_log":true,"ask":null}`

/**
 * 從回應裡取出文字內容。
 *
 * ⚠️ 不能寫 `content[0]`。Opus 5 回的是 `[thinking, text]` 兩個 block，
 * 取 [0] 會拿到 thinking（`.text` 不存在）→ 空字串 → 解析失敗 → 整則訊息被當成讀不懂。
 * 實測踩到：「練了背 一小時 蠻累的大概8」模型其實正確解出 pull/60/RPE8，
 * 但因為取錯 block 而整個丟掉。
 *
 * repo 裡另外兩支（handleNaturalTraining / handleNaturalNutrition）也寫死 content[0]，
 * 現在用 Haiku 不吐 thinking 所以還沒爆 —— 但只要有人改模型就會**安靜地**全部解析失敗。
 * 所以這支是共用的，三處都走它。
 */
export function textFromContent(content: Array<{ type: string; text?: string }>): string {
  return content.find(c => c.type === 'text')?.text ?? ''
}

/** 從模型回應裡挖出 JSON（模型偶爾會包 markdown 圍欄或加開場白） */
export function extractJSON(raw: string): NLParsed | null {
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return JSON.parse(m[0]) as NLParsed
  } catch {
    return null
  }
}
