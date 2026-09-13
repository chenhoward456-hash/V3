/**
 * 血檢開單：**減法引擎**。
 *
 * ## 為什麼有這支（2026-09-13）
 *
 * Howard：「我根本不知道我到底要驗什麼，很不智能」→ 我手做了一份清單給他 →
 * 「太貴了，乾，沒錢啦」→「重點是還是沒有解決，我還是只能問你啊。那系統存在的意義是什麼？」
 *
 * 他是對的。系統原本只做了加法：`lab_panel_templates` 有 4 份公版，
 * `/api/admin/push-lab-recommendation` 會把公版整包推給你 —— 男生目標導向那份是
 * **加驗 6,870 ＋ 底盤 3,600 ＝ 11,970**，不管你是誰、上次驗了什麼。
 *
 * **列出「所有該驗的」很簡單，列出「你還不知道的」才是價值。** 這支做的是後者。
 *
 * ## 四種「不用花這筆錢」
 *
 *   1. `genetic-once` 基因型驗過了 —— Lp(a)/APOE/MTHFR 一輩子不變，重抽不會有新資訊
 *   2. `derivable`    算得出來 —— 游離睪固酮＝總T＋SHBG＋白蛋白（見 lib/lab-derive.ts，
 *                      拿 Howard 自己的舊資料驗過誤差 2–5%）
 *   3. `recent-optimal` 最近驗過而且在最佳範圍 —— 三個月前才驗過 59 的維生素 D，
 *                      這次驗完動作還是「把劑量降下來」，那這 700 元沒有買到決策
 *   4. `deferred`     要等上游結果 —— B12／葉酸只有在「同半胱胺酸沒下來」時才問得出東西。
 *                      先驗上游（250），不好再驗下游（1,200），不是兩層一起開
 *
 * ## 三個桶子，不是一份清單
 *
 * 這是預算分層的來源，也是 Howard 真正要的東西：
 *   - **必開**：有已知異常要追（follow-up），加上被別的項目需要的輸入（companion）
 *   - **可延後**：從沒驗過／太久沒驗，但**沒有已知問題**——純基準線，晚三個月驗不會怎樣
 *   - **不用開**：上面四種
 *
 * ⚠️ 這支不做臨床判斷，只做「這筆錢有沒有買到新資訊」。
 * 有症狀、有臨床理由要驗的東西，教練自己加，引擎不該擋。
 */

import { getLabCanonicalId } from '@/utils/labMatch'
import { calculateLabStatus, isInOptimalRange, getOptimalRangeText } from '@/utils/labStatus'
import { isGeneticOnce } from './lab-due'
import { DERIVABLE_MARKERS } from './lab-derive'
import type { LabResultRow } from './lab-trend-analyzer'
import { DAY_MS } from './date-utils'

/**
 * 「最近驗過」的門檻（天）。
 * 180 天≈半年：短於這個、而且值在最佳範圍，再驗一次通常不會改變任何動作。
 */
export const RECENT_DAYS = 180

/**
 * 下游診斷項目 → 要先看的上游項目。
 *
 * 邏輯是「先驗上游，結果不好再驗下游」，不是兩層一起開。
 * ⚠️ 代價要講清楚：上游真的不好時要**再跑一趟抽血**。急著一次問完的人可以自己加回去。
 */
export const CONDITIONAL_ON: Record<string, { upstream: string; why: string }> = {
  prolactin: {
    upstream: 'testosterone',
    why: '高泌乳素會壓睪固酮，但總睪固酮回到正常就不用問原因',
  },
  dheas: {
    upstream: 'testosterone',
    why: '上游類固醇，總睪固酮正常時驗它問不出東西',
  },
  vitamin_b12: {
    upstream: 'homocysteine',
    why: '只有在同半胱胺酸沒下來時，才需要分辨「補了沒吸收」還是「補得不夠」',
  },
  folate: {
    upstream: 'homocysteine',
    why: '同上，配同半胱胺酸才有意義',
  },
}

/** 一般健檢底盤會涵蓋的常規項目（用來判斷底盤套餐值不值得再開一次） */
const ROUTINE_MARKERS = [
  'alt', 'ast', 'total_cholesterol', 'triglyceride', 'ldl', 'hdl',
  'creatinine', 'fasting_glucose', 'hemoglobin', 'wbc', 'platelet',
]

export type OrderRule =
  | 'follow-up' | 'companion' | 'never-tested' | 'stale'
  | 'genetic-once' | 'derivable' | 'recent-optimal' | 'deferred'

export type Bucket = 'must' | 'defer' | 'skip'

export type LabOrderLine = {
  /** 顯示用名字：優先用公版的寫法，公版沒有就用 canonical 中文 */
  label: string
  canonicalId: string | null
  price: number | null
  rule: OrderRule
  bucket: Bucket
  /** 一句話講為什麼開／為什麼不開 */
  why: string
}

export type LabOrderPlan = {
  /** 必開 */
  must: LabOrderLine[]
  /** 可延後（純基準線） */
  defer: LabOrderLine[]
  /** 不用開 */
  skip: LabOrderLine[]
  /** 必開小計（只算已知價格的） */
  mustCost: number
  /** 必開＋可延後小計 */
  fullCost: number
  /** 公版 must 全開的價格（對照組） */
  templateCost: number
  /** 有幾項價格不明（公版沒列，開單時要自己問） */
  unknownPriceCount: number
  /** 底盤套餐要不要再開一次 */
  basePackage: {
    price: number | null
    /** 常規項目最近一次日期 */
    lastRoutineDate: string | null
    skippable: boolean
    why: string
  }
}

export type TemplateItem = {
  name: string
  price?: number | null
  priority?: string | null
  why?: string | null
}

export type BuildLabOrderInput = {
  labs: LabResultRow[]
  /** lab_panel_templates 的 add_on_items */
  templateItems: TemplateItem[]
  /** lab_panel_templates.base_price */
  basePrice?: number | null
  gender?: '男性' | '女性'
  /** 台灣日 YYYY-MM-DD */
  today: string
}

type HistoryEntry = {
  value: number
  date: string
  daysAgo: number
  isNormal: boolean
  inOptimal: boolean
  optimalText: string | null
  canonicalName: string
}

/**
 * 把公版那種「Testosterone 總睪固酮」「Apo B (外送大安聯合)」對回 canonical ID。
 *
 * `getLabCanonicalId` 是整串精確查表，這種混寫一律查不到。
 * 作法：先砍掉括號註記，再由長到短試所有連續詞組 —— 「Apo B」查得到、「Apo」查不到。
 */
export function resolveMarkerId(raw: string): string | null {
  const cleaned = raw.replace(/[（(][^）)]*[）)]/g, ' ').trim()
  const direct = getLabCanonicalId(cleaned) ?? getLabCanonicalId(raw)
  if (direct) return direct

  const tokens = cleaned.split(/\s+/).filter(Boolean)
  for (let len = tokens.length; len >= 1; len--) {
    for (let i = 0; i + len <= tokens.length; i++) {
      const id = getLabCanonicalId(tokens.slice(i, i + len).join(' '))
      if (id) return id
    }
  }
  return null
}

function buildHistory(labs: LabResultRow[], gender: '男性' | '女性' | undefined, today: string) {
  const hist = new Map<string, HistoryEntry>()
  for (const l of labs) {
    const id = getLabCanonicalId(l.test_name)
    if (!id) continue
    const value = typeof l.value === 'string' ? parseFloat(l.value) : l.value
    if (!Number.isFinite(value)) continue
    const prev = hist.get(id)
    if (prev && prev.date >= l.date) continue
    hist.set(id, {
      value,
      date: l.date,
      daysAgo: Math.round((Date.parse(today) - Date.parse(l.date)) / DAY_MS),
      // 紅線 4：DB 的 status 不是真相，一律用 labStatus 重算
      isNormal: calculateLabStatus(l.test_name, value, gender) === 'normal',
      inOptimal: isInOptimalRange(l.test_name, value, gender),
      optimalText: getOptimalRangeText(l.test_name, gender),
      canonicalName: l.test_name,
    })
  }
  return hist
}

/** 這次開單要花的錢，只算得出來的那些 */
function sum(lines: LabOrderLine[]): number {
  return lines.reduce((s, l) => s + (l.price ?? 0), 0)
}

export function buildLabOrder(input: BuildLabOrderInput): LabOrderPlan {
  const { labs, templateItems, basePrice, gender, today } = input
  const hist = buildHistory(labs, gender, today)

  const templateCost = templateItems
    .filter(t => (t.priority ?? 'must') === 'must')
    .reduce((s, t) => s + (t.price ?? 0), 0)

  // ── 第一輪：公版的每個 must 項目該不該開 ──
  const lines: LabOrderLine[] = []
  const byId = new Map<string, LabOrderLine>()

  for (const t of templateItems) {
    if ((t.priority ?? 'must') !== 'must') continue
    const id = resolveMarkerId(t.name)
    const h = id ? hist.get(id) : undefined
    const price = t.price ?? null

    const push = (rule: OrderRule, bucket: Bucket, why: string) => {
      const line: LabOrderLine = { label: t.name, canonicalId: id, price, rule, bucket, why }
      lines.push(line)
      if (id) byId.set(id, line)
    }

    // 1. 基因型驗過了 → 終身不用再驗
    if (h && isGeneticOnce(h.canonicalName)) {
      push('genetic-once', 'skip', `基因型，${h.date} 驗過 ${h.value}，一輩子不會變`)
      continue
    }
    // 2. 最近驗過而且在最佳範圍 → 再驗不會改變動作
    //
    // ⚠️ 一定要先確認「真的有定義最佳區間」。`isInOptimalRange()` 對沒定義的項目
    // 一律回 true（語意是「正常即可」）——直接拿來當跳過的理由，會把
    // 游離睪固酮這種**刻意不設目標、只看趨勢**的指標判成「驗完動作一樣」。
    // Howard 的游離 T 從 123 腰斬到 72.8，那正是最該再驗的東西。
    // （同一個坑 timeline/page.tsx 的「最佳」綠標踩過一次。）
    if (h && h.daysAgo <= RECENT_DAYS && h.isNormal && h.inOptimal && h.optimalText) {
      push('recent-optimal', 'skip',
        `${h.daysAgo} 天前驗過 ${h.value}${h.optimalText ? `（最佳 ${h.optimalText}）` : ''}，驗完動作一樣`)
      continue
    }
    // 3. 從沒驗過 → 沒有已知問題，屬基準線
    if (!h) {
      push('never-tested', 'defer', '從沒驗過，是基準線不是追蹤，沒錢可以晚一輪')
      continue
    }
    // 4. 上次不在標準或最佳範圍 → 這次要追
    if (!h.isNormal || !h.inOptimal) {
      push('follow-up', 'must',
        `上次 ${h.value}${h.optimalText ? `（最佳 ${h.optimalText}）` : ''}，${h.date} 驗的，要看有沒有動`)
      continue
    }
    // 5. 正常但太久沒驗 → 基準線
    push('stale', 'defer', `上次 ${h.value} 正常，但已經 ${h.daysAgo} 天，沒錢可以晚一輪`)
  }

  // ── 第二輪：算得出來的，改成不用驗；並把它需要的輸入補進來 ──
  //
  // ⚠️ **只有在輸入是分開賣的時候，「用算的」才真的省到錢。**
  // 公版的「HOMA-IR (Insulin + Glucose) 470」那一筆**本身就是胰島素＋血糖**，
  // 把它劃掉再去單點兩個輸入，省下的是帳面上的 470、實際要付的一模一樣
  // ——那是假省錢，比不省更糟，因為它看起來像個決定。
  // 判準：輸入裡**至少有一項在公版自己有獨立一行**（或手上已有夠新的值），
  // 才代表這一行跟輸入是兩件商品。總睪固酮有獨立一行 → 游離睪固酮算得出來 ✅
  // 胰島素／血糖都沒有獨立一行 → 那 470 就是套裝，照開 ❌
  const needed = new Map<string, string>()   // 輸入 canonicalId → 誰要用它
  for (const line of lines) {
    if (line.bucket === 'skip' || !line.canonicalId) continue
    const d = DERIVABLE_MARKERS[line.canonicalId]
    if (!d) continue

    const separatelySold = d.from.some(f => {
      const own = byId.get(f)
      if (own && own.canonicalId !== line.canonicalId) return true
      const h = hist.get(f)
      return !!h && h.daysAgo <= RECENT_DAYS
    })
    if (!separatelySold) continue   // 這一行就是套裝本身，照開

    line.rule = 'derivable'
    line.bucket = 'skip'
    line.why = `${d.method}，不用另外驗（${d.source}）`
    d.from.forEach(f => { if (!needed.has(f)) needed.set(f, line.label) })
  }

  // 缺哪個輸入就補哪個 —— 公版漏了 SHBG，而游離／生物可利用睪固酮都要它
  //
  // ⚠️ **同一個計算式的輸入必須是同一管血抽的。**
  // 一開始我在這裡寫了「手上已經有 180 天內的值就不用再驗」，那是錯的：
  // 拿這次新抽的總睪固酮去配 177 天前的 SHBG，算出來的游離睪固酮是垃圾——
  // 而 SHBG 正是 Howard 身上變最多的那一個（24.4→38.4，+57%，他游離 T 腰斬的主因）。
  // 所以規則是：**只要有任何一個輸入這次要驗，其餘輸入全部一起驗**；
  // 一個都不驗的話（全部都夠新），那就整組沿用舊的，也不用補。
  const anyInputOrdered = (from: string[]) =>
    from.some(f => { const l = byId.get(f); return !!l && l.bucket !== 'skip' })

  for (const [id, requiredBy] of needed) {
    const derivation = Object.values(DERIVABLE_MARKERS).find(d => d.from.includes(id))
    if (derivation && !anyInputOrdered(derivation.from)) continue

    const existing = byId.get(id)
    if (existing) {
      if (existing.bucket === 'defer') {
        existing.bucket = 'must'
        existing.rule = 'companion'
        existing.why = `${existing.why}；而且要用它算出${requiredBy}`
      }
      continue
    }
    const line: LabOrderLine = {
      label: CANONICAL_LABEL[id] ?? id,
      canonicalId: id,
      price: null,
      rule: 'companion',
      bucket: 'must',
      why: hist.has(id)
        ? `公版漏了這項。上次是 ${hist.get(id)!.date} 的 ${hist.get(id)!.value}，但要跟總睪固酮同一管血才算得準${requiredBy ? `（用來算${requiredBy}）` : ''}`
        : `公版漏了這項，但少了它算不出${requiredBy}`,
    }
    lines.push(line)
    byId.set(id, line)
  }

  // ── 第三輪：上游還沒有結果的，下游先不要開 ──
  for (const line of lines) {
    if (line.bucket === 'skip' || !line.canonicalId) continue
    const cond = CONDITIONAL_ON[line.canonicalId]
    if (!cond) continue
    const upstream = byId.get(cond.upstream)
    if (upstream && upstream.bucket !== 'skip') {
      line.rule = 'deferred'
      line.bucket = 'skip'
      line.why = `先看${CANONICAL_LABEL[cond.upstream] ?? cond.upstream}的結果 —— ${cond.why}`
    }
  }

  const must = lines.filter(l => l.bucket === 'must')
  const defer = lines.filter(l => l.bucket === 'defer')
  const skip = lines.filter(l => l.bucket === 'skip')

  // ── 底盤套餐還要不要再開一次 ──
  const routineDates = ROUTINE_MARKERS.map(m => hist.get(m)).filter(Boolean) as HistoryEntry[]
  const lastRoutine = routineDates.length
    ? routineDates.reduce((a, b) => (a.date > b.date ? a : b))
    : null
  const routineFresh = !!lastRoutine && lastRoutine.daysAgo <= RECENT_DAYS
  const routineClean = routineDates.filter(r => r.daysAgo <= RECENT_DAYS).every(r => r.isNormal)

  return {
    must, defer, skip,
    mustCost: sum(must),
    fullCost: sum(must) + sum(defer),
    templateCost,
    unknownPriceCount: [...must, ...defer].filter(l => l.price == null).length,
    basePackage: {
      price: basePrice ?? null,
      lastRoutineDate: lastRoutine?.date ?? null,
      skippable: routineFresh && routineClean,
      why: !lastRoutine
        ? '沒有常規項目紀錄，底盤該開'
        : routineFresh && routineClean
          ? `肝腎血脂血糖 ${lastRoutine.date} 才驗過而且都正常，底盤可以不開、直接開單項`
          : routineFresh
            ? `${lastRoutine.date} 驗過但有項目不正常，底盤值得再開一次`
            : `常規項目上次是 ${lastRoutine.date}（${lastRoutine.daysAgo} 天前），底盤該開`,
    },
  }
}

/** canonical ID → 中文顯示名（只給引擎自己補進來的項目用） */
const CANONICAL_LABEL: Record<string, string> = {
  testosterone: '總睪固酮',
  shbg: 'SHBG（性荷爾蒙結合球蛋白）',
  albumin: '白蛋白',
  fasting_insulin: '空腹胰島素',
  fasting_glucose: '空腹血糖',
  homocysteine: '同半胱胺酸',
}
