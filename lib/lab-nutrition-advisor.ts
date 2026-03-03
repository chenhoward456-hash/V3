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
  references: string[]
  caveat?: string
}

interface LabInput {
  test_name: string
  value: number | null
  unit: string
  status: 'normal' | 'attention' | 'alert'
}

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

    if (matchName(lab.test_name, ['總膽固醇', 'total cholesterol', 'tc'])) {
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
          ],
          caveat: '長期低碳水飲食會降低 T3（活性甲狀腺素），但 T4 較穩定。若 T4 也低，建議回診確認。',
        })
      }
    }

    // ════════════════════════════════════════
    // 鐵代謝
    // ════════════════════════════════════════

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

    if (matchName(lab.test_name, ['血紅素', 'hemoglobin', 'hgb', 'hb'])) {
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
