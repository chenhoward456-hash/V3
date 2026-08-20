/**
 * 入會體測報告 —— DEMO 版（固定資料，不接資料庫）。
 *
 * 給 Howard 看「產品長什麼樣」用的（2026-08-20：「我想先知道你說的產品為何」）。
 * 數據取自他 2026-08-15 拍的真實 ACCUNIQ 報表，**已去除身分識別**。
 *
 * 這一頁要取代的東西：現在會員做完體測拿到的那張機器印的紙。
 * 那張紙每間健身房都一樣、會員看不懂、要靠教練嘴巴解釋 ——
 * 而嘴巴的品質等於教練資歷，那正是菜鳥賣不動教練課的原因。
 *
 * 設計原則：
 * 1. **一句話結論在最上面** —— 會員只記得住一件事，那件事必須是對的那件
 * 2. 三個數字，不是二十個（機器給二十個，那是它賣不動的原因）
 * 3. 每個數字都要說「所以呢」，不能只是報數
 * 4. 合規：全程不用診斷語言，健康指標只說「參考值」與「建議諮詢」
 */
import { buildAssessmentReport } from '@/lib/assessment-report'
import ReportView from '@/components/assessment/ReportView'
import type { InBodyReading } from '@/lib/inbody-ocr'

/** 2026-08-15 那張真實 ACCUNIQ 報表（已去識別）*/
const READING: InBodyReading = {
  measured_at: '2026-08-15', gender: '男性', weight: 75.8, height: 175, age: 35,
  body_fat_pct: 21.0, body_fat_mass: 15.9, skeletal_muscle: 33.5, lean_mass: 59.9,
  smi: 8.16, bmi: 24.8, visceral_fat: 8, visceral_fat_area: 83,
  waist_cm: 94, waist_was_inches: true, whr: 0.9, bmr: 1664, machine_tdee: 2562,
  body_water: 44, protein: 11.9, mineral: 4.1, obesity_degree: 12.5,
  health_score: 80, edema_index: 0.373, target_weight: 72.7,
  fat_control: -3.1, muscle_control: 0,
  segmental_muscle: { 軀幹: 26.4, 左臂: 3.37, 右臂: 3.4, 左腿: 9.11, 右腿: 9.12 },
  segmental_fat: { 軀幹: 8.4, 左臂: 0.85, 右臂: 0.83, 左腿: 2.23, 右腿: 2.26 },
  history: [], uncertain: [],
}

export default function AssessmentDemoPage() {
  const report = buildAssessmentReport({ reading: READING, activity: 'light' })
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <ReportView
          report={report}
          meta={{
            measuredAt: READING.measured_at, gender: READING.gender,
            age: READING.age, height: READING.height, weight: READING.weight,
          }}
        />
      </div>
    </main>
  )
}
