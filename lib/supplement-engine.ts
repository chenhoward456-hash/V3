/**
 * Supplement Suggestion Engine
 * 根據血檢數值 + 訓練狀態 自動建議補品
 *
 * 文獻依據：
 *   - Examine.com 系統性回顧（2023-2024）
 *   - Peeling et al. 2018 (IJSNEM) — 鐵劑補充
 *   - Holick 2011 (NEJM) — 維生素 D 缺乏
 *   - Lukaszuk et al. 2012 — 鋅鎂補充與睪固酮
 *   - Kreider et al. 2017 (JISSN) — 肌酸共識聲明
 *   - Guest et al. 2021 (JISSN) — 運動員維生素 D 建議
 */

export interface LabResult {
  test_name: string
  value: number | null
  unit: string
  status: 'normal' | 'attention' | 'alert'
  reference_range?: string | null
}

export interface SupplementSuggestion {
  name: string               // 補品名稱
  dosage: string             // 建議劑量
  timing: string             // 服用時機
  reason: string             // 推薦原因（中文說明）
  priority: 'high' | 'medium' | 'low'
  evidence: string           // 文獻依據一句話
  triggerTests: string[]     // 觸發這個建議的血檢項目
  category: 'deficiency' | 'performance' | 'recovery' | 'hormonal'
}

// ── 血檢項目名稱標準化（相容不同寫法）──
function normalize(name: string): string {
  return name.toLowerCase().replace(/[\s_\-()（）]/g, '')
}

const ALIASES: Record<string, string[]> = {
  'ferritin':     ['ferritin', '鐵蛋白', 'ferritin(鐵蛋白)'],
  'vitd':         ['vitd', 'vitamind', '25ohd', '維生素d', 'vit.d', '25-ohd'],
  'vitb12':       ['vitb12', 'vitaminb12', 'b12', '維生素b12', 'cobalamin'],
  'zinc':         ['zinc', '鋅', 'zn'],
  'magnesium':    ['magnesium', '鎂', 'mg', 'magnesium(鎂)'],
  'testosterone': ['testosterone', '睪固酮', 'totaltestosterone', '總睪固酮'],
  'hemoglobin':   ['hemoglobin', 'hgb', 'hb', '血紅素', 'haemoglobin'],
  'folate':       ['folate', 'folicacid', '葉酸', 'vitaminb9'],
  'omega3index':  ['omega3index', 'omega-3index', 'omega3', 'epa+dha'],
  'cortisol':     ['cortisol', '皮質醇', '可體松'],
  'crp':          ['crp', 'c-reactiveprotein', 'c反應蛋白', 'hscrp', 'hs-crp'],
}

function matchTest(testName: string, key: string): boolean {
  const norm = normalize(testName)
  return (ALIASES[key] || []).some(alias => norm.includes(normalize(alias)))
}

function findLabValue(labs: LabResult[], key: string): LabResult | undefined {
  return labs.find(l => matchTest(l.test_name, key))
}

// ── 主引擎 ──

export function generateSupplementSuggestions(
  labs: LabResult[],
  options: {
    gender?: '男性' | '女性'
    isCompetitionPrep?: boolean
    hasHighRPE?: boolean       // 近期訓練 RPE 持續偏高
    goalType?: 'cut' | 'bulk' | null
  } = {}
): SupplementSuggestion[] {
  const suggestions: SupplementSuggestion[] = []
  const { gender, isCompetitionPrep, hasHighRPE, goalType } = options

  // ── 1. 鐵蛋白（Ferritin）──
  const ferritin = findLabValue(labs, 'ferritin')
  if (ferritin?.value != null) {
    if (ferritin.value < 30) {
      suggestions.push({
        name: '鐵劑 + 維生素 C',
        dosage: '鐵 18-25mg + 維生素 C 500mg',
        timing: '空腹或飯前 1 小時',
        reason: `鐵蛋白 ${ferritin.value} ng/mL，低於運動員建議下限（30 ng/mL）。低鐵蛋白會影響有氧代謝與訓練恢復。`,
        priority: ferritin.value < 15 ? 'high' : 'medium',
        evidence: 'Peeling et al. 2018 (IJSNEM)：鐵蛋白 < 30 ng/mL 影響 VO2max 與運動表現',
        triggerTests: [ferritin.test_name],
        category: 'deficiency',
      })
    }
  }

  // ── 2. 維生素 D ──
  const vitd = findLabValue(labs, 'vitd')
  if (vitd?.value != null) {
    if (vitd.value < 20) {
      suggestions.push({
        name: '維生素 D3 + K2',
        dosage: 'D3 4000 IU + K2 100mcg',
        timing: '隨含脂肪的餐點服用',
        reason: `維生素 D ${vitd.value} ng/mL，嚴重缺乏（< 20）。影響骨骼、肌肉力量、免疫功能與睪固酮合成。`,
        priority: 'high',
        evidence: 'Guest et al. 2021 (JISSN)：運動員維生素 D 建議維持 40-60 ng/mL',
        triggerTests: [vitd.test_name],
        category: 'deficiency',
      })
    } else if (vitd.value < 40) {
      suggestions.push({
        name: '維生素 D3 + K2',
        dosage: 'D3 2000 IU + K2 100mcg',
        timing: '隨含脂肪的餐點服用',
        reason: `維生素 D ${vitd.value} ng/mL，不足（運動員理想值 40-60 ng/mL）。`,
        priority: 'medium',
        evidence: 'Holick 2011 (NEJM)：血清 25(OH)D < 40 ng/mL 為不足',
        triggerTests: [vitd.test_name],
        category: 'deficiency',
      })
    }
  }

  // ── 3. 維生素 B12 ──
  const b12 = findLabValue(labs, 'vitb12')
  if (b12?.value != null && b12.value < 300) {
    suggestions.push({
      name: '維生素 B12',
      dosage: '1000mcg（甲基鈷胺素形式）',
      timing: '早餐後',
      reason: `B12 ${b12.value} pg/mL，偏低（建議 > 300 pg/mL）。B12 不足影響紅血球生成、神經功能與能量代謝。`,
      priority: b12.value < 200 ? 'high' : 'medium',
      evidence: 'National Institute of Health：B12 < 200 pg/mL 為缺乏，< 300 pg/mL 為亞臨床不足',
      triggerTests: [b12.test_name],
      category: 'deficiency',
    })
  }

  // ── 4. 鋅 ──
  const zinc = findLabValue(labs, 'zinc')
  if (zinc?.value != null && zinc.value < 80) {
    suggestions.push({
      name: '鋅（Zinc）',
      dosage: '25-30mg（葡萄糖酸鋅或甲硫胺酸鋅）',
      timing: '睡前空腹',
      reason: `鋅 ${zinc.value} mcg/dL，偏低。鋅是睪固酮合成、免疫功能與蛋白質代謝的關鍵礦物質。`,
      priority: 'medium',
      evidence: 'Lukaszuk et al. 2012：鋅補充改善運動員睪固酮水平與恢復',
      triggerTests: [zinc.test_name],
      category: 'hormonal',
    })
  }

  // ── 5. 鎂 ──
  const magnesium = findLabValue(labs, 'magnesium')
  if (magnesium?.value != null && magnesium.value < 1.8) {
    suggestions.push({
      name: '鎂（Magnesium）',
      dosage: '300-400mg（甘胺酸鎂或蘋果酸鎂）',
      timing: '睡前 30 分鐘',
      reason: `血清鎂 ${magnesium.value} mg/dL，低於正常範圍。鎂不足影響睡眠品質、肌肉放鬆與胰島素敏感性。`,
      priority: 'medium',
      evidence: 'Zhang et al. 2017 (Nutrients)：鎂補充改善睡眠品質與運動後恢復',
      triggerTests: [magnesium.test_name],
      category: 'recovery',
    })
  }

  // ── 6. 睪固酮（男性）──
  if (gender === '男性') {
    const testosterone = findLabValue(labs, 'testosterone')
    if (testosterone?.value != null && testosterone.value < 400) {
      suggestions.push({
        name: 'ZMA（鋅鎂合劑）',
        dosage: '鋅 30mg + 鎂 450mg + B6 10.5mg',
        timing: '睡前空腹',
        reason: `睪固酮 ${testosterone.value} ng/dL，低於男性理想範圍（400-700 ng/dL）。ZMA 有助於改善鋅鎂不足導致的睪固酮偏低。`,
        priority: testosterone.value < 300 ? 'high' : 'medium',
        evidence: 'Brilla & Conte 2000：ZMA 補充顯著提升訓練運動員睪固酮水平',
        triggerTests: [testosterone.test_name],
        category: 'hormonal',
      })
    }
  }

  // ── 7. 血紅素（貧血）──
  const hemoglobin = findLabValue(labs, 'hemoglobin')
  if (hemoglobin?.value != null) {
    const threshold = gender === '女性' ? 12.0 : 13.5
    if (hemoglobin.value < threshold) {
      suggestions.push({
        name: '鐵劑 + 葉酸',
        dosage: '鐵 25mg + 葉酸 400mcg',
        timing: '空腹服用，搭配維生素 C',
        reason: `血紅素 ${hemoglobin.value} g/dL，低於正常值（${gender === '女性' ? '女性 12.0' : '男性 13.5'} g/dL）。貧血嚴重影響有氧代謝與運動表現。`,
        priority: 'high',
        evidence: 'WHO：血紅素低於閾值定義為貧血，需積極補充鐵劑',
        triggerTests: [hemoglobin.test_name],
        category: 'deficiency',
      })
    }
  }

  // ── 8. 發炎指數（CRP 偏高 + 高 RPE）──
  const crp = findLabValue(labs, 'crp')
  if (crp?.value != null && crp.value > 3) {
    suggestions.push({
      name: 'Omega-3 魚油',
      dosage: 'EPA+DHA 合計 2-3g',
      timing: '隨餐服用',
      reason: `CRP ${crp.value} mg/L，發炎指數偏高。Omega-3 有助於降低系統性發炎，改善訓練恢復。`,
      priority: crp.value > 10 ? 'high' : 'medium',
      evidence: 'Calder 2017 (J Nutr)：EPA+DHA 2-4g/day 顯著降低 CRP 與 IL-6',
      triggerTests: [crp.test_name],
      category: 'recovery',
    })
  }

  // ── 9. 肌酸（備賽/增肌，無論血檢）──
  if (isCompetitionPrep || goalType === 'bulk') {
    const alreadyHasCreatine = suggestions.some(s => s.name.includes('肌酸'))
    if (!alreadyHasCreatine) {
      suggestions.push({
        name: '肌酸（Creatine Monohydrate）',
        dosage: '3-5g',
        timing: '訓練後隨含碳水餐點',
        reason: '肌酸是運動科學中證據等級最高的增肌/維持肌肉量補品，備賽期間特別有助於保護肌肉量。',
        priority: 'high',
        evidence: 'Kreider et al. 2017 (JISSN)：肌酸共識聲明，最高等級（Grade A）證據',
        triggerTests: [],
        category: 'performance',
      })
    }
  }

  // ── 10. 高 RPE 恢復建議 ──
  if (hasHighRPE) {
    suggestions.push({
      name: '鎂（Magnesium Glycinate）',
      dosage: '400mg',
      timing: '睡前 30 分鐘',
      reason: '近期訓練 RPE 持續偏高，肌肉疲勞積累。甘胺酸鎂有助於改善睡眠深度與肌肉恢復速度。',
      priority: 'medium',
      evidence: 'Abbasi et al. 2012 (J Res Med Sci)：鎂補充顯著改善睡眠品質指標',
      triggerTests: [],
      category: 'recovery',
    })
  }

  // ── 排序：high → medium → low，同優先級按 category 排序 ──
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const categoryOrder = { deficiency: 0, hormonal: 1, performance: 2, recovery: 3 }
  suggestions.sort((a, b) => {
    const p = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (p !== 0) return p
    return categoryOrder[a.category] - categoryOrder[b.category]
  })

  return suggestions
}
