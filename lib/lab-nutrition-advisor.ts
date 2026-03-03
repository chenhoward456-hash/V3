/**
 * Lab-Driven Nutrition Advisor
 * 血檢結果 → 個人化飲食建議
 *
 * 核心邏輯：根據血檢異常指標，產出具體的飲食調整建議
 * 不只是「吃什麼補品」，而是「每天的食物怎麼調」
 * 每條建議皆附文獻出處，血清侷限性以 caveat 標示
 */

export interface LabNutritionAdvice {
  category: 'iron' | 'inflammation' | 'lipid' | 'glucose' | 'vitamin' | 'mineral' | 'hormone'
  title: string
  icon: string
  severity: 'high' | 'medium'
  dietaryChanges: string[]
  foodsToIncrease: string[]
  foodsToReduce: string[]
  macroAdjustment?: {
    nutrient: string
    direction: 'increase' | 'decrease'
    detail: string
  }
  labMarker: string
  currentValue: number
  unit: string
  targetRange: string
  references: string[]       // 文獻佐證
  caveat?: string            // 指標侷限性提醒
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

    // ── 鐵蛋白（區分偏高 vs 偏低）──
    if (matchName(lab.test_name, ['鐵蛋白', 'ferritin'])) {
      const ferritinMax = gender === '女性' ? 200 : 150
      const ferritinMin = gender === '女性' ? 12 : 50
      const isHigh = lab.value > ferritinMax
      const isLow = lab.value < ferritinMin

      if (isHigh) {
        advice.push({
          category: 'iron',
          title: '鐵蛋白偏高',
          icon: '⚠️',
          severity: lab.status === 'alert' ? 'high' : 'medium',
          dietaryChanges: [
            '減少紅肉頻率（每週最多 1-2 次，每次 ≤100g）',
            '避免鐵強化食品和含鐵補充劑',
            '餐中搭配茶或咖啡（單寧酸可抑制鐵吸收）',
            '增加抗氧化食物以對抗鐵引起的氧化壓力',
          ],
          foodsToIncrease: ['綠茶', '蔬菜', '全穀類', '豆腐', '雞胸肉', '魚類'],
          foodsToReduce: ['紅肉', '內臟', '鐵強化穀片', '高劑量維生素 C 補充劑（促進鐵吸收）'],
          macroAdjustment: {
            nutrient: '蛋白質來源',
            direction: 'decrease',
            detail: '蛋白質改以白肉（雞、魚）和植物性蛋白為主，減少血基質鐵攝入',
          },
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: gender === '女性' ? '12-200 ng/mL' : '50-150 ng/mL',
          references: [
            'Koperdanova & Bhatt 2015 (BMJ): Approach to the patient with hyperferritinaemia',
            'Adams et al. 2005 (NEJM): Hemochromatosis and iron-overload screening',
            'Hurrell & Egli 2010 (Am J Clin Nutr): Iron bioavailability and dietary reference values',
          ],
          caveat: '鐵蛋白為急性期蛋白，發炎時會假性升高。建議同時參考 CRP；若 CRP 正常但鐵蛋白仍高，才確定為鐵過載。',
        })
      } else if (isLow) {
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
          references: [
            'WHO 2021: Iron Deficiency Anemia — Assessment, Prevention and Control',
            'Hurrell & Egli 2010 (Am J Clin Nutr): Iron bioavailability and dietary reference values',
            'Hallberg et al. 2003 (Am J Clin Nutr): Inhibitory effect of tea & coffee on iron absorption',
          ],
          caveat: '鐵蛋白為急性期蛋白，發炎時會假性升高。若同時有 CRP 偏高，真實鐵蛋白可能更低。',
        })
      }
    }

    // ── 血紅素 ──
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
          references: [
            'WHO 2011: Haemoglobin concentrations for the diagnosis of anaemia',
            'Sim et al. 2019 (Nutrients): Iron considerations for the athlete',
          ],
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
        references: [
          'Calder 2017 (J Nutr): Omega-3 fatty acids and inflammatory processes',
          'Galland 2010 (Nutr Clin Pract): Diet and inflammation',
          'Ridker 2003 (Circulation): Clinical application of CRP for cardiovascular disease',
        ],
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
        references: [
          'Miller et al. 2011 (J Am Coll Cardiol): Triglycerides and cardiovascular disease',
          'Skulas-Ray et al. 2019 (Circulation): AHA advisory — Omega-3 for hypertriglyceridemia',
          'Parks 2001 (J Nutr): Dietary carbohydrate effects on lipogenesis and TG',
        ],
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
        references: [
          'Sniderman et al. 2019 (JAMA Cardiol): ApoB vs LDL-C as primary measure of atherogenic risk',
          'Ference et al. 2017 (Eur Heart J): Low-density lipoproteins cause atherosclerosis',
          'AHA 2021: Diet and Lifestyle Recommendations',
        ],
      })
    }

    // ── HOMA-IR → 胰島素敏感性 ──
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
        references: [
          'Wallace et al. 2004 (Diabetes Care): Use and abuse of HOMA modeling',
          'Richter & Hargreaves 2013 (Physiol Rev): Exercise, GLUT4, and skeletal muscle glucose uptake',
          'Johnston et al. 2004 (Diabetes Care): Vinegar improves insulin sensitivity in insulin-resistant subjects',
        ],
      })
    }

    // ── 空腹血糖 ──
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
          references: [
            'ADA 2024: Standards of Care in Diabetes — classification and diagnosis',
            'Colberg et al. 2016 (Diabetes Care): Physical activity/exercise and diabetes',
            'Khan et al. 2003 (Diabetes Care): Cinnamon improves glucose and lipids in type 2 diabetes',
          ],
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
        references: [
          'Holick 2007 (NEJM): Vitamin D deficiency',
          'Owens et al. 2018 (Eur J Sport Sci): Vitamin D and the athlete',
          'Dawson-Hughes et al. 2005 (Am J Clin Nutr): Dietary fat increases vitamin D-3 absorption',
        ],
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
        references: [
          'Selhub 1999 (Annu Rev Nutr): Homocysteine metabolism',
          'Clarke et al. 2014 (BMJ): B-vitamins and homocysteine reduction',
          'Refsum et al. 2004 (Clin Chem): Facts and recommendations about total homocysteine',
        ],
      })
    }

    // ── 鎂（區分偏高 vs 偏低）──
    if (matchName(lab.test_name, ['鎂', 'magnesium'])) {
      const mgHigh = lab.value > 2.4
      const mgCaveat = '血清鎂僅反映全身鎂的 0.3%（99% 存在於骨骼和細胞內）。血清鎂正常不代表身體不缺鎂，RBC 鎂或 24hr 尿鎂更能反映真實狀態。運動員因流汗損耗，實際缺乏風險更高。'
      if (mgHigh) {
        advice.push({
          category: 'mineral',
          title: '鎂偏高',
          icon: '🥬',
          severity: lab.status === 'alert' ? 'high' : 'medium',
          dietaryChanges: [
            '暫停鎂補充劑',
            '減少高鎂食物攝取量（堅果、黑巧克力）',
            '確認腎功能是否正常（腎功能下降會導致鎂滯留）',
          ],
          foodsToIncrease: [],
          foodsToReduce: ['鎂補充劑', '大量堅果', '黑巧克力'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '2.0-2.4 mg/dL',
          references: [
            'Swaminathan 2003 (Clin Biochem Rev): Magnesium metabolism and its disorders',
            'Musso 2009 (Int Urol Nephrol): Magnesium metabolism in health and disease',
          ],
          caveat: mgCaveat,
        })
      } else {
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
          references: [
            'DiNicolantonio et al. 2018 (Open Heart): Subclinical magnesium deficiency — a principal driver of cardiovascular disease',
            'Nielsen & Lukaski 2006 (Magnes Res): Update on magnesium and exercise',
            'Zhang et al. 2017 (Nutrients): Effects of magnesium supplementation on blood pressure',
          ],
          caveat: mgCaveat,
        })
      }
    }

    // ── 鋅（區分偏高 vs 偏低）──
    if (matchName(lab.test_name, ['鋅', 'zinc'])) {
      const znHigh = lab.value > 120
      const znCaveat = '血清鋅受餐後狀態、發炎反應、時間點影響極大（需空腹抽血）。發炎時鋅會從血液轉移至肝臟，導致血清鋅假性偏低。建議同時參考 CRP 判讀。'
      if (znHigh) {
        advice.push({
          category: 'mineral',
          title: '鋅偏高',
          icon: '🦪',
          severity: lab.status === 'alert' ? 'high' : 'medium',
          dietaryChanges: [
            '暫停鋅補充劑',
            '減少貝類和紅肉頻率',
            '注意：長期鋅過高會抑制銅吸收，留意相關症狀',
          ],
          foodsToIncrease: [],
          foodsToReduce: ['鋅補充劑', '牡蠣（暫時減少）', '過量紅肉'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '70-120 µg/dL',
          references: [
            'Plum et al. 2010 (Int J Environ Res Public Health): The essential toxin — impact of zinc on human health',
            'Fosmire 1990 (Am J Clin Nutr): Zinc toxicity',
          ],
          caveat: znCaveat,
        })
      } else {
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
          references: [
            'King et al. 2016 (J Nutr): Biomarkers of Nutrition for Development (BOND) — Zinc review',
            'Kilic 2007 (Neuro Endocrinol Lett): Effect of zinc supplementation on free testosterone in male athletes',
            'Prasad 2008 (Mol Med): Zinc in human health — effect on immune cells',
          ],
          caveat: znCaveat,
        })
      }
    }

    // ── 睪固酮（區分男性偏低 vs 女性偏高）──
    if (matchName(lab.test_name, ['睪固酮', 'testosterone', '總睪固酮', 'total testosterone'])) {
      const isMale = gender !== '女性'
      if (isMale && lab.value < 300) {
        // 男性睪固酮偏低
        advice.push({
          category: 'hormone',
          title: '睪固酮偏低',
          icon: '💪',
          severity: lab.value < 200 ? 'high' : 'medium',
          dietaryChanges: [
            '確保脂肪攝取充足（佔總熱量 25-35%），過低脂肪飲食會抑制睪固酮合成',
            '鋅和維生素 D 是睪固酮合成必需輔因子，確認這兩項血檢是否正常',
            '避免過度熱量赤字（>500 kcal/day 持續超過 12 週會顯著壓低 T）',
            '減少酒精攝取（乙醇直接抑制睪丸 Leydig 細胞合成 T）',
            '確保每日膽固醇攝取足夠（蛋黃、海鮮），膽固醇是 T 的直接前驅物',
          ],
          foodsToIncrease: ['全蛋', '酪梨', '橄欖油', '牡蠣（鋅）', '巴西堅果（硒）', '十字花科蔬菜（DIM 降低雌激素）', '大蒜（促進 LH）'],
          foodsToReduce: ['酒精', '大豆異黃酮（過量）', '薄荷茶（抗雄性素效果）', '過度加工食品'],
          macroAdjustment: {
            nutrient: '脂肪',
            direction: 'increase',
            detail: '脂肪佔總熱量至少 25%，飽和脂肪 ≥10%（膽固醇是睪固酮前驅物）。減脂期不要低脂飲食。',
          },
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '450-800 ng/dL（運動員理想）',
          references: [
            'Volek et al. 1997 (J Appl Physiol): Testosterone and cortisol in relationship to dietary nutrients and resistance exercise',
            'Prasad et al. 1996 (Nutrition): Zinc status and serum testosterone levels in healthy adults',
            'Pilz et al. 2011 (Horm Metab Res): Effect of vitamin D supplementation on testosterone levels',
            'Whittaker & Wu 2021 (Nutrients): Low-fat diets and testosterone in men — systematic review and meta-analysis',
            'Kilic 2007 (Neuro Endocrinol Lett): Zinc supplementation and free testosterone in male athletes',
          ],
          caveat: '總睪固酮受 SHBG 影響大，SHBG 高時游離睪固酮可能偏低但總 T 正常。建議同時檢驗游離睪固酮或計算游離 T。另外，抽血時間影響結果（早上 T 最高），需早晨空腹抽血。',
        })
      } else if (isMale && lab.value > 300) {
        // 男性 T 在 attention/alert 但 > 300 可能是邊界值
        // 只有當 status 是非 normal 且 > 300 → 可能是偏高（例如外源使用）
        // 這裡不給飲食建議，因為高 T 通常不是飲食問題
      }
      if (!isMale && lab.value > 70) {
        // 女性睪固酮偏高
        advice.push({
          category: 'hormone',
          title: '睪固酮偏高',
          icon: '⚖️',
          severity: lab.status === 'alert' ? 'high' : 'medium',
          dietaryChanges: [
            '減少精製碳水和高 GI 食物（胰島素阻抗會刺激卵巢產生更多雄性素）',
            '增加抗發炎食物（Omega-3、莓果、薑黃）',
            '增加纖維攝取（25-30g/day，幫助排除多餘雌激素和雄性素代謝物）',
            '考慮薄荷茶（研究顯示有輕微降低雄性素效果）',
          ],
          foodsToIncrease: ['深海魚', '亞麻籽', '薄荷茶', '綠茶', '高纖蔬菜', '肉桂'],
          foodsToReduce: ['精製碳水', '含糖食物', '乳製品（可能刺激 IGF-1）'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '15-70 ng/dL',
          references: [
            'Grant 2010 (J Clin Endocrinol Metab): Spearmint herbal tea and androgen levels in PCOS',
            'Escobar-Morreale et al. 2005 (Eur J Endocrinol): Dietary composition and PCOS',
            'Barrea et al. 2019 (Nutrients): Nutrition and PCOS — from bench to bedside',
          ],
          caveat: '女性睪固酮偏高常與 PCOS 相關，建議配合婦產科/內分泌科評估。飲食調整可輔助但不能替代醫療。',
        })
      }
    }

    // ── 游離睪固酮 ──
    if (matchName(lab.test_name, ['游離睪固酮', 'free testosterone', 'freetestosterone'])) {
      const isMale = gender !== '女性'
      if (isMale && lab.value < 9) {
        advice.push({
          category: 'hormone',
          title: '游離睪固酮偏低',
          icon: '💪',
          severity: lab.value < 5 ? 'high' : 'medium',
          dietaryChanges: [
            '確保脂肪攝取充足（佔總熱量 25-35%）',
            '硼（Boron）可降低 SHBG 從而提高游離 T — 每日 3-6mg（酪梨、葡萄乾、杏仁）',
            '維生素 D + 鋅 + 鎂 三位一體確保充足',
            '避免長期大幅熱量赤字',
          ],
          foodsToIncrease: ['全蛋', '酪梨', '杏仁', '葡萄乾（硼）', '牡蠣', '橄欖油'],
          foodsToReduce: ['酒精', '過量咖啡因（>400mg/day）'],
          macroAdjustment: {
            nutrient: '脂肪',
            direction: 'increase',
            detail: '脂肪至少佔總熱量 25%，確保飽和脂肪和單元不飽和脂肪均有攝取',
          },
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '9-30 pg/mL（男性）',
          references: [
            'Naghii et al. 2011 (J Trace Elem Med Biol): Comparative effects of boron and calcium-fructoborate on serum free testosterone',
            'Volek et al. 1997 (J Appl Physiol): Testosterone responses to dietary fat and resistance exercise',
            'Cinar et al. 2011 (Biol Trace Elem Res): Effects of magnesium supplementation on testosterone levels in athletes',
          ],
          caveat: '游離睪固酮比總 T 更能反映實際活性水平，但需注意：計算值（Vermeulen 公式）vs 直接測量（平衡透析法）差異可達 20-30%。',
        })
      }
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
