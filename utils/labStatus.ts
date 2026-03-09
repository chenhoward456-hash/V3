// 血檢狀態計算工具函數
// 統一參考範圍 — 全系統唯一真相來源（lab-status-calculator.ts, supplement-engine.ts 都從這裡參考）
// 涵蓋：代謝、血脂、肝腎、甲狀腺、荷爾蒙、維生素、礦物質、血球、發炎

// ── 閾值配置 ──
// 數值型（越低越好）：normal = 正常上限, attention = 注意上限
// 數值型（越高越好）：normal = 正常下限, attention = 注意下限（列入 HIGHER_IS_BETTER）
// 範圍型：normal = { min, max }, attention = { min, max }
export const LAB_THRESHOLDS = {
  // ── 代謝 / 血糖 ──
  'HOMA-IR': { normal: 2.0, attention: 2.5 },
  '空腹胰島素': { normal: 5.0, attention: 8.0 },
  '空腹血糖': { normal: 90, attention: 100 },
  'HbA1c': { normal: 5.5, attention: 5.7 },
  '尿酸': { normal: 7.0, attention: 8.0 },
  '尿酸_female': { normal: 6.0, attention: 7.0 },

  // ── 血脂 ──
  '三酸甘油酯': { normal: 100, attention: 150 },
  'ApoB': { normal: 80, attention: 100 },
  'Lp(a)': { normal: 30, attention: 50 },
  'LDL-C': { normal: 100, attention: 130 },
  '總膽固醇': { normal: 200, attention: 240 },
  'HDL-C': { normal: 40, attention: 35 },           // 越高越好（男）
  'HDL-C_female': { normal: 50, attention: 40 },     // 越高越好（女）

  // ── 肝功能 ──
  'AST': { normal: 40, attention: 80 },
  'ALT': { normal: 40, attention: 80 },
  'GGT': { normal: 60, attention: 120 },
  'GGT_female': { normal: 40, attention: 80 },
  '白蛋白': { normal: 3.5, attention: 3.0 },         // 越高越好

  // ── 腎功能 ──
  '肌酸酐': { normal: { min: 0.7, max: 1.3 }, attention: { min: 0.5, max: 1.5 } },
  '肌酸酐_female': { normal: { min: 0.6, max: 1.1 }, attention: { min: 0.4, max: 1.3 } },
  'BUN': { normal: { min: 7, max: 20 }, attention: { min: 5, max: 25 } },
  'eGFR': { normal: 90, attention: 60 },             // 越高越好

  // ── 甲狀腺 ──
  'TSH': { normal: { min: 0.4, max: 4.0 }, attention: { min: 0.3, max: 5.0 } },
  'Free T4': { normal: { min: 0.8, max: 1.8 }, attention: { min: 0.6, max: 2.0 } },
  'Free T3': { normal: { min: 2.3, max: 4.2 }, attention: { min: 2.0, max: 4.5 } },

  // ── 鐵 ──
  '鐵蛋白': { normal: { min: 50, max: 150 }, attention: { min: 30, max: 200 } },
  '鐵蛋白_female': { normal: { min: 12, max: 200 }, attention: { min: 8, max: 300 } },

  // ── 發炎 ──
  'CRP': { normal: 1.0, attention: 3.0 },
  'hs-CRP': { normal: 1.0, attention: 3.0 },
  '同半胱胺酸': { normal: 8.0, attention: 12.0 },

  // ── 維生素（均為範圍型：過低=缺乏，過高=中毒/遮蔽效應）──
  '維生素D': { normal: { min: 50, max: 100 }, attention: { min: 30, max: 150 } },      // >100 可能中毒（高血鈣）
  '維生素B12': { normal: { min: 400, max: 900 }, attention: { min: 200, max: 1100 } }, // >900 可能代表肝病或發炎
  '葉酸': { normal: { min: 5.4, max: 20 }, attention: { min: 3.0, max: 24 } },         // >20 可能遮蔽 B12 缺乏

  // ── 礦物質（範圍型）──
  '鎂': { normal: { min: 2.0, max: 2.4 }, attention: { min: 1.8, max: 2.6 } },
  '鋅': { normal: { min: 70, max: 120 }, attention: { min: 60, max: 140 } },
  '鈣': { normal: { min: 8.5, max: 10.5 }, attention: { min: 8.0, max: 11.0 } },

  // ── 荷爾蒙 ──
  '睪固酮': { normal: { min: 300, max: 1000 }, attention: { min: 200, max: 1200 } },
  '睪固酮_female': { normal: { min: 15, max: 70 }, attention: { min: 10, max: 90 } },
  '游離睪固酮': { normal: { min: 47, max: 244 }, attention: { min: 30, max: 300 } },
  '游離睪固酮_female': { normal: { min: 0.5, max: 8.5 }, attention: { min: 0.3, max: 10.0 } },
  '皮質醇': { normal: { min: 6, max: 18 }, attention: { min: 4, max: 22 } },
  'DHEA-S': { normal: { min: 100, max: 500 }, attention: { min: 80, max: 600 } },
  'DHEA-S_female': { normal: { min: 65, max: 380 }, attention: { min: 50, max: 450 } },
  '雌二醇': { normal: { min: 10, max: 40 }, attention: { min: 8, max: 60 } },         // 男性
  '雌二醇_female': { normal: { min: 30, max: 400 }, attention: { min: 20, max: 500 } }, // 女性（經期變化大）
  'SHBG': { normal: { min: 10, max: 57 }, attention: { min: 8, max: 70 } },
  'SHBG_female': { normal: { min: 18, max: 144 }, attention: { min: 15, max: 160 } },

  // ── 血球 ──
  'MCV': { normal: { min: 80, max: 100 }, attention: { min: 75, max: 105 } },
  '血紅素': { normal: { min: 13.5, max: 17.5 }, attention: { min: 12.0, max: 18.5 } },
  '血紅素_female': { normal: { min: 12.0, max: 15.5 }, attention: { min: 11.0, max: 16.5 } },
  '白血球': { normal: { min: 4000, max: 10000 }, attention: { min: 3500, max: 12000 } },
  '血小板': { normal: { min: 150000, max: 400000 }, attention: { min: 130000, max: 450000 } },
} as const;

// ── 最佳化範圍（在 normal 範圍內的理想目標）──
// 用於辨別「正常但可優化」vs「已達最佳」
// 範圍型：{ min, max }，越低越好型：上限數值，越高越好型：下限數值
export const LAB_OPTIMAL_RANGES: Record<string, number | { min: number; max: number }> = {
  // 代謝 / 血糖
  'HOMA-IR': 1.0,                    // <1.0 = 胰島素敏感度極佳
  '空腹胰島素': 3.0,                  // <3.0 = 胰島素分泌效率高
  '空腹血糖': 82,                     // <82 = 血糖調節極佳
  'HbA1c': 5.2,                      // <5.2 = 長期血糖控制極佳
  '尿酸': 5.5,                        // <5.5 = 代謝效率好
  '尿酸_female': 4.5,

  // 血脂
  '三酸甘油酯': 70,                   // <70 = 脂質代謝極佳
  'ApoB': 60,                        // <60 = 心血管風險極低
  'LDL-C': 70,                       // <70 = LDL 極佳
  'HDL-C': 60,                       // >60 = HDL 理想（越高越好）
  'HDL-C_female': 70,
  '總膽固醇': 180,

  // 肝功能
  'AST': 25,
  'ALT': 25,
  'GGT': 30,
  'GGT_female': 25,
  '白蛋白': 4.2,                      // >4.2 = 營養狀態極佳（越高越好）

  // 腎功能
  'eGFR': 100,                       // >100 = 腎功能極佳（越高越好）

  // 甲狀腺
  'TSH': { min: 1.0, max: 2.5 },     // 功能醫學最佳區間
  'Free T4': { min: 1.0, max: 1.5 },
  'Free T3': { min: 3.0, max: 4.0 },

  // 鐵
  '鐵蛋白': { min: 70, max: 120 },
  '鐵蛋白_female': { min: 40, max: 120 },

  // 發炎
  'CRP': 0.5,                         // <0.5 = 發炎極低
  'hs-CRP': 0.5,
  '同半胱胺酸': 6.0,                   // <6 = 甲基化效率極佳

  // 維生素
  '維生素D': { min: 60, max: 80 },     // 功能醫學最佳區間
  '維生素B12': { min: 500, max: 800 },
  '葉酸': { min: 10, max: 18 },

  // 礦物質
  '鎂': { min: 2.1, max: 2.3 },
  '鋅': { min: 85, max: 110 },
  '鈣': { min: 9.0, max: 10.0 },

  // 荷爾蒙
  '睪固酮': { min: 500, max: 900 },
  '睪固酮_female': { min: 30, max: 60 },
  '游離睪固酮': { min: 100, max: 220 },
  '游離睪固酮_female': { min: 2.0, max: 7.0 },
  '皮質醇': { min: 8, max: 14 },
  'DHEA-S': { min: 200, max: 450 },
  'DHEA-S_female': { min: 150, max: 350 },
  '雌二醇': { min: 15, max: 30 },
  '雌二醇_female': { min: 50, max: 300 },
  'SHBG': { min: 20, max: 45 },
  'SHBG_female': { min: 30, max: 120 },

  // 血球
  '血紅素': { min: 14.5, max: 16.5 },
  '血紅素_female': { min: 13.0, max: 14.5 },
  'MCV': { min: 85, max: 95 },
}

// 「越高越好」的指標集合
const HIGHER_IS_BETTER = new Set([
  'HDL-C', 'HDL-C_female', '白蛋白', 'eGFR',
]);

// 血檢狀態類型
export type LabStatus = 'normal' | 'attention' | 'alert';

// 閾值類型定義
type ThresholdValue = number | { min: number; max: number };

// 閾值配置類型
type ThresholdConfig = {
  normal: ThresholdValue;
  attention: ThresholdValue;
};

// 完整的閾值配置類型
type LabThresholds = Record<string, ThresholdConfig>;

/**
 * 計算血檢指標狀態
 * @param testName 檢測項目名稱
 * @param value 檢測數值
 * @param gender 性別（影響多項參考範圍）
 * @returns 狀態 (normal | attention | alert)
 */
export function calculateLabStatus(testName: string, value: number, gender?: '男性' | '女性'): LabStatus {
  // 性別差異閾值查詢
  let lookupName = testName;
  if (gender === '女性') {
    const femaleVariants = ['鐵蛋白', '睪固酮', '游離睪固酮', 'HDL-C', '尿酸', 'GGT', '肌酸酐', 'DHEA-S', '雌二醇', 'SHBG', '血紅素'];
    if (femaleVariants.includes(testName)) {
      lookupName = `${testName}_female`;
    }
  }

  const threshold = (LAB_THRESHOLDS as LabThresholds)[lookupName];
  if (!threshold) {
    console.warn(`[labStatus] 未知的檢驗項目: "${testName}"，無法判定狀態，返回 attention`)
    return 'attention';
  }

  // 防止 NaN / Infinity 造成錯誤判定
  if (!Number.isFinite(value)) {
    console.warn(`[labStatus] 無效數值: ${value}，項目: "${testName}"`)
    return 'alert';
  }

  // 處理範圍型閾值（如鐵蛋白、鋅、鎂、TSH 等）
  if (typeof threshold.normal === 'object' && 'min' in threshold.normal) {
    const normalRange = threshold.normal as { min: number; max: number };
    const attentionRange = threshold.attention as { min: number; max: number };

    if (value >= normalRange.min && value <= normalRange.max) {
      return 'normal';
    }
    if (value >= attentionRange.min && value <= attentionRange.max) {
      return 'attention';
    }
    return 'alert';
  }

  // 處理「越高越好」的指標（維生素D、B12、葉酸、HDL-C、白蛋白、eGFR）
  if (HIGHER_IS_BETTER.has(lookupName)) {
    const normalValue = threshold.normal as number;
    const attentionValue = threshold.attention as number;
    if (value >= normalValue) return 'normal';
    if (value >= attentionValue) return 'attention';
    return 'alert';
  }

  // 處理一般數值（越低越好）
  const normalValue = threshold.normal as number;
  const attentionValue = threshold.attention as number;
  if (value <= normalValue) return 'normal';
  if (value <= attentionValue) return 'attention';
  return 'alert';
}

/**
 * 判斷「正常」範圍內的值是否已達最佳化區間
 * @returns true = 已達最佳, false = 正常但可優化
 */
export function isInOptimalRange(testName: string, value: number, gender?: '男性' | '女性'): boolean {
  let lookupName = testName
  if (gender === '女性') {
    const femaleVariants = ['鐵蛋白', '睪固酮', '游離睪固酮', 'HDL-C', '尿酸', 'GGT', 'DHEA-S', '雌二醇', 'SHBG', '血紅素']
    if (femaleVariants.includes(testName)) {
      lookupName = `${testName}_female`
    }
  }

  const optimal = LAB_OPTIMAL_RANGES[lookupName]
  if (optimal == null) return true // 沒定義最佳範圍 = 正常即可

  if (typeof optimal === 'object' && 'min' in optimal) {
    return value >= optimal.min && value <= optimal.max
  }

  // 越高越好的指標：value >= optimal = 最佳
  if (HIGHER_IS_BETTER.has(lookupName)) {
    return value >= optimal
  }

  // 越低越好的指標：value <= optimal = 最佳
  return value <= optimal
}

/**
 * 取得最佳化範圍文字描述
 */
export function getOptimalRangeText(testName: string, gender?: '男性' | '女性'): string | null {
  let lookupName = testName
  if (gender === '女性') {
    const femaleVariants = ['鐵蛋白', '睪固酮', '游離睪固酮', 'HDL-C', '尿酸', 'GGT', 'DHEA-S', '雌二醇', 'SHBG', '血紅素']
    if (femaleVariants.includes(testName)) {
      lookupName = `${testName}_female`
    }
  }

  const optimal = LAB_OPTIMAL_RANGES[lookupName]
  if (optimal == null) return null

  if (typeof optimal === 'object' && 'min' in optimal) {
    return `${optimal.min}-${optimal.max}`
  }

  if (HIGHER_IS_BETTER.has(lookupName)) {
    return `>${optimal}`
  }

  return `<${optimal}`
}

/**
 * 獲取狀態對應的顏色類名
 * @param status 血檢狀態
 * @returns CSS 類名字串
 */
export function getStatusColor(status: LabStatus): string {
  switch (status) {
    case 'normal': return 'bg-green-100 text-green-800';
    case 'attention': return 'bg-yellow-100 text-yellow-800';
    case 'alert': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

/**
 * 獲取狀態對應的圖示
 * @param status 血檢狀態
 * @returns 狀態圖示 emoji
 */
export function getStatusIcon(status: LabStatus): string {
  switch (status) {
    case 'normal': return '🟢';
    case 'attention': return '🟡';
    case 'alert': return '🔴';
    default: return '⚪';
  }
}

/**
 * 獲取狀態對應的中文描述
 * @param status 血檢狀態
 * @returns 中文描述
 */
export function getStatusText(status: LabStatus): string {
  switch (status) {
    case 'normal': return '正常';
    case 'attention': return '注意';
    case 'alert': return '警示';
    default: return '未知';
  }
}
