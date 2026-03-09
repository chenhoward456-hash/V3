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

import { matchLabName } from '@/utils/labMatch'

// ── 補品引擎的 key → 血檢關鍵字映射 ──
const KEY_ALIASES: Record<string, string[]> = {
  'ferritin':           ['鐵蛋白', 'ferritin'],
  'vitd':               ['維生素d', 'vitamin d'],
  'vitb12':             ['維生素b12', 'b12'],
  'zinc':               ['鋅', 'zinc'],
  'magnesium':          ['鎂', 'magnesium'],
  'testosterone':       ['睪固酮', 'testosterone'],
  'freetestosterone':   ['游離睪固酮', 'free testosterone'],
  'hemoglobin':         ['血紅素', 'hemoglobin'],
  'folate':             ['葉酸', 'folate'],
  'omega3index':        ['omega3', 'omega-3 index'],
  'cortisol':           ['皮質醇', 'cortisol'],
  'crp':                ['crp', 'hs-crp'],
}

function findLabValue(labs: LabResult[], key: string): LabResult | undefined {
  const keywords = KEY_ALIASES[key]
  if (!keywords) return undefined
  return labs.find(l => matchLabName(l.test_name, keywords))
}

// ── 主引擎 ──

export interface GeneticProfile {
  mthfr?: 'normal' | 'heterozygous' | 'homozygous' | null
  apoe?: 'e2/e2' | 'e2/e3' | 'e3/e3' | 'e3/e4' | 'e4/e4' | null
  depressionRisk?: 'low' | 'moderate' | 'high' | null
}

export function generateSupplementSuggestions(
  labs: LabResult[],
  options: {
    gender?: '男性' | '女性'
    isCompetitionPrep?: boolean
    hasHighRPE?: boolean       // 近期訓練 RPE 持續偏高
    goalType?: 'cut' | 'bulk' | null
    isHealthMode?: boolean     // 健康模式：長壽導向補品建議
    genetics?: GeneticProfile  // 基因風險資料
  } = {}
): SupplementSuggestion[] {
  const suggestions: SupplementSuggestion[] = []
  const { gender, isCompetitionPrep, hasHighRPE, goalType, isHealthMode, genetics } = options

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
  if (b12?.value != null && b12.value < 400) {
    suggestions.push({
      name: '維生素 B12',
      dosage: '1000mcg（甲基鈷胺素形式）',
      timing: '早餐後',
      reason: `B12 ${b12.value} pg/mL，偏低（建議 400-900 pg/mL）。B12 不足影響紅血球生成、神經功能與能量代謝。`,
      priority: b12.value < 200 ? 'high' : 'medium',
      evidence: 'National Institute of Health：B12 < 200 pg/mL 為缺乏，< 400 pg/mL 為亞臨床不足',
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

  // ── 6b. 游離睪固酮（男性）──
  if (gender === '男性') {
    const freeT = findLabValue(labs, 'freetestosterone')
    if (freeT?.value != null && freeT.value < 47) {
      // 只有在尚未因總 T 偏低推薦 ZMA 時才推薦
      const alreadyHasZMA = suggestions.some(s => s.name.includes('ZMA'))
      if (!alreadyHasZMA) {
        suggestions.push({
          name: 'ZMA（鋅鎂合劑）',
          dosage: '鋅 30mg + 鎂 450mg + B6 10.5mg',
          timing: '睡前空腹',
          reason: `游離睪固酮 ${freeT.value} pg/mL，低於理想範圍（47-244 pg/mL）。游離 T 比總 T 更反映實際活性水平。`,
          priority: freeT.value < 30 ? 'high' : 'medium',
          evidence: 'Brilla & Conte 2000：ZMA 補充顯著提升訓練運動員睪固酮水平',
          triggerTests: [freeT.test_name],
          category: 'hormonal',
        })
      }
    }
  }

  // ── 7. 血紅素（貧血）— 避免與鐵蛋白低的鐵劑建議重複 ──
  const hemoglobin = findLabValue(labs, 'hemoglobin')
  if (hemoglobin?.value != null) {
    const threshold = gender === '女性' ? 12.0 : 13.5
    if (hemoglobin.value < threshold) {
      const alreadyHasIron = suggestions.some(s => s.name.includes('鐵劑'))
      const hasMTHFR = genetics?.mthfr === 'heterozygous' || genetics?.mthfr === 'homozygous'
      const folateForm = hasMTHFR ? '5-MTHF 活性葉酸' : '葉酸'
      const folateDose = hasMTHFR ? '5-MTHF 800mcg' : '葉酸 400mcg'

      if (alreadyHasIron) {
        // 已有鐵蛋白觸發的鐵劑建議 → 合併：升級劑量 + 加入葉酸 + 追加觸發指標
        const existing = suggestions.find(s => s.name.includes('鐵劑'))!
        existing.name = `鐵劑 + 維生素 C + ${folateForm}`
        existing.dosage = `鐵 25mg + 維生素 C 500mg + ${folateDose}`
        existing.reason += ` 同時血紅素 ${hemoglobin.value} g/dL 偏低，合併補充${folateForm}加速紅血球生成。${hasMTHFR ? '（MTHFR 突變，使用活性葉酸形式）' : ''}`
        existing.priority = 'high'
        existing.triggerTests.push(hemoglobin.test_name)
      } else {
        suggestions.push({
          name: `鐵劑 + ${folateForm}`,
          dosage: `鐵 25mg + ${folateDose}`,
          timing: '空腹服用，搭配維生素 C',
          reason: `血紅素 ${hemoglobin.value} g/dL，低於正常值（${gender === '女性' ? '女性 12.0' : '男性 13.5'} g/dL）。貧血嚴重影響有氧代謝與運動表現。`,
          priority: 'high',
          evidence: 'WHO：血紅素低於閾值定義為貧血，需積極補充鐵劑',
          triggerTests: [hemoglobin.test_name],
          category: 'deficiency',
        })
      }
    }
  }

  // ── 8. 發炎指數（CRP 偏高 + 高 RPE）──
  const crp = findLabValue(labs, 'crp')
  if (crp?.value != null && crp.value > 5) {
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

  // ── 10. 高 RPE 恢復建議（鎂 — 避免與血檢鎂重複）──
  if (hasHighRPE) {
    const alreadyHasMagnesium = suggestions.some(s => s.name.includes('鎂'))
    if (!alreadyHasMagnesium) {
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
  }

  // ── 健康模式：長壽導向補品（不依賴血檢，基於循證長壽研究）──
  if (isHealthMode) {
    // Omega-3（未被血檢觸發時補上基礎建議）
    const alreadyHasOmega3 = suggestions.some(s => s.name.toLowerCase().includes('omega') || s.name.includes('魚油'))
    if (!alreadyHasOmega3) {
      suggestions.push({
        name: 'Omega-3 魚油',
        dosage: 'EPA+DHA 合計 1-2g',
        timing: '隨餐服用',
        reason: '長壽研究核心補品。降低全因死亡率、支持心血管、腦部與抗發炎。適合長期健康維護。',
        priority: 'high',
        evidence: 'Bhatt et al. 2019 (NEJM, REDUCE-IT)：EPA 4g/day 降低重大心血管事件 25%',
        triggerTests: [],
        category: 'recovery',
      })
    }

    // 甘胺酸鎂（睡眠/壓力）
    const alreadyHasMag = suggestions.some(s => s.name.includes('鎂'))
    if (!alreadyHasMag) {
      suggestions.push({
        name: '甘胺酸鎂（Magnesium Glycinate）',
        dosage: '300-400mg',
        timing: '睡前 30 分鐘',
        reason: '現代人飲食普遍缺鎂。改善睡眠深度、降低皮質醇、支持胰島素敏感性，為健康模式首選補品。',
        priority: 'high',
        evidence: 'Abbasi et al. 2012 (J Res Med Sci)：鎂補充顯著改善睡眠品質與主觀睡眠時間',
        triggerTests: [],
        category: 'recovery',
      })
    }

    // 維生素 D3+K2（未被血檢觸發時補上）
    const alreadyHasD3 = suggestions.some(s => s.name.includes('D3') || s.name.includes('維生素 D'))
    if (!alreadyHasD3) {
      suggestions.push({
        name: '維生素 D3 + K2',
        dosage: 'D3 2000 IU + K2 100mcg',
        timing: '隨含脂肪的餐點服用',
        reason: '台灣都市族群普遍維生素 D 不足。D3+K2 協同支持骨骼、免疫、情緒與心血管健康。',
        priority: 'medium',
        evidence: 'Holick 2011 (NEJM)；Theuwissen 2012 (Mol Nutr Food Res)：D3+K2 協同心血管保護',
        triggerTests: [],
        category: 'deficiency',
      })
    }

    // 白藜蘆醇（Resveratrol）— 避免重複
    const alreadyHasResveratrol = suggestions.some(s => s.name.includes('白藜蘆醇') || s.name.toLowerCase().includes('resveratrol'))
    if (!alreadyHasResveratrol) suggestions.push({
      name: '白藜蘆醇（Trans-Resveratrol）',
      dosage: '250-500mg',
      timing: '隨餐服用',
      reason: '激活 Sirtuin 長壽蛋白通路，模擬熱量限制效果。改善胰島素敏感性、抗氧化、抗發炎。',
      priority: 'medium',
      evidence: 'Bhatt et al. 2012 (Am J Cardiol)；Lagouge et al. 2006 (Cell)：Resveratrol 激活 SIRT1',
      triggerTests: [],
      category: 'performance',
    })

    // 輔酶 Q10（CoQ10）— 避免重複
    const alreadyHasCoQ10 = suggestions.some(s => s.name.includes('CoQ10') || s.name.includes('Q10') || s.name.includes('輔酶'))
    if (!alreadyHasCoQ10) suggestions.push({
      name: '輔酶 Q10（Ubiquinol 還原型）',
      dosage: '100-200mg',
      timing: '隨含脂肪的餐點服用',
      reason: '粒線體能量生產的關鍵輔因子。35 歲後體內 CoQ10 逐年下降，補充有助維持細胞能量、抗氧化與心臟功能。',
      priority: 'medium',
      evidence: 'Mortensen et al. 2014 (JACC Heart Failure, Q-SYMBIO)：CoQ10 降低心衰竭死亡率 43%',
      triggerTests: [],
      category: 'performance',
    })

    // 南非醉茄（Ashwagandha）— 壓力管理，避免重複
    const alreadyHasAshwagandha = suggestions.some(s => s.name.includes('南非醉茄') || s.name.toLowerCase().includes('ashwagandha'))
    if (!alreadyHasAshwagandha) suggestions.push({
      name: '南非醉茄（Ashwagandha）',
      dosage: 'KSM-66 萃取 300-600mg',
      timing: '晚餐後或睡前',
      reason: '具臨床證據的適應原（Adaptogen）。降低皮質醇、改善睡眠品質、緩解焦慮，適合高壓工作族群。',
      priority: 'medium',
      evidence: 'Chandrasekhar et al. 2012 (Indian J Psychol Med)：KSM-66 降低皮質醇 27.9%、焦慮量表改善 44%',
      triggerTests: [],
      category: 'hormonal',
    })
  }

  // ── 基因導向補品建議 ──

  // MTHFR 突變：建議活性葉酸 + B12（甲基鈷胺素）
  if (genetics?.mthfr === 'heterozygous' || genetics?.mthfr === 'homozygous') {
    const alreadyHasFolate = suggestions.some(s =>
      s.name.includes('葉酸') || s.name.includes('MTHF') || s.name.includes('B群')
    )
    if (!alreadyHasFolate) {
      const isHomozygous = genetics.mthfr === 'homozygous'
      suggestions.push({
        name: '活性葉酸（5-MTHF）+ 甲基 B12',
        dosage: isHomozygous ? '5-MTHF 1000mcg + 甲基B12 1000mcg' : '5-MTHF 800mcg + 甲基B12 1000mcg',
        timing: '早餐後',
        reason: `MTHFR ${isHomozygous ? '純合' : '雜合'}突變，無法有效將葉酸轉化為活性形式。需補充已活化的 5-MTHF 與甲基 B12，支持甲基化代謝、降低同半胱胺酸。`,
        priority: isHomozygous ? 'high' : 'medium',
        evidence: 'Tsang et al. 2015 (Mol Genet Metab)：MTHFR C677T 純合突變者補充 5-MTHF 顯著降低同半胱胺酸',
        triggerTests: [],
        category: 'deficiency',
      })
    }
  }

  // APOE4 帶因者：強調 Omega-3 DHA + 降低心血管風險
  if (genetics?.apoe === 'e3/e4' || genetics?.apoe === 'e4/e4') {
    const isDoubleE4 = genetics.apoe === 'e4/e4'

    // 強調 DHA 為主的 Omega-3
    const alreadyHasOmega3 = suggestions.some(s => s.name.toLowerCase().includes('omega') || s.name.includes('魚油'))
    if (alreadyHasOmega3) {
      // 升級現有 Omega-3 建議，強調 DHA
      const existing = suggestions.find(s => s.name.toLowerCase().includes('omega') || s.name.includes('魚油'))!
      existing.name = 'Omega-3 魚油（高 DHA 配方）'
      existing.dosage = 'DHA 1000mg + EPA 500mg'
      existing.reason += ` APOE4 帶因者需特別強調 DHA 攝取，支持腦部健康與心血管保護。`
      existing.priority = 'high'
    } else {
      suggestions.push({
        name: 'Omega-3 魚油（高 DHA 配方）',
        dosage: 'DHA 1000mg + EPA 500mg',
        timing: '隨餐服用',
        reason: `APOE4 帶因者${isDoubleE4 ? '（雙 e4，高風險）' : ''}，DHA 對腦部與心血管保護尤為關鍵。建議搭配低飽和脂肪飲食。`,
        priority: 'high',
        evidence: 'Yassine et al. 2017 (JAMA Neurology)：APOE4 帶因者補充 DHA 改善腦部 DHA 攝取',
        triggerTests: [],
        category: 'recovery',
      })
    }

    // 磷蝦油 / 磷脂質 DHA（APOE4 特異性，穿越血腦屏障效率更高）
    if (isDoubleE4) {
      suggestions.push({
        name: '磷脂醯絲胺酸（PS）',
        dosage: '100-300mg',
        timing: '隨餐服用',
        reason: 'APOE4/4 高風險基因型。磷脂醯絲胺酸支持細胞膜流動性與認知功能，與 DHA 協同保護腦部。',
        priority: 'medium',
        evidence: 'Richter et al. 2013 (Nutrition)：PS 補充改善認知功能指標',
        triggerTests: [],
        category: 'performance',
      })
    }
  }

  // 憂鬱傾向基因：強調維生素 D、Omega-3 EPA、鎂
  if (genetics?.depressionRisk === 'moderate' || genetics?.depressionRisk === 'high') {
    const isHighRisk = genetics.depressionRisk === 'high'

    // 確保有維生素 D（升級劑量）
    const existingD = suggestions.find(s => s.name.includes('D3') || s.name.includes('維生素 D'))
    if (existingD) {
      if (isHighRisk) {
        existingD.dosage = 'D3 4000 IU + K2 100mcg'
        existingD.reason += ' 憂鬱傾向基因高風險，維生素 D 與血清素合成密切相關，建議維持 50+ ng/mL。'
        existingD.priority = 'high'
      }
    } else {
      suggestions.push({
        name: '維生素 D3 + K2',
        dosage: isHighRisk ? 'D3 4000 IU + K2 100mcg' : 'D3 2000 IU + K2 100mcg',
        timing: '隨含脂肪的餐點服用',
        reason: `憂鬱傾向基因${isHighRisk ? '高' : '中等'}風險。維生素 D 參與血清素合成，不足與憂鬱症狀顯著相關。`,
        priority: isHighRisk ? 'high' : 'medium',
        evidence: 'Anglin et al. 2013 (Br J Psychiatry)：低維生素 D 與憂鬱風險增加 2 倍相關',
        triggerTests: [],
        category: 'deficiency',
      })
    }

    // Omega-3 EPA（抗憂鬱效果主要來自 EPA）
    const existingOmega = suggestions.find(s => s.name.toLowerCase().includes('omega') || s.name.includes('魚油'))
    if (existingOmega) {
      existingOmega.reason += ' 憂鬱傾向基因風險，EPA 的抗發炎與神經保護作用有助穩定情緒。'
    } else {
      suggestions.push({
        name: 'Omega-3 魚油（高 EPA 配方）',
        dosage: 'EPA 1000mg + DHA 500mg',
        timing: '隨餐服用',
        reason: `憂鬱傾向基因${isHighRisk ? '高' : '中等'}風險。EPA 具抗發炎與調節神經傳導物質的作用，臨床研究顯示對憂鬱症狀有改善效果。`,
        priority: 'high',
        evidence: 'Liao et al. 2019 (Transl Psychiatry)：EPA ≥1g/day 對憂鬱症狀有顯著改善',
        triggerTests: [],
        category: 'recovery',
      })
    }

    // 鎂（放鬆、助眠、穩定情緒）
    const alreadyHasMag = suggestions.some(s => s.name.includes('鎂'))
    if (!alreadyHasMag) {
      suggestions.push({
        name: '甘胺酸鎂（Magnesium Glycinate）',
        dosage: '400mg',
        timing: '睡前 30 分鐘',
        reason: `憂鬱傾向基因風險。鎂調節 NMDA 受體與 HPA 軸，不足會加重焦慮與憂鬱。甘胺酸鎂兼具助眠與穩定情緒效果。`,
        priority: 'high',
        evidence: 'Tarleton et al. 2017 (PLoS One)：鎂補充 6 週顯著改善輕中度憂鬱症狀',
        triggerTests: [],
        category: 'recovery',
      })
    }
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
