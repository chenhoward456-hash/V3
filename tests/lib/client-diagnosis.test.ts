import { describe, it, expect } from 'vitest'
import {
  diagnoseClient, averageNutrition,
  OFFLINE_DAYS, TRAINING_GAP_DAYS, MIN_CALORIE_DAYS,
  type DiagnosisInput,
} from '@/lib/client-diagnosis'

/**
 * 一個學員一句原因。
 *
 * 這支的價值全在**順序**：對一個 18 天沒練的人砍熱量、對一個少報 400 大卡的人砍熱量，
 * 都是拿正確的公式解錯的問題。Howard 自己被系統這樣砍過一次
 * （2026-08-16：「在明知我亂吃的情況下，你怎麼會幫我調降成這樣？」）。
 * 所以每一條規則的**優先序**都要有測試釘住，不只是它會不會觸發。
 */

const TODAY = '2026-09-14'
const ago = (n: number) => new Date(Date.parse(TODAY) - n * 86400000).toISOString().slice(0, 10)
const series = (n: number, f: (i: number) => number) =>
  Array.from({ length: n }, (_, i) => ({ date: ago(n - 1 - i), weight: f(i) }))

const base = (o: Partial<DiagnosisInput> = {}): DiagnosisInput => ({
  goalType: 'cut',
  caloriesTarget: 2000,
  trainingEnabled: true,
  weights: series(20, i => 85 - i * 0.05),
  nutritionLogs: Array.from({ length: 14 }, (_, i) => ({ date: ago(i), calories: 2000 })),
  trainingLogs: Array.from({ length: 10 }, (_, i) => ({ date: ago(i * 2), training_type: 'push' })),
  today: TODAY,
  ...o,
})

describe('順序：人還在嗎 → 吃對了嗎 → 處方 ；訓練紀錄只是 note', () => {
  it(`🚨 ${OFFLINE_DAYS} 天沒任何紀錄 → offline，蓋過其他所有判斷`, () => {
    // 第一版沒有這條，9 個學員有 5 個被診斷成「沒有訓練紀錄 → 確認他有沒有在練」，
    // 而那 5 個是失聯 30-51 天的人。對不見的人分析訓練頻率是解錯的問題。
    const d = diagnoseClient(base({
      weights: [{ date: ago(20), weight: 85 }],
      nutritionLogs: [],
      trainingLogs: [],
    }))
    expect(d.code).toBe('offline')
    expect(d.cause).toContain('20 天')
  })

  it('🚨 完全沒資料時不可以宣稱「從來沒有」—— 引擎只看得到呼叫端給的窗', () => {
    const d = diagnoseClient(base({ weights: [], nutritionLogs: [], trainingLogs: [], windowDays: 14 }))
    expect(d.code).toBe('offline')
    expect(d.cause).toContain('近 14 天')
    expect(d.cause).not.toContain('從來')
  })

  it('🚨🚨 缺訓練紀錄不可以被講成「沒在練」—— Howard 當場推翻的第一版', () => {
    // 他的原話：「其實他們都有練，只是他們都沒有紀錄而已，超級靠北。」
    // 第一版把沒有訓練 log 讀成沒訓練，對震宣與 Sean 各輸出一句
    // 「18 天沒練 → 槓桿是訓練不是熱量」。那是推論不是資料。
    // 缺紀錄只降低把握度（note），不能當成原因（cause），更不能蓋過吃的對帳。
    const d = diagnoseClient(base({
      trainingLogs: [{ date: ago(18), training_type: 'legs' }],
      weights: series(20, () => 82.8),
    }))
    expect(d.code).not.toBe('no_training_data')
    expect(d.note ?? '').toContain('不代表他沒練')
    expect(d.cause).not.toContain('沒練')
  })

  it('🚨 缺訓練紀錄不可以蓋過「吃的跟回報對不對得上」', () => {
    // 執行落差只用體重＋回報熱量算，完全不依賴訓練紀錄 —— 反而是最硬的證據。
    const d = diagnoseClient(base({
      goalType: 'bulk', caloriesTarget: 3000,
      weights: series(20, i => 80 + i * 0.1),
      nutritionLogs: Array.from({ length: 14 }, (_, i) => ({ date: ago(i), calories: 3089 })),
      trainingLogs: [],
    }))
    // ⚠️ 2026-09-19：改判 undetermined —— 他記的 3089 跟處方 3000 對得上，
    // 資料分不出是少記還是處方開太高。這支要護的是「訓練紀錄不可以蓋過吃的對帳」，
    // 那點仍然成立：結論來自熱量那條路，不是訓練那條。
    expect(d.code).toBe('undetermined')
    expect(d.note ?? '').toContain('不代表他沒練')
  })

  it('沒開訓練功能的人連 note 都不要掛', () => {
    const d = diagnoseClient(base({ trainingEnabled: false, trainingLogs: [] }))
    expect(d.note).toBeUndefined()
  })

  it('訓練空窗還在正常範圍內就沒有 note', () => {
    const d = diagnoseClient(base({ trainingLogs: [{ date: ago(TRAINING_GAP_DAYS - 1), training_type: 'push' }] }))
    expect(d.note).toBeUndefined()
  })

  it('rest 不算有紀錄的訓練 —— 但那也只是 note', () => {
    const d = diagnoseClient(base({
      trainingLogs: [{ date: ago(1), training_type: 'rest' }, { date: ago(20), training_type: 'push' }],
    }))
    expect(d.note ?? '').toContain('不代表他沒練')
  })

  it('數據面都對、只缺訓練紀錄 → 那才輪到 no_training_data', () => {
    const d = diagnoseClient(base({
      goalType: 'cut', caloriesTarget: 2000,
      weights: series(20, i => 85 - i * 0.07),
      nutritionLogs: Array.from({ length: 14 }, (_, i) => ({ date: ago(i), calories: 2000 })),
      trainingLogs: [],
    }))
    expect(['no_training_data', 'execution_gap', 'prescription']).toContain(d.code)
    expect(d.note ?? d.cause).toContain('不代表他沒練')
  })

  it(`飲食有熱量的天數 < ${MIN_CALORIE_DAYS} → 先要數字，不要硬推`, () => {
    // Sean 的真實情境：2026-09-12 修好 LINE 缺口前，0 筆飲食紀錄有熱量。
    const d = diagnoseClient(base({
      nutritionLogs: Array.from({ length: 10 }, (_, i) => ({ date: ago(i), calories: null })),
    }))
    expect(d.code).toBe('no_food_data')
    expect(d.action).toContain('數字')
  })

  it('🚨 記的跟處方對得上時，不可以斷定是他多吃', () => {
    // 陳胤豪的真實情境：回報 3089、體重反推 3517、處方 3000。
    // 舊版判「執行落差 · 不是處方太高」。但 3089 只比處方高 89 —— 資料分不出
    // 是他少記了 400，還是他的 TDEE 比模型低。2026-09-19 震宣的案例證明這種
    // 斷定會冤枉人（他飲食記 25/28 天、在超商還拍熱量給教練看）。
    const d = diagnoseClient(base({
      goalType: 'bulk', caloriesTarget: 3000,
      weights: series(20, i => 80 + i * 0.1),
      nutritionLogs: Array.from({ length: 14 }, (_, i) => ({ date: ago(i), calories: 3089 })),
      trainingLogs: Array.from({ length: 10 }, (_, i) => ({ date: ago(i), training_type: 'push' })),
    }))
    expect(d.code).toBe('undetermined')
    expect(d.cause).not.toContain('執行超出')
  })

  it('🚨 但他自己記的就超過處方 → 那才可以斷定（那是他自己寫的）', () => {
    const d = diagnoseClient(base({
      goalType: 'bulk', caloriesTarget: 3000,
      weights: series(20, i => 80 + i * 0.1),
      nutritionLogs: Array.from({ length: 14 }, (_, i) => ({ date: ago(i), calories: 3600 })),
      trainingLogs: Array.from({ length: 10 }, (_, i) => ({ date: ago(i), training_type: 'push' })),
    }))
    expect(d.code).toBe('execution_gap')
    expect(d.cause).toContain('他自己記的')
  })

  it('🚨 碳水剛往上調 → 體重趨勢不可信，不下任何判斷', () => {
    // Howard 的臨床通則：學員來之前都亂砍碳水，第一步是把碳水吃回來 →
    // 肝醣＋水回補，體重不掉是正常的。
    const d = diagnoseClient(base({
      weights: series(20, () => 82.5),
      nutritionLogs: Array.from({ length: 14 }, (_, i) => ({ date: ago(i), calories: 2000 })),
      macroLog: [{ applied_at: `${ago(3)}T01:00:00Z`, old_macros: { carbs_target: 150 }, new_macros: { carbs_target: 224 } }],
    }))
    expect(d.code).toBe('carb_repletion')
    expect(d.cause).toContain('肝醣')
  })
})

describe('averageNutrition', () => {
  const logs = (n: number, cal: number) =>
    Array.from({ length: n }, (_, i) => ({ date: ago(i), calories: cal, protein_grams: 150, carbs_grams: 200, fat_grams: 60 }))

  it('只算有記的天，並且把記了幾天講出來', () => {
    const a = averageNutrition(logs(3, 2000), TODAY, 7)
    expect(a.daysLogged).toBe(3)
    expect(a.windowDays).toBe(7)
    expect(a.calories).toBe(2000)
  })

  it('🚨 沒記的天不可以當成 0 —— 那會把 2000 稀釋成 857，看起來像他在挨餓', () => {
    expect(averageNutrition(logs(3, 2000), TODAY, 7).calories).toBe(2000)
  })

  it('同一天多筆只留一筆 —— 重複紀錄會讓平均偏向記比較多次的那天', () => {
    const dup = [
      { date: ago(0), calories: 1000, protein_grams: 100, carbs_grams: 100, fat_grams: 30 },
      { date: ago(0), calories: 3000, protein_grams: 200, carbs_grams: 300, fat_grams: 90 },
    ]
    const a = averageNutrition(dup, TODAY, 7)
    expect(a.daysLogged).toBe(1)
    expect(a.calories).toBe(3000)
  })

  it('窗外的不算', () => {
    expect(averageNutrition(logs(14, 2000), TODAY, 7).daysLogged).toBe(7)
  })

  it('沒記就回 null，不要回 0 —— 0 大卡是一個看起來很像事實的謊', () => {
    const a = averageNutrition([], TODAY, 7)
    expect(a.daysLogged).toBe(0)
    expect(a.calories).toBeNull()
    expect(a.protein).toBeNull()
  })

  it('某個欄位沒填不影響其他欄位的平均', () => {
    const a = averageNutrition([
      { date: ago(0), calories: 2000, protein_grams: null, carbs_grams: 200, fat_grams: 60 },
      { date: ago(1), calories: 2000, protein_grams: 150, carbs_grams: 200, fat_grams: 60 },
    ], TODAY, 7)
    expect(a.calories).toBe(2000)
    expect(a.protein).toBe(150)
  })
})
