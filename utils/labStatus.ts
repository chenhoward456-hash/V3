// 血檢狀態計算工具函數
// 統一參考範圍 — 全系統唯一真相來源（lab-status-calculator.ts, supplement-engine.ts 都從這裡參考）
// 涵蓋：代謝、血脂、肝腎、甲狀腺、荷爾蒙、維生素、礦物質、血球、發炎

import { createLogger } from '../lib/logger'

const logger = createLogger('labStatus')
// 同一個未知項目只警告一次，避免清單頁逐列呼叫時轟炸 Sentry
const warnedUnknownTests = new Set<string>()

// 有性別差異閾值的檢驗項目（三個函數共用，避免不同步）
export const FEMALE_VARIANTS = ['鐵蛋白', '睪固酮', '游離睪固酮', 'HDL-C', '尿酸', 'GGT', '肌酸酐', 'DHEA-S', '雌二醇', 'SHBG', '血紅素']

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
  // 總膽紅素：attention 帶（1.2-2.0）以非結合型為主、其餘肝指數正常時，最常見為體質性（Gilbert，人群 3-10%）
  // → 措辭標「偏高、建議與醫師確認分型」，不寫肝病。下界設 0：膽紅素低不是風險，不該標紅。
  '總膽紅素': { normal: { min: 0.1, max: 1.2 }, attention: { min: 0, max: 2.0 } },
  // ALP：成人 IFCC 常見 40-129（方法/年齡差異大；青少年生長期、孕期第三孕期生理性大幅偏高，不套此上限）。
  // ⚠️ 低 ALP 也有意義（鋅缺乏、低磷酸酯酶症 PMID 38374822）→ attention 下界 30，讓 30-40 是黃燈而非綠燈。
  // 性別/年齡特異區間存在（PMID 33480088），目前刻意用單一成人區間，未做 _female 分流。
  'ALP': { normal: { min: 40, max: 129 }, attention: { min: 30, max: 150 } },

  // ── 電解質 ──
  // 正常區間為實驗室/臨床通用共識值（非單一論文），各家上下限差 1-3 單位，以送檢實驗室 reference 為準。
  // ⚠️ 備賽 Peak Week 控水/控鈉/利尿期間三者全部失真：鈉偏高多為脫水假象、鉀偏低多為利尿假象，
  //    不可當病理判讀（PMID 39599586 證實運動脫水擾動 Na/K/Cl）。判讀前先確認抽血當下的水分狀態。
  '鈉': { normal: { min: 135, max: 145 }, attention: { min: 130, max: 148 } },
  '鉀': { normal: { min: 3.5, max: 5.0 }, attention: { min: 3.0, max: 5.5 } },
  '氯': { normal: { min: 98, max: 107 }, attention: { min: 95, max: 110 } },

  // ── 腎功能 ──
  '肌酸酐': { normal: { min: 0.7, max: 1.3 }, attention: { min: 0.5, max: 1.5 } },
  '肌酸酐_female': { normal: { min: 0.6, max: 1.1 }, attention: { min: 0.4, max: 1.3 } },
  'BUN': { normal: { min: 7, max: 20 }, attention: { min: 5, max: 25 } },
  'eGFR': { normal: 90, attention: 60 },             // 越高越好
  // 尿微量白蛋白/肌酸酐比：KDIGO 分級 A1<30 / A2 30-300 / A3>300（共識硬切點），越低越好。
  // ⚠️ 劇烈運動後 24-48h 內可出現一過性運動性白蛋白尿 → 應於非訓練日清晨首次尿採檢，否則假性升高。
  // ⚠️ 分母是尿肌酸酐，男性肌肉量高 → 同樣白蛋白量男性數值偏低；單一 30 門檻可能低估男性。
  '尿微量白蛋白ACR': { normal: 30, attention: 300 },

  // ── 甲狀腺 ──
  'TSH': { normal: { min: 0.4, max: 4.0 }, attention: { min: 0.3, max: 5.0 } },
  'Free T4': { normal: { min: 0.8, max: 1.8 }, attention: { min: 0.6, max: 2.0 } },
  'Free T3': { normal: { min: 2.3, max: 4.2 }, attention: { min: 2.0, max: 4.5 } },

  // ── 鐵 ──
  // 共識正常放寬(對帳 2026-06)：男缺鐵<30、實驗室 ULN ~300-400。原 50-150 是功能/長壽緊帶、
  // 已移到 OPTIMAL(70-120)。高鐵蛋白的發炎假性升高由 cross-marker D(鐵蛋白↑+CRP↑)接手。
  '鐵蛋白': { normal: { min: 30, max: 300 }, attention: { min: 20, max: 400 } },
  // 女性下限上調(Howard 拍板 2026-07-02)：WHO <15 ng/mL 即鐵缺乏、女性運動員 ≤20 補鐵才受益
  // (PMID 26876679, 29792778)。原 8-12 帶會漏標缺鐵 → <15 紅、15-20 黃。
  '鐵蛋白_female': { normal: { min: 20, max: 200 }, attention: { min: 15, max: 300 } },

  // ── 發炎 ──
  'CRP': { normal: 1.0, attention: 3.0 },
  'hs-CRP': { normal: 1.0, attention: 3.0 },
  '同半胱胺酸': { normal: 8.0, attention: 12.0 },

  // ── 維生素（均為範圍型：過低=缺乏，過高=中毒/遮蔽效應）──
  // 下界 30=主流充足門檻(Endocrine Society 2011 / IOM；死亡率 U 型最低點~31, PMID 39183989)。
  // 原 50 會把 30-50(主流視為正常)大量誤標不足 → 對帳 2026-06 下修。
  '維生素D': { normal: { min: 30, max: 100 }, attention: { min: 20, max: 150 } },      // >100 可能中毒（高血鈣）
  '維生素B12': { normal: { min: 400, max: 900 }, attention: { min: 200, max: 1100 } }, // >900 可能代表肝病或發炎
  '葉酸': { normal: { min: 5.4, max: 20 }, attention: { min: 3.0, max: 24 } },         // >20 可能遮蔽 B12 缺乏

  // ── 礦物質（範圍型）──
  '鎂': { normal: { min: 1.8, max: 2.4 }, attention: { min: 1.6, max: 2.6 } },       // 下界 1.8=主流正常下緣(對帳 2026-06)
  '鋅': { normal: { min: 70, max: 120 }, attention: { min: 60, max: 140 } },
  '鈣': { normal: { min: 8.5, max: 10.5 }, attention: { min: 8.0, max: 11.0 } },

  // ── 荷爾蒙 ──
  '睪固酮': { normal: { min: 300, max: 1000 }, attention: { min: 200, max: 1200 } },
  '睪固酮_female': { normal: { min: 15, max: 70 }, attention: { min: 10, max: 90 } },
  '游離睪固酮': { normal: { min: 47, max: 244 }, attention: { min: 30, max: 300 } },
  '游離睪固酮_female': { normal: { min: 0.5, max: 8.5 }, attention: { min: 0.3, max: 10.0 } },
  // 生物可利用睪固酮（ng/dL）：底層參考為健康華人男性區間 107–380（PMID 29729137），
  // 下限按 Howard 客群（有訓練男性）拉嚴至 200，alert 線 150；上限取健康族群實測上界 380。
  // 上限>380（高於健康族群實測上界）對自然訓練男性是「優化方向」非紅燈：380–600 只降級為 attention，
  // >600（疑似外源）才 alert。下限維持 200/150。
  '生物可利用睪固酮': { normal: { min: 200, max: 380 }, attention: { min: 150, max: 600 } },
  '皮質醇': { normal: { min: 6, max: 23 }, attention: { min: 4, max: 27 } },         // 上限放寬：8am 標準約 5-25(對帳 2026-06)
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
//
// ⚠️ 重要說明（請對學員清楚溝通）：
//   • LAB_THRESHOLDS（normal / attention 警示閾值）= 主流共識指引
//     參考來源：AHA/CDC（hsCRP）、Endocrine Society（Vit D）、IDF/ADA（HbA1c）等
//   • LAB_OPTIMAL_RANGES（最佳化目標）= **長壽研究派立場**（非醫學共識）
//     主要參考：Peter Attia「Outlive」(2023)、IFM/功能醫學 + 部分隨機對照試驗
//     這些是「個人化健康優化目標」，**不是診斷標準**
export const LAB_OPTIMAL_RANGES: Record<string, number | { min: number; max: number }> = {
  // ── 代謝 / 血糖（長壽派激進目標）──
  'HOMA-IR': 1.0,                    // <1.0（Attia 派）；原 <0.8 近檢測下緣無文獻背書故放寬(對帳 2026-06)
  '空腹胰島素': 5.0,                  // <5（理想敏感）；原 <2.5 近偵測下緣無背書故放寬(對帳 2026-06)
  '空腹血糖': { min: 70, max: 85 },   // 改區間：太低=低血糖，避免「越低越好」誤標（J-curve）
  'HbA1c': { min: 4.8, max: 5.4 },   // 改區間：<4.8 也有 J 型風險，非越低越好
  '尿酸': 5.0,
  '尿酸_female': { min: 3.5, max: 4.5 },  // U型：女<3.5 喪失抗氧化、踩低尿酸風險(PMID 40229850/40331095)，非越低越好(對帳 2026-06)

  // ── 血脂（長壽研究派 / Peter Attia）──
  '三酸甘油酯': 60,                   // <60 Attia 立場；AHA 正常 <150
  'ApoB': 50,                        // Peter Attia「Outlive」(2023) longevity target；AHA / Canadian CCS 警示 ~80-100
  'LDL-C': 60,                       // <60 Attia；AHA 正常 <100
  // ⚠️ HDL 非「越高越好」：呈 U 型，>80 mg/dL 全因死亡 HR~1.96，孟德爾隨機化證明拉高 HDL 不保護
  // (PMID 35583863/39113030)。改成 U 型最適區間；判讀心血管風險主看 TG/HDL 比或 apoB(對帳 2026-06)。
  'HDL-C': { min: 40, max: 60 },
  'HDL-C_female': { min: 50, max: 65 },
  '總膽固醇': 170,

  // 肝功能
  'AST': 25,
  'ALT': 25,
  'GGT': 30,
  'GGT_female': 25,
  '白蛋白': 4.2,                      // >4.2 = 營養狀態極佳（越高越好）
  // ⚖️ 立場（觀察性關聯，非因果、非治療目標）：高正常膽紅素與較低 CVD/全因死亡相關
  // （PMID 37774224 NHANES 最高四分位 HR 0.83；PMID 20693308 綜述 + UGT1A1*28 Gilbert 基因型 CVD 風險較低）。
  // 沒有 RCT 證明人為升高膽紅素能降死亡 → 只當「關聯」，不鼓勵追高。
  '總膽紅素': { min: 0.6, max: 1.2 },
  // ALP 無公認最佳區間 → 不設。

  // 電解質
  // ⚖️ 立場（心血管偏好，無指引共識）：4.0-4.5 心律較穩。不當硬門檻。
  '鉀': { min: 4.0, max: 4.5 },
  // 鈉/氯無公認最佳區間 → 不設。

  // 腎功能
  'eGFR': 100,                       // >100 = 腎功能極佳（越高越好）
  // ⚖️ 立場：KDIGO 正式切點是 30，但風險在遠低於 30 就隨 ACR 單調上升；
  // 一般健康人群中位數約 11 mg/g（PMID 37787795，JAMA 114 世代 >900 萬人）→ <10 當優化目標。
  '尿微量白蛋白ACR': 10,

  // 甲狀腺
  'TSH': { min: 1.0, max: 2.5 },     // 功能醫學最佳區間；⚠️非長壽實證(長壽家族 TSH 偏高較好 PMID 20739380/25514105)
  // Free T4 / Free T3 不設長壽最佳：長壽/CVD 證據一致指向「區間內偏低較好」(FT4 每升 1SD 致死中風 HR 1.10;
  // 長壽家族 FT3 偏低 — PMID 25514105/27603906/20739380)。原本推上緣與實證相反 → 對帳 2026-06 移除避免誤導。

  // 鐵
  '鐵蛋白': { min: 70, max: 120 },
  '鐵蛋白_female': { min: 40, max: 120 },

  // ── 發炎（AHA/CDC 共識: <1 低風險 / 1-3 中 / >3 高；長壽派 <0.5）──
  'CRP': 0.5,
  'hs-CRP': 0.5,                      // <0.5 Attia 長壽派；AHA/CDC 共識「低風險」<1
  '同半胱胺酸': 6.0,                   // <6 較激進；功能醫學共識 6-9（Kresser/Lamkin）

  // ── 維生素（Endocrine Society + 功能醫學派）──
  '維生素D': { min: 40, max: 60 },     // 下修：>40 ng/mL 全因死亡開始回升、60-80 落回升區(PMID 39183989)(對帳 2026-06)
  '維生素B12': { min: 500, max: 800 },
  '葉酸': { min: 10, max: 18 },

  // 礦物質
  '鎂': { min: 2.1, max: 2.3 },
  '鋅': { min: 85, max: 110 },
  '鈣': { min: 9.0, max: 10.0 },

  // 荷爾蒙（追求更好：下限拉高，鼓勵持續優化）
  '睪固酮': { min: 700, max: 900 },           // 625 還有空間 → 目標 700+
  '睪固酮_female': { min: 40, max: 60 },
  // ⚠️ 游離睪固酮「刻意不設最佳目標」（2026-08-11 結案，原「待確認測法」的待辦到此為止）
  //
  // 原本是 { min: 150, max: 220 }。問題：游離睪固酮的絕對值高度依賴檢驗方法——
  // 免疫法、平衡透析、計算式三種的尺度不同，不同實驗室之間不可直接比較。
  // 在不知道報告用哪種方法的前提下設「目標 150+」，等於用甲的尺去量乙：
  // Howard 本人 72.8 pg/mL 就因此被系統長期標「要盯一下」，而那可能只是免疫法的正常值。
  //
  // 為什麼不繼續等測法確認：等了一個多月沒有下文，而且就算問到了，
  // 每個學員的實驗室可能都不同 —— 這個待辦本質上「永遠等不到答案」。
  //
  // 解法（也是這套系統的立場）：**絕對值不可比，趨勢可比。**
  // 同一個人、同一家實驗室的前後變化不受測法影響（Howard 減脂 4 週 123→72.8、−41%
  // 這條線完全成立）。所以這裡不給目標，讓判讀退回 normal 範圍 + 交給趨勢分析
  // （lib/lab-trend-analyzer.ts 不依賴 optimal 也能判 improving/declining）。
  // isOptimal() 對 undefined 回 true = 「正常即可」，不會亮燈。
  // 生物可利用睪固酮同樣受測法影響，但它是計算值且下限有華人實測支撐，暫時保留。
  //   '游離睪固酮': 不設 optimal（見上）
  //   '游離睪固酮_female': 不設 optimal（同上）
  '生物可利用睪固酮': { min: 250, max: 380 },   // 追求上半段，對應睪固酮軸「越高越好」立場
  '皮質醇': { min: 8, max: 12 },               // 越低端越放鬆
  'DHEA-S': { min: 250, max: 450 },            // 抗老化指標，越高端越好
  'DHEA-S_female': { min: 200, max: 350 },
  '雌二醇': { min: 15, max: 30 },
  '雌二醇_female': { min: 50, max: 300 },
  'SHBG': { min: 20, max: 40 },                // 太高會結合過多游離T
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

// 「越低越好」型指標中，過低同樣有風險者（J-curve）→ 加下限警示。
// 不改 LAB_THRESHOLDS 形狀（避免動到 6 個消費端），只在 calculateLabStatus 補低側判斷。
// 空腹血糖 < 70 低血糖、< 54 嚴重；HbA1c 過低也與不良預後相關（保守）。
const LOW_BOUND_RISK: Record<string, { attentionBelow: number; alertBelow: number }> = {
  '空腹血糖': { attentionBelow: 70, alertBelow: 54 },
  'HbA1c': { attentionBelow: 4.0, alertBelow: 3.5 },
  // 尿酸 U 型：過低喪失抗氧化作用、與死亡上升相關(轉折 ~5.4-5.9, PMID 40229850/40331095)(對帳 2026-06)
  '尿酸': { attentionBelow: 2.5, alertBelow: 2.0 },
  '尿酸_female': { attentionBelow: 2.0, alertBelow: 1.5 },
};

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
    if (FEMALE_VARIANTS.includes(testName)) {
      lookupName = `${testName}_female`;
    }
  }

  const threshold = (LAB_THRESHOLDS as LabThresholds)[lookupName];
  if (!threshold) {
    if (!warnedUnknownTests.has(lookupName)) {
      warnedUnknownTests.add(lookupName)
      logger.warn(`未知的檢驗項目，fallback 返回 attention`, { testName, lookupName })
    }
    return 'attention';
  }

  // 防止 NaN / Infinity 造成錯誤判定
  if (!Number.isFinite(value)) {
    logger.warn(`無效數值，fallback 返回 alert`, { testName, value: String(value) })
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
  // 低側風險（J-curve）：空腹血糖/HbA1c 過低也要標記，避免低血糖顯示綠燈
  const lowBound = LOW_BOUND_RISK[lookupName];
  if (lowBound) {
    if (value < lowBound.alertBelow) return 'alert';
    if (value < lowBound.attentionBelow) return 'attention';
  }
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
    if (FEMALE_VARIANTS.includes(testName)) {
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
    if (FEMALE_VARIANTS.includes(testName)) {
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
 * 取得指標相對「正常範圍」的方向：low / normal / high。
 * 給跨指標關聯偵測用（SHBG↑+游離T↓ 等），以共識閾值判斷「偏高/偏低」，
 * 保守取向：落在正常範圍內一律回 normal，不會把「在範圍內」當成異常方向。
 */
export function getLabDirection(testName: string, value: number, gender?: '男性' | '女性'): 'low' | 'normal' | 'high' {
  let lookupName = testName
  if (gender === '女性' && FEMALE_VARIANTS.includes(testName)) {
    lookupName = `${testName}_female`
  }
  const threshold = (LAB_THRESHOLDS as LabThresholds)[lookupName]
  if (!threshold || !Number.isFinite(value)) return 'normal'
  const n = threshold.normal
  if (typeof n === 'object' && 'min' in n) {
    if (value < n.min) return 'low'
    if (value > n.max) return 'high'
    return 'normal'
  }
  if (HIGHER_IS_BETTER.has(lookupName)) {
    return value < (n as number) ? 'low' : 'normal' // 越高越好：只有低於正常才算偏低
  }
  const lb = LOW_BOUND_RISK[lookupName]
  if (lb && value < lb.attentionBelow) return 'low' // J-curve：過低也算偏低
  return value > (n as number) ? 'high' : 'normal' // 越低越好：高於正常算偏高
}

/**
 * 取得「正常範圍」文字描述（共識閾值 LAB_THRESHOLDS，非最佳化目標）
 * 範圍型 → "min-max"；越高越好 → "≥x"；越低越好 → "≤x"。未知項目回 null。
 * 與 getOptimalRangeText 一樣以 labStatus.ts 為唯一真相來源，供 API / bot 顯示，
 * 避免下游（賴助手等）自行編造實驗室參考範圍而放寬 Howard 的標準。
 */
export function getNormalRangeText(testName: string, gender?: '男性' | '女性'): string | null {
  let lookupName = testName
  if (gender === '女性' && FEMALE_VARIANTS.includes(testName)) {
    lookupName = `${testName}_female`
  }
  const threshold = (LAB_THRESHOLDS as LabThresholds)[lookupName]
  if (!threshold) return null
  const n = threshold.normal
  if (typeof n === 'object' && 'min' in n) return `${n.min}-${n.max}`
  if (HIGHER_IS_BETTER.has(lookupName)) return `≥${n}`
  return `≤${n}`
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
