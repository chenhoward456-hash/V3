/**
 * 補品建議庫 — Howard Protocol 常用補品 + 預設劑量 + 教練 rationale 起手式。
 * 用於教練後台新增補品時的 typeahead + 「套用建議」按鈕。
 *
 * 所有劑量都是「文獻常用範圍」，不是處方。教練選用後仍需根據學員血檢數據調整。
 */

export interface SupplementSuggestion {
  name: string
  dosage: string
  timing: string  // 對應 admin UI select 選項
  rationaleStarter: string  // 預填到 coach_rationale 的提示文字
  targetMarkers: string[]   // 對應哪些血檢指標
  category: string
}

export const SUPPLEMENT_CATALOG: SupplementSuggestion[] = [
  // ── 心血管 / 血脂 ──
  {
    name: 'Omega-3 EPA/DHA',
    dosage: '2-3 g/日',
    timing: '早餐',
    rationaleStarter: '降三酸甘油酯、抗發炎、支持心血管。對 ApoB、hsCRP 都有幫助。',
    targetMarkers: ['三酸甘油酯', 'hs-CRP', 'ApoB'],
    category: '心血管',
  },
  {
    name: 'Bergamot Extract',
    dosage: '500-1000 mg/日',
    timing: '晚餐',
    rationaleStarter: '柑橘類黃酮，文獻顯示對降 LDL-C、ApoB 有幫助。',
    targetMarkers: ['LDL-C', 'ApoB', '三酸甘油酯'],
    category: '心血管',
  },
  {
    name: 'CoQ10 (Ubiquinol)',
    dosage: '100-200 mg/日',
    timing: '早餐',
    rationaleStarter: '粒線體功能、抗氧化。若有服用 statin 類藥物建議補充。',
    targetMarkers: ['LDL-C'],
    category: '心血管',
  },

  // ── 代謝 / 血糖 ──
  {
    name: 'Berberine',
    dosage: '500 mg × 2-3次/日',
    timing: '早餐',
    rationaleStarter: '對 HbA1c、空腹血糖、胰島素敏感性有支持作用。文獻劑量 1500 mg/日分次服用。',
    targetMarkers: ['HbA1c', '空腹血糖', '空腹胰島素', 'HOMA-IR'],
    category: '代謝',
  },
  {
    name: 'Alpha-Lipoic Acid',
    dosage: '300-600 mg/日',
    timing: '早餐',
    rationaleStarter: '抗氧化 + 血糖控制輔助。空腹服用吸收較好。',
    targetMarkers: ['HbA1c', '空腹血糖'],
    category: '代謝',
  },

  // ── 微量營養素 ──
  {
    name: '維生素 D3',
    dosage: '4000-5000 IU/日',
    timing: '早餐',
    rationaleStarter: '與油脂同時服用吸收最佳。目標血濃度 60-80 ng/mL。',
    targetMarkers: ['維生素D'],
    category: '微量營養',
  },
  {
    name: 'K2 (MK-7)',
    dosage: '180-360 mcg/日',
    timing: '早餐',
    rationaleStarter: '搭配 Vit D3 使用，引導鈣質沉積到骨骼而非血管。',
    targetMarkers: ['維生素D'],
    category: '微量營養',
  },
  {
    name: '鎂 (Magnesium Glycinate)',
    dosage: '400-500 mg/日',
    timing: '睡前',
    rationaleStarter: '甘氨酸鎂吸收佳、不易腹瀉。支持睡眠、肌肉放鬆、血糖。',
    targetMarkers: ['鎂', 'HbA1c'],
    category: '微量營養',
  },
  {
    name: '鋅 (Zinc Picolinate)',
    dosage: '15-30 mg/日',
    timing: '晚餐',
    rationaleStarter: '免疫、男性荷爾蒙合成、aromatase 抑制。長期高劑量需搭配銅。',
    targetMarkers: ['鋅', '睪固酮', '游離睪固酮'],
    category: '微量營養',
  },
  {
    name: '維生素 B12 (Methylcobalamin)',
    dosage: '1000 mcg/週',
    timing: '早餐',
    rationaleStarter: '對同半胱胺酸有幫助。MTHFR 變異者建議用甲基化形式。',
    targetMarkers: ['維生素B12', '同半胱胺酸'],
    category: '微量營養',
  },
  {
    name: '葉酸 (Methylfolate)',
    dosage: '400-800 mcg/日',
    timing: '早餐',
    rationaleStarter: '甲基化形式對 MTHFR 變異者較好吸收。降同半胱胺酸關鍵營養素。',
    targetMarkers: ['葉酸', '同半胱胺酸'],
    category: '微量營養',
  },

  // ── 荷爾蒙支持 ──
  {
    name: '硼 (Boron)',
    dosage: '6-10 mg/日',
    timing: '早餐',
    rationaleStarter: '文獻顯示對自由睪固酮、雌二醇平衡有支持作用。',
    targetMarkers: ['睪固酮', '游離睪固酮', '雌二醇'],
    category: '荷爾蒙',
  },
  {
    name: 'DIM (Diindolylmethane)',
    dosage: '100-200 mg/日',
    timing: '午餐前',
    rationaleStarter: '十字花科蔬菜萃取，協助雌二醇代謝。男性 E2 偏高常用。',
    targetMarkers: ['雌二醇'],
    category: '荷爾蒙',
  },
  {
    name: 'Ashwagandha (KSM-66)',
    dosage: '600 mg/日',
    timing: '晚餐',
    rationaleStarter: '適應原，文獻顯示對皮質醇、睪固酮、壓力恢復有支持。',
    targetMarkers: ['皮質醇', '睪固酮'],
    category: '荷爾蒙',
  },

  // ── 恢復 / 睡眠 ──
  {
    name: '甘氨酸 (Glycine)',
    dosage: '3 g/日',
    timing: '睡前',
    rationaleStarter: '改善睡眠深度、降核心體溫。對睡眠 onset 有幫助。',
    targetMarkers: [],
    category: '恢復',
  },
  {
    name: '肌酸 (Creatine Monohydrate)',
    dosage: '5 g/日',
    timing: '訓練後',
    rationaleStarter: '證據最強的補品，肌力、腦功能、恢復都有支持。',
    targetMarkers: [],
    category: '恢復',
  },

  // ── 抗氧化 / 長壽 ──
  {
    name: 'NMN',
    dosage: '500-1000 mg/日',
    timing: '早餐',
    rationaleStarter: 'NAD+ 前驅物，研究中對代謝、長壽 marker 有支持。空腹服用較好。',
    targetMarkers: [],
    category: '長壽',
  },
  {
    name: 'Quercetin',
    dosage: '500 mg/日',
    timing: '早餐',
    rationaleStarter: '抗發炎類黃酮，文獻顯示對 hsCRP、senescent cells 有支持。',
    targetMarkers: ['hs-CRP'],
    category: '長壽',
  },
]

/** 給 input list 用的純名稱清單 */
export const SUPPLEMENT_NAMES = SUPPLEMENT_CATALOG.map(s => s.name)

/** 查表 — 大小寫不敏感、寬鬆比對 */
export function findSuggestion(name: string): SupplementSuggestion | null {
  const norm = name.trim().toLowerCase()
  if (!norm) return null
  // 完全相符優先
  const exact = SUPPLEMENT_CATALOG.find(s => s.name.toLowerCase() === norm)
  if (exact) return exact
  // 開頭包含
  const partial = SUPPLEMENT_CATALOG.find(s => s.name.toLowerCase().startsWith(norm))
  if (partial) return partial
  return null
}
