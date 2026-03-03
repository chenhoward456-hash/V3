// 血檢狀態計算工具函數
// 統一參考範圍 — 全系統唯一真相來源（lab-status-calculator.ts, supplement-engine.ts 都從這裡參考）

// 血檢指標閾值配置
// 修正：鋅 700-1200 → 70-120 mcg/dL（原為 10x 錯誤）
// 修正：HOMA-IR 1.4 → 2.0（臨床正常 <2.0，1.4 過嚴）
// 新增：鐵蛋白性別差異（男 50-150，女 12-200）
export const LAB_THRESHOLDS = {
  'HOMA-IR': { normal: 2.0, attention: 2.5 },
  '同半胱胺酸': { normal: 8.0, attention: 12.0 },
  '空腹胰島素': { normal: 5.0, attention: 8.0 },
  '空腹血糖': { normal: 90, attention: 100 },
  '維生素D': { normal: 50, attention: 30 }, // 注意：維生素D是越高越好
  '鐵蛋白': { normal: { min: 50, max: 150 }, attention: { min: 30, max: 200 } },
  '鐵蛋白_female': { normal: { min: 12, max: 200 }, attention: { min: 8, max: 300 } },
  '三酸甘油酯': { normal: 100, attention: 150 },
  'Lp(a)': { normal: 30, attention: 50 },
  'ApoB': { normal: 80, attention: 100 },
  '鎂': { normal: { min: 2.0, max: 2.4 }, attention: { min: 1.8, max: 2.6 } },
  '鋅': { normal: { min: 70, max: 120 }, attention: { min: 60, max: 140 } },
} as const;

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
 * @param gender 性別（影響鐵蛋白參考範圍）
 * @returns 狀態 (normal | attention | alert)
 */
export function calculateLabStatus(testName: string, value: number, gender?: '男性' | '女性'): LabStatus {
  // 鐵蛋白依性別選擇閾值
  let lookupName = testName;
  if (testName === '鐵蛋白' && gender === '女性') {
    lookupName = '鐵蛋白_female';
  }

  const threshold = (LAB_THRESHOLDS as LabThresholds)[lookupName];
  if (!threshold) return 'normal';

  // 處理範圍型閾值（如鐵蛋白、鋅、鎂）
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

  // 處理維生素D（越高越好）
  if (testName === '維生素D') {
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
