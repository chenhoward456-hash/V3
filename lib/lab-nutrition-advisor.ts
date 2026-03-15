/**
 * Lab-Driven Nutrition Advisor (Comprehensive Edition)
 * 血檢結果 → 個人化飲食建議
 *
 * 涵蓋 30+ 血檢指標：
 *   代謝（血糖、胰島素、HOMA-IR、HbA1c、尿酸）
 *   血脂（TG、ApoB、LDL、HDL、Lp(a)、總膽固醇）
 *   肝功能（AST、ALT、GGT、白蛋白）
 *   腎功能（肌酸酐、BUN、eGFR）
 *   甲狀腺（TSH、Free T4）
 *   鐵（鐵蛋白、血紅素、MCV）
 *   發炎（CRP、同半胱胺酸）
 *   維生素（D、B12、葉酸）
 *   礦物質（鎂、鋅、鈣）
 *   荷爾蒙（睪固酮、游離T、皮質醇、DHEA-S、雌二醇、SHBG）
 *
 * 每條建議皆附 peer-reviewed 文獻出處
 * 血清值有侷限性的指標以 caveat 標示
 */

export interface LabNutritionAdvice {
  category: 'iron' | 'inflammation' | 'lipid' | 'glucose' | 'vitamin' | 'mineral' | 'hormone' | 'liver' | 'kidney' | 'thyroid' | 'blood'
  title: string
  icon: string
  severity: 'high' | 'medium' | 'positive'
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
  references: string[]
  caveat?: string
}

interface LabInput {
  test_name: string
  value: number | null
  unit: string
  status: 'normal' | 'attention' | 'alert'
  date?: string
}

import { matchLabName as matchName } from '@/utils/labMatch'

export function generateLabNutritionAdvice(
  labs: LabInput[],
  options: { gender?: '男性' | '女性'; goalType?: 'cut' | 'bulk' | null } = {}
): LabNutritionAdvice[] {
  const advice: LabNutritionAdvice[] = []
  const { gender, goalType } = options

  for (const lab of labs) {
    if (lab.value == null) continue

    // ════════════════════════════════════════
    // 優勢指標正向建議（Positive Advice Cards）
    // ════════════════════════════════════════

    if (matchName(lab.test_name, ['homa-ir', 'homair']) && lab.value < 1.0) {
      advice.push({
        category: 'glucose',
        title: '胰島素敏感度頂尖',
        icon: '🟢',
        severity: 'positive',
        dietaryChanges: [
          '訓練日碳水可拉高至 5-6g/kg，充分利用胰島素敏感度優勢',
          '碳水時機可更靈活，不需嚴格限制在訓練前後',
          '高碳日可作為合成代謝的推力，有利增肌或維持肌肉量',
        ],
        foodsToIncrease: ['白飯', '地瓜', '馬鈴薯', '香蕉', '燕麥'],
        foodsToReduce: [],
        macroAdjustment: { nutrient: '碳水化合物', direction: 'increase', detail: '碳水 +0.3g/kg，訓練日可拉到 5-6g/kg' },
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '<1.0（頂尖）/ <1.4（優秀）',
        references: ['Volek & Phinney 2011', 'Richter & Hargreaves 2013, Physiol Rev'],
      })
    }

    if (matchName(lab.test_name, ['apob', 'apolipoproteinb']) && lab.value < 60) {
      advice.push({
        category: 'lipid',
        title: 'ApoB 極低，心血管風險極低',
        icon: '🟢',
        severity: 'positive',
        dietaryChanges: [
          '飲食脂肪比例可適度放寬，不需刻意限制飽和脂肪',
          '可以更靈活地選擇蛋白質來源（含脂肉品、全蛋等）',
          '堅果、酪梨等高脂食物可自由攝取',
        ],
        foodsToIncrease: ['全蛋', '牛排', '酪梨', '堅果', '起司'],
        foodsToReduce: [],
        macroAdjustment: { nutrient: '脂肪', direction: 'increase', detail: '脂肪 +0.1g/kg，飽和脂肪不需嚴格限制' },
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '<60（頂尖）/ <80（理想）',
        references: ['Sniderman et al. 2019, Lancet', 'Ference et al. 2017, Eur Heart J'],
      })
    }

    if (matchName(lab.test_name, ['三酸甘油酯', 'triglyceride', 'tg']) && lab.value < 70) {
      advice.push({
        category: 'lipid',
        title: '三酸甘油酯極低，脂質代謝極佳',
        icon: '🟢',
        severity: 'positive',
        dietaryChanges: [
          '碳水耐受力強，不需額外限制精製碳水',
          '可在訓練日攝取較高碳水而無脂質代謝風險',
        ],
        foodsToIncrease: ['白飯', '水果', '果汁（訓練後）'],
        foodsToReduce: [],
        macroAdjustment: { nutrient: '碳水化合物', direction: 'increase', detail: '碳水 +0.2g/kg，碳水來源限制可放寬' },
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '<70（頂尖）/ <100（理想）',
        references: ['Miller et al. 2011, Circulation'],
      })
    }

    // 跳過正常指標的異常分析
    if (lab.status === 'normal') continue

    // ════════════════════════════════════════
    // 代謝 / 血糖
    // ════════════════════════════════════════

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
            '早餐碳水加入肉桂（改善血糖反應）',
            '進食順序：蔬菜 → 蛋白質 → 碳水（可降低餐後血糖波動 30-40%）',
          ],
          foodsToIncrease: ['蔬菜', '堅果', '肉桂', '醋', '高纖食物', '豆類'],
          foodsToReduce: ['精製碳水', '含糖飲料', '高 GI 零食', '果汁'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '<90 mg/dL（最佳）',
          references: [
            'ADA 2024: Standards of Care in Diabetes — classification and diagnosis',
            'Colberg et al. 2016 (Diabetes Care): Physical activity/exercise and diabetes',
            'Khan et al. 2003 (Diabetes Care): Cinnamon improves glucose and lipids in type 2 diabetes',
            'Shukla et al. 2015 (Diabetes Care): Food order has significant impact on postprandial glucose',
          ],
        })
      }
    }

    if (matchName(lab.test_name, ['空腹胰島素', 'fasting insulin'])) {
      if (lab.value > 5) {
        advice.push({
          category: 'glucose',
          title: '空腹胰島素偏高',
          icon: '💉',
          severity: lab.value > 8 ? 'high' : 'medium',
          dietaryChanges: [
            '減少精製碳水，改為全穀、地瓜等低 GI 來源',
            '增加膳食纖維至每日 30g+（減緩碳水吸收速率）',
            '餐前 1 湯匙蘋果醋稀釋飲用（改善餐後胰島素反應）',
            '碳水集中在訓練前後攝取，休息日減少碳水比例',
          ],
          foodsToIncrease: ['蔬菜', '豆類', '燕麥', '蘋果醋', '肉桂', '綠茶'],
          foodsToReduce: ['白飯', '麵包', '含糖飲料', '精製零食'],
          macroAdjustment: {
            nutrient: '碳水化合物',
            direction: 'decrease',
            detail: '考慮碳循環：訓練日碳水 4-5g/kg，休息日 2-3g/kg',
          },
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '<5.0 µIU/mL（最佳）',
          references: [
            'Reaven 2005 (Annu Rev Nutr): The insulin resistance syndrome',
            'Johnston et al. 2004 (Diabetes Care): Vinegar improves insulin sensitivity',
            'Weickert & Pfeiffer 2008 (J Nutr): Metabolic effects of dietary fiber consumption',
          ],
        })
      }
    }

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

    if (matchName(lab.test_name, ['hba1c', '糖化血色素', '糖化血紅素'])) {
      advice.push({
        category: 'glucose',
        title: '糖化血色素偏高',
        icon: '📈',
        severity: lab.value > 5.7 ? 'high' : 'medium',
        dietaryChanges: [
          'HbA1c 反映過去 2-3 個月的平均血糖，需長期飲食調整',
          '所有碳水來源改為低 GI（地瓜、糙米、燕麥、豆類）',
          '每餐先吃蔬菜和蛋白質，最後吃碳水',
          '每餐後走路 10 分鐘（累積效果顯著）',
          '增加可溶性纖維攝取（洋車前子、燕麥、豆類）',
        ],
        foodsToIncrease: ['燕麥', '豆類', '地瓜', '綠色蔬菜', '堅果', '肉桂', '莓果'],
        foodsToReduce: ['白飯', '白麵包', '含糖飲料', '甜食', '果汁', '精製零食'],
        macroAdjustment: {
          nutrient: '碳水化合物',
          direction: 'decrease',
          detail: '碳水佔總熱量降至 40-45%，全部來自低 GI 來源，搭配足量纖維',
        },
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: '%',
        targetRange: '<5.5%（最佳）',
        references: [
          'ADA 2024: Standards of Care in Diabetes',
          'Jenkins et al. 2002 (Am J Clin Nutr): Glycemic index and chronic disease risk',
          'Reynolds et al. 2019 (Lancet): Carbohydrate quality and health — dietary fibre and whole grains',
        ],
      })
    }

    if (matchName(lab.test_name, ['尿酸', 'uric acid'])) {
      const uaMax = gender === '女性' ? 6.0 : 7.0
      if (lab.value > uaMax) {
        advice.push({
          category: 'glucose',
          title: '尿酸偏高',
          icon: '🦶',
          severity: lab.value > 9 ? 'high' : 'medium',
          dietaryChanges: [
            '減少高普林食物（內臟、紅肉、海鮮的攝取頻率和份量）',
            '完全避免啤酒和烈酒（酒精代謝直接增加尿酸）',
            '每日飲水 2.5-3L（促進尿酸排泄）',
            '增加低脂乳製品（酪蛋白有促進尿酸排泄效果）',
            '減少果糖攝取（果糖代謝直接產生尿酸）',
          ],
          foodsToIncrease: ['低脂牛奶', '優格', '櫻桃', '維生素C食物', '大量水'],
          foodsToReduce: ['內臟', '啤酒', '含糖飲料（果糖）', '過量海鮮', '過量紅肉'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: gender === '女性' ? '<6.0 mg/dL' : '<7.0 mg/dL',
          references: [
            'Choi et al. 2004 (NEJM): Purine-rich foods, dairy, protein intake, and risk of gout',
            'Juraschek et al. 2011 (Arthritis Care Res): Effect of vitamin C supplementation on serum uric acid',
            'Choi & Curhan 2008 (BMJ): Soft drinks, fructose, and risk of gout in men',
          ],
          caveat: '尿酸偏高不一定會痛風，但長期高尿酸與代謝症候群、心血管風險相關。減脂期過度斷食或生酮也可能暫時升高尿酸（酮體與尿酸競爭腎臟排泄）。',
        })
      }
    }

    // ════════════════════════════════════════
    // 血脂
    // ════════════════════════════════════════

    if (matchName(lab.test_name, ['三酸甘油酯', 'triglyceride', 'tg'])) {
      advice.push({
        category: 'lipid',
        title: '三酸甘油酯偏高',
        icon: '💧',
        severity: lab.value > 150 ? 'high' : 'medium',
        dietaryChanges: [
          '減少精製碳水（白飯換糙米、地瓜）',
          '完全避免含糖飲料和果汁',
          '增加 Omega-3 攝取（EPA+DHA 有直接降 TG 效果，每日 2-4g）',
          '適量增加纖維攝取（每日 25-30g）',
          '限制酒精（酒精是 TG 最強的飲食驅動因子之一）',
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

    if (matchName(lab.test_name, ['lp(a)', 'lpa', 'lipoprotein(a)', 'lipoprotein a'])) {
      advice.push({
        category: 'lipid',
        title: 'Lp(a) 偏高',
        icon: '🫀',
        severity: lab.value > 50 ? 'high' : 'medium',
        dietaryChanges: [
          'Lp(a) 主要由基因決定（>90%），飲食影響有限但可降低整體心血管風險',
          '最大化抗發炎飲食（降低整體心血管風險 stack）',
          '確保 ApoB 和 LDL-C 盡量在最佳範圍（Lp(a) 高時其他脂質指標更需嚴格）',
          '增加 Omega-3 攝取和抗氧化物',
        ],
        foodsToIncrease: ['深海魚', '橄欖油', '堅果', '莓果', '綠色蔬菜'],
        foodsToReduce: ['反式脂肪', '加工食品', '過量飽和脂肪'],
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '<30 nmol/L（理想）',
        references: [
          'Tsimikas et al. 2020 (J Am Coll Cardiol): Lp(a) and cardiovascular disease',
          'Nordestgaard et al. 2010 (Eur Heart J): Lp(a) as a cardiovascular risk factor',
        ],
        caveat: 'Lp(a) 超過 90% 由基因決定，飲食和運動對其直接影響非常有限。但可以透過控制其他風險因子（LDL、發炎、血壓）來降低整體心血管風險。',
      })
    }

    if (matchName(lab.test_name, ['ldl-c', 'ldl', '低密度脂蛋白', '低密度膽固醇'])) {
      advice.push({
        category: 'lipid',
        title: 'LDL-C 偏高',
        icon: '🔴',
        severity: lab.value > 130 ? 'high' : 'medium',
        dietaryChanges: [
          '減少飽和脂肪至總熱量 <7%（紅肉、全脂乳、椰子油）',
          '每日攝取 10-25g 可溶性纖維（燕麥、豆類、洋車前子）',
          '每日 2g 植物固醇（堅果、豆類、強化食品）',
          '增加單元不飽和脂肪酸（橄欖油、酪梨）替代飽和脂肪',
        ],
        foodsToIncrease: ['燕麥', '豆類', '堅果', '酪梨', '橄欖油', '深海魚', '蘋果'],
        foodsToReduce: ['紅肉', '全脂乳製品', '椰子油', '棕櫚油', '加工食品'],
        macroAdjustment: {
          nutrient: '脂肪',
          direction: 'decrease',
          detail: '飽和脂肪 <7% 總熱量，改以 MUFA（橄欖油）和 PUFA（魚油、堅果）為主',
        },
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '<100 mg/dL（最佳，有心血管風險者 <70）',
        references: [
          'Ference et al. 2017 (Eur Heart J): Low-density lipoproteins cause atherosclerosis',
          'NCEP ATP III 2002: Detection, evaluation, and treatment of high cholesterol',
          'Estruch et al. 2018 (NEJM): PREDIMED — Mediterranean diet and cardiovascular prevention',
        ],
      })
    }

    if (matchName(lab.test_name, ['hdl-c', 'hdl', '高密度脂蛋白', '高密度膽固醇'])) {
      const hdlMin = gender === '女性' ? 50 : 40
      if (lab.value < hdlMin) {
        advice.push({
          category: 'lipid',
          title: 'HDL-C 偏低',
          icon: '💛',
          severity: lab.status === 'alert' ? 'high' : 'medium',
          dietaryChanges: [
            '增加有氧運動（每週 150 分鐘中等強度，HDL 可提高 5-10%）',
            '增加單元不飽和脂肪（橄欖油、酪梨、堅果）',
            '減少精製碳水和反式脂肪',
            '適量紅酒（1 杯/天）可輕微提高 HDL，但不建議為此開始喝酒',
            '減重（每減 3kg 體重，HDL 約提高 1 mg/dL）',
          ],
          foodsToIncrease: ['橄欖油', '酪梨', '堅果', '深海魚', '全蛋'],
          foodsToReduce: ['反式脂肪', '精製碳水', '含糖食物'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: gender === '女性' ? '>50 mg/dL' : '>40 mg/dL（理想 >60）',
          references: [
            'Kodama et al. 2007 (Arch Intern Med): Effect of aerobic exercise on HDL',
            'Mensink et al. 2003 (Am J Clin Nutr): Effects of dietary fatty acids on serum lipids',
            'Barter et al. 2007 (NEJM): HDL cholesterol and cardiovascular events',
          ],
        })
      }
    }

    if (matchName(lab.test_name, ['總膽固醇', 'total cholesterol'])) {
      if (lab.value > 200) {
        advice.push({
          category: 'lipid',
          title: '總膽固醇偏高',
          icon: '📊',
          severity: lab.value > 240 ? 'high' : 'medium',
          dietaryChanges: [
            '總膽固醇需搭配 LDL、HDL、TG 一起判讀',
            '減少飽和脂肪攝取，增加可溶性纖維',
            '增加植物固醇來源',
          ],
          foodsToIncrease: ['燕麥', '豆類', '蔬菜', '堅果', '橄欖油'],
          foodsToReduce: ['高飽和脂肪食物', '加工食品'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '<200 mg/dL',
          references: [
            'NCEP ATP III 2002: Detection, evaluation, and treatment of high cholesterol',
            'Grundy et al. 2019 (Circulation): AHA/ACC guideline on cholesterol management',
          ],
          caveat: '總膽固醇單獨意義不大，需搭配 LDL-C、HDL-C、TG、ApoB 綜合判讀。HDL 偏高也會拉高總膽固醇，但不代表風險增加。',
        })
      }
    }

    // ════════════════════════════════════════
    // 肝功能
    // ════════════════════════════════════════

    if (matchName(lab.test_name, ['ast', 'got', 'sgot', '麩草酸轉胺酶'])) {
      advice.push({
        category: 'liver',
        title: 'AST（GOT）偏高',
        icon: '🫁',
        severity: lab.value > 80 ? 'high' : 'medium',
        dietaryChanges: [
          '完全避免酒精至少 4 週（讓肝臟休息）',
          '增加十字花科蔬菜（支持肝臟 Phase 2 解毒酵素）',
          '減少高脂油炸食物和加工食品',
          '確保充足蛋白質攝取（肝臟修復需要胺基酸）',
          '增加抗氧化食物（莓果、綠茶、薑黃）',
        ],
        foodsToIncrease: ['花椰菜', '高麗菜', '綠茶', '薑黃', '莓果', '大蒜', '朝鮮薊'],
        foodsToReduce: ['酒精', '油炸食物', '加工食品', '高糖食物'],
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '<40 U/L',
        references: [
          'Kwo et al. 2017 (Am J Gastroenterol): ACG clinical guideline — evaluation of abnormal liver chemistries',
          'Hodges & Minich 2015 (J Nutr Metab): Modulation of metabolic detoxification pathways using foods',
        ],
        caveat: 'AST 不只存在於肝臟，也大量存在於肌肉（心肌、骨骼肌）。高強度訓練後 AST 可偏高 2-3 倍，通常 48-72 小時恢復。建議抽血前避免高強度訓練 48hr。若 AST 高但 ALT 正常，可能是肌肉來源而非肝臟。',
      })
    }

    if (matchName(lab.test_name, ['alt', 'gpt', 'sgpt', '麩丙酮酸轉胺酶'])) {
      advice.push({
        category: 'liver',
        title: 'ALT（GPT）偏高',
        icon: '🫁',
        severity: lab.value > 80 ? 'high' : 'medium',
        dietaryChanges: [
          '完全避免酒精',
          '減少精製碳水和果糖（非酒精性脂肪肝的主要飲食驅動因子）',
          '增加膳食纖維和抗氧化物',
          '考慮補充牛磺酸和 NAC（N-乙醯半胱胺酸）',
          '增加十字花科蔬菜',
        ],
        foodsToIncrease: ['花椰菜', '高麗菜', '綠茶', '大蒜', '洋蔥', '莓果'],
        foodsToReduce: ['酒精', '果糖', '含糖飲料', '油炸食物', '加工食品'],
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '<40 U/L（理想 <25）',
        references: [
          'Kwo et al. 2017 (Am J Gastroenterol): ACG guideline — abnormal liver chemistries',
          'Zelber-Sagi et al. 2011 (J Hepatol): Dietary patterns and NAFLD',
          'Abdelmalek et al. 2010 (Hepatology): Increased fructose consumption and NAFLD',
        ],
        caveat: 'ALT 比 AST 更具肝臟特異性。若 ALT > AST 且持續偏高，建議排查非酒精性脂肪肝（NAFLD），這在高體脂人群中很常見。',
      })
    }

    if (matchName(lab.test_name, ['ggt', 'γ-gt', 'gamma-gt', '丙麩氨酸轉肽酶'])) {
      advice.push({
        category: 'liver',
        title: 'GGT 偏高',
        icon: '🍺',
        severity: lab.status === 'alert' ? 'high' : 'medium',
        dietaryChanges: [
          '完全避免酒精（GGT 是酒精性肝損傷最敏感的指標）',
          '增加穀胱甘肽前驅物（NAC、含硫蔬菜）',
          '減少加工食品和環境毒素暴露',
        ],
        foodsToIncrease: ['花椰菜', '大蒜', '洋蔥', '蘆筍', '酪梨', '菠菜'],
        foodsToReduce: ['酒精', '加工食品', '油炸食物'],
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: gender === '女性' ? '<40 U/L' : '<60 U/L',
        references: [
          'Whitfield 2001 (Clin Chem): GGT and cardiometabolic risk',
          'Koenig & Seneff 2015 (Entropy): GGT as a biomarker for glutathione status',
        ],
        caveat: 'GGT 升高除了酒精，也可能反映氧化壓力、藥物影響（如 NSAIDs）或膽道問題。某些補充品（過量維生素 A、類固醇）也會升高 GGT。',
      })
    }

    if (matchName(lab.test_name, ['白蛋白', 'albumin'])) {
      if (lab.value < 3.5) {
        advice.push({
          category: 'liver',
          title: '白蛋白偏低',
          icon: '🥚',
          severity: lab.value < 3.0 ? 'high' : 'medium',
          dietaryChanges: [
            '確保蛋白質攝取充足（每日 1.6-2.2g/kg 體重）',
            '優先選擇高生物利用率蛋白質（蛋、乳清、魚、肉）',
            '避免長時間禁食（白蛋白半衰期約 20 天，長期低營養會下降）',
          ],
          foodsToIncrease: ['雞蛋', '乳清蛋白', '雞胸肉', '魚類', '牛奶'],
          foodsToReduce: [],
          macroAdjustment: {
            nutrient: '蛋白質',
            direction: 'increase',
            detail: '蛋白質攝取提高至 2.0-2.2g/kg，確保每餐 30-40g 優質蛋白質',
          },
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '>4.0 g/dL（理想）',
          references: [
            'Don & Kaysen 2004 (J Am Soc Nephrol): Serum albumin — relationship to inflammation and nutrition',
            'Morton et al. 2018 (Br J Sports Med): Protein distribution and muscle protein synthesis',
          ],
          caveat: '白蛋白是負性急性期蛋白，發炎時會下降（不代表蛋白質攝取不足）。脫水時會假性升高。需搭配 CRP 和飲食記錄綜合判讀。',
        })
      }
    }

    // ════════════════════════════════════════
    // 腎功能
    // ════════════════════════════════════════

    if (matchName(lab.test_name, ['肌酸酐', 'creatinine'])) {
      const crMax = gender === '女性' ? 1.1 : 1.3
      if (lab.value > crMax) {
        advice.push({
          category: 'kidney',
          title: '肌酸酐偏高',
          icon: '🫘',
          severity: lab.status === 'alert' ? 'high' : 'medium',
          dietaryChanges: [
            '確保每日飲水 2.5-3L（維持腎臟灌流）',
            '蛋白質攝取不需要大幅降低，但避免超過 2.5g/kg',
            '減少肌酸補充劑（會直接提高肌酸酐）',
            '限制鈉攝取（<2000mg/day）',
          ],
          foodsToIncrease: ['水', '蔬菜', '水果'],
          foodsToReduce: ['過量蛋白質', '高鈉食物', '加工食品', '肌酸補充劑'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: gender === '女性' ? '0.6-1.1 mg/dL' : '0.7-1.3 mg/dL',
          references: [
            'KDIGO 2024: Clinical practice guideline for CKD evaluation and management',
            'Levey et al. 2009 (Ann Intern Med): Using GFR estimation equations',
          ],
          caveat: '肌肉量高的人肌酸酐自然偏高（肌酸酐是肌酸代謝產物）。服用肌酸補充劑也會升高。單看肌酸酐不準確，需搭配 eGFR 和 BUN 綜合判讀腎功能。',
        })
      }
    }

    if (matchName(lab.test_name, ['bun', '血尿素氮', '尿素氮'])) {
      if (lab.value > 20) {
        advice.push({
          category: 'kidney',
          title: 'BUN 偏高',
          icon: '🫘',
          severity: lab.value > 25 ? 'high' : 'medium',
          dietaryChanges: [
            '確保充足飲水（脫水是 BUN 偏高最常見原因）',
            '蛋白質攝取適度調降（BUN 直接反映蛋白質代謝廢物）',
            '避免長時間禁食或過度限制碳水',
          ],
          foodsToIncrease: ['水', '蔬菜', '水果'],
          foodsToReduce: ['過量蛋白質粉'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '7-20 mg/dL',
          references: [
            'KDIGO 2024: CKD evaluation and management',
            'Hosten 1990 (Clinical Methods): BUN and creatinine',
          ],
          caveat: '高蛋白飲食（>2g/kg）本身就會升高 BUN，這不代表腎臟有問題。脫水、腸胃出血、高蛋白餐後也會升高。需搭配肌酸酐和 eGFR 判讀。',
        })
      }
    }

    if (matchName(lab.test_name, ['egfr', '腎絲球過濾率'])) {
      if (lab.value < 90) {
        advice.push({
          category: 'kidney',
          title: 'eGFR 偏低',
          icon: '🫘',
          severity: lab.value < 60 ? 'high' : 'medium',
          dietaryChanges: [
            '確保充足飲水',
            '控制血壓（限鈉 <2000mg/day）',
            '蛋白質不需過度限制（除非 eGFR<30），但避免 >2.0g/kg',
            '增加抗氧化食物',
          ],
          foodsToIncrease: ['蔬菜', '莓果', '水'],
          foodsToReduce: ['高鈉食物', '加工食品'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '>90 mL/min/1.73m²',
          references: [
            'KDIGO 2024: CKD evaluation and management',
            'Kalantar-Zadeh et al. 2020 (NEJM): Plant-dominant low-protein diet for CKD',
          ],
          caveat: 'eGFR 是用肌酸酐推算的估計值。肌肉量大的人 eGFR 會被低估（因為肌酸酐本來就高）。建議搭配 Cystatin C 計算更準確。',
        })
      }
    }

    // ════════════════════════════════════════
    // 甲狀腺
    // ════════════════════════════════════════

    if (matchName(lab.test_name, ['tsh', '促甲狀腺激素'])) {
      const tshHigh = lab.value > 4.0
      if (tshHigh) {
        advice.push({
          category: 'thyroid',
          title: 'TSH 偏高（甲狀腺低下傾向）',
          icon: '🦋',
          severity: lab.value > 5.0 ? 'high' : 'medium',
          dietaryChanges: [
            '確保碘攝取充足（海帶、紫菜、碘鹽），但不要過量',
            '確保硒攝取（硒是 T4→T3 轉換酶的必要輔因子）',
            '避免大量生食十字花科蔬菜（含 goitrogens，煮熟後影響大幅降低）',
            '確保鋅攝取充足（甲狀腺素合成需要鋅）',
          ],
          foodsToIncrease: ['海帶（適量）', '紫菜', '巴西堅果（硒）', '海鮮', '全蛋'],
          foodsToReduce: ['生十字花科蔬菜（煮熟可以）', '過量大豆異黃酮'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '0.4-4.0 mIU/L（理想 1.0-2.0）',
          references: [
            'Garber et al. 2012 (Endocr Pract): ATA/AACE guidelines for hypothyroidism',
            'Ventura et al. 2017 (Nutrients): Selenium and thyroid disease',
            'Bajaj et al. 2016 (Indian J Endocrinol Metab): Goitrogens and thyroid function',
          ],
          caveat: '減脂期長期大幅熱量赤字（>500 kcal）會降低 T3 並升高 TSH，這是身體的節能機制而非甲狀腺疾病。恢復正常熱量通常會改善。',
        })
      } else if (lab.value < 0.4) {
        advice.push({
          category: 'thyroid',
          title: 'TSH 偏低（甲狀腺亢進傾向）',
          icon: '🦋',
          severity: lab.value < 0.3 ? 'high' : 'medium',
          dietaryChanges: [
            '避免過量碘攝取（停止碘補充劑、減少海帶）',
            '增加抗氧化食物（甲亢狀態氧化壓力高）',
            '確保鈣和維生素 D 充足（甲亢會加速骨質流失）',
            '增加熱量攝取（甲亢代謝率高，容易消耗過多）',
          ],
          foodsToIncrease: ['十字花科蔬菜', '莓果', '乳製品（鈣）', '堅果'],
          foodsToReduce: ['海帶', '紫菜', '碘鹽（改無碘鹽）', '碘補充劑'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '0.4-4.0 mIU/L',
          references: [
            'Ross et al. 2016 (Thyroid): ATA guidelines for hyperthyroidism',
            'Bahn et al. 2011 (Thyroid): Hyperthyroidism and other causes of thyrotoxicosis',
          ],
          caveat: 'TSH 偏低需要醫療評估，飲食調整只能輔助。若確診甲亢，需配合內分泌科治療。',
        })
      }
    }

    if (matchName(lab.test_name, ['free t4', 'ft4', '游離甲狀腺素'])) {
      if (lab.value < 0.8) {
        advice.push({
          category: 'thyroid',
          title: 'Free T4 偏低',
          icon: '🦋',
          severity: lab.value < 0.6 ? 'high' : 'medium',
          dietaryChanges: [
            '確保碘和硒攝取充足',
            '避免長期極低熱量飲食（會抑制甲狀腺素合成）',
            '確保足夠的碳水攝取（極低碳也會降低 T4→T3 轉換）',
          ],
          foodsToIncrease: ['海鮮', '海帶（適量）', '巴西堅果', '全蛋'],
          foodsToReduce: ['過量生十字花科蔬菜'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '0.8-1.8 ng/dL',
          references: [
            'Garber et al. 2012 (Endocr Pract): ATA/AACE guidelines for hypothyroidism',
            'Danforth et al. 1979 (J Clin Invest): Dietary carbohydrate and thyroid hormone metabolism',
            'Kose et al. 2024 (Nutrients): Low-glycemic diets and thyroid — 低碳水使 T3 降幅達 34.6%（vs 高碳水 17.9%），機制為低胰島素抑制脫碘酶活性',
            'Krupa-Kotara et al. 2025 (Curr Issues Mol Biol): Ketogenic diet and thyroid — 生酮飲食降低 T3/FT3，T4 代償性升高',
          ],
          caveat: '長期低碳水飲食會降低 T3（活性甲狀腺素），降幅可達 35%（Kose 2024）。機制：低胰島素 → 脫碘酶活性下降 → T4→T3 轉換受阻。T4 較穩定但若也低，建議回診。',
        })
      }
    }

    // ════════════════════════════════════════
    // 鐵代謝
    // ════════════════════════════════════════

    if (matchName(lab.test_name, ['鐵蛋白', 'ferritin'])) {
      const ferritinMax = gender === '女性' ? 150 : 300
      const ferritinMin = gender === '女性' ? 12 : 30
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

    if (matchName(lab.test_name, ['血紅素', 'hemoglobin', 'hgb'])) {
      const hbMin = gender === '女性' ? 12.0 : 13.5
      if (lab.value < hbMin) {
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
          targetRange: `>${hbMin} g/dL`,
          references: [
            'WHO 2011: Haemoglobin concentrations for the diagnosis of anaemia',
            'Sim et al. 2019 (Nutrients): Iron considerations for the athlete',
          ],
        })
      }
    }

    if (matchName(lab.test_name, ['mcv', '平均紅血球體積'])) {
      if (lab.value < 80) {
        advice.push({
          category: 'blood',
          title: 'MCV 偏低（小球性貧血傾向）',
          icon: '🔬',
          severity: lab.value < 75 ? 'high' : 'medium',
          dietaryChanges: [
            'MCV 低通常指向缺鐵性貧血 → 增加鐵質攝取',
            '確認鐵蛋白是否同時偏低',
            '搭配維生素 C 提高鐵吸收',
          ],
          foodsToIncrease: ['紅肉', '鴨血', '菠菜', '維生素C食物'],
          foodsToReduce: ['餐中茶/咖啡'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: 'fL',
          targetRange: '80-100 fL',
          references: [
            'Camaschella 2015 (NEJM): Iron-deficiency anemia',
            'Cappellini & Motta 2015 (Eur J Intern Med): Anemia in clinical practice',
          ],
        })
      } else if (lab.value > 100) {
        advice.push({
          category: 'blood',
          title: 'MCV 偏高（大球性貧血傾向）',
          icon: '🔬',
          severity: lab.value > 105 ? 'high' : 'medium',
          dietaryChanges: [
            'MCV 高通常指向 B12 或葉酸缺乏',
            '增加 B12 來源（動物性蛋白質）',
            '增加葉酸來源（深綠色蔬菜）',
            '減少酒精（酒精會直接升高 MCV）',
          ],
          foodsToIncrease: ['牛肉', '全蛋', '鮭魚', '菠菜', '蘆筍', '豆類'],
          foodsToReduce: ['酒精'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: 'fL',
          targetRange: '80-100 fL',
          references: [
            'Green & Mitra 2017 (Am Fam Physician): Megaloblastic anemia',
            'Stabler 2013 (NEJM): Vitamin B12 deficiency',
          ],
          caveat: 'MCV 偏高最常見原因是 B12/葉酸缺乏和酒精。但甲狀腺低下也會升高 MCV。',
        })
      }
    }

    // ════════════════════════════════════════
    // 發炎
    // ════════════════════════════════════════

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
          '增加多酚攝取（綠茶、可可、莓果、紅酒）',
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
        caveat: '高強度訓練後 CRP 可能暫時升高（24-72hr），建議抽血前避免激烈運動。感染、受傷也會升高。hs-CRP（高敏感）比一般 CRP 更適合評估慢性低度發炎。',
      })
    }

    if (matchName(lab.test_name, ['同半胱胺酸', 'homocysteine'])) {
      advice.push({
        category: 'inflammation',
        title: '同半胱胺酸偏高',
        icon: '🧬',
        severity: lab.value > 12 ? 'high' : 'medium',
        dietaryChanges: [
          '增加葉酸食物來源（深綠色蔬菜每日 2-3 份）',
          '確保 B12 攝取（動物性蛋白質，素食者需補充）',
          'B6 來源：雞胸肉、鮭魚、馬鈴薯、香蕉',
          '減少咖啡攝取（>4 杯/天可升高同半胱胺酸）',
        ],
        foodsToIncrease: ['菠菜', '蘆筍', '花椰菜', '豆類', '雞胸肉', '鮭魚', '全蛋'],
        foodsToReduce: ['過量咖啡'],
        labMarker: lab.test_name,
        currentValue: lab.value,
        unit: lab.unit,
        targetRange: '<8 µmol/L（最佳）',
        references: [
          'Selhub 1999 (Annu Rev Nutr): Homocysteine metabolism',
          'Clarke et al. 2014 (BMJ): B-vitamins and homocysteine reduction',
          'Refsum et al. 2004 (Clin Chem): Facts and recommendations about total homocysteine',
        ],
        caveat: '同半胱胺酸與 MTHFR 基因多型性相關（台灣人約 10-15% 為 TT 型），TT 型的人葉酸代謝效率低，可能需要甲基葉酸（5-MTHF）而非一般葉酸。',
      })
    }

    // ════════════════════════════════════════
    // 維生素
    // ════════════════════════════════════════

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
          '脂溶性維生素 → 確保每餐有足夠脂肪（≥10g）以助吸收',
          '補充劑建議 2000-4000 IU/day（與餐一起服用）',
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

    if (matchName(lab.test_name, ['維生素b12', 'vitamin b12', 'b12', '鈷胺素'])) {
      if (lab.value < 400) {
        advice.push({
          category: 'vitamin',
          title: '維生素 B12 偏低',
          icon: '🧠',
          severity: lab.value < 200 ? 'high' : 'medium',
          dietaryChanges: [
            'B12 只存在於動物性食物中，素食者必須補充',
            '最佳來源：蛤蜊（每 100g 含 98µg）、肝臟、沙丁魚',
            '每日至少 1 份動物性蛋白質（蛋、肉、魚、乳製品）',
            '注意：長期服用制酸劑（PPI）會降低 B12 吸收',
          ],
          foodsToIncrease: ['蛤蜊', '牛肉', '鮭魚', '全蛋', '牛奶', '優格'],
          foodsToReduce: [],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '>400 pg/mL（理想 500-800）',
          references: [
            'Stabler 2013 (NEJM): Vitamin B12 deficiency',
            'Allen 2009 (Am J Clin Nutr): How common is vitamin B12 deficiency?',
            'Green et al. 2017 (NEJM): Vitamin B12 deficiency from a neurological perspective',
          ],
          caveat: '血清 B12 不完全反映組織內可用量。MMA（甲基丙二酸）升高是更敏感的 B12 功能性缺乏指標。',
        })
      }
    }

    if (matchName(lab.test_name, ['葉酸', 'folate', 'folic acid'])) {
      if (lab.value < 5.4) {
        advice.push({
          category: 'vitamin',
          title: '葉酸偏低',
          icon: '🥬',
          severity: lab.value < 3.0 ? 'high' : 'medium',
          dietaryChanges: [
            '每日至少 2-3 份深綠色蔬菜（菠菜、蘆筍、花椰菜）',
            '增加豆類攝取（黑豆、鷹嘴豆、毛豆）',
            '注意：葉酸怕熱，蔬菜輕微烹調或半生食保留更多',
          ],
          foodsToIncrease: ['菠菜', '蘆筍', '花椰菜', '毛豆', '黑豆', '鷹嘴豆', '酪梨'],
          foodsToReduce: [],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '>5.4 ng/mL（理想 >10）',
          references: [
            'Bailey et al. 2015 (Adv Nutr): Folate — dietary requirements and food sources',
            'Crider et al. 2011 (Pharmacol Ther): Folate and DNA methylation',
          ],
        })
      }
    }

    // ════════════════════════════════════════
    // 礦物質
    // ════════════════════════════════════════

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
            '考慮睡前補充甘胺酸鎂 200-400mg（改善睡眠和恢復）',
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
            '注意：長期鋅過高會抑制銅吸收，留意相關症狀（貧血、白血球低）',
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

    if (matchName(lab.test_name, ['鈣', 'calcium'])) {
      if (lab.value < 8.5) {
        advice.push({
          category: 'mineral',
          title: '鈣偏低',
          icon: '🦴',
          severity: lab.value < 8.0 ? 'high' : 'medium',
          dietaryChanges: [
            '每日攝取 2-3 份乳製品或高鈣食物',
            '確保維生素 D 充足（鈣吸收需要維生素 D）',
            '分散攝取（每次 ≤500mg，分次吸收率更高）',
            '避免高鈉飲食（鈉會增加鈣的腎臟排泄）',
          ],
          foodsToIncrease: ['牛奶', '優格', '起司', '小魚乾', '板豆腐', '芝麻', '深綠色蔬菜'],
          foodsToReduce: ['高鈉食物', '過量咖啡因', '汽水（磷酸鹽）'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '8.5-10.5 mg/dL',
          references: [
            'Weaver et al. 2016 (Osteoporos Int): Calcium plus vitamin D supplementation and risk of fractures',
            'IOM 2011: Dietary Reference Intakes for Calcium and Vitamin D',
          ],
          caveat: '血清總鈣受白蛋白影響（白蛋白低時鈣會假性偏低）。校正公式：校正鈣 = 總鈣 + 0.8 × (4.0 - 白蛋白)。離子化鈣更準確。',
        })
      } else if (lab.value > 10.5) {
        advice.push({
          category: 'mineral',
          title: '鈣偏高',
          icon: '🦴',
          severity: lab.value > 11.0 ? 'high' : 'medium',
          dietaryChanges: [
            '暫停鈣補充劑和維生素 D 補充劑',
            '減少高鈣食物攝取',
            '增加飲水量（幫助鈣排泄）',
          ],
          foodsToIncrease: ['水'],
          foodsToReduce: ['鈣補充劑', '維生素 D 補充劑', '大量乳製品'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '8.5-10.5 mg/dL',
          references: [
            'Carroll & Schade 2003 (Am Fam Physician): A practical approach to hypercalcemia',
          ],
          caveat: '高血鈣最常見原因是副甲狀腺功能亢進或惡性腫瘤，需醫療評估。單純飲食很少造成高血鈣。',
        })
      }
    }

    // ════════════════════════════════════════
    // 荷爾蒙
    // ════════════════════════════════════════

    if (matchName(lab.test_name, ['睪固酮', 'testosterone', '總睪固酮', 'total testosterone'])) {
      const isMale = gender !== '女性'
      if (isMale && lab.value < 300) {
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
          ],
          caveat: '總睪固酮受 SHBG 影響大，SHBG 高時游離睪固酮可能偏低但總 T 正常。建議同時檢驗游離睪固酮。另外，抽血時間影響結果（早上 T 最高），需早晨空腹抽血。',
        })
      }
      if (!isMale && lab.value > 70) {
        advice.push({
          category: 'hormone',
          title: '睪固酮偏高',
          icon: '⚖️',
          severity: lab.status === 'alert' ? 'high' : 'medium',
          dietaryChanges: [
            '減少精製碳水和高 GI 食物（胰島素阻抗會刺激卵巢產生更多雄性素）',
            '增加抗發炎食物（Omega-3、莓果、薑黃）',
            '增加纖維攝取（25-30g/day，幫助排除多餘雄性素代謝物）',
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

    if (matchName(lab.test_name, ['游離睪固酮', 'free testosterone', 'freetestosterone'])) {
      const isMale = gender !== '女性'
      if (isMale && lab.value < 47) {
        advice.push({
          category: 'hormone',
          title: '游離睪固酮偏低',
          icon: '💪',
          severity: lab.value < 30 ? 'high' : 'medium',
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
          targetRange: '47-244 pg/mL（男性，平衡透析法）',
          references: [
            'Naghii et al. 2011 (J Trace Elem Med Biol): Comparative effects of boron on serum free testosterone',
            'Volek et al. 1997 (J Appl Physiol): Testosterone responses to dietary fat and resistance exercise',
            'Cinar et al. 2011 (Biol Trace Elem Res): Effects of magnesium supplementation on testosterone in athletes',
          ],
          caveat: '游離睪固酮比總 T 更能反映實際活性水平，但計算值（Vermeulen 公式）vs 直接測量（平衡透析法）差異可達 20-30%。',
        })
      }
    }

    if (matchName(lab.test_name, ['皮質醇', 'cortisol'])) {
      if (lab.value > 18) {
        advice.push({
          category: 'hormone',
          title: '皮質醇偏高',
          icon: '😰',
          severity: lab.value > 22 ? 'high' : 'medium',
          dietaryChanges: [
            '增加抗氧化和抗壓力食物（維生素 C、鎂、Omega-3）',
            '避免過度限制碳水（極低碳會升高皮質醇）',
            '減少咖啡因攝取（尤其是下午後）',
            '考慮 ashwagandha 補充（600mg/day 可降低皮質醇 ~30%）',
            '訓練量不要過大（過度訓練是運動員皮質醇偏高常見原因）',
          ],
          foodsToIncrease: ['莓果', '柑橘（維生素C）', '深海魚', '黑巧克力', '堅果', '綠茶（L-茶胺酸）'],
          foodsToReduce: ['過量咖啡因', '酒精', '高糖食物'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '6-18 µg/dL（早晨）',
          references: [
            'Chandrasekhar et al. 2012 (Indian J Psychol Med): Ashwagandha root extract reduces cortisol levels',
            'Anderson et al. 2008 (Psychoneuroendocrinology): Cortisol and caffeine',
            'Kreher & Schwartz 2012 (Sports Health): Overtraining syndrome — cortisol and performance',
          ],
          caveat: '皮質醇有明顯日夜節律（早晨最高、晚上最低），必須在早上 8:00-10:00 抽血才有意義。壓力、睡眠不足、過度訓練都會升高。',
        })
      } else if (lab.value < 6) {
        advice.push({
          category: 'hormone',
          title: '皮質醇偏低',
          icon: '😴',
          severity: lab.value < 4 ? 'high' : 'medium',
          dietaryChanges: [
            '確保充足鈉攝取（腎上腺疲勞時鈉需求增加）',
            '增加維生素 C 攝取（腎上腺是體內維生素 C 濃度最高的器官）',
            '小頻餐（避免長時間空腹導致低血糖）',
            '增加甘草根茶（含甘草酸可延長皮質醇半衰期，但有高血壓者避免）',
          ],
          foodsToIncrease: ['適量鹽', '柑橘', '甜椒', '全蛋', '酪梨'],
          foodsToReduce: ['過量咖啡因（進一步壓榨腎上腺）'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '6-18 µg/dL（早晨）',
          references: [
            'Cadegiani & Kater 2016 (BMC Endocr Disord): Adrenal fatigue — does it exist?',
            'Patak et al. 2004 (J Inherit Metab Dis): Vitamin C and the adrenal glands',
          ],
          caveat: '持續低皮質醇需排除腎上腺功能不全（Addison disease），建議內分泌科評估。「腎上腺疲勞」在正統醫學中仍有爭議。',
        })
      }
    }

    if (matchName(lab.test_name, ['dhea-s', 'dheas', '脫氫表雄酮硫酸鹽'])) {
      const dheaMin = gender === '女性' ? 65 : 100
      if (lab.value < dheaMin) {
        advice.push({
          category: 'hormone',
          title: 'DHEA-S 偏低',
          icon: '⚡',
          severity: lab.status === 'alert' ? 'high' : 'medium',
          dietaryChanges: [
            '確保脂肪攝取充足（DHEA 是類固醇荷爾蒙，需要膽固醇為原料）',
            '減少慢性壓力（皮質醇和 DHEA 競爭同一前驅物質 pregnenolone）',
            '確保充足睡眠（7-9 小時）',
            '適度重訓（可刺激 DHEA 分泌）',
          ],
          foodsToIncrease: ['全蛋', '酪梨', '橄欖油', '山藥（含 diosgenin）'],
          foodsToReduce: ['酒精', '過量咖啡因'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: gender === '女性' ? '65-380 µg/dL' : '100-500 µg/dL',
          references: [
            'Rutkowski et al. 2014 (J Steroid Biochem Mol Biol): DHEA and cortisol changes with exercise',
            'Samaras et al. 2013 (Maturitas): DHEA treatment and aging',
          ],
          caveat: 'DHEA-S 隨年齡自然下降（30 歲後每年約降 2-3%）。低 DHEA-S 搭配高皮質醇可能反映「pregnenolone steal」（壓力導致前驅物優先合成皮質醇）。',
        })
      }
    }

    if (matchName(lab.test_name, ['雌二醇', 'estradiol', 'e2'])) {
      const isMale = gender !== '女性'
      if (isMale && lab.value > 40) {
        advice.push({
          category: 'hormone',
          title: '雌二醇偏高（男性）',
          icon: '⚖️',
          severity: lab.value > 60 ? 'high' : 'medium',
          dietaryChanges: [
            '增加十字花科蔬菜（含 DIM/I3C，促進雌激素代謝）',
            '減少體脂（脂肪組織中的芳香化酶將睪固酮轉換為雌二醇）',
            '減少酒精（刺激芳香化酶活性）',
            '增加纖維攝取（幫助排除多餘雌激素代謝物）',
            '減少環境雌激素暴露（塑膠容器、BPA）',
          ],
          foodsToIncrease: ['花椰菜', '高麗菜', '白蘿蔔', '蘆筍', '綠茶', '亞麻籽'],
          foodsToReduce: ['酒精', '高脂加工食品', '大豆異黃酮（過量）'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          targetRange: '10-40 pg/mL（男性）',
          references: [
            'Bradlow et al. 1996 (Ann N Y Acad Sci): Indole-3-carbinol and estrogen metabolism',
            'Vermeulen et al. 2002 (J Clin Endocrinol Metab): Aromatase, estrogen, and adiposity in men',
            'Gavaler 1998 (Alcohol Clin Exp Res): Alcoholic beverages as a source of estrogen',
          ],
          caveat: '男性雌二醇過低也不好（影響骨密度和關節），理想範圍是 20-35 pg/mL。不要盲目壓低。',
        })
      }
    }

    if (matchName(lab.test_name, ['shbg', '性荷爾蒙結合球蛋白'])) {
      const isMale = gender !== '女性'
      if (isMale && lab.value > 57) {
        advice.push({
          category: 'hormone',
          title: 'SHBG 偏高',
          icon: '🔗',
          severity: lab.value > 70 ? 'high' : 'medium',
          dietaryChanges: [
            '高 SHBG 會綁定更多睪固酮，降低游離 T',
            '確保足夠碳水攝取（極低碳飲食會升高 SHBG）',
            '補充硼 3-6mg/day（可降低 SHBG ~10%）',
            '確保鎂攝取充足',
          ],
          foodsToIncrease: ['碳水（適量）', '酪梨（硼）', '杏仁', '葡萄乾'],
          foodsToReduce: [],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: 'nmol/L',
          targetRange: '10-57 nmol/L（男性）',
          references: [
            'Naghii et al. 2011 (J Trace Elem Med Biol): Boron supplementation and SHBG',
            'Anderson et al. 1987 (Am J Clin Nutr): Diet-hormone interactions — protein/carb ratio and SHBG',
          ],
          caveat: 'SHBG 受甲狀腺功能、肝臟、年齡、BMI 影響。甲亢會升高 SHBG，肥胖和胰島素阻抗會降低 SHBG。',
        })
      } else if (isMale && lab.value < 10) {
        advice.push({
          category: 'hormone',
          title: 'SHBG 偏低',
          icon: '🔗',
          severity: lab.status === 'alert' ? 'high' : 'medium',
          dietaryChanges: [
            'SHBG 偏低常與胰島素阻抗和肥胖相關',
            '改善胰島素敏感性（見 HOMA-IR 建議）',
            '減脂（體脂降低通常 SHBG 會回升）',
          ],
          foodsToIncrease: ['蔬菜', '全穀類', '高纖食物'],
          foodsToReduce: ['精製碳水', '高糖食物'],
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: 'nmol/L',
          targetRange: '10-57 nmol/L（男性）',
          references: [
            'Brand et al. 2011 (Diabetes Care): Testosterone, SHBG, and development of type 2 diabetes in middle-aged men',
          ],
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

// ═══════════════════════════════════════════════════════════════
// 正常值優化建議 — 值在正常範圍但尚未達到最佳區間
// ═══════════════════════════════════════════════════════════════

export interface LabOptimizationTip {
  category: string
  title: string
  icon: string
  labMarker: string
  currentValue: number
  unit: string
  optimalRange: string
  currentRange: string
  tips: string[]
  supplements?: { name: string; dosage: string; timing?: string; note?: string }[]
  references: string[]
}

export function generateLabOptimizationTips(
  labs: LabInput[],
  options: { gender?: '男性' | '女性' } = {}
): LabOptimizationTip[] {
  const tips: LabOptimizationTip[] = []
  const { gender } = options

  // 每個指標只保留最新一筆，避免舊值產生錯誤建議
  const latestByName = new Map<string, LabInput>()
  for (const lab of labs) {
    if (lab.value == null) continue
    const key = lab.test_name.toLowerCase().trim()
    const existing = latestByName.get(key)
    if (!existing || (lab.date && (!existing.date || lab.date > existing.date))) {
      latestByName.set(key, lab)
    }
  }
  const dedupedLabs = Array.from(latestByName.values())

  for (const lab of dedupedLabs) {
    if (lab.value == null || lab.status !== 'normal') continue

    // ── 游離睪固酮（男性）──
    if (matchName(lab.test_name, ['游離睪固酮', 'free testosterone'])) {
      const optMin = gender === '女性' ? 3.0 : 150
      const optMax = gender === '女性' ? 7.0 : 220
      if (lab.value < optMin || lab.value > optMax) {
        if (gender !== '女性') {
          tips.push({
            category: 'hormone',
            title: `游離睪固酮可再提升（目標 ${optMin}+）`,
            icon: '💪',
            labMarker: lab.test_name,
            currentValue: lab.value,
            unit: lab.unit,
            optimalRange: `${optMin}-${optMax} ${lab.unit}`,
            currentRange: '47-244（正常）',
            tips: [
              '確保每晚 7-9 小時高品質睡眠（睡眠不足可降低睪固酮 10-15%）',
              '每週至少 3 次大肌群複合動作重訓（深蹲、硬舉、臥推）',
              '確保鋅（牡蠣、牛肉）與維生素D（目標 60+ ng/mL）攝取充足',
              '避免長期高壓與過度節食（皮質醇升高會抑制睪固酮）',
              '適量攝取健康油脂（每日熱量 25-35% 來自脂肪）',
              '降低 SHBG 可釋放更多游離T：避免過度限制碳水、確保鋅充足',
            ],
            supplements: [
              { name: '東革阿里 (Tongkat Ali)', dosage: '200-400mg/天（標準化萃取）', timing: '早餐後', note: '多項 RCT 顯示可提升游離睪固酮 15-30%' },
              { name: 'Ashwagandha (KSM-66)', dosage: '600mg/天', timing: '早晚各 300mg', note: '降低皮質醇、間接提升睪固酮' },
              { name: '鋅', dosage: '15-30mg/天（鋅雙甘胺酸）', timing: '晚餐後', note: '缺鋅者補充後睪固酮可提升 30%+' },
              { name: '鎂', dosage: '400mg/天（甘胺酸鎂或蘇糖酸鎂）', timing: '睡前', note: '改善睡眠品質，間接支持睪固酮' },
              { name: '維生素D3', dosage: '2000-4000 IU/天', timing: '隨餐（含油脂）', note: '目標血清 60+ ng/mL' },
            ],
            references: [
              'Leproult & Van Cauter 2011 (JAMA): Sleep loss lowers testosterone in young men',
              'Vingren et al. 2010 (Sports Med): Testosterone response to resistance exercise',
              'Prasad et al. 1996 (Nutrition): Zinc status and testosterone levels',
              'Henkel et al. 2014 (Phytother Res): Tongkat Ali and male hormonal profile',
              'Lopresti et al. 2019 (Am J Mens Health): Ashwagandha and testosterone in overweight men',
            ],
          })
        }
      }
    }

    // ── 睪固酮 ──
    if (matchName(lab.test_name, ['睪固酮', 'testosterone'])) {
      const optMin = gender === '女性' ? 40 : 700
      const optMax = gender === '女性' ? 60 : 900
      if (lab.value < optMin) {
        tips.push({
          category: 'hormone',
          title: `睪固酮可再提升（目標 ${optMin}+）`,
          icon: '🏋️',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: `${optMin}-${optMax} ${lab.unit}`,
          currentRange: gender === '女性' ? '15-70（正常）' : '300-1000（正常）',
          tips: [
            '重訓為主：大肌群複合動作（深蹲、硬舉、臥推）最有效提升睪固酮',
            '確保充足睡眠 7-9 小時（每少睡 1 小時，睪固酮平均降 10-15%）',
            '攝取足夠鋅（15-30mg/天）、鎂（400mg/天）、維生素D（目標 60+）',
            '脂肪不低於總熱量 25%（膽固醇是睪固酮的前驅物）',
            '管理壓力：長期高皮質醇會直接抑制睪固酮合成',
          ],
          supplements: [
            { name: '東革阿里 (Tongkat Ali)', dosage: '200-400mg/天', timing: '早餐後', note: 'RCT 顯示可提升總睪固酮' },
            { name: 'Ashwagandha (KSM-66)', dosage: '600mg/天', timing: '早晚各 300mg', note: '降低皮質醇 + 提升睪固酮' },
            { name: 'Fadogia Agrestis', dosage: '600mg/天', timing: '早餐後', note: '動物研究支持，人體數據有限，建議週期使用' },
            { name: '鋅 + 鎂 + D3', dosage: '鋅 30mg + 鎂 400mg + D3 4000IU', timing: '鋅鎂睡前，D3 隨餐', note: '基礎荷爾蒙支持三件套' },
          ],
          references: [
            'Kraemer & Ratamess 2005 (Sports Med): Hormonal responses to resistance exercise',
            'Pilz et al. 2011 (Horm Metab Res): Vitamin D supplementation increases testosterone',
            'Henkel et al. 2014 (Phytother Res): Tongkat Ali review',
          ],
        })
      }
    }

    // ── 維生素D ──
    if (matchName(lab.test_name, ['維生素d', 'vitamin d', '25-oh'])) {
      if (lab.value < 60 || lab.value > 80) {
        tips.push({
          category: 'vitamin',
          title: '維生素D可進一步優化',
          icon: '☀️',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '60-80 ng/mL',
          currentRange: '50-100（正常）',
          tips: lab.value < 60 ? [
            '增加日照時間（每天 15-20 分鐘裸露手臂和腿部）',
            '食物來源：鮭魚、沙丁魚、蛋黃、香菇',
          ] : [
            '目前略高於最佳區間，可減少補劑量',
            '維持均衡飲食與適度日照即可',
          ],
          supplements: lab.value < 60 ? [
            { name: '維生素D3', dosage: '2000-4000 IU/天', timing: '隨含油脂餐食', note: '每 1000 IU 約可提升血清 10 ng/mL' },
            { name: '維生素K2 (MK-7)', dosage: '100-200μg/天', timing: '與 D3 一起', note: '導引鈣至骨骼，避免血管鈣化' },
          ] : [],
          references: [
            'Holick 2007 (NEJM): Vitamin D deficiency — the pandemic',
            'Wacker & Holick 2013 (Nutrients): Optimal vitamin D range',
          ],
        })
      }
    }

    // ── 同半胱胺酸 ──
    if (matchName(lab.test_name, ['同半胱胺酸', 'homocysteine'])) {
      if (lab.value >= 6 && lab.value < 8) {
        tips.push({
          category: 'inflammation',
          title: '同半胱胺酸可再優化',
          icon: '🧬',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '<6 μmol/L',
          currentRange: '<8（正常）',
          tips: [
            '增加 B 族維生素攝取（B6、B12、葉酸是關鍵輔因子）',
            '多吃深色蔬菜（菠菜、花椰菜）、雞蛋、魚類',
          ],
          supplements: [
            { name: '活性 B 群複合物', dosage: '含 methylfolate 800μg + methylcobalamin 1000μg + P5P(B6) 50mg', timing: '早餐後', note: '甲基化關鍵輔因子，優先選活性形式' },
            { name: 'TMG (甜菜鹼)', dosage: '500-1500mg/天', timing: '隨餐', note: '提供甲基，直接幫助同半胱胺酸代謝' },
            { name: '肌酸 (Creatine)', dosage: '3-5g/天', timing: '任意時間', note: '消耗甲基合成肌酸，間接降低同半胱胺酸' },
          ],
          references: [
            'Refsum et al. 2004 (Clin Chem): Homocysteine and cardiovascular risk',
            'Steenge et al. 2003 (J Nutr): Betaine supplementation lowers homocysteine',
            'Stead et al. 2006 (Am J Clin Nutr): Methylation demand of creatine synthesis',
          ],
        })
      }
    }

    // ── CRP / hs-CRP ──
    if (matchName(lab.test_name, ['crp', 'hs-crp', 'c-reactive'])) {
      if (lab.value >= 0.5 && lab.value < 1.0) {
        tips.push({
          category: 'inflammation',
          title: '發炎指標可再優化',
          icon: '🔥',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '<0.5 mg/L',
          currentRange: '<1.0（正常）',
          tips: [
            '多攝取抗發炎食物：薑黃、莓果、深色蔬菜、橄欖油',
            '減少精製碳水、加工食品、過量 Omega-6 油脂',
            '確保充足睡眠與壓力管理',
          ],
          supplements: [
            { name: 'Omega-3 魚油 (EPA+DHA)', dosage: '2-3g/天（以 EPA 為主）', timing: '隨餐', note: '抗發炎效果顯著，EPA 比 DHA 對 CRP 效果更強' },
            { name: '薑黃素 (Curcumin)', dosage: '500-1000mg/天（含胡椒鹼或脂質體形式）', timing: '隨餐', note: '強效抗發炎，需搭配黑胡椒或脂質體提升吸收' },
          ],
          references: [
            'Ridker 2003 (Circulation): C-reactive protein and cardiovascular risk',
            'Calder 2017 (Ann Nutr Metab): Omega-3 and inflammation',
          ],
        })
      }
    }

    // ── 空腹血糖 ──
    if (matchName(lab.test_name, ['空腹血糖', 'fasting glucose'])) {
      if (lab.value >= 80 && lab.value <= 90) {
        tips.push({
          category: 'glucose',
          title: '空腹血糖可再優化',
          icon: '🩸',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '<80 mg/dL',
          currentRange: '<90（正常）',
          tips: [
            '進食順序：蔬菜→蛋白質→碳水（可降低餐後血糖 30-40%）',
            '餐後散步 10-15 分鐘',
            '增加膳食纖維攝取（每天 30g+）',
            '減少精製碳水與含糖飲料',
          ],
          supplements: [
            { name: '肉桂萃取 (Ceylon Cinnamon)', dosage: '500-1000mg/天', timing: '隨餐', note: '改善胰島素敏感度與餐後血糖反應' },
            { name: '小檗鹼 (Berberine)', dosage: '500mg x 2-3次/天', timing: '餐前', note: '多項 RCT 顯示可降空腹血糖，效果接近二甲雙胍' },
            { name: '鉻 (Chromium Picolinate)', dosage: '200-400μg/天', timing: '隨餐', note: '增強胰島素受體敏感度' },
          ],
          references: [
            'Shukla et al. 2015 (Diabetes Care): Food order and postprandial glucose',
            'Yin et al. 2008 (Metabolism): Berberine improves glucose metabolism',
          ],
        })
      }
    }

    // ── HOMA-IR ──
    if (matchName(lab.test_name, ['homa-ir', 'homa ir'])) {
      if (lab.value >= 0.8 && lab.value < 2.0) {
        tips.push({
          category: 'glucose',
          title: '胰島素敏感度可再優化',
          icon: '⚡',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '<0.8',
          currentRange: '<2.0（正常）',
          tips: [
            '增加重訓頻率（肌肉是最大的葡萄糖接收器）',
            '餐前醋飲或肉桂（改善胰島素敏感度）',
            '確保充足睡眠（睡眠不足會降低胰島素敏感度）',
          ],
          supplements: [
            { name: '小檗鹼 (Berberine)', dosage: '500mg x 2-3次/天', timing: '餐前', note: '改善胰島素阻抗，多項 RCT 支持' },
            { name: '鉻 (Chromium Picolinate)', dosage: '200-400μg/天', timing: '隨餐', note: '增強胰島素受體敏感度' },
            { name: 'Alpha-Lipoic Acid (ALA)', dosage: '300-600mg/天', timing: '餐前', note: '強效抗氧化劑，改善胰島素敏感度' },
          ],
          references: [
            'Colberg et al. 2016 (Diabetes Care): Exercise and diabetes management',
            'Yin et al. 2008 (Metabolism): Berberine and insulin resistance',
          ],
        })
      }
    }

    // ── HDL-C ──
    if (matchName(lab.test_name, ['hdl', 'hdl-c'])) {
      const optMin = gender === '女性' ? 70 : 60
      if (lab.value < optMin) {
        tips.push({
          category: 'lipid',
          title: 'HDL 膽固醇可再提升',
          icon: '❤️',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: `>${optMin} ${lab.unit}`,
          currentRange: gender === '女性' ? '>50（正常）' : '>40（正常）',
          tips: [
            '增加有氧運動（每週 150 分鐘中等強度）',
            '攝取優質油脂：橄欖油、酪梨、堅果',
            '適量飲食中的椰子油可提升 HDL',
            '減少反式脂肪與精製碳水',
          ],
          supplements: [
            { name: 'Omega-3 魚油 (EPA+DHA)', dosage: '2-3g/天', timing: '隨餐', note: '提升 HDL 並降低三酸甘油酯' },
            { name: '菸鹼酸 (Niacin/B3)', dosage: '500mg/天（緩釋型）', timing: '睡前', note: '最有效提升 HDL 的營養素，但可能引起潮紅反應' },
          ],
          references: [
            'Kodama et al. 2007 (Arch Intern Med): Exercise and HDL meta-analysis',
            'Boden et al. 2014 (NEJM): Niacin and HDL',
          ],
        })
      }
    }

    // ── 三酸甘油酯 ──
    if (matchName(lab.test_name, ['三酸甘油酯', 'triglyceride', 'tg'])) {
      if (lab.value >= 70 && lab.value < 100) {
        tips.push({
          category: 'lipid',
          title: '三酸甘油酯可再優化',
          icon: '💧',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '<70 mg/dL',
          currentRange: '<100（正常）',
          tips: [
            '增加 Omega-3 攝取（深海魚或魚油補劑）',
            '減少精緻碳水和果糖攝取',
            '增加膳食纖維',
          ],
          supplements: [
            { name: 'Omega-3 魚油 (EPA+DHA)', dosage: '2-4g/天（高 EPA 比例）', timing: '隨餐', note: '降低三酸甘油酯效果顯著（可降 15-30%）' },
            { name: '洋車前子殼 (Psyllium)', dosage: '5-10g/天', timing: '餐前加水服用', note: '水溶性纖維，降低餐後血脂吸收' },
          ],
          references: [
            'Miller et al. 2011 (Circulation): Triglycerides and cardiovascular risk',
            'Harris et al. 2008 (Am J Clin Nutr): Omega-3 and triglycerides dose-response',
          ],
        })
      }
    }

    // ── 鐵蛋白 ──
    if (matchName(lab.test_name, ['鐵蛋白', 'ferritin'])) {
      const optMin = gender === '女性' ? 40 : 70
      const optMax = 120
      if (lab.value < optMin) {
        tips.push({
          category: 'iron',
          title: '鐵儲存可再優化',
          icon: '🥩',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: `${optMin}-${optMax} ${lab.unit}`,
          currentRange: gender === '女性' ? '12-200（正常）' : '50-150（正常）',
          tips: [
            '增加紅肉、牡蠣等血鐵質來源（吸收率是植物鐵的 2-3 倍）',
            '鐵質搭配維生素C一起攝取（可提升吸收 2-6 倍）',
            '避免與茶、咖啡同時攝取鐵質食物',
          ],
          supplements: [
            { name: '鐵雙甘胺酸 (Iron Bisglycinate)', dosage: '25-50mg/天', timing: '空腹或搭配維C', note: '吸收率高、腸胃刺激小，優於硫酸亞鐵' },
            { name: '維生素C', dosage: '500mg（與鐵一起）', timing: '與鐵劑同服', note: '提升非血鐵吸收 2-6 倍' },
            { name: 'Lactoferrin（乳鐵蛋白）', dosage: '100-200mg/天', timing: '空腹', note: '促進鐵吸收，腸胃耐受性佳' },
          ],
          references: [
            'WHO 2020: Iron supplementation guidelines',
            'Hallberg et al. 1989 (Am J Clin Nutr): Iron absorption and vitamin C',
          ],
        })
      }
    }

    // ── 維生素B12 ──
    if (matchName(lab.test_name, ['維生素b12', 'b12', 'cobalamin'])) {
      if (lab.value < 500) {
        tips.push({
          category: 'vitamin',
          title: 'B12 可進一步優化',
          icon: '💊',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '500-800 pg/mL',
          currentRange: '400-900（正常）',
          tips: [
            '增加動物性食物攝取：肝臟、蛤蜊、牛肉、蛋',
          ],
          supplements: [
            { name: '甲基鈷胺素 (Methylcobalamin)', dosage: '1000-2000μg/天', timing: '早餐後舌下含服', note: '活性形式，吸收率優於氰鈷胺素' },
            { name: '活性葉酸 (Methylfolate)', dosage: '400-800μg/天', timing: '與 B12 一起', note: 'B12 + 葉酸協同作用，甲基化效率更佳' },
          ],
          references: [
            'Green et al. 2017 (BMJ): Vitamin B12 deficiency',
          ],
        })
      }
    }

    // ── 皮質醇 ──
    if (matchName(lab.test_name, ['皮質醇', 'cortisol'])) {
      if ((lab.value > 12 && lab.value <= 18) || (lab.value >= 6 && lab.value < 8)) {
        tips.push({
          category: 'hormone',
          title: lab.value > 12 ? '皮質醇偏高端，可優化壓力管理' : '皮質醇偏低端，注意腎上腺健康',
          icon: '🧘',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '8-12 μg/dL',
          currentRange: '6-18（正常）',
          tips: lab.value > 12 ? [
            '建立固定的放鬆習慣（冥想、深呼吸、散步）',
            '確保充足睡眠（7-9小時）',
            '避免過度訓練（監控 RPE 和恢復狀態）',
          ] : [
            '確保不過度限制熱量（長期低卡會壓低皮質醇）',
            '規律作息、避免慢性壓力耗竭',
          ],
          supplements: lab.value > 12 ? [
            { name: 'Ashwagandha (KSM-66)', dosage: '600mg/天', timing: '早晚各 300mg', note: 'RCT 顯示可降低皮質醇 25-30%' },
            { name: '鎂 (甘胺酸鎂)', dosage: '400mg/天', timing: '睡前', note: '放鬆神經系統、改善睡眠品質' },
            { name: 'L-Theanine', dosage: '200mg/天', timing: '壓力大時或睡前', note: '促進 alpha 腦波，減輕壓力反應' },
            { name: 'Phosphatidylserine (PS)', dosage: '400-800mg/天', timing: '運動前', note: '可鈍化運動引起的皮質醇飆升' },
          ] : [
            { name: '維生素C', dosage: '500-1000mg/天', timing: '分次攝取', note: '腎上腺合成皮質醇需要大量維C' },
            { name: '泛酸 (B5)', dosage: '500mg/天', timing: '早餐後', note: '支持腎上腺功能的關鍵 B 群' },
          ],
          references: [
            'Hirotsu et al. 2015 (Sleep Sci): Sleep and cortisol relationship',
            'Chandrasekhar et al. 2012 (Indian J Psychol Med): Ashwagandha reduces cortisol',
          ],
        })
      }
    }

    // ── 空腹胰島素 ──
    if (matchName(lab.test_name, ['空腹胰島素', 'fasting insulin'])) {
      if (lab.value >= 2.5 && lab.value < 5) {
        tips.push({
          category: 'glucose',
          title: '空腹胰島素可再優化（目標 <2.5）',
          icon: '📉',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '<2.5 μIU/mL',
          currentRange: '<5.0（正常）',
          tips: [
            '持續減少精製碳水，增加纖維攝取',
            '間歇性斷食可改善胰島素效率',
            '增加重訓（肌肉越多，胰島素效率越高）',
          ],
          supplements: [
            { name: '小檗鹼 (Berberine)', dosage: '500mg x 2-3次/天', timing: '餐前', note: '改善胰島素敏感度，降低空腹胰島素' },
            { name: '肉桂萃取 (Ceylon Cinnamon)', dosage: '500-1000mg/天', timing: '隨餐', note: '增強胰島素訊號傳導' },
          ],
          references: ['Patarrão et al. 2014 (Curr Diabetes Rev): Insulin sensitivity assessment'],
        })
      }
    }

    // ── HbA1c ──
    if (matchName(lab.test_name, ['hba1c', '糖化血色素'])) {
      if (lab.value >= 5.0 && lab.value < 5.5) {
        tips.push({
          category: 'glucose',
          title: 'HbA1c 可再優化（目標 <5.0）',
          icon: '📊',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '<5.0%',
          currentRange: '<5.5（正常）',
          tips: [
            '控制精製碳水和含糖食物',
            '增加膳食纖維攝取（每天 30g+）',
            '進食順序：蔬菜→蛋白質→碳水',
            '規律運動（有氧+重訓）改善長期血糖控制',
          ],
          supplements: [
            { name: '小檗鹼 (Berberine)', dosage: '500mg x 2-3次/天', timing: '餐前', note: '多項 RCT 顯示可降低 HbA1c' },
            { name: '肉桂萃取 (Ceylon Cinnamon)', dosage: '500-1000mg/天', timing: '隨餐', note: '改善長期血糖控制' },
          ],
          references: ['ADA 2024: Standards of Care in Diabetes'],
        })
      }
    }

    // ── 尿酸 ──
    if (matchName(lab.test_name, ['尿酸', 'uric acid'])) {
      const optTarget = gender === '女性' ? 4.0 : 5.0
      const normalMax = gender === '女性' ? 6.0 : 7.0
      if (lab.value >= optTarget && lab.value < normalMax) {
        tips.push({
          category: 'glucose',
          title: `尿酸可再優化（目標 <${optTarget}）`,
          icon: '🧪',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: `<${optTarget} mg/dL`,
          currentRange: `<${normalMax}（正常）`,
          tips: [
            '減少高普林食物（內臟、紅肉、啤酒）',
            '增加水分攝取（每天 2-3L）促進尿酸排泄',
            '多攝取櫻桃、莓果（有助降低尿酸）',
            '減少果糖攝取（果汁、含糖飲料會升高尿酸）',
          ],
          supplements: [
            { name: '維生素C', dosage: '500-1000mg/天', timing: '分次攝取', note: '促進尿酸排泄，降低血清尿酸' },
            { name: '櫻桃萃取 (Tart Cherry)', dosage: '500-1000mg/天', timing: '隨餐', note: '含花青素，研究顯示可降低尿酸與痛風發作風險' },
          ],
          references: ['Choi et al. 2004 (NEJM): Diet and hyperuricemia', 'Huang et al. 2005 (Arthritis Rheum): Vitamin C and uric acid'],
        })
      }
    }

    // ── ApoB ──
    if (matchName(lab.test_name, ['apob', 'apo b', 'apolipoprotein b'])) {
      if (lab.value >= 50 && lab.value < 80) {
        tips.push({
          category: 'lipid',
          title: 'ApoB 可再優化（目標 <50）',
          icon: '🫀',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '<50 mg/dL',
          currentRange: '<80（正常）',
          tips: [
            '增加水溶性纖維攝取（燕麥、豆類、蘋果）',
            '減少飽和脂肪（紅肉、全脂乳製品），增加不飽和脂肪',
            '考慮植物固醇補充（每日 2g 可降低 LDL 10%）',
            '增加 Omega-3 攝取（深海魚、魚油）',
          ],
          supplements: [
            { name: '植物固醇 (Plant Sterols)', dosage: '2g/天', timing: '隨餐', note: '可降低 LDL/ApoB 約 10%' },
            { name: 'Omega-3 魚油 (EPA+DHA)', dosage: '2-3g/天', timing: '隨餐', note: '改善血脂組成' },
            { name: '洋車前子殼 (Psyllium)', dosage: '5-10g/天', timing: '餐前', note: '水溶性纖維，減少膽固醇吸收' },
          ],
          references: ['Ference et al. 2017 (Eur Heart J): LDL and ApoB as causal risk factors'],
        })
      }
    }

    // ── LDL-C ──
    if (matchName(lab.test_name, ['ldl', 'ldl-c'])) {
      if (lab.value >= 60 && lab.value < 100) {
        tips.push({
          category: 'lipid',
          title: 'LDL 可再優化（目標 <60）',
          icon: '💔',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '<60 mg/dL',
          currentRange: '<100（正常）',
          tips: [
            '增加水溶性纖維攝取（每天 10-25g）',
            '減少飽和脂肪至總熱量 7% 以下',
            '增加植物性蛋白質（豆類、堅果）',
            '規律有氧運動有助改善 LDL 顆粒大小',
          ],
          supplements: [
            { name: '植物固醇 (Plant Sterols)', dosage: '2g/天', timing: '隨餐', note: '阻斷膽固醇吸收，降低 LDL 約 10%' },
            { name: '紅麴萃取 (Red Yeast Rice)', dosage: '1200mg/天', timing: '晚餐後', note: '含天然 Monacolin K，注意與 statin 機制相似' },
            { name: '洋車前子殼 (Psyllium)', dosage: '5-10g/天', timing: '餐前', note: '水溶性纖維，與膽酸結合促進 LDL 排泄' },
          ],
          references: ['Grundy et al. 2019 (Circulation): AHA/ACC Cholesterol guidelines'],
        })
      }
    }

    // ── 總膽固醇 ──
    if (matchName(lab.test_name, ['總膽固醇', 'total cholesterol'])) {
      if (lab.value >= 170 && lab.value < 200) {
        tips.push({
          category: 'lipid',
          title: '總膽固醇可再優化',
          icon: '📋',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '<170 mg/dL',
          currentRange: '<200（正常）',
          tips: [
            '增加纖維攝取與減少飽和脂肪',
            '規律有氧運動',
            '注意 HDL/LDL 比例比總膽固醇更重要',
          ],
          supplements: [
            { name: '植物固醇 (Plant Sterols)', dosage: '2g/天', timing: '隨餐', note: '降低膽固醇吸收' },
            { name: 'Omega-3 魚油', dosage: '2-3g/天', timing: '隨餐', note: '改善整體血脂比例' },
          ],
          references: ['Grundy et al. 2019 (Circulation): AHA/ACC Cholesterol guidelines'],
        })
      }
    }

    // ── AST / ALT ──
    if (matchName(lab.test_name, ['ast', 'got'])) {
      if (lab.value >= 25 && lab.value < 40) {
        tips.push({
          category: 'liver',
          title: 'AST 可再優化（目標 <25）',
          icon: '🫁',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '<25 U/L',
          currentRange: '<40（正常）',
          tips: [
            '減少酒精攝取',
            '避免高油脂飲食，增加蔬果',
            '注意運動後會暫時升高（避免在激烈運動 24hr 內抽血）',
            '確保充足休息與睡眠',
          ],
          supplements: [
            { name: 'NAC (N-乙醯半胱氨酸)', dosage: '600-1200mg/天', timing: '空腹', note: '穀胱甘肽前驅物，支持肝臟解毒' },
            { name: '水飛薊素 (Milk Thistle)', dosage: '150-300mg/天（標準化 80% silymarin）', timing: '隨餐', note: '保護肝細胞，多項研究支持降低 AST/ALT' },
          ],
          references: ['Kim et al. 2004 (Hepatology): Optimal ALT cut-off values'],
        })
      }
    }

    if (matchName(lab.test_name, ['alt', 'gpt'])) {
      if (lab.value >= 25 && lab.value < 40) {
        tips.push({
          category: 'liver',
          title: 'ALT 可再優化（目標 <25）',
          icon: '🫁',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '<25 U/L',
          currentRange: '<40（正常）',
          tips: [
            '減少酒精攝取',
            '控制體脂率（脂肪肝是 ALT 升高的常見原因）',
            '減少加工食品與精製碳水',
            '增加十字花科蔬菜（花椰菜、高麗菜）支持肝臟解毒',
          ],
          supplements: [
            { name: 'NAC (N-乙醯半胱氨酸)', dosage: '600-1200mg/天', timing: '空腹', note: '最有效的肝臟保護補劑之一' },
            { name: '水飛薊素 (Milk Thistle)', dosage: '150-300mg/天', timing: '隨餐', note: '保護肝細胞再生' },
            { name: 'TUDCA', dosage: '250-500mg/天', timing: '隨餐', note: '膽汁酸衍生物，支持肝臟排毒' },
          ],
          references: ['Kim et al. 2004 (Hepatology): Optimal ALT cut-off values'],
        })
      }
    }

    // ── GGT ──
    if (matchName(lab.test_name, ['ggt', 'γ-gt'])) {
      const optTarget = gender === '女性' ? 25 : 30
      const normalMax = gender === '女性' ? 40 : 60
      if (lab.value >= optTarget && lab.value < normalMax) {
        tips.push({
          category: 'liver',
          title: `GGT 可再優化（目標 <${optTarget}）`,
          icon: '🍷',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: `<${optTarget} U/L`,
          currentRange: `<${normalMax}（正常）`,
          tips: [
            '減少或戒除酒精（GGT 對酒精非常敏感）',
            '增加抗氧化食物：莓果、綠茶、薑黃',
            '維持健康體重，減少內臟脂肪',
          ],
          supplements: [
            { name: 'NAC (N-乙醯半胱氨酸)', dosage: '600-1200mg/天', timing: '空腹', note: '提升穀胱甘肽，GGT 與氧化壓力密切相關' },
            { name: '水飛薊素 (Milk Thistle)', dosage: '150-300mg/天', timing: '隨餐', note: '保護肝細胞' },
          ],
          references: ['Whitfield 2001 (Crit Rev Clin Lab Sci): GGT as biomarker'],
        })
      }
    }

    // ── 白蛋白 ──
    if (matchName(lab.test_name, ['白蛋白', 'albumin'])) {
      if (lab.value >= 3.5 && lab.value < 4.2) {
        tips.push({
          category: 'liver',
          title: '白蛋白可再優化（目標 >4.2）',
          icon: '🥚',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '>4.2 g/dL',
          currentRange: '>3.5（正常）',
          tips: [
            '增加優質蛋白攝取（每天 1.6-2.2g/kg 體重）',
            '確保蛋白質來源多樣化：蛋、魚、肉、豆類',
            '避免長期低蛋白飲食',
          ],
          supplements: [
            { name: '乳清蛋白 (Whey Protein)', dosage: '20-30g/天', timing: '訓練後或餐間', note: '高生物利用率蛋白質，快速補充胺基酸' },
            { name: '膠原蛋白 (Collagen Peptides)', dosage: '10-15g/天', timing: '任意時間', note: '額外蛋白質來源，同時支持關節與皮膚' },
          ],
          references: ['Don & Kaysen 2004: Serum albumin and nutritional status'],
        })
      }
    }

    // ── eGFR ──
    if (matchName(lab.test_name, ['egfr', '腎絲球過濾率'])) {
      if (lab.value >= 90 && lab.value < 100) {
        tips.push({
          category: 'kidney',
          title: 'eGFR 可再優化（目標 >100）',
          icon: '💧',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '>100 mL/min',
          currentRange: '>90（正常）',
          tips: [
            '確保充足水分攝取（每天 2-3L）',
            '控制血壓與血糖在最佳範圍',
            '避免過量 NSAID 類止痛藥',
          ],
          supplements: [
            { name: 'Omega-3 魚油', dosage: '2g/天', timing: '隨餐', note: '抗發炎，多項研究顯示對腎功能有保護作用' },
            { name: 'CoQ10', dosage: '100-200mg/天', timing: '隨餐', note: '抗氧化，支持腎臟細胞能量代謝' },
          ],
          references: ['KDIGO 2024: Clinical practice guideline for CKD'],
        })
      }
    }

    // ── TSH ──
    if (matchName(lab.test_name, ['tsh', '促甲狀腺激素'])) {
      if ((lab.value >= 0.4 && lab.value < 1.0) || (lab.value > 2.5 && lab.value <= 4.0)) {
        tips.push({
          category: 'thyroid',
          title: 'TSH 可再優化（目標 1.0-2.5）',
          icon: '🦋',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '1.0-2.5 mIU/L',
          currentRange: '0.4-4.0（正常）',
          tips: lab.value > 2.5 ? [
            '確保碘攝取充足（海帶、海鮮、碘鹽）',
            '補充硒（巴西堅果 2 顆/天即可達標）',
            '避免過度限制熱量（長期低卡會升高 TSH）',
            '確保充足睡眠與壓力管理',
          ] : [
            '注意碘攝取是否過多',
            '確認甲狀腺功能穩定，定期追蹤',
          ],
          supplements: lab.value > 2.5 ? [
            { name: '硒 (Selenium)', dosage: '100-200μg/天', timing: '隨餐', note: '支持 T4→T3 轉換，保護甲狀腺' },
            { name: '碘 (Iodine/海帶)', dosage: '150-300μg/天', timing: '隨餐', note: '甲狀腺激素合成的必需礦物質' },
            { name: '鋅', dosage: '15-30mg/天', timing: '晚餐後', note: '支持甲狀腺激素代謝' },
          ] : [],
          references: ['Biondi & Cooper 2008 (JCEM): Subclinical thyroid disease — lancet review'],
        })
      }
    }

    // ── Free T4 ──
    if (matchName(lab.test_name, ['free t4', '游離t4'])) {
      if ((lab.value >= 0.8 && lab.value < 1.0) || (lab.value > 1.5 && lab.value <= 1.8)) {
        tips.push({
          category: 'thyroid',
          title: 'Free T4 可再優化（目標 1.0-1.5）',
          icon: '🦋',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '1.0-1.5 ng/dL',
          currentRange: '0.8-1.8（正常）',
          tips: [
            '確保碘和硒攝取充足',
            '避免長期壓力與熱量不足（影響 T4→T3 轉換）',
            '搭配 TSH 和 Free T3 綜合判讀',
          ],
          supplements: [
            { name: '硒 (Selenium)', dosage: '100-200μg/天', timing: '隨餐', note: '支持甲狀腺過氧化物酶和脫碘酶活性' },
            { name: '碘', dosage: '150-300μg/天', timing: '隨餐', note: '確保甲狀腺激素合成原料充足' },
          ],
          references: ['Biondi & Cooper 2008 (JCEM): Thyroid hormone assessment'],
        })
      }
    }

    // ── Free T3 ──
    if (matchName(lab.test_name, ['free t3', '游離t3'])) {
      if ((lab.value >= 2.3 && lab.value < 3.0) || (lab.value > 4.0 && lab.value <= 4.2)) {
        tips.push({
          category: 'thyroid',
          title: 'Free T3 可再優化（目標 3.0-4.0）',
          icon: '🦋',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '3.0-4.0 pg/mL',
          currentRange: '2.3-4.2（正常）',
          tips: lab.value < 3.0 ? [
            '確保充足碳水攝取（碳水過低會降低 T4→T3 轉換）',
            '補充硒（支持脫碘酶活性）',
            '避免長期熱量赤字（代謝適應會降低 T3）',
            '確保充足睡眠',
          ] : [
            '略高於最佳區間，持續追蹤即可',
          ],
          supplements: lab.value < 3.0 ? [
            { name: '硒 (Selenium)', dosage: '100-200μg/天', timing: '隨餐', note: '脫碘酶需要硒，促進 T4→T3 轉換' },
            { name: '鋅', dosage: '15-30mg/天', timing: '晚餐後', note: '支持甲狀腺激素代謝' },
            { name: '鐵 (如缺乏)', dosage: '依鐵蛋白數值調整', timing: '空腹', note: '缺鐵會影響甲狀腺過氧化物酶活性' },
          ] : [],
          references: ['Mullur et al. 2014 (Physiol Rev): Thyroid hormone regulation of metabolism'],
        })
      }
    }

    // ── 葉酸 ──
    if (matchName(lab.test_name, ['葉酸', 'folate', 'folic acid'])) {
      if ((lab.value >= 5.4 && lab.value < 10) || (lab.value > 18 && lab.value <= 20)) {
        tips.push({
          category: 'vitamin',
          title: '葉酸可再優化（目標 10-18）',
          icon: '🥬',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '10-18 ng/mL',
          currentRange: '5.4-20（正常）',
          tips: lab.value < 10 ? [
            '多攝取深色蔬菜：菠菜、花椰菜、蘆筍',
            '豆類和扁豆也是優質葉酸來源',
            '考慮補充活性葉酸（methylfolate）',
          ] : [
            '略高於最佳區間，減少補劑量即可',
          ],
          supplements: lab.value < 10 ? [
            { name: '活性葉酸 (Methylfolate)', dosage: '400-800μg/天', timing: '早餐後', note: '活性形式，跳過 MTHFR 基因多態性問題' },
            { name: '活性 B 群複合物', dosage: '含 methylfolate + methylcobalamin', timing: '早餐後', note: 'B 群協同作用，提升甲基化效率' },
          ] : [],
          references: ['Bailey et al. 2015 (Adv Nutr): Folate and health'],
        })
      }
    }

    // ── 鎂 ──
    if (matchName(lab.test_name, ['鎂', 'magnesium'])) {
      if ((lab.value >= 2.0 && lab.value < 2.1) || (lab.value > 2.3 && lab.value <= 2.4)) {
        tips.push({
          category: 'mineral',
          title: '鎂可再優化（目標 2.1-2.3）',
          icon: '🌰',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '2.1-2.3 mg/dL',
          currentRange: '2.0-2.4（正常）',
          tips: lab.value < 2.1 ? [
            '增加鎂豐富食物：堅果、深色蔬菜、黑巧克力、南瓜子',
            '考慮補充甘胺酸鎂或蘇糖酸鎂（吸收率較佳）',
            '鎂有助於睡眠品質和肌肉恢復',
          ] : [
            '略高於最佳區間，維持目前飲食即可',
          ],
          supplements: lab.value < 2.1 ? [
            { name: '甘胺酸鎂 (Magnesium Glycinate)', dosage: '200-400mg/天', timing: '睡前', note: '吸收率佳、不易腹瀉，改善睡眠' },
            { name: '蘇糖酸鎂 (Magnesium L-Threonate)', dosage: '1000-2000mg/天', timing: '睡前', note: '可穿越血腦屏障，改善認知與睡眠' },
          ] : [],
          references: ['DiNicolantonio et al. 2018 (Open Heart): Subclinical magnesium deficiency'],
        })
      }
    }

    // ── 鋅 ──
    if (matchName(lab.test_name, ['鋅', 'zinc', 'zn'])) {
      if ((lab.value >= 70 && lab.value < 85) || (lab.value > 110 && lab.value <= 120)) {
        tips.push({
          category: 'mineral',
          title: '鋅可再優化（目標 85-110）',
          icon: '🦪',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '85-110 μg/dL',
          currentRange: '70-120（正常）',
          tips: lab.value < 85 ? [
            '增加牡蠣、牛肉、南瓜子攝取（最佳鋅來源）',
            '鋅對睪固酮、免疫力和傷口癒合都很重要',
            '避免長期高劑量鈣或鐵補充（會競爭吸收）',
          ] : [
            '略高於最佳區間，減少鋅補劑即可',
          ],
          supplements: lab.value < 85 ? [
            { name: '鋅雙甘胺酸 (Zinc Bisglycinate)', dosage: '15-30mg/天', timing: '晚餐後', note: '吸收率最佳的鋅形式，腸胃刺激小' },
            { name: '鋅+銅複合', dosage: '鋅 30mg + 銅 2mg', timing: '晚餐後', note: '長期補鋅需搭配銅，避免銅缺乏' },
          ] : [],
          references: ['Prasad 2008 (Mol Med): Zinc in human health'],
        })
      }
    }

    // ── 鈣 ──
    if (matchName(lab.test_name, ['鈣', 'calcium'])) {
      if ((lab.value >= 8.5 && lab.value < 9.0) || (lab.value > 10.0 && lab.value <= 10.5)) {
        tips.push({
          category: 'mineral',
          title: '鈣可再優化（目標 9.0-10.0）',
          icon: '🦴',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '9.0-10.0 mg/dL',
          currentRange: '8.5-10.5（正常）',
          tips: lab.value < 9.0 ? [
            '增加乳製品、小魚乾、豆腐攝取',
            '確保維生素D充足（有助鈣吸收）',
            '負重運動有助鈣質保留在骨骼中',
          ] : [
            '略高於最佳區間，注意維生素D不要過量',
          ],
          supplements: lab.value < 9.0 ? [
            { name: '檸檬酸鈣 (Calcium Citrate)', dosage: '500-600mg/天（分次）', timing: '隨餐', note: '吸收率優於碳酸鈣，空腹也可吸收' },
            { name: '維生素D3', dosage: '2000 IU/天', timing: '隨餐', note: '提升鈣吸收率' },
            { name: '維生素K2 (MK-7)', dosage: '100μg/天', timing: '與 D3 一起', note: '導引鈣至骨骼而非血管' },
          ] : [],
          references: ['Ross et al. 2011 (JCEM): Dietary reference intakes for calcium and vitamin D'],
        })
      }
    }

    // ── DHEA-S ──
    if (matchName(lab.test_name, ['dhea-s', 'dhea', '硫酸脫氫異雄固酮'])) {
      const optMin = gender === '女性' ? 200 : 250
      const optMax = gender === '女性' ? 350 : 450
      const normalRange = gender === '女性' ? '65-380（正常）' : '100-500（正常）'
      if (lab.value < optMin || lab.value > optMax) {
        tips.push({
          category: 'hormone',
          title: `DHEA-S 可再優化（目標 ${optMin}-${optMax}）`,
          icon: '⏳',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: `${optMin}-${optMax} ${lab.unit}`,
          currentRange: normalRange,
          tips: lab.value < optMin ? [
            '增加規律運動（重訓+有氧組合最有效）',
            '壓力管理：長期高壓會消耗 DHEA-S',
            '確保充足睡眠（7-9小時）',
            '適量攝取健康脂肪（DHEA-S 合成需要膽固醇前驅物）',
          ] : [
            '略高於最佳區間，持續追蹤即可',
          ],
          supplements: lab.value < optMin ? [
            { name: 'DHEA', dosage: '25-50mg/天', timing: '早餐後', note: '直接補充前驅物，建議在醫師指導下使用' },
            { name: '維生素D3', dosage: '2000-4000 IU/天', timing: '隨餐', note: '維D不足會降低 DHEA-S' },
            { name: 'Ashwagandha', dosage: '600mg/天', timing: '早晚各 300mg', note: '研究顯示可提升 DHEA-S' },
          ] : [],
          references: ['Labrie et al. 2005 (J Endocrinol): DHEA and aging'],
        })
      }
    }

    // ── SHBG ──
    if (matchName(lab.test_name, ['shbg', '性荷爾蒙結合球蛋白'])) {
      const optMin = gender === '女性' ? 30 : 20
      const optMax = gender === '女性' ? 120 : 40
      const normalRange = gender === '女性' ? '18-144（正常）' : '10-57（正常）'
      if (lab.value < optMin || lab.value > optMax) {
        tips.push({
          category: 'hormone',
          title: lab.value > optMax ? 'SHBG 偏高端（會降低游離睪固酮）' : 'SHBG 偏低端',
          icon: '🔗',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: `${optMin}-${optMax} ${lab.unit}`,
          currentRange: normalRange,
          tips: lab.value > optMax ? [
            'SHBG 過高會結合過多游離睪固酮，降低生物利用率',
            '確保碳水攝取不要過低（低碳飲食會升高 SHBG）',
            '確保鋅和鎂攝取充足',
            '檢查甲狀腺功能（甲亢會升高 SHBG）',
          ] : [
            'SHBG 偏低可能與胰島素阻抗相關',
            '改善胰島素敏感度：運動、控制碳水',
            '減少過量酒精攝取',
          ],
          supplements: lab.value > optMax ? [
            { name: '硼 (Boron)', dosage: '6-10mg/天', timing: '隨餐', note: '研究顯示可降低 SHBG，提升游離睪固酮' },
            { name: '鎂', dosage: '400mg/天', timing: '睡前', note: '鎂缺乏與 SHBG 升高相關' },
          ] : [
            { name: '小檗鹼 (Berberine)', dosage: '500mg x 2次/天', timing: '餐前', note: '改善胰島素敏感度，低 SHBG 常與胰島素阻抗相關' },
          ],
          references: ['Hammond 2011 (Mol Cell Endocrinol): SHBG and metabolic function', 'Naghii et al. 2011 (J Trace Elem Med Biol): Boron and steroid hormones'],
        })
      }
    }

    // ── 雌二醇（男性）──
    if (matchName(lab.test_name, ['雌二醇', 'estradiol', 'e2'])) {
      if (gender !== '女性') {
        if ((lab.value >= 10 && lab.value < 15) || (lab.value > 30 && lab.value <= 40)) {
          tips.push({
            category: 'hormone',
            title: '雌二醇可再優化（目標 15-30）',
            icon: '⚖️',
            labMarker: lab.test_name,
            currentValue: lab.value,
            unit: lab.unit,
            optimalRange: '15-30 pg/mL',
            currentRange: '10-40（正常）',
            tips: lab.value > 30 ? [
              '高雌二醇常與高體脂相關（減脂可降低芳香化酶活性）',
              '增加十字花科蔬菜（含 DIM，有助雌激素代謝）',
              '減少酒精攝取（酒精會升高雌二醇）',
            ] : [
              '雌二醇過低也不好（骨密度和關節健康需要適量雌激素）',
              '確保脂肪攝取充足',
            ],
            supplements: lab.value > 30 ? [
              { name: 'DIM (Diindolylmethane)', dosage: '100-200mg/天', timing: '隨餐', note: '來自十字花科蔬菜，促進雌激素健康代謝' },
              { name: '鈣-D-葡萄糖酸 (CDG)', dosage: '500mg/天', timing: '隨餐', note: '支持肝臟雌激素代謝清除' },
            ] : [],
            references: ['Schulster et al. 2016 (Rev Urol): Male estradiol and health'],
          })
        }
      }
    }

    // ── 血紅素 ──
    if (matchName(lab.test_name, ['血紅素', 'hemoglobin', 'hgb'])) {
      const optMin = gender === '女性' ? 13.0 : 14.5
      const optMax = gender === '女性' ? 14.5 : 16.5
      const normalRange = gender === '女性' ? '12.0-15.5（正常）' : '13.5-17.5（正常）'
      if (lab.value < optMin || lab.value > optMax) {
        tips.push({
          category: 'blood',
          title: `血紅素可再優化（目標 ${optMin}-${optMax}）`,
          icon: '🩸',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: `${optMin}-${optMax} ${lab.unit}`,
          currentRange: normalRange,
          tips: lab.value < optMin ? [
            '增加富鐵食物攝取（紅肉、牡蠣、肝臟）',
            '搭配維生素C提升鐵吸收',
            '確保 B12 和葉酸充足（造血所需）',
            '運動員需注意「運動性溶血」—足底衝擊會破壞紅血球',
          ] : [
            '略高於最佳區間，確保水分攝取充足',
          ],
          supplements: lab.value < optMin ? [
            { name: '鐵雙甘胺酸 (Iron Bisglycinate)', dosage: '25-50mg/天', timing: '空腹搭配維C', note: '補充鐵質，促進血紅素合成' },
            { name: '活性 B 群複合物', dosage: '含 B12 + 葉酸', timing: '早餐後', note: 'B12 和葉酸是造血必需' },
            { name: '維生素C', dosage: '500mg', timing: '與鐵劑同服', note: '提升鐵吸收' },
          ] : [],
          references: ['WHO 2020: Haemoglobin concentrations for diagnosis of anaemia'],
        })
      }
    }

    // ── MCV ──
    if (matchName(lab.test_name, ['mcv', '平均紅血球容積'])) {
      if ((lab.value >= 80 && lab.value < 85) || (lab.value > 95 && lab.value <= 100)) {
        tips.push({
          category: 'blood',
          title: 'MCV 可再優化（目標 85-95）',
          icon: '🔬',
          labMarker: lab.test_name,
          currentValue: lab.value,
          unit: lab.unit,
          optimalRange: '85-95 fL',
          currentRange: '80-100（正常）',
          tips: lab.value < 85 ? [
            'MCV 偏低端可能暗示早期鐵缺乏',
            '增加鐵質攝取，搭配維生素C',
            '追蹤鐵蛋白確認鐵儲存狀態',
          ] : [
            'MCV 偏高端可能暗示 B12 或葉酸不足',
            '增加 B12（肉類、蛋）和葉酸（深色蔬菜）攝取',
          ],
          supplements: lab.value < 85 ? [
            { name: '鐵雙甘胺酸', dosage: '25mg/天', timing: '空腹搭配維C', note: '低 MCV 常見原因是缺鐵' },
            { name: '維生素C', dosage: '500mg', timing: '與鐵劑同服', note: '提升鐵吸收' },
          ] : [
            { name: '甲基鈷胺素 (Methylcobalamin)', dosage: '1000μg/天', timing: '舌下含服', note: '高 MCV 可能暗示 B12 不足' },
            { name: '活性葉酸 (Methylfolate)', dosage: '400-800μg/天', timing: '早餐後', note: '葉酸不足也會造成 MCV 偏高' },
          ],
          references: ['Maner & Moosavi 2023 (StatPearls): Mean Corpuscular Volume'],
        })
      }
    }
  }

  return tips
}

// ═══════════════════════════════════════════════════════════════
// Lab → Macro Modifiers
// 從血檢結果產出可直接影響營養引擎的巨量營養素修正
// ═══════════════════════════════════════════════════════════════

export interface LabMacroModifier {
  nutrient: 'protein' | 'fat' | 'carbs' | 'calories'
  direction: 'increase' | 'decrease'
  /** 修正量（g 或 kcal），會疊加到引擎計算結果上 */
  delta: number
  reason: string
  labMarker: string
}

export interface LabTrainingModifier {
  area: 'cardio' | 'volume' | 'intensity'
  direction: 'increase' | 'decrease'
  reason: string
  labMarker: string
}

/**
 * 從血檢結果提取可量化的巨量營養素修正
 * 供 nutrition-engine 在計算最終 macros 後疊加
 *
 * 文獻：
 *  - Low ferritin + exercise → increased iron loss (Peeling et al. 2008, Br J Sports Med)
 *  - High ApoB → reduce SFA < 7% total kcal (Ference et al. 2017, Eur Heart J)
 *  - Low albumin → protein intake ≥ 2.0 g/kg (Don & Kaysen 2004)
 *  - High fasting insulin / HOMA-IR → carb cycling benefit (Richter & Hargreaves 2013)
 */
export function getLabMacroModifiers(
  labs: LabInput[],
  options: { gender?: '男性' | '女性'; bodyWeight?: number } = {}
): { macroModifiers: LabMacroModifier[]; trainingModifiers: LabTrainingModifier[]; warnings: string[]; carbCycleMultiplier: number } {
  const macroModifiers: LabMacroModifier[] = []
  const trainingModifiers: LabTrainingModifier[] = []
  const warnings: string[] = []
  const bw = options.bodyWeight ?? 70
  let hasInsulinSensitivityBoost = false // 防止 HOMA-IR + 空腹胰島素雙重加碳水
  // 碳循環倍率：預設 1.5x，根據代謝健康動態調整
  // 優秀胰島素敏感度 → 訓練日可吃更多碳水（1.8x）
  // 差的胰島素敏感度 → 訓練日碳水集中但不要太高（1.3x）
  let carbCycleMultiplier = 1.5

  for (const lab of labs) {
    if (lab.value == null) continue

    // ═══ 優勢指標正向調配（Positive Modifiers）═══
    // 當血檢指標優秀時，放寬對應營養素限制，讓飲食分配更靈活
    // 文獻：
    //  - HOMA-IR < 1.0 → 極佳胰島素敏感度，碳水耐受力高 (Volek & Phinney 2011)
    //  - ApoB < 60 → 心血管風險極低，脂肪攝取彈性更大 (Sniderman et al. 2019, Lancet)
    //  - 空腹胰島素 < 5 → 碳水分配窗口可拉寬 (Ludwig 2002, JAMA)
    //  - TG < 70 → 脂質代謝極佳，不需額外限制碳水
    //
    // 防重複計算：HOMA-IR = (空腹胰島素 × 空腹血糖) / 405
    // 兩者高度相關，只取其一加碳水，優先用 HOMA-IR（更完整的指標）

    if (matchName(lab.test_name, ['homa-ir', 'homair'])) {
      if (lab.value < 1.0) {
        macroModifiers.push({
          nutrient: 'carbs',
          direction: 'increase',
          delta: Math.round(bw * 0.3), // +0.3 g/kg carbs
          reason: `HOMA-IR 極佳（${lab.value}），胰島素敏感度頂尖，可增加碳水攝取`,
          labMarker: lab.test_name,
        })
        warnings.push(`🟢 HOMA-IR ${lab.value}（優秀 <1.0）：胰島素敏感度極佳，碳水耐受力高，訓練日碳水可拉到 5-6g/kg`)
        hasInsulinSensitivityBoost = true
        carbCycleMultiplier = 1.8 // 胰島素敏感度極佳，訓練日碳水可拉更高
      }
    }

    if (matchName(lab.test_name, ['apob', 'apolipoproteinb'])) {
      if (lab.value < 60) {
        macroModifiers.push({
          nutrient: 'fat',
          direction: 'increase',
          delta: Math.round(bw * 0.1), // +0.1 g/kg fat
          reason: `ApoB 極佳（${lab.value}），心血管風險極低，脂肪攝取彈性更大`,
          labMarker: lab.test_name,
        })
        warnings.push(`🟢 ApoB ${lab.value}（優秀 <60）：脂質代謝頂尖，飲食脂肪比例可適度放寬`)
      }
    }

    // 只在沒有 HOMA-IR 優勢加成時才用空腹胰島素加碳水（避免雙重計算）
    if (matchName(lab.test_name, ['空腹胰島素', 'fasting insulin'])) {
      if (lab.value < 5 && lab.value > 0 && !hasInsulinSensitivityBoost) {
        macroModifiers.push({
          nutrient: 'carbs',
          direction: 'increase',
          delta: Math.round(bw * 0.3), // +0.3 g/kg carbs
          reason: `空腹胰島素極低（${lab.value}），碳水處理能力優秀，可增加碳水`,
          labMarker: lab.test_name,
        })
        warnings.push(`🟢 空腹胰島素 ${lab.value}（優秀 <5）：碳循環高碳日可拉到 5-6g/kg`)
        hasInsulinSensitivityBoost = true
        carbCycleMultiplier = 1.8
      }
    }

    if (matchName(lab.test_name, ['三酸甘油酯', 'triglyceride', 'tg'])) {
      if (lab.value < 70) {
        macroModifiers.push({
          nutrient: 'carbs',
          direction: 'increase',
          delta: Math.round(bw * 0.2), // +0.2 g/kg carbs
          reason: `三酸甘油酯極低（${lab.value}），脂質代謝優秀，碳水耐受力高`,
          labMarker: lab.test_name,
        })
        warnings.push(`🟢 TG ${lab.value}（優秀 <70）：脂質代謝極佳，不需額外限制碳水`)
      }
    }

    // ═══ 異常指標負向修正（原有邏輯）═══
    if (lab.status === 'normal') continue

    // ── 低鐵蛋白 → 增加蛋白質（含鐵血紅蛋白來源）+ 減少有氧量 ──
    if (matchName(lab.test_name, ['鐵蛋白', 'ferritin'])) {
      const threshold = options.gender === '女性' ? 30 : 50
      if (lab.value < threshold) {
        macroModifiers.push({
          nutrient: 'protein',
          direction: 'increase',
          delta: Math.round(bw * 0.2), // +0.2 g/kg protein（紅肉含鐵血紅蛋白）
          reason: `鐵蛋白偏低（${lab.value}），增加蛋白質以攝取更多血紅素鐵`,
          labMarker: lab.test_name,
        })
        trainingModifiers.push({
          area: 'cardio',
          direction: 'decrease',
          reason: `鐵蛋白偏低（${lab.value}），建議減少有氧訓練量（汗液和足底衝擊會增加鐵流失）`,
          labMarker: lab.test_name,
        })
        warnings.push(`🩸 鐵蛋白 ${lab.value}（目標 >${threshold}）：建議優先選擇紅肉、牛肉等含血紅素鐵的蛋白質來源，並減少有氧量`)
      }
    }

    // ── 高 ApoB / LDL → 減少飽和脂肪，改用不飽和脂肪 ──
    if (matchName(lab.test_name, ['apob', 'apolipoproteinb'])) {
      if (lab.value > 90) {
        macroModifiers.push({
          nutrient: 'fat',
          direction: 'decrease',
          delta: Math.round(bw * 0.1), // -0.1 g/kg fat（減少飽和脂肪）
          reason: `ApoB 偏高（${lab.value}），減少飽和脂肪攝取`,
          labMarker: lab.test_name,
        })
        warnings.push(`❤️ ApoB ${lab.value}（目標 <80）：飽和脂肪 <7% 總熱量，以橄欖油、魚油替代`)
      }
    }

    // ── 高 LDL-C → 減少飽和脂肪（ApoB 的 fallback，不是每人都測 ApoB）──
    if (matchName(lab.test_name, ['ldl-c', 'ldl', '低密度脂蛋白', '低密度膽固醇'])) {
      if (lab.value > 130) {
        // 只在沒有 ApoB modifier 時才加，避免跟 ApoB > 90 重複扣
        const hasApobMod = macroModifiers.some(m => m.labMarker && matchName(m.labMarker, ['apob', 'apolipoproteinb']))
        if (!hasApobMod) {
          macroModifiers.push({
            nutrient: 'fat',
            direction: 'decrease',
            delta: Math.round(bw * 0.1), // -0.1 g/kg fat
            reason: `LDL-C 偏高（${lab.value}），減少飽和脂肪攝取`,
            labMarker: lab.test_name,
          })
          warnings.push(`❤️ LDL-C ${lab.value}（目標 <130）：飽和脂肪 <7% 總熱量，優先選擇不飽和脂肪`)
        }
      }
    }

    // ── 低白蛋白 → 增加蛋白質 ──
    if (matchName(lab.test_name, ['白蛋白', 'albumin'])) {
      if (lab.value < 3.5) {
        macroModifiers.push({
          nutrient: 'protein',
          direction: 'increase',
          delta: Math.round(bw * 0.3), // +0.3 g/kg
          reason: `白蛋白偏低（${lab.value}），增加蛋白質攝取至 2.0-2.2 g/kg`,
          labMarker: lab.test_name,
        })
        warnings.push(`🥚 白蛋白 ${lab.value}（目標 >4.0）：每餐確保 30-40g 優質蛋白質`)
      }
    }

    // ── 高空腹胰島素 / HOMA-IR → 減少碳水，建議碳循環 ──
    if (matchName(lab.test_name, ['空腹胰島素', 'fasting insulin'])) {
      if (lab.value > 8) {
        macroModifiers.push({
          nutrient: 'carbs',
          direction: 'decrease',
          delta: Math.round(bw * 0.5), // -0.5 g/kg carbs
          reason: `空腹胰島素偏高（${lab.value}），減少碳水並集中在訓練前後`,
          labMarker: lab.test_name,
        })
        warnings.push(`💉 空腹胰島素 ${lab.value}（目標 <5）：碳水集中在訓練前後，休息日降低碳水比例`)
      }
    }

    if (matchName(lab.test_name, ['homa-ir', 'homair'])) {
      if (lab.value > 2.0) {
        macroModifiers.push({
          nutrient: 'carbs',
          direction: 'decrease',
          delta: Math.round(bw * 0.5),
          reason: `HOMA-IR 偏高（${lab.value}），減少碳水攝取`,
          labMarker: lab.test_name,
        })
        warnings.push(`📊 HOMA-IR ${lab.value}（目標 <2.0）：建議啟用碳循環，訓練日 4-5g/kg、休息日 2-3g/kg`)
        carbCycleMultiplier = 1.3 // 胰島素阻抗偏高，訓練日碳水不宜拉太高
      }
    }

    // ── 高三酸甘油酯 → 減少精製碳水 ──
    if (matchName(lab.test_name, ['三酸甘油酯', 'triglyceride', 'tg'])) {
      if (lab.value > 150) {
        macroModifiers.push({
          nutrient: 'carbs',
          direction: 'decrease',
          delta: Math.round(bw * 0.3),
          reason: `三酸甘油酯偏高（${lab.value}），減少精製碳水`,
          labMarker: lab.test_name,
        })
        warnings.push(`💧 TG ${lab.value}（目標 <100）：碳水來源改為低 GI，增加 Omega-3`)
      }
    }

    // ── TSH 偏高（甲狀腺低下）→ 不宜過度減卡 ──
    if (matchName(lab.test_name, ['tsh', '促甲狀腺激素'])) {
      if (lab.value > 4.0) {
        macroModifiers.push({
          nutrient: 'calories',
          direction: 'increase',
          delta: 100,
          reason: `TSH 偏高（${lab.value}），甲狀腺低下傾向，不宜過度限制熱量`,
          labMarker: lab.test_name,
        })
        trainingModifiers.push({
          area: 'intensity',
          direction: 'decrease',
          reason: `TSH 偏高（${lab.value}），代謝率降低，建議適度降低訓練強度`,
          labMarker: lab.test_name,
        })
        warnings.push(`🦋 TSH ${lab.value}（目標 1.0-2.0）：甲狀腺低下傾向，不宜過度限制熱量`)
      }
    }

    // ── 低睪固酮（男性）→ 增加脂肪，脂肪過低會壓制睪固酮合成 ──
    if (matchName(lab.test_name, ['睪固酮', 'testosterone', '總睪固酮', 'total testosterone'])) {
      if (options.gender === '男性' && lab.value < 300) {
        macroModifiers.push({
          nutrient: 'fat',
          direction: 'increase',
          delta: Math.round(bw * 0.1), // +0.1 g/kg fat
          reason: `睪固酮偏低（${lab.value}），增加脂肪攝取支持荷爾蒙合成`,
          labMarker: lab.test_name,
        })
        warnings.push(`🔻 睪固酮 ${lab.value}（目標 >300 ng/dL）：脂肪攝取 ≥25% 總熱量，確保飽和脂肪 ≥10%，支持睪固酮合成`)
      }
    }

    // ── 低游離睪固酮（男性）→ 增加脂肪 ──
    if (matchName(lab.test_name, ['游離睪固酮', 'free testosterone', 'freetestosterone'])) {
      if (options.gender === '男性' && lab.value < 5) {
        // 只在沒有總睪固酮 modifier 時才加，避免重複
        const hasTestoMod = macroModifiers.some(m => m.labMarker && matchName(m.labMarker, ['睪固酮', 'testosterone', '總睪固酮', 'total testosterone']))
        if (!hasTestoMod) {
          macroModifiers.push({
            nutrient: 'fat',
            direction: 'increase',
            delta: Math.round(bw * 0.1), // +0.1 g/kg fat
            reason: `游離睪固酮偏低（${lab.value}），增加脂肪攝取支持荷爾蒙合成`,
            labMarker: lab.test_name,
          })
          warnings.push(`🔻 游離睪固酮 ${lab.value}（偏低）：脂肪攝取 ≥25% 總熱量，支持荷爾蒙合成`)
        }
      }
    }

    // ── 低血紅素 → 減少有氧 ──
    if (matchName(lab.test_name, ['血紅素', 'hemoglobin', 'hgb'])) {
      const hbMin = options.gender === '女性' ? 12.0 : 13.5
      if (lab.value < hbMin) {
        trainingModifiers.push({
          area: 'cardio',
          direction: 'decrease',
          reason: `血紅素偏低（${lab.value}），氧氣運輸能力下降，減少有氧訓練量`,
          labMarker: lab.test_name,
        })
        warnings.push(`🔴 血紅素 ${lab.value}（目標 >${hbMin}）：有氧能力受限，建議減少有氧量`)
      }
    }
  }

  return { macroModifiers, trainingModifiers, warnings, carbCycleMultiplier }
}

// ═══════════════════════════════════════════════════════════════
// 交叉分析：多指標群組風險偵測
// 單一指標異常可能是偶發，多指標同時異常 = 系統性問題
// ═══════════════════════════════════════════════════════════════

export interface LabCrossAnalysis {
  pattern: string           // 風險模式 ID
  title: string
  icon: string
  severity: 'critical' | 'high' | 'medium'
  description: string
  triggeredMarkers: { name: string; value: number; unit: string }[]
  actionItems: string[]
  references: string[]
}

export function detectLabCrossPatterns(
  labs: LabInput[],
  options: { gender?: '男性' | '女性'; bodyFatPct?: number | null; hasAmenorrhea?: boolean } = {}
): LabCrossAnalysis[] {
  const patterns: LabCrossAnalysis[] = []
  const { gender, bodyFatPct, hasAmenorrhea } = options

  // 輔助：取得指標最新值
  const getValue = (keywords: string[]): { name: string; value: number; unit: string } | null => {
    let latest: { name: string; value: number; unit: string; date?: string } | null = null
    for (const lab of labs) {
      if (lab.value != null && matchName(lab.test_name, keywords)) {
        if (!latest || (lab.date && (!latest.date || lab.date > latest.date))) {
          latest = { name: lab.test_name, value: lab.value, unit: lab.unit, date: lab.date }
        }
      }
    }
    return latest ? { name: latest.name, value: latest.value, unit: latest.unit } : null
  }

  // ── Pattern 1: RED-S 風險群組（女性為主，男性也可能）──
  // Mountjoy 2018 IOC: 低鐵蛋白 + 低維生素 D + 閉經 + 低體脂 = RED-S 高風險
  const ferritin = getValue(['鐵蛋白', 'ferritin'])
  const vitD = getValue(['維生素d', 'vitamind', '25oh', '25-oh'])
  const tsh = getValue(['tsh', '促甲狀腺'])
  const cortisol = getValue(['皮質醇', 'cortisol'])
  const testosterone = getValue(['睪固酮', 'testosterone', 'totaltestosterone'])
  const freeT = getValue(['游離睪固酮', 'freetestosterone'])

  {
    const redSMarkers: { name: string; value: number; unit: string }[] = []
    let redSScore = 0

    if (ferritin && ferritin.value < 30) { redSMarkers.push(ferritin); redSScore++ }
    if (vitD && vitD.value < 30) { redSMarkers.push(vitD); redSScore++ }
    if (tsh && tsh.value > 4.0) { redSMarkers.push(tsh); redSScore++ }
    if (gender === '女性' && hasAmenorrhea) { redSScore += 2 } // 閉經是最強信號
    if (bodyFatPct != null && gender === '女性' && bodyFatPct < 15) { redSScore++ }
    if (bodyFatPct != null && gender === '男性' && bodyFatPct < 6) { redSScore++ }
    // 男性也看睪固酮
    if (gender === '男性' && testosterone && testosterone.value < 300) { redSMarkers.push(testosterone); redSScore++ }

    if (redSScore >= 3) {
      patterns.push({
        pattern: 'red_s_risk',
        title: 'RED-S（相對能量不足）風險',
        icon: '🚨',
        severity: redSScore >= 4 ? 'critical' : 'high',
        description: `偵測到 ${redSMarkers.length} 項相關指標異常${hasAmenorrhea ? ' + 閉經' : ''}${bodyFatPct != null && bodyFatPct < 15 ? ` + 低體脂（${bodyFatPct}%）` : ''}。這些指標同時異常高度暗示能量攝取長期不足，影響荷爾蒙、骨密度、免疫力。`,
        triggeredMarkers: redSMarkers,
        actionItems: [
          '立即增加每日熱量攝取 300-500kcal',
          '確保能量可用性 > 30 kcal/kg FFM/day',
          '減少有氧訓練量，優先恢復',
          '建議諮詢運動醫學科或內分泌科',
          ...(hasAmenorrhea ? ['閉經是 RED-S 最嚴重的警訊，需優先處理'] : []),
        ],
        references: [
          'Mountjoy et al. 2018 (Br J Sports Med): IOC consensus statement on RED-S',
          'Loucks & Thuma 2003 (J Clin Endocrinol Metab): LH pulsatility disrupted at EA < 30 kcal/kg FFM/day',
        ],
      })
    }
  }

  // ── Pattern 2: 代謝症候群風險 ──
  // IDF 2006: 空腹血糖 + 三酸甘油酯 + HDL + 血壓（我們沒有血壓）
  const glucose = getValue(['空腹血糖', 'fastingglucose', 'fbs'])
  const insulin = getValue(['空腹胰島素', 'fastinginsulin'])
  const homaIR = getValue(['homair', 'homa-ir', '胰島素阻抗'])
  const triglycerides = getValue(['三酸甘油酯', 'triglycerides', 'tg'])
  const hdl = getValue(['hdl', '高密度脂蛋白'])
  const uricAcid = getValue(['尿酸', 'uricacid'])

  {
    const metSynMarkers: { name: string; value: number; unit: string }[] = []
    let metSynScore = 0

    if (glucose && glucose.value >= 100) { metSynMarkers.push(glucose); metSynScore++ }
    if (triglycerides && triglycerides.value >= 150) { metSynMarkers.push(triglycerides); metSynScore++ }
    if (hdl) {
      const hdlThreshold = gender === '女性' ? 50 : 40
      if (hdl.value < hdlThreshold) { metSynMarkers.push(hdl); metSynScore++ }
    }
    if (homaIR && homaIR.value > 2.5) { metSynMarkers.push(homaIR); metSynScore++ }
    if (insulin && insulin.value > 12) { metSynMarkers.push(insulin); metSynScore++ }
    if (uricAcid) {
      const uaMax = gender === '女性' ? 6.0 : 7.0
      if (uricAcid.value > uaMax) { metSynMarkers.push(uricAcid); metSynScore++ }
    }

    if (metSynScore >= 3) {
      patterns.push({
        pattern: 'metabolic_syndrome',
        title: '代謝症候群風險',
        icon: '⚠️',
        severity: metSynScore >= 4 ? 'high' : 'medium',
        description: `${metSynMarkers.length} 項代謝指標同時異常，符合代謝症候群模式。胰島素阻抗可能是核心問題，需要從飲食結構整體調整。`,
        triggeredMarkers: metSynMarkers,
        actionItems: [
          '碳水總量減少 20-30%，優先移除精緻碳水（白飯白麵可保留，糖飲甜食先砍）',
          '碳循環策略：訓練日碳水正常，休息日碳水減半',
          '增加 Omega-3 攝取（每日 2g EPA+DHA）— 改善胰島素敏感度 + 降低三酸甘油酯',
          '增加膳食纖維至 30g/天（蔬菜、豆類、燕麥）',
          '每餐先吃蛋白質和蔬菜，最後吃碳水（降低餐後血糖峰值）',
          ...(uricAcid && uricAcid.value > 7.0 ? ['尿酸偏高：減少果糖（含糖飲料、蜂蜜）和內臟類'] : []),
        ],
        references: [
          'Alberti et al. 2009 (Circulation): IDF/AHA Joint Interim Statement on metabolic syndrome',
          'Richter & Hargreaves 2013 (Physiol Rev): Exercise, GLUT4, and skeletal muscle glucose uptake',
        ],
      })
    }
  }

  // ── Pattern 3: 過度訓練 / 恢復不足 ──
  // Meeusen et al. 2013: cortisol + testosterone ratio + ferritin + CRP
  const crp = getValue(['crp', 'hscrp', 'c反應蛋白', 'c-reactiveprotein'])

  {
    const otMarkers: { name: string; value: number; unit: string }[] = []
    let otScore = 0

    if (cortisol && cortisol.value > 25) { otMarkers.push(cortisol); otScore++ }
    if (gender === '男性' && testosterone && testosterone.value < 400) { otMarkers.push(testosterone); otScore++ }
    if (gender === '男性' && freeT && freeT.value < 47) { otMarkers.push(freeT); otScore++ }
    if (ferritin && ferritin.value < 30) { otMarkers.push(ferritin); otScore++ }
    if (crp && crp.value > 3.0) { otMarkers.push(crp); otScore++ }
    if (tsh && tsh.value > 4.0) { otMarkers.push(tsh); otScore++ }

    if (otScore >= 3) {
      patterns.push({
        pattern: 'overtraining_risk',
        title: '過度訓練 / 恢復不足',
        icon: '🔥',
        severity: otScore >= 4 ? 'high' : 'medium',
        description: `${otMarkers.length} 項恢復相關指標異常。高皮質醇 + 低睪固酮 + 發炎指標升高的組合暗示身體處於長期壓力狀態。`,
        triggeredMarkers: otMarkers,
        actionItems: [
          '減少訓練量 20-30%，為期 1-2 週',
          '增加碳水攝取 +1g/kg（碳水是降低皮質醇最快的營養素）',
          '睡眠優先：目標 7-9 小時，避免訓練後 2 小時內就寢',
          '增加抗發炎食物：魚油、薑黃、藍莓、深色蔬菜',
          ...(crp && crp.value > 5.0 ? ['CRP > 5：排除感染或受傷因素，考慮諮詢醫師'] : []),
        ],
        references: [
          'Meeusen et al. 2013 (Med Sci Sports Exerc): European College of Sport Science — Prevention, diagnosis, and treatment of overtraining syndrome',
          'Cadegiani & Kater 2017 (BMC Sports Sci Med Rehabil): Hormonal aspects of overtraining syndrome',
        ],
      })
    }
  }

  // ── Pattern 4: 甲狀腺代謝低下 + 減脂停滯 ──
  const freeT4 = getValue(['freet4', '游離t4', 'ft4', '游離甲狀腺素'])

  if (tsh && tsh.value > 3.5 && freeT4 && freeT4.value < 1.0) {
    patterns.push({
      pattern: 'thyroid_metabolic',
      title: '甲狀腺功能偏低 — 代謝減速',
      icon: '🦋',
      severity: tsh.value > 5.0 ? 'high' : 'medium',
      description: `TSH 偏高（${tsh.value}）+ Free T4 偏低（${freeT4.value}）的組合暗示甲狀腺功能不足。這會降低基礎代謝率，使減脂更加困難。`,
      triggeredMarkers: [tsh, freeT4],
      actionItems: [
        '不要再加深赤字（代謝已經在減速，再砍熱量只會更差）',
        '增加每日碳水攝取 50-100g（T3 轉換需要碳水，極低碳會惡化）',
        '確保碘攝取（海帶、紫菜、碘鹽）— 碘是甲狀腺激素的原料',
        '確保硒攝取（巴西堅果 2-3 顆/天）— 硒是 T4 → T3 轉換酶的輔因子',
        '建議諮詢內分泌科評估是否需要藥物介入',
      ],
      references: [
        'Mullur et al. 2014 (Physiol Rev): Thyroid hormone regulation of metabolism',
        'Reinehr 2010 (Obes Rev): Thyroid and body weight — the interplay',
      ],
    })
  }

  // ── Pattern 5: 慢性發炎 ──
  const homocysteine = getValue(['同半胱胺酸', 'homocysteine'])

  {
    const infMarkers: { name: string; value: number; unit: string }[] = []
    let infScore = 0

    if (crp && crp.value > 3.0) { infMarkers.push(crp); infScore++ }
    if (homocysteine && homocysteine.value > 12) { infMarkers.push(homocysteine); infScore++ }
    if (uricAcid) {
      const uaMax = gender === '女性' ? 6.0 : 7.0
      if (uricAcid.value > uaMax) { infMarkers.push(uricAcid); infScore++ }
    }
    if (ferritin && ferritin.value > (gender === '女性' ? 150 : 300)) { infMarkers.push(ferritin); infScore++ }

    if (infScore >= 2) {
      patterns.push({
        pattern: 'chronic_inflammation',
        title: '慢性發炎傾向',
        icon: '🔴',
        severity: infScore >= 3 ? 'high' : 'medium',
        description: `${infMarkers.length} 項發炎相關指標偏高。慢性低度發炎會影響恢復、胰島素敏感度和整體健康。`,
        triggeredMarkers: infMarkers,
        actionItems: [
          '增加 Omega-3（每日 2-3g EPA+DHA）— 最有效的抗發炎營養素',
          '增加蔬果至每日 5-7 份（多酚和抗氧化物）',
          '減少加工食品、油炸物、精緻糖',
          ...(homocysteine && homocysteine.value > 12 ? ['同半胱胺酸偏高：補充 B6 + B12 + 葉酸（甲基化支持）'] : []),
          ...(uricAcid && uricAcid.value > 7.0 ? ['減少果糖來源（含糖飲料、蜂蜜）和高普林食物（內臟、濃湯）'] : []),
        ],
        references: [
          'Calder 2006 (Am J Clin Nutr): n-3 polyunsaturated fatty acids, inflammation, and inflammatory diseases',
          'Minihane et al. 2015 (Br J Nutr): Low-grade inflammation, diet composition, and health',
        ],
      })
    }
  }

  // 按嚴重度排序
  patterns.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2 }
    return order[a.severity] - order[b.severity]
  })

  return patterns
}

// ═══════════════════════════════════════════════════════════════
// 複檢提醒：根據異常指標自動計算建議複檢時間
// ═══════════════════════════════════════════════════════════════

export interface LabRetestReminder {
  testName: string
  lastValue: number
  unit: string
  lastDate: string
  severity: 'high' | 'medium'
  suggestedRetestDate: string  // ISO date
  suggestedRetestWeeks: number
  reason: string
  isOverdue: boolean          // 已超過建議複檢日
}

export function generateRetestReminders(
  labs: Array<{ test_name: string; value: number | null; unit: string; status: 'normal' | 'attention' | 'alert'; date: string }>,
  options: { gender?: '男性' | '女性' } = {}
): LabRetestReminder[] {
  const reminders: LabRetestReminder[] = []
  const now = new Date()

  // 按 test_name 分組，取最新一筆
  const latestByTest = new Map<string, typeof labs[0]>()
  for (const lab of labs) {
    if (lab.value == null) continue
    const existing = latestByTest.get(lab.test_name)
    if (!existing || lab.date > existing.date) {
      latestByTest.set(lab.test_name, lab)
    }
  }

  // 複檢週期對照表（僅異常指標需要複檢提醒）
  // 文獻：各指標 clinical guidelines 的建議追蹤間隔
  const retestSchedule: { keywords: string[]; weeks: number; reason: string; reasonHigh?: string; severity: 'high' | 'medium' }[] = [
    // 鐵 — 依偏高/偏低給不同原因（Peeling 2008）
    { keywords: ['鐵蛋白', 'ferritin'], weeks: 12, reason: '鐵劑補充後約 8-12 週可見鐵蛋白回升，建議追蹤效果', reasonHigh: '鐵蛋白偏高需定期追蹤，確認是否有改善或需進一步檢查', severity: 'high' },
    { keywords: ['血紅素', 'hemoglobin', 'hgb'], weeks: 12, reason: '貧血治療後 8-12 週追蹤血紅素恢復情況', severity: 'high' },
    // 維生素 D — 補充 3 個月後複檢（Holick 2011）
    { keywords: ['維生素d', 'vitamind', '25oh'], weeks: 12, reason: '維生素 D 補充後 3 個月達穩態，建議複檢確認是否達標', severity: 'medium' },
    // 血脂 — 飲食調整後 3 個月（NCEP ATP III）
    { keywords: ['apob', 'apolipoproteinb'], weeks: 12, reason: '飲食調整對 ApoB 的影響約 8-12 週可見', severity: 'medium' },
    { keywords: ['ldl', '低密度脂蛋白'], weeks: 12, reason: '飲食調整後 3 個月追蹤 LDL 變化', severity: 'medium' },
    { keywords: ['三酸甘油酯', 'triglycerides', 'tg'], weeks: 8, reason: '三酸甘油酯對飲食反應較快，8 週可見效果', severity: 'medium' },
    // 血糖/胰島素 — 飲食調整後 8-12 週
    { keywords: ['空腹血糖', 'fastingglucose', 'fbs'], weeks: 12, reason: '碳水調整後 3 個月追蹤血糖改善', severity: 'medium' },
    { keywords: ['homair', 'homa-ir', '胰島素阻抗'], weeks: 12, reason: '飲食+運動介入後 3 個月評估胰島素敏感度改善', severity: 'high' },
    { keywords: ['糖化血色素', 'hba1c'], weeks: 12, reason: 'HbA1c 反映 3 個月平均血糖，至少 3 個月後複檢', severity: 'medium' },
    // 甲狀腺 — 6-8 週
    { keywords: ['tsh', '促甲狀腺'], weeks: 8, reason: 'TSH 對飲食和藥物調整的反應約 6-8 週', severity: 'high' },
    // 荷爾蒙 — 3 個月
    { keywords: ['睪固酮', 'testosterone'], weeks: 12, reason: '生活方式調整後 3 個月追蹤睪固酮變化', severity: 'medium' },
    // 發炎 — 4-8 週
    { keywords: ['crp', 'hscrp', 'c反應蛋白'], weeks: 8, reason: '抗發炎飲食調整後 8 週追蹤 CRP 變化', severity: 'medium' },
    // 同半胱胺酸 — B 群補充後 8-12 週（Clarke 2014）
    { keywords: ['同半胱胺酸', 'homocysteine'], weeks: 12, reason: 'B6 + B12 + 葉酸補充後 8-12 週追蹤同半胱胺酸變化', severity: 'high' },
    // B12 — 補充後 3 個月
    { keywords: ['維生素b12', 'b12', '鈷胺素'], weeks: 12, reason: 'B12 補充後 3 個月追蹤血清濃度', severity: 'medium' },
    // 葉酸 — 補充後 3 個月
    { keywords: ['葉酸', 'folate', 'folicacid'], weeks: 12, reason: '葉酸補充後 3 個月追蹤血清濃度', severity: 'medium' },
    // 尿酸 — 飲食調整後 4-8 週
    { keywords: ['尿酸', 'uricacid'], weeks: 8, reason: '飲食調整後 8 週追蹤尿酸變化', severity: 'medium' },
    // 肝功能 — 飲食調整後 8-12 週
    { keywords: ['alt', 'gpt', 'sgpt'], weeks: 12, reason: '飲食調整後 3 個月追蹤肝指數改善', severity: 'medium' },
    { keywords: ['ast', 'got', 'sgot'], weeks: 12, reason: '飲食調整後 3 個月追蹤肝指數改善', severity: 'medium' },
    { keywords: ['ggt', 'γ-gt'], weeks: 12, reason: '減少酒精與調整飲食後 3 個月追蹤 GGT 變化', severity: 'medium' },
    // 腎功能 — 3 個月
    { keywords: ['肌酸酐', 'creatinine'], weeks: 12, reason: '飲食調整後 3 個月追蹤腎功能變化', severity: 'medium' },
    { keywords: ['egfr', '腎絲球過濾率'], weeks: 12, reason: '3 個月追蹤腎絲球過濾率變化', severity: 'medium' },
  ]

  for (const [, lab] of latestByTest) {
    if (lab.status === 'normal') continue // 正常的不需要複檢提醒

    for (const schedule of retestSchedule) {
      if (!matchName(lab.test_name, schedule.keywords)) continue

      const lastDate = new Date(lab.date)
      const retestDate = new Date(lastDate)
      retestDate.setDate(retestDate.getDate() + schedule.weeks * 7)
      const isOverdue = now > retestDate

      reminders.push({
        testName: lab.test_name,
        lastValue: lab.value!,
        unit: lab.unit,
        lastDate: lab.date,
        severity: schedule.severity,
        suggestedRetestDate: retestDate.toISOString().split('T')[0],
        suggestedRetestWeeks: schedule.weeks,
        reason: (lab.status === 'alert' && schedule.reasonHigh) ? schedule.reasonHigh : schedule.reason,
        isOverdue,
      })
      break // 每個指標只匹配一次
    }
  }

  // 已過期的排前面
  reminders.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1
    if (!a.isOverdue && b.isOverdue) return 1
    return new Date(a.suggestedRetestDate).getTime() - new Date(b.suggestedRetestDate).getTime()
  })

  return reminders
}

// ═══════════════════════════════════════════════════════════════
// 變化追蹤報告：比較同一指標的前後兩次值
// ═══════════════════════════════════════════════════════════════

export interface LabChangeReport {
  testName: string
  previousValue: number
  previousDate: string
  currentValue: number
  currentDate: string
  unit: string
  changeAbsolute: number     // 絕對變化
  changePct: number          // 百分比變化
  direction: 'improved' | 'worsened' | 'stable'
  interpretation: string     // 變化解讀
  isNowNormal: boolean       // 是否已回到正常範圍
  previousStatus: 'normal' | 'attention' | 'alert'
  currentStatus: 'normal' | 'attention' | 'alert'
}

export function generateLabChangeReport(
  labs: Array<{ test_name: string; value: number | null; unit: string; status: 'normal' | 'attention' | 'alert'; date: string }>,
  options: { gender?: '男性' | '女性' } = {}
): LabChangeReport[] {
  const reports: LabChangeReport[] = []

  // 按 test_name 分組
  const byTest = new Map<string, typeof labs>()
  for (const lab of labs) {
    if (lab.value == null) continue
    const group = byTest.get(lab.test_name) || []
    group.push(lab)
    byTest.set(lab.test_name, group)
  }

  // 指標方向定義：value 升高是好還是壞
  // true = 升高是壞的（需要降低），false = 升高是好的（需要升高）
  const higherIsBad: Record<string, boolean> = {
    '空腹血糖': true, 'fastingglucose': true, 'fbs': true,
    '空腹胰島素': true, 'fastinginsulin': true,
    'homair': true, 'homa-ir': true, '胰島素阻抗': true,
    '糖化血色素': true, 'hba1c': true,
    '尿酸': true, 'uricacid': true,
    '三酸甘油酯': true, 'triglycerides': true,
    'apob': true, 'ldl': true, '低密度脂蛋白': true,
    '總膽固醇': true,
    'ast': true, 'alt': true, 'ggt': true, '丙麩氨酸轉肽酶': true,
    '肌酸酐': true, 'creatinine': true,
    'bun': true, '血尿素氮': true,
    'tsh': true, '促甲狀腺': true,
    'crp': true, 'hscrp': true, 'c反應蛋白': true,
    '同半胱胺酸': true, 'homocysteine': true,
    '皮質醇': true, 'cortisol': true,
    '雌二醇': true, 'estradiol': true,  // 男性偏高是壞的
  }

  const higherIsGood: Record<string, boolean> = {
    'hdl': true, '高密度脂蛋白': true,
    '血紅素': true, 'hemoglobin': true,
    '維生素d': true, 'vitamind': true, '25oh': true,
    '維生素b12': true, 'b12': true,
    '葉酸': true, 'folate': true,
    '白蛋白': true, 'albumin': true,
    'egfr': true, '腎絲球過濾率': true,
    '睪固酮': true, 'testosterone': true,  // 通常升高是好的
    '游離睪固酮': true, 'freetestosterone': true,
    'dheas': true, 'dhea-s': true,
    'freet4': true, '游離t4': true, '游離甲狀腺素': true,
  }

  // 雙向指標：可以偏高也可以偏低，需依 status 判斷方向
  // 這些指標不應放在 higherIsBad 或 higherIsGood，而是根據當前狀態動態判斷
  const bidirectionalMarkers: Record<string, boolean> = {
    '鐵蛋白': true, 'ferritin': true,       // 偏低=缺鐵, 偏高=鐵過載/發炎
    '鎂': true, 'magnesium': true,           // 偏低=缺乏, 偏高=腎功能異常
    '鋅': true, 'zinc': true,               // 偏低=缺乏, 偏高=中毒
    '鈣': true, 'calcium': true,             // 偏低=低血鈣, 偏高=高血鈣
    'mcv': true, '平均紅血球體積': true,       // 偏低=小球性, 偏高=巨球性
    'shbg': true, '性荷爾蒙結合球蛋白': true,  // 偏低偏高都不好
  }

  for (const [testName, results] of byTest) {
    if (results.length < 2) continue

    // 按日期排序，取最近一筆與前一次有足夠時間間距的紀錄
    const sorted = results.sort((a, b) => b.date.localeCompare(a.date))
    const current = sorted[0]
    // 找到距離最近日期至少 14 天以上的前一筆（避免同次檢測的重複紀錄互相比較）
    const currentDate = new Date(current.date)
    let previous = sorted[1]
    for (let i = 1; i < sorted.length; i++) {
      const daysDiff = (currentDate.getTime() - new Date(sorted[i].date).getTime()) / (1000 * 60 * 60 * 24)
      if (daysDiff >= 14) {
        previous = sorted[i]
        break
      }
    }

    const changeAbs = current.value! - previous.value!
    const changePct = previous.value! !== 0 ? (changeAbs / previous.value!) * 100 : 0

    // 判斷方向
    const norm = testName.toLowerCase().replace(/[\s_\-()（）]/g, '')
    let direction: 'improved' | 'worsened' | 'stable'

    if (Math.abs(changePct) < 3) {
      direction = 'stable'
    } else {
      const isBidirectional = Object.keys(bidirectionalMarkers).some(k => norm.includes(k.toLowerCase().replace(/[\s_\-()（）]/g, '')))
      const isHigherBad = Object.keys(higherIsBad).some(k => norm.includes(k.toLowerCase().replace(/[\s_\-()（）]/g, '')))
      const isHigherGood = Object.keys(higherIsGood).some(k => norm.includes(k.toLowerCase().replace(/[\s_\-()（）]/g, '')))

      if (isBidirectional) {
        // 雙向指標：用 status 判斷改善或惡化
        if (current.status === 'normal' && previous.status !== 'normal') direction = 'improved'
        else if (current.status !== 'normal' && previous.status === 'normal') direction = 'worsened'
        else if (current.status === 'normal' && previous.status === 'normal') direction = 'stable'
        else {
          // 兩次都異常：往 normal 靠近就是改善（這裡用 status 嚴重度判斷）
          const severityOrder = { 'normal': 0, 'attention': 1, 'alert': 2 }
          const currentSev = severityOrder[current.status] ?? 1
          const prevSev = severityOrder[previous.status] ?? 1
          if (currentSev < prevSev) direction = 'improved'
          else if (currentSev > prevSev) direction = 'worsened'
          else direction = 'stable'
        }
      } else if (isHigherBad) {
        direction = changeAbs > 0 ? 'worsened' : 'improved'
      } else if (isHigherGood) {
        direction = changeAbs > 0 ? 'improved' : 'worsened'
      } else {
        // 用 status 判斷
        if (current.status === 'normal' && previous.status !== 'normal') direction = 'improved'
        else if (current.status !== 'normal' && previous.status === 'normal') direction = 'worsened'
        else direction = 'stable'
      }
    }

    // 解讀文字
    const absStr = Math.abs(changeAbs).toFixed(1)
    const pctStr = Math.abs(changePct).toFixed(1)
    const dirStr = changeAbs > 0 ? '↑' : '↓'
    let interpretation: string
    if (direction === 'improved') {
      interpretation = `${dirStr} ${absStr} ${current.unit}（${pctStr}%）— 飲食調整有效，持續保持`
    } else if (direction === 'worsened') {
      interpretation = `${dirStr} ${absStr} ${current.unit}（${pctStr}%）— 指標惡化，需檢視飲食執行狀況`
    } else {
      interpretation = `變化不大（${pctStr}%）— 目前策略維持穩定，持續觀察`
    }

    const isNowNormal = current.status === 'normal' && previous.status !== 'normal'
    if (isNowNormal) {
      interpretation += '。✅ 已回到正常範圍！'
    }

    reports.push({
      testName,
      previousValue: previous.value!,
      previousDate: previous.date,
      currentValue: current.value!,
      currentDate: current.date,
      unit: current.unit,
      changeAbsolute: Math.round(changeAbs * 100) / 100,
      changePct: Math.round(changePct * 10) / 10,
      direction,
      interpretation,
      isNowNormal,
      previousStatus: previous.status,
      currentStatus: current.status,
    })
  }

  // 改善的排前面（正向回饋），惡化的排後面
  reports.sort((a, b) => {
    const order = { improved: 0, stable: 1, worsened: 2 }
    return order[a.direction] - order[b.direction]
  })

  return reports
}
