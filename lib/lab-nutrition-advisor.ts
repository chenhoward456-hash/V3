/**
 * Lab-Driven Nutrition Advisor
 * 血檢結果 → 個人化飲食建議
 *
 * 核心邏輯：根據血檢異常指標，產出具體的飲食調整建議
 * 不只是「吃什麼補品」，而是「每天的食物怎麼調」
 *
 * 文獻依據：
 *   - ISSN Position Stand on Diets and Body Composition (2017)
 *   - Calder 2017 (J Nutr): Omega-3 與系統性發炎
 *   - Holick 2011 (NEJM): 維生素 D 飲食來源
 *   - WHO Iron Deficiency Anemia Guidelines (2021)
 *   - AHA Diet & Lifestyle Recommendations (2021)
 */

export interface LabNutritionAdvice {
  category: 'iron' | 'inflammation' | 'lipid' | 'glucose' | 'vitamin' | 'mineral'
  title: string                    // 簡短標題
  icon: string                     // emoji
  severity: 'high' | 'medium'     // 根據血檢嚴重度
  dietaryChanges: string[]         // 具體飲食調整
  foodsToIncrease: string[]        // 建議多吃的食物
  foodsToReduce: string[]          // 建議減少的食物
  macroAdjustment?: {              // 巨量營養素調整建議
    nutrient: string
    direction: 'increase' | 'decrease'
    detail: string
  }
  labMarker: string                // 觸發的血檢指標
  currentValue: number             // 當前值
  unit: string
  targetRange: string              // 目標範圍
}

interface LabInput {
  test_name: string
  value: number | null
  unit: string
  status: 'normal' | 'attention' | 'alert'
}

// 血檢項目名稱比對
function matchName(testName: string, keywords: string[]): boolean {
  const norm = testName.toLowerCase().replace(/[\s_\-()（）]/g, '')
  return keywords.some(k => norm.includes(k.toLowerCase().replace(/[\s_\-()（）]/g, '')))
}

export function generateLabNutritionAdvice(
  labs: LabInput[],
  options: { gender?: '男性' | '女性'; goalType?: 'cut' | 'bulk' | null } = {}
): LabNutritionAdvice[] {
  const advice: LabNutritionAdvice[] = []
  const { gender, goalType } = options

  for (const lab of labs) {
    if (lab.value == null || lab.status === 'normal') continue

    // ── 鐵蛋白 / 血紅素 → 鐵質飲食建議 ──
    if (matchName(lab.test_name, ['鐵蛋白', 'ferritin'])) {
      advice.push({
        category: 'iron',
        title: '鐵質攝取不足',
        icon: '🥩',
        severity: lab.status === 'alert' ? 'high' : 'medium',
        dietaryChanges: [
          '每週安排 3-4 次紅肉（牛肉、羊肉），每次 100-150g',
          '搭配維生素 C 食物（柑橘、甜椒）提高鐵吸收率 3-6 倍',
          '避免餐中喝茶或咖啡（單寧酸抑制鐵吸收）',
        ],
        foodsToIncrease: ['牛肉', '羊肉', '鴨血', '豬肝', '菠菜', '紅莧菜', '黑芝麻'],
        foodsToReduce: ['餐中茶/咖啡（改為餐後 1 小時）'],
        macroAdjustment: goalType === 'cut' ? {
          nutrient: '蛋白質來源',
          direction: 'increase',
          detail: '蛋白質優先選擇紅肉（血基質鐵吸收率 15-35%，植物鐵僅 2-20%）',
        } : undefined,
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: gender === '女性' ? '12-200 ng/mL' : '50-150 ng/mL',
      })
    }

    if (matchName(lab.test_name, ['血紅素', 'hemoglobin', 'hgb', 'hb'])) {
      const threshold = gender === '女性' ? 12.0 : 13.5
      if (lab.value < threshold) {
        advice.push({
          category: 'iron',
          title: '貧血風險',
          icon: '🩸',
          severity: 'high',
          dietaryChanges: [
            '每日確保攝取至少一份高鐵食物',
            '葉酸搭配：深綠色蔬菜、豆類每日至少 2 份',
            '減脂期也不要完全排除紅肉',
          ],
          foodsToIncrease: ['牛肉', '鴨血', '豬肝', '蛤蜊', '深綠色蔬菜', '豆類'],
          foodsToReduce: [],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: `>${threshold} g/dL`,
        })
      }
    }

    // ── CRP / 發炎指數 → 抗發炎飲食 ──
    if (matchName(lab.test_name, ['crp', 'c反應蛋白', 'hs-crp', 'hscrp'])) {
      advice.push({
        category: 'inflammation',
        title: '發炎指數偏高',
        icon: '🔥',
        severity: lab.value > 10 ? 'high' : 'medium',
        dietaryChanges: [
          '提高 Omega-3 / Omega-6 比例：每週吃 3 次以上深海魚',
          '減少精製植物油（大豆油、葵花油），改用橄欖油、酪梨油',
          '增加抗氧化食物：莓果、深色蔬菜、薑黃',
          '減少高溫油炸食物和加工肉品',
        ],
        foodsToIncrease: ['鮭魚', '鯖魚', '秋刀魚', '核桃', '亞麻籽', '莓果', '薑黃', '橄欖油'],
        foodsToReduce: ['油炸食物', '加工肉品', '精製植物油', '高糖食物'],
        macroAdjustment: {
          nutrient: '脂肪來源',
          direction: 'increase',
          detail: '脂肪配額中至少 30% 來自 Omega-3 來源（深海魚、核桃、亞麻籽）',
        },
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '<1.0 mg/L（理想）',
      })
    }

    // ── 三酸甘油酯 → 碳水/脂肪調整 ──
    if (matchName(lab.test_name, ['三酸甘油酯', 'triglyceride', 'tg'])) {
      advice.push({
        category: 'lipid',
        title: '三酸甘油酯偏高',
        icon: '💧',
        severity: lab.value > 150 ? 'high' : 'medium',
        dietaryChanges: [
          '減少精製碳水（白飯換糙米、地瓜）',
          '完全避免含糖飲料和果汁',
          '增加 Omega-3 攝取（EPA+DHA 有直接降 TG 效果）',
          '適量增加纖維攝取（每日 25-30g）',
        ],
        foodsToIncrease: ['糙米', '地瓜', '燕麥', '深海魚', '核桃', '蔬菜'],
        foodsToReduce: ['白飯', '麵包', '含糖飲料', '果汁', '酒精'],
        macroAdjustment: {
          nutrient: '碳水化合物',
          direction: 'decrease',
          detail: '碳水來源改為低 GI 食物，精製碳水佔比降至 30% 以下',
        },
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '<100 mg/dL（最佳）',
      })
    }

    // ── ApoB → 心血管脂肪管理 ──
    if (matchName(lab.test_name, ['apob', 'apolipoproteinb'])) {
      advice.push({
        category: 'lipid',
        title: 'ApoB 偏高（心血管風險）',
        icon: '❤️',
        severity: lab.value > 100 ? 'high' : 'medium',
        dietaryChanges: [
          '減少飽和脂肪：紅肉改為去皮雞胸、魚類',
          '每日攝取可溶性纖維（燕麥β-glucan、洋車前子）',
          '增加植物固醇來源（堅果、豆類）',
        ],
        foodsToIncrease: ['燕麥', '豆類', '堅果', '深海魚', '酪梨', '橄欖油'],
        foodsToReduce: ['紅肉（改為每週 1-2 次）', '全脂乳製品', '加工食品', '椰子油'],
        macroAdjustment: {
          nutrient: '脂肪',
          direction: 'decrease',
          detail: '飽和脂肪佔總熱量 <7%，以單元不飽和脂肪（橄欖油、酪梨）為主',
        },
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '<80 mg/dL（最佳）',
      })
    }

    // ── HOMA-IR / 空腹血糖 / 空腹胰島素 → 胰島素敏感性 ──
    if (matchName(lab.test_name, ['homa-ir', 'homair'])) {
      advice.push({
        category: 'glucose',
        title: '胰島素阻抗偏高',
        icon: '📊',
        severity: lab.value > 2.5 ? 'high' : 'medium',
        dietaryChanges: [
          '碳水集中在訓練前後攝取（利用肌肉收縮的非胰島素依賴性葡萄糖攝取）',
          '每餐碳水搭配蛋白質和纖維（降低餐後血糖波動）',
          '考慮間歇性的碳水循環（訓練日高碳、休息日低碳）',
          '增加醋酸攝取（餐前 1 湯匙蘋果醋 + 水）',
        ],
        foodsToIncrease: ['地瓜', '糙米', '豆類', '肉桂', '蘋果醋', '綠色蔬菜'],
        foodsToReduce: ['白飯', '麵包', '含糖飲料', '精製零食'],
        macroAdjustment: {
          nutrient: '碳水化合物',
          direction: 'decrease',
          detail: '建議啟用碳循環：訓練日碳水 4-5g/kg，休息日 2-3g/kg',
        },
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: '',
        targetRange: '<2.0（理想）',
      })
    }

    if (matchName(lab.test_name, ['空腹血糖', 'fasting glucose'])) {
      if (lab.value > 90) {
        advice.push({
          category: 'glucose',
          title: '空腹血糖偏高',
          icon: '🍬',
          severity: lab.value > 100 ? 'high' : 'medium',
          dietaryChanges: [
            '晚餐減少精製碳水、增加蔬菜和蛋白質',
            '餐後散步 10-15 分鐘（顯著降低餐後血糖）',
            '考慮在早餐前的碳水中加入肉桂（改善血糖反應）',
          ],
          foodsToIncrease: ['蔬菜', '堅果', '肉桂', '醋', '高纖食物'],
          foodsToReduce: ['精製碳水', '含糖飲料', '高 GI 零食'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '<90 mg/dL（最佳）',
        })
      }
    }

    // ── 維生素 D ──
    if (matchName(lab.test_name, ['維生素d', 'vitamin d', '25-ohd', '25ohd', 'vit d'])) {
      advice.push({
        category: 'vitamin',
        title: '維生素 D 不足',
        icon: '☀️',
        severity: lab.value < 20 ? 'high' : 'medium',
        dietaryChanges: [
          '每週吃 2-3 次高油脂魚類（鮭魚、鯖魚各含 400-600 IU/100g）',
          '雞蛋選全蛋（蛋黃含 40 IU/顆）',
          '每日曬太陽 15-20 分鐘（裸露手臂，10:00-15:00）',
          '脂溶性維生素 → 確保每餐有足夠脂肪（≥10g）',
        ],
        foodsToIncrease: ['鮭魚', '鯖魚', '秋刀魚', '全蛋', '香菇（曬過太陽的）', '強化牛奶'],
        foodsToReduce: [],
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '40-60 ng/mL（運動員理想）',
      })
    }

    // ── 同半胱胺酸 → B群 + 葉酸 ──
    if (matchName(lab.test_name, ['同半胱胺酸', 'homocysteine'])) {
      advice.push({
        category: 'vitamin',
        title: '同半胱胺酸偏高',
        icon: '🧬',
        severity: lab.value > 12 ? 'high' : 'medium',
        dietaryChanges: [
          '增加葉酸食物來源（深綠色蔬菜每日 2-3 份）',
          '確保 B12 攝取（動物性蛋白質，素食者需補充）',
          'B6 來源：雞胸肉、鮭魚、馬鈴薯、香蕉',
        ],
        foodsToIncrease: ['菠菜', '蘆筍', '花椰菜', '豆類', '雞胸肉', '鮭魚', '全蛋'],
        foodsToReduce: [],
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '<8 µmol/L（最佳）',
      })
    }

    // ── 鎂 ──
    if (matchName(lab.test_name, ['鎂', 'magnesium'])) {
      advice.push({
        category: 'mineral',
        title: '鎂偏低',
        icon: '🥬',
        severity: lab.status === 'alert' ? 'high' : 'medium',
        dietaryChanges: [
          '每日攝取深綠色蔬菜至少 2 份（菠菜、甘藍）',
          '每日一份堅果（南瓜子含鎂最高，30g = 150mg 鎂）',
          '選擇全穀類而非精製碳水',
        ],
        foodsToIncrease: ['南瓜子', '杏仁', '菠菜', '黑巧克力', '酪梨', '糙米'],
        foodsToReduce: ['精製碳水（加工過程流失鎂）', '酒精（促進鎂排出）'],
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '2.0-2.4 mg/dL',
      })
    }

    // ── 鋅 ──
    if (matchName(lab.test_name, ['鋅', 'zinc'])) {
      advice.push({
        category: 'mineral',
        title: '鋅偏低',
        icon: '🦪',
        severity: lab.status === 'alert' ? 'high' : 'medium',
        dietaryChanges: [
          '每週 2-3 次貝類（牡蠣是鋅含量最高食物，6 顆 = 32mg）',
          '紅肉是次佳來源（100g 牛肉 = 4-5mg 鋅）',
          '避免與高植酸食物同餐（未發酵豆類、全穀類會抑制鋅吸收）',
        ],
        foodsToIncrease: ['牡蠣', '蛤蜊', '牛肉', '南瓜子', '雞腿肉'],
        foodsToReduce: ['植酸食物（與鋅分開餐次）'],
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '70-120 µg/dL',
      })
    }
  }

  // 按嚴重度排序
  advice.sort((a, b) => {
    if (a.severity === 'high' && b.severity !== 'high') return -1
    if (a.severity !== 'high' && b.severity === 'high') return 1
    return 0
  })

  return advice
}
