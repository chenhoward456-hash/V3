/**
 * 補品指徵對帳器（Supplement Indication Audit）
 *
 * 給一個補品 + 這位學員的血檢/基因，判斷「這位學員有沒有吃這個的指徵」。
 * 本質是 supplement-engine 的反向：引擎是「依數據推薦」，這裡是「依數據回頭查核已開的單」。
 *
 * 動機：補品 protocol 是人工填的、繞過引擎，過去會把某人的單複製給沒有對應數據的人
 *（謝佳峻案例：把陳胤豪的 D3/Zinc/雙TMG 搬過去，但他維生素D已頂尖、T正常、沒驗MTHFR）。
 *
 * 維護原則：新增補品就在 RULES 加一條；判斷一律從學員「自己的」血檢/基因走，別假設範本。
 */

import { TOTAL_TESTOSTERONE_KEYWORDS, TOTAL_TESTOSTERONE_EXCLUDE } from '@/utils/labMatch'
import { LAB_THRESHOLDS, LAB_OPTIMAL_RANGES } from '@/utils/labStatus'
import { MEDICATION_EFFECTS, activeMedications, type ClientMedication } from '@/lib/medication-effects'

// 判斷線一律跟標準檔（utils/labStatus.ts）走，別在這裡另寫一套數字（2026-10-03：同半胱胺酸這裡原本寫 ≥10，標準檔正常上限是 8）
const HCY_NORMAL_MAX = (LAB_THRESHOLDS['同半胱胺酸'] as { normal: number }).normal
const FERRITIN_OPTIMAL = LAB_OPTIMAL_RANGES['鐵蛋白'] as { min: number; max: number }

export type IndicationStatus = 'indicated' | 'lifestyle' | 'no-indication' | 'caution'

export type IndicationVerdict = {
  status: IndicationStatus
  basis: string // 一句話說明為什麼（給教練看）
}

export type AuditLab = { test_name: string; value: string | number | null; status?: string | null; date?: string | null }
export type AuditGenetics = { gene_mthfr?: string | null; gene_apoe?: string | null }

function toNum(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

type LabHit = { value: number | null; status?: string | null }

/** 從 labs 取符合任一關鍵字、且日期最新的一筆（排除 exclude 關鍵字，避免 游離/生物可利用 睪固酮 誤配）。 */
function makeLabFinder(labs: AuditLab[]) {
  return (keywords: string[], exclude: string[] = []): LabHit | null => {
    const matches = labs.filter(l => {
      const n = (l.test_name || '').toLowerCase()
      if (exclude.some(e => n.includes(e.toLowerCase()))) return false
      return keywords.some(k => n.includes(k.toLowerCase()))
    })
    if (matches.length === 0) return null
    matches.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
    return { value: toNum(matches[0].value), status: matches[0].status }
  }
}

type Ctx = {
  lab: ReturnType<typeof makeLabFinder>
  gene_mthfr?: string | null
  gene_apoe?: string | null
  /** 正在吃的藥（已過濾成 today 還在吃的） */
  meds: ClientMedication[]
  /** 正規化後的補品名（同一條規則要分 TMG／B 群時用） */
  name: string
}

const normalMax = (name: string): number | null => {
  const t = (LAB_THRESHOLDS as Record<string, { normal: number | { min: number; max: number } }>)[name]
  if (!t) return null
  return typeof t.normal === 'object' ? t.normal.max : t.normal
}

const ok = (basis: string): IndicationVerdict => ({ status: 'indicated', basis })
const life = (basis: string): IndicationVerdict => ({ status: 'lifestyle', basis })
const none = (basis: string): IndicationVerdict => ({ status: 'no-indication', basis })
const warn = (basis: string): IndicationVerdict => ({ status: 'caution', basis })

const RULES: { match: string[]; evaluate: (c: Ctx) => IndicationVerdict }[] = [
  {
    // ⚠️ 放第一條：「ashwagandha」字串裡有「dha」，排在魚油後面會被魚油規則先吃掉
    match: ['南非醉茄', '南非', 'ashwagandha', 'withania'],
    // 膽汁滯留型肝損傷病例系列（PMID 31991029、37756041）：正在吃會動肝的藥、或肝指數已超標 → 先暫停
    evaluate: (c) => {
      const liverMed = c.meds.map(m => MEDICATION_EFFECTS[m.key]).find(e => e?.liver)
      if (liverMed) return warn(`正在吃${liverMed.label}（會動肝指數），南非醉茄有肝損傷病例報告（PMID 31991029）→ 療程中先暫停`)
      const alt = c.lab(['alt', 'gpt']); const ast = c.lab(['ast', 'got'])
      const altMax = normalMax('ALT'); const astMax = normalMax('AST')
      if ((alt?.value != null && altMax != null && alt.value > altMax) || (ast?.value != null && astMax != null && ast.value > astMax)) {
        return warn('肝指數已超出正常，南非醉茄有肝損傷病例報告（PMID 31991029）→ 先暫停，肝指數回來再說')
      }
      return life('壓力/睡眠（生活型）；少數有肝損傷病例，肝指數要一起追')
    },
  },
  {
    match: ['肌酸', 'creatine'],
    evaluate: (c) => {
      const egfr = c.lab(['egfr', '腎絲球'])
      if (egfr?.value != null && egfr.value < 60) return warn(`eGFR ${egfr.value} <60，肌酸會墊高肌酸酐，建議先確認腎功能`)
      return life('增肌證據最強的補品（非血檢指徵）；會讓肌酸酐升、eGFR 算低（RCT PMID 32670557），腎功能看 Cystatin C 才準')
    },
  },
  {
    match: ['魚油', 'omega', 'fish oil', 'dha', 'epa', 'fishoil'],
    evaluate: (c) => {
      const hits: string[] = []
      const lpa = c.lab(['lp(a)', 'lpa', '脂蛋白'])
      const apob = c.lab(['apob', 'apo b'])
      const ldl = c.lab(['ldl', '低密度'])
      const tg = c.lab(['三酸甘油', 'triglyc'])
      const crp = c.lab(['crp', '發炎'])
      if (lpa?.value != null && lpa.value >= 30) hits.push(`Lp(a) ${lpa.value} 偏高`)
      if (apob?.value != null && apob.value > 80) hits.push(`ApoB ${apob.value} 偏高`)
      if (ldl?.value != null && ldl.value > 130) hits.push(`LDL ${ldl.value} 偏高`)
      if (tg?.value != null && tg.value > 150) hits.push(`三酸甘油酯 ${tg.value} 偏高`)
      if (crp?.value != null && crp.value > 3) hits.push(`CRP ${crp.value} 偏高`)
      return hits.length ? ok(hits.join('、') + ' → 心血管/抗發炎') : life('一般抗發炎（血脂正常，無特定指徵）')
    },
  },
  {
    match: ['櫻桃', 'tart cherry', 'cherry'],
    evaluate: (c) => {
      const ua = c.lab(['尿酸', 'uric'])
      if (ua?.value != null && ua.value > 7) return ok(`尿酸 ${ua.value} 偏高 → 降尿酸`)
      return none('尿酸正常或無資料，降尿酸指徵不足')
    },
  },
  {
    match: ['vitamin c', 'vitaminc', '維生素c', '維他命c', 'vitc', 'vit c', '抗壞血酸'],
    evaluate: (c) => {
      const hits: string[] = []
      const ua = c.lab(['尿酸', 'uric'])
      const wbc = c.lab(['白血球', 'wbc', '白細胞'])
      // 維生素 C 會增加非血基質鐵的吸收：鐵蛋白已經高於理想上限時，提醒跟含鐵的正餐錯開
      const fer = c.lab(['鐵蛋白', 'ferritin'])
      if (fer?.value != null && fer.value > FERRITIN_OPTIMAL.max) return warn(`鐵蛋白 ${fer.value} 高於理想 ${FERRITIN_OPTIMAL.min}-${FERRITIN_OPTIMAL.max}，維生素 C 會增加鐵吸收 → 跟正餐（尤其紅肉）錯開吃，或先停到下次抽血`)
      if (ua?.value != null && ua.value > 7) hits.push(`尿酸 ${ua.value} 偏高`)
      if (wbc?.value != null && wbc.value < 4000) hits.push(`白血球 ${wbc.value} 偏低`)
      return hits.length ? ok(hits.join('、')) : life('一般免疫（無特定血檢指徵）')
    },
  },
  {
    match: ['zinc', '鋅'],
    evaluate: (c) => {
      const hits: string[] = []
      const wbc = c.lab(['白血球', 'wbc', '白細胞'])
      const t = c.lab(TOTAL_TESTOSTERONE_KEYWORDS, TOTAL_TESTOSTERONE_EXCLUDE)
      if (wbc?.value != null && wbc.value < 4000) hits.push(`白血球 ${wbc.value} 偏低（免疫）`)
      if (t?.value != null && t.value < 400) hits.push(`睪固酮 ${t.value} 偏低`)
      if (hits.length) return ok(hits.join('、'))
      return none('白血球/睪固酮正常，免疫或 T support 指徵不足；長期高劑量留意壓銅')
    },
  },
  {
    match: ['tmg', 'betaine', 'trimethyl', 'b群', 'b 群', 'b-complex', 'b complex', '甲基', '葉酸', 'folate', 'methyl'],
    evaluate: (c) => {
      const hits: string[] = []
      const hcy = c.lab(['同半胱胺酸', 'homocyst'])
      const mthfr = c.gene_mthfr
      if (hcy?.value != null && hcy.value > HCY_NORMAL_MAX) hits.push(`同半胱胺酸 ${hcy.value} 偏高（正常 ≤${HCY_NORMAL_MAX}）`)
      if (mthfr && /hetero|homo|variant|突變|\bt\/t\b|\bc\/t\b|\+/i.test(mthfr)) hits.push(`MTHFR ${mthfr}`)
      // 甜菜鹼（TMG）≥4 g/天 LDL 平均 +10 mg/dL（統合分析 PMID 33764214）：LDL 已超標就改「要注意」
      const isTmg = /tmg|betaine|trimethyl/.test(c.name)
      const ldl = c.lab(['ldl', '低密度'])
      const ldlMax = normalMax('LDL-C')
      if (isTmg && hits.length && ldl?.value != null && ldlMax != null && ldl.value > ldlMax) return warn(`${hits.join('、')}，但 LDL ${ldl.value} 已超標；TMG ≥4 g/天會再拉高 LDL（PMID 33764214）→ 減量或改用活性 B 群`)
      if (hits.length) return ok(hits.join('、') + ' → 甲基化' + (isTmg ? '；TMG 早晚合計每天 <4 g（≥4 g 會升 LDL，PMID 33764214）' : ''))
      if (hcy?.value != null) return none(`同半胱胺酸 ${hcy.value} 正常、無 MTHFR 變異資料 → 甲基化指徵不足`)
      return none('無同半胱胺酸/MTHFR 資料 → 無法確認甲基化指徵（劑量勿照他人複製）')
    },
  },
  {
    match: ['dim', '二吲哚', 'diindolyl'],
    evaluate: (c) => {
      const e2 = c.lab(['雌二醇', 'estradiol', 'e2'])
      if (e2?.value != null && (e2.status === 'attention' || e2.status === 'alert' || e2.value > 40)) return ok(`雌二醇 ${e2.value} 偏高 → 降 E2`)
      return none('雌二醇正常或無資料，降 E2 指徵不足')
    },
  },
  {
    match: ['維生素d', 'vitamin d', 'd3', 'd3k2', 'vit d', 'vitd'],
    evaluate: (c) => {
      const d = c.lab(['維生素d', 'vitamin d', '25-oh', '25(oh)'])
      if (d?.value == null) return none('無維生素D資料')
      if (d.value < 50) return ok(`維生素D ${d.value} 偏低 → 補充`)
      if (d.value > 70) return warn(`維生素D ${d.value} 已偏高，補 D 指徵不足（K2 想留可另計）`)
      return life(`維生素D ${d.value} 尚可，維持即可`)
    },
  },
  {
    match: ['鐵', 'iron', 'ferrous', 'ferric'],
    evaluate: (c) => {
      const fer = c.lab(['鐵蛋白', 'ferritin'])
      if (fer?.value == null) return none('無鐵蛋白資料，補鐵前建議先驗')
      if (fer.value > 300) return warn(`鐵蛋白 ${fer.value} 偏高 → 不建議補鐵`)
      if (fer.value < 30) return ok(`鐵蛋白 ${fer.value} 偏低 → 缺鐵`)
      return none(`鐵蛋白 ${fer.value} 正常，補鐵指徵不足`)
    },
  },
  {
    match: ['鎂', 'magnesium'],
    evaluate: (c) => {
      const egfr = c.lab(['egfr', '腎絲球'])
      if (egfr?.value != null && egfr.value < 60) return warn(`eGFR ${egfr.value} <60，鎂由腎排除，劑量留意`)
      return life('恢復/睡眠（通用，通常安全）')
    },
  },
  {
    match: ['茶氨酸', 'theanine', 'l-theanine', '甘胺酸', 'glycine', '褪黑'],
    evaluate: () => life('壓力/睡眠（生活型，通常非血檢指徵）'),
  },
  {
    match: ['維生素a', '維他命a', 'vitamin a', 'vitamina', 'retinol', '視黃醇', '魚肝油', 'cod liver'],
    evaluate: () => none('血檢看不出要補維生素 A；過量有毒，別長期高劑量'),
  },
  {
    match: ['carnitine', '肉鹼', 'l-carnitine'],
    // Howard 標準（memory project_v3_supplement_standards #2）：2020 後統合分析，吃肉的健康成人補充沒有額外好處
    evaluate: () => none('有吃肉的健康成人補充沒有額外好處；主要是素食或年長的人才需要'),
  },
]

/** 對單一補品做指徵對帳。 */
export function auditSupplement(
  name: string,
  labs: AuditLab[],
  genetics?: AuditGenetics,
  opts: { medications?: ClientMedication[] | null; today?: string } = {},
): IndicationVerdict {
  // NFKC：學員手打常是全形（「ＴＭＧ」「Ｌcarnitine」「活性Ｂ群」），不轉就一條規則都對不到
  const n = (name || '').normalize('NFKC').toLowerCase().trim()
  if (!n) return none('未命名')
  const meds = activeMedications(opts.medications, opts.today)
  // 服藥期間不能疊加的補品，優先於一般規則
  for (const m of meds) {
    for (const a of MEDICATION_EFFECTS[m.key]?.avoid ?? []) {
      if (a.match.some(k => n.includes(k))) return warn(a.why)
    }
  }
  const ctx: Ctx = { lab: makeLabFinder(labs || []), gene_mthfr: genetics?.gene_mthfr, gene_apoe: genetics?.gene_apoe, meds, name: n }
  for (const rule of RULES) {
    if (rule.match.some(m => n.includes(m.toLowerCase()))) return rule.evaluate(ctx)
  }
  return none('無對應規則 → 請人工判斷指徵')
}

// ── 吃了有沒有效（2026-10-03）──
// 補品跟它要改善的那項血檢：開始吃之前最後一次 vs 開始吃之後最新一次。
const EFFECT_MARKERS: { match: string[]; marker: string; keywords: string[] }[] = [
  { match: ['tmg', 'betaine', 'b群', 'b 群', 'b-complex', 'b complex', '甲基', '葉酸', 'folate', 'methyl'], marker: '同半胱胺酸', keywords: ['同半胱胺酸', 'homocyst'] },
  { match: ['dim', '二吲哚', 'diindolyl'], marker: '雌二醇', keywords: ['雌二醇', 'estradiol'] },
  { match: ['維生素d', 'vitamin d', 'd3', 'd3k2', 'vit d', 'vitd'], marker: '維生素D', keywords: ['維生素d', 'vitamin d', '25-oh', '25(oh)'] },
  { match: ['魚油', 'omega', 'fish oil', 'fishoil'], marker: '三酸甘油酯', keywords: ['三酸甘油', 'triglyc'] },
  { match: ['鐵', 'iron', 'ferrous', 'ferric'], marker: '鐵蛋白', keywords: ['鐵蛋白', 'ferritin'] },
]

export interface SupplementEffect {
  marker: string
  before: { value: number; date: string } | null
  after: { value: number; date: string } | null
}

/** 這個補品對應的血檢在開始吃前後的值；沒有對應指標、或沒有開始日期就回 null */
export function supplementEffect(name: string, labs: AuditLab[], startedAt: string | null | undefined): SupplementEffect | null {
  if (!startedAt) return null
  const n = (name || '').normalize('NFKC').toLowerCase().trim()
  const def = EFFECT_MARKERS.find(d => d.match.some(m => n.includes(m)))
  if (!def) return null
  const points = (labs || [])
    .filter(l => l.date && def.keywords.some(k => (l.test_name || '').toLowerCase().includes(k)))
    .map(l => ({ value: toNum(l.value), date: String(l.date) }))
    .filter((p): p is { value: number; date: string } => p.value != null)
    .sort((a, b) => a.date.localeCompare(b.date))
  const before = [...points].reverse().find(p => p.date < startedAt) ?? null
  const after = [...points].reverse().find(p => p.date >= startedAt) ?? null
  return { marker: def.marker, before, after }
}
