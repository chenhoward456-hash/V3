/**
 * workout-parse.ts —— 把「教練手寫的課表文字」解析成 { 動作名, 組數 }
 *
 * ⚠️ 為什麼需要這支：`lib/volume-audit.ts` 已經能把**動作名**對到部位，
 *    但它吃的是結構化的 { name, sets }。真實世界拿到的是一團文字：
 *
 *      DB SP 寬 （主） 3組 8~10下
 *      引體向上*10*2
 *      平胸推6下x4
 *      六角槓硬舉 45×1×10
 *      反手單邊划船*10/10*2
 *      26機械肩膀 12 3
 *
 *    2026-09 連續看了五份外部教練寫的課表，每一份的寫法都不一樣，
 *    而且每一份都是手動轉成陣列才算得出組數——那就是擋住「教練自己貼進來」的東西。
 *
 * 設計原則：
 * · **寧可標成 guess 也不要猜錯**。組數猜錯會讓整份對帳失真，
 *   而對帳的價值就在數字可信。抓不準就標出來讓人自己改。
 * · 純函式、不打 API、不存任何東西。
 */

/** 一行解析出來的結果 */
export interface ParsedExercise {
  /** 原始那一行（保留給 UI 顯示「你貼的是這個」） */
  raw: string
  /** 剝掉數字與註記之後的動作名 */
  name: string
  sets: number
  /**
   * exact = 文字裡有明確的組數寫法（「3組」「8下x4」）
   * guess = 只找到一個孤立數字，依慣例當組數——**要讓使用者看得到並能改**
   */
  confidence: 'exact' | 'guess'
  /** 命中哪一條規則，debug 與測試用 */
  rule: string
  /**
   * 重量（kg）。課表通常沒有，學員回報當天訓練時才有。
   * ⚠️ 抓不到就是 null，不要猜 —— 寧可少一個欄位也不要寫錯的重量進 DB。
   */
  weight: number | null
  /** 每組次數。同上，抓不到回 null。 */
  reps: number | null
}

export interface ParseResult {
  exercises: ParsedExercise[]
  /** 看起來不是動作的行（標題、分隔線、總計、備註） */
  skipped: string[]
}

/** 組數的合理上限。超過這個數的孤立數字不當組數（多半是次數或重量）。 */
export const MAX_PLAUSIBLE_SETS = 10

/** 全形數字/符號 → 半形；統一各種乘號與波浪號 */
export function normalizeLine(raw: string): string {
  return raw
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[×✕✖╳]/g, 'x')
    .replace(/[＊*]/g, '*')
    .replace(/[～〜]/g, '~')
    .replace(/[－—–]/g, '-')
    .replace(/[　\t]+/g, ' ')
    .trim()
}

/**
 * 這些行不是動作。
 * ⚠️ 刻意只擋「明顯是結構」的，不擋看不懂的動作名——
 *    看不懂的交給 volume-audit 去報「沒對到」，那比這裡靜靜吞掉有用。
 */
const STRUCTURAL = [
  /^[-=_*·—]{2,}$/,                       // 分隔線
  /^(共|合計|總計|total)\s*\d+\s*組?/i,    // 「共80組」
  /^#/,                                   // 註解
  /^[>＞]/,                                // 引言
  /^(目標|天數|方向|備註|說明|原則)\s*[:：]/, // 「目標：整體肩補強」
  // ⚠️ 日別標題。真實寫法：「D1:下肢/21組」「Day 2 拉」「第三天 腿」
  //    它同時帶數字跟斜線，looksLikeDayHeader 的「冒號後幾乎只有數字」判不到。
  /^D\d+\s*[:：]/i,
  /^Day\s*\d+/i,
  /^第[一二三四五六七日1-7]天/,
]

/** 「推日：18組 肩6 胸9 手3」這種一整行都是分配摘要的標題 */
function looksLikeDayHeader(s: string): boolean {
  // 冒號前是短標籤、冒號後主要是「部位+數字」的組合
  if (!/[:：]/.test(s)) return false
  const [head, ...rest] = s.split(/[:：]/)
  if (head.trim().length > 12) return false
  const body = rest.join(':')
  // 後半除了數字、組、空白、常見部位字之外幾乎沒別的
  const stripped = body.replace(/[\d\s組肩胸背手腿臀側後前腹核心天]/g, '')
  return stripped.length <= 2
}

/**
 * 抽組數。順序**由具體到模糊**，先命中先贏。
 * ⚠️ 這個順序跟 volume-audit 的 ABBREV 一樣是踩過坑才排出來的：
 *    模糊的規則放前面會把具體的寫法吃掉。
 */
interface SetsHit {
  sets: number
  confidence: 'exact' | 'guess'
  rule: string
  consumed: string
  weight?: number | null
  reps?: number | null
}

function extractSets(s: string): SetsHit | null {
  // ① 明寫「N組」——最沒有歧義
  const m1 = s.match(/(\d+)\s*組/)
  if (m1) return { sets: +m1[1], confidence: 'exact', rule: 'N組', consumed: m1[0] }

  // ② 「8下x4」「10次 × 3」——「下/次」黏在前面那個數，所以後面那個是組數
  const m2 = s.match(/(\d+)\s*[下次]\s*[x*]\s*(\d+)/)
  if (m2) return { sets: +m2[2], reps: +m2[1], confidence: 'exact', rule: '下x組', consumed: m2[0] }

  // ③ 「4x8下」——反過來寫，前面那個是組數
  const m3 = s.match(/(\d+)\s*[x*]\s*(\d+)\s*[下次]/)
  if (m3) return { sets: +m3[1], reps: +m3[2], confidence: 'exact', rule: '組x下', consumed: m3[0] }

  // ④ 三個數 `45x1x10` / `100x5x3` ＝ 重量 × (組數與次數，順序不固定)
  //
  // ⛔ 2026-09-23：這裡原本寫死「重量x組x次」取中間，但健身圈兩種順序都有用：
  //      六角槓硬舉 45x1x10   Howard 的課表 → 45kg、1 組、10 次
  //      深蹲 100x5x3         LINE 既有教學 → 100kg、5 次、3 組
  //    固定取中間的話第二種會把「5 次」讀成 5 組。
  //    → 後兩個數取**較小的當組數**：組數通常個位數、次數通常更大。
  //      45x1x10 → min(1,10)=1 組 ✓   100x5x3 → min(5,3)=3 組 ✓  兩種都對。
  const m4 = s.match(/(\d+(?:\.\d+)?)\s*[x*]\s*(\d+)\s*[x*]\s*(\d+)/)
  if (m4) {
    const a = +m4[2]
    const b = +m4[3]
    const lo = Math.min(a, b)
    return {
      sets: lo,
      weight: +m4[1],
      reps: Math.max(a, b),
      // 兩個一樣大就分不出來（100x8x8），標 guess 讓人自己確認
      confidence: a === b ? 'guess' : 'exact',
      rule: '重量x(組/次)',
      consumed: m4[0],
    }
  }

  // ⑤ 兩個數 `8x3` / `引體向上*10*2`——哪個是組數有歧義。
  //    健身房慣例：組數小、次數大。取較小且 ≤10 的那個。
  const m5 = s.match(/(\d+)\s*[x*]\s*(\d+)/)
  if (m5) {
    const a = +m5[1]
    const b = +m5[2]
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    if (lo <= MAX_PLAUSIBLE_SETS && lo !== hi) {
      return { sets: lo, confidence: 'exact', rule: '兩數取小', consumed: m5[0] }
    }
    if (lo === hi && lo <= MAX_PLAUSIBLE_SETS) {
      return { sets: lo, confidence: 'guess', rule: '兩數相同', consumed: m5[0] }
    }
    return { sets: Math.min(hi, MAX_PLAUSIBLE_SETS), confidence: 'guess', rule: '兩數都大', consumed: m5[0] }
  }

  // ⑥ 行尾一個孤立的小數字：「SA DB RDL 3」「腿推 3」
  // ⚠️ 前面可能不是空白：「反手單邊划船*10/10*2」把 10/10 剝掉後剩下「...* *2」
  const m6 = s.match(/(?:^|[\s*x])(\d+)\s*$/)
  if (m6 && +m6[1] <= MAX_PLAUSIBLE_SETS) {
    return { sets: +m6[1], confidence: 'guess', rule: '行尾孤立數', consumed: m6[0] }
  }

  return null
}

/**
 * 切行。
 * ⚠️ 除了換行，還要處理「一行塞好幾個動作」的寫法：
 *      腿推 3、前蹲 3、SA Lunge 3、SA DB RDL 3
 *    這是真實案例（2026-09 看到的第三份課表就是這樣寫的）。
 *    但只在「每一段都自己帶數字」時才拆——不然
 *    「深蹲、腿推機、腿屈伸」那種純列舉會被拆成三個沒組數的碎片。
 */
export function splitLines(text: string): string[] {
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(/[、，,]/).map((p) => p.trim()).filter(Boolean)
    if (parts.length > 1 && parts.every((p) => /\d/.test(p))) out.push(...parts)
    else out.push(line)
  }
  return out
}

/**
 * 解析整段課表文字。
 *
 * @param text 使用者貼進來的原文
 */
export function parseWorkout(text: string): ParseResult {
  const exercises: ParsedExercise[] = []
  const skipped: string[] = []

  for (const rawLine of splitLines(text ?? '')) {
    const raw = rawLine.trim()
    if (!raw) continue

    const s = normalizeLine(raw)
    if (STRUCTURAL.some((re) => re.test(s)) || looksLikeDayHeader(s)) {
      skipped.push(raw)
      continue
    }

    // ── 先移除「不是組數」的數字，免得它們被誤抓 ──
    let work = s
    // ⚠️ 語氣／時間前綴：學員打的是「今天 硬舉 3組」「剛練完 深蹲 4組」，
    //    不剝掉的話動作名會變成「今天 硬舉」而認不出來。
    //    只剝**行首**且是已知的幾個詞——不要做通用的中文斷詞，那會咬到動作名。
    work = work.replace(/^(?:今天|昨天|剛剛|剛|我|做了|練了|練完|剛練完|做|練)\s*/g, '')
    // 行首的器材編號：「26機械肩膀」「1. 深蹲」「3) 臥推」
    work = work.replace(/^\d+\s*[.、)）]\s*/, '')
    work = work.replace(/^\d+(?=[一-龥A-Za-z])/, '')
    // 括號註記：（主）、(back-off)
    work = work.replace(/[（(][^）)]*[）)]/g, ' ')
    // 次數區間：「8~10下」「12-15」——那是次數不是組數
    work = work.replace(/\d+\s*~\s*\d+\s*[下次]?/g, ' ')
    // 單邊次數：「10/10」
    work = work.replace(/\d+\s*\/\s*\d+/g, ' ')
    // 重量尾巴：「Swing 20kg」「臥推 80公斤 8下4組」
    // ⚠️ 剝掉之前先記下來 —— 學員回報當天訓練時這個是有用的資訊。
    const wm = work.match(/(\d+(?:\.\d+)?)\s*(?:kg|公斤|lb|磅)/i)
    const taggedWeight = wm ? +wm[1] : null
    work = work.replace(/\d+(?:\.\d+)?\s*(?:kg|公斤|lb|磅)/gi, ' ')
    // 次數也獨立抓一次：「臥推 80kg 8下4組」走的是「N組」規則，那條不帶 reps。
    // ⚠️ 要在次數區間（8~10下）被剝掉之後才抓，不然會抓到區間的上限。
    const rm = work.match(/(\d+)\s*[下次]/)
    const taggedReps = rm ? +rm[1] : null

    const hit = extractSets(work)
    if (!hit) {
      skipped.push(raw)
      continue
    }

    // 動作名 = 剝掉組數那段與所有殘餘數字符號之後剩下的
    const name = work
      .replace(hit.consumed, ' ')
      .replace(/[\d]+\s*[下次組]/g, ' ')
      .replace(/[x*~\-–—]/g, ' ')
      .replace(/\d+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()

    if (!name || name.length < 2) {
      skipped.push(raw)
      continue
    }

    exercises.push({
      raw,
      name,
      sets: hit.sets,
      confidence: hit.confidence,
      rule: hit.rule,
      weight: hit.weight ?? taggedWeight ?? null,
      reps: hit.reps ?? taggedReps ?? null,
    })
  }

  return { exercises, skipped }
}

/** 給 volume-audit 用的形狀（它吃「一列一組」） */
export function toSetRows(exercises: ParsedExercise[]): Array<{ exercise_name: string }> {
  return exercises.flatMap((e) => Array.from({ length: e.sets }, () => ({ exercise_name: e.name })))
}
