'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { generateDemoAnalysis, type DemoAnalysisInput, type DemoAnalysisResult } from '@/lib/nutrition-engine'
import LineButton from '@/components/LineButton'

export default function DiagnosisPage() {
  const [step, setStep] = useLocalStorage('demo_step', 1)
  const [gender, setGender] = useLocalStorage<'男性' | '女性' | ''>('demo_gender', '')
  const [bodyWeight, setBodyWeight] = useLocalStorage('demo_weight', '')
  const [height, setHeight] = useLocalStorage('demo_height', '')
  const [bodyFatPct, setBodyFatPct] = useLocalStorage('demo_bodyfat', '')
  const [goalType, setGoalType] = useLocalStorage<'cut' | 'bulk' | ''>('demo_goal', '')
  const [targetWeight, setTargetWeight] = useLocalStorage('demo_target_weight', '')
  const [trainingDays, setTrainingDays] = useLocalStorage('demo_training_days', 4)
  const [, , isClient] = useLocalStorage('_client_check', true)
  const [result, setResult] = useState<DemoAnalysisResult | null>(null)

  const canProceedStep1 = gender && bodyWeight && parseFloat(bodyWeight) > 0 && goalType
  const canProceedStep2 = trainingDays >= 1 && trainingDays <= 7

  const handleRunAnalysis = () => {
    const input: DemoAnalysisInput = {
      gender: gender as '男性' | '女性',
      bodyWeight: parseFloat(bodyWeight),
      height: height ? parseFloat(height) : null,
      bodyFatPct: bodyFatPct ? parseFloat(bodyFatPct) : null,
      goalType: goalType as 'cut' | 'bulk',
      targetWeight: targetWeight ? parseFloat(targetWeight) : null,
      trainingDaysPerWeek: trainingDays,
    }
    const analysisResult = generateDemoAnalysis(input)
    setResult(analysisResult)
    setStep(3)
  }

  const handleReset = () => {
    if (isClient) {
      const keys = ['demo_step', 'demo_gender', 'demo_weight', 'demo_height', 'demo_bodyfat', 'demo_goal', 'demo_target_weight', 'demo_training_days']
      keys.forEach(k => localStorage.removeItem(k))
    }
    setStep(1)
    setGender('')
    setBodyWeight('')
    setHeight('')
    setBodyFatPct('')
    setGoalType('')
    setTargetWeight('')
    setTrainingDays(4)
    setResult(null)
  }

  return (
    <section className="max-w-4xl mx-auto px-6 py-16 md:py-20">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-block bg-[#2563eb]/10 text-[#2563eb] text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
          Smart Engine Demo
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: '#1e3a5f' }}>
          免費體驗系統分析
        </h1>
        <p className="text-gray-500 text-sm md:text-base">
          輸入基本資料，系統即時估算你的 TDEE、每日參考熱量、巨量營養素
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex justify-center gap-4 mb-12">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${
                s < step || (s === 3 && result)
                  ? 'border-green-500 bg-green-500 text-white'
                  : s === step
                  ? 'border-[#2563eb] bg-[#2563eb] text-white'
                  : 'border-gray-200 bg-white text-gray-400'
              }`}
            >
              {s < step || (s === 3 && result) ? '✓' : s}
            </div>
            {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-green-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-10 shadow-sm">

          {/* Step 1: 基本資料 */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-2" style={{ color: '#1e3a5f' }}>
                Step 1：基本資料
              </h2>

              {/* 性別 */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">性別</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['男性', '女性'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`py-3.5 rounded-xl font-semibold text-base transition-all border-2 ${
                        gender === g
                          ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {g === '男性' ? '♂ 男性' : '♀ 女性'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 體重 */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">體重 (kg)</p>
                <input
                  type="number"
                  placeholder="例如 75"
                  value={bodyWeight}
                  onChange={(e) => setBodyWeight(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
                />
              </div>

              {/* 身高（選填） */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">身高 (cm) <span className="text-gray-400 font-normal">— 選填</span></p>
                <input
                  type="number"
                  placeholder="例如 175"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
                />
              </div>

              {/* 體脂率（選填） */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">體脂率 (%) <span className="text-gray-400 font-normal">— 選填</span></p>
                <input
                  type="number"
                  placeholder="例如 18"
                  value={bodyFatPct}
                  onChange={(e) => setBodyFatPct(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  不確定？跳過也可以，系統會用體重公式估算。填入體脂率可用 Katch-McArdle 公式，準確度更高。
                </p>
              </div>

              {/* 目標 */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">你的目標</p>
                <div className="grid grid-cols-2 gap-3">
                  {([{ key: 'cut', label: '📉 減脂' }, { key: 'bulk', label: '💪 增肌' }] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setGoalType(key)}
                      className={`py-3.5 rounded-xl font-semibold text-base transition-all border-2 ${
                        goalType === key
                          ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="w-full bg-[#2563eb] text-white py-3.5 rounded-xl font-semibold text-base hover:bg-[#1d4ed8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-4"
              >
                下一步 →
              </button>
            </div>
          )}

          {/* Step 2: 目標設定 */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-2" style={{ color: '#1e3a5f' }}>
                Step 2：目標設定
              </h2>

              {/* 目標體重 */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  目標體重 (kg) <span className="text-gray-400 font-normal">— 選填，有填才能算時程</span>
                </p>
                <input
                  type="number"
                  placeholder={goalType === 'cut' ? '例如 70' : '例如 80'}
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
                />
              </div>

              {/* 每週訓練天數 */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">每週訓練天數</p>
                <div className="grid grid-cols-7 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <button
                      key={d}
                      onClick={() => setTrainingDays(d)}
                      className={`py-3 rounded-xl font-bold text-sm transition-all ${
                        trainingDays === d
                          ? 'bg-[#2563eb] text-white shadow-sm'
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5 text-center">天/週</p>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-white text-gray-600 border-2 border-gray-200 py-3.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  ← 上一步
                </button>
                <button
                  onClick={handleRunAnalysis}
                  disabled={!canProceedStep2}
                  className="flex-[2] bg-[#2563eb] text-white py-3.5 rounded-xl font-semibold text-base hover:bg-[#1d4ed8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🧠 執行系統分析
                </button>
              </div>
            </div>
          )}

          {/* Step 3: 分析結果 */}
          {step === 3 && result && (
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center">
                <div className="inline-block bg-green-100 border border-green-300 rounded-full px-4 py-1.5 mb-4">
                  <span className="text-green-700 font-mono font-bold text-xs">/// ANALYSIS_COMPLETE</span>
                </div>
                <h2 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>系統分析結果</h2>
              </div>

              {/* 狀態卡片 */}
              <div className={`rounded-xl p-4 border ${
                result.safetyNotes.length > 0
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                <p className={`text-sm font-medium ${
                  result.safetyNotes.length > 0 ? 'text-amber-700' : 'text-green-700'
                }`}>
                  {result.safetyNotes.length > 0
                    ? '🟡 目標可行，但有安全建議'
                    : goalType === 'cut'
                    ? '🟢 目標可行，預估進度在安全範圍內'
                    : '🟢 增肌計畫已生成'
                  }
                </p>
              </div>

              {/* TDEE 計算方法 */}
              <div className="bg-gray-50 rounded-xl px-4 py-2.5">
                <p className="text-xs text-gray-500">
                  TDEE 估算方式：{result.tdeeMethod === 'katch_mcardle' ? 'Katch-McArdle 公式（基於體脂率）' : '體重公式（未填體脂率）'}
                </p>
              </div>

              {/* 核心指標 3 欄 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-400 mb-1">估算 TDEE</p>
                  <p className="text-xl font-bold text-gray-900">{result.estimatedTDEE.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">kcal/天</p>
                </div>
                <div className="bg-[#2563eb]/5 rounded-xl p-3 text-center border border-[#2563eb]/20">
                  <p className="text-[10px] text-[#2563eb] mb-1">目標熱量</p>
                  <p className="text-xl font-bold text-[#2563eb]">{result.suggestedCalories.toLocaleString()}</p>
                  <p className="text-[10px] text-[#2563eb]">kcal/天</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-400 mb-1">每日{goalType === 'cut' ? '赤字' : '盈餘'}</p>
                  <p className={`text-xl font-bold ${goalType === 'cut' ? 'text-green-600' : 'text-blue-600'}`}>
                    {Math.abs(result.dailyDeficit)}
                  </p>
                  <p className="text-[10px] text-gray-400">kcal</p>
                </div>
              </div>

              {/* 巨量營養素 3 欄 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
                  <p className="text-[10px] text-red-400 mb-1">🥩 蛋白質</p>
                  <p className="text-lg font-bold text-red-700">{result.suggestedProtein}g</p>
                  <p className="text-[10px] text-red-400">{(result.suggestedProtein * 4)} kcal</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                  <p className="text-[10px] text-amber-500 mb-1">🍚 碳水</p>
                  <p className="text-lg font-bold text-amber-700">{result.suggestedCarbs}g</p>
                  <p className="text-[10px] text-amber-500">{(result.suggestedCarbs * 4)} kcal</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 text-center border border-yellow-200">
                  <p className="text-[10px] text-yellow-600 mb-1">🥑 脂肪</p>
                  <p className="text-lg font-bold text-yellow-700">{result.suggestedFat}g</p>
                  <p className="text-[10px] text-yellow-600">{(result.suggestedFat * 9)} kcal</p>
                </div>
              </div>

              {/* 預估時程 */}
              {result.projectedWeeks != null && (
                <div className="bg-[#1e3a5f]/5 rounded-xl p-4 text-center">
                  <p className="text-sm font-semibold" style={{ color: '#1e3a5f' }}>
                    🕐 預估 {result.projectedWeeks} 週達標
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    每週 {goalType === 'cut' ? '-' : '+'}{Math.abs(result.weeklyChangeKg).toFixed(2)} kg（{Math.abs(result.weeklyChangeRate).toFixed(1)}% BW/週）
                  </p>
                </div>
              )}

              {/* 安全性提醒 */}
              {result.safetyNotes.length > 0 && (
                <div className="space-y-2">
                  {result.safetyNotes.map((note, i) => (
                    <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-amber-700">⚠️ {note}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 分隔線 + 升級提示 */}
              <div className="border-t border-gray-100 pt-6 mt-6">
                <div className="bg-[#2563eb]/5 rounded-2xl p-6 text-center border border-[#2563eb]/10">
                  <p className="text-sm text-gray-700 mb-1 leading-relaxed">
                    這是<span className="font-bold text-[#1e3a5f]">一次性公式估算</span>，和你的真實代謝一定有落差。
                  </p>
                  <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                    訂閱後系統會根據你每週的體重數據<span className="font-bold text-[#2563eb]">自動校正、自動調整</span>— 越用越準。
                  </p>
                  <LineButton
                    source="diagnosis_result"
                    intent="demo_analysis"
                    className="inline-block bg-[#2563eb] text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-[#1d4ed8] transition-colors shadow-lg shadow-blue-500/25"
                  >
                    把結果帶到 LINE 跟我討論 💬
                  </LineButton>
                  <div className="mt-4">
                    <Link
                      href="/remote"
                      className="text-sm text-[#2563eb] hover:underline font-medium"
                    >
                      或先了解完整方案 →
                    </Link>
                  </div>
                </div>
              </div>

              {/* 重新開始 */}
              <div className="text-center">
                <button
                  onClick={handleReset}
                  className="text-gray-400 hover:text-[#2563eb] text-sm underline transition-colors"
                >
                  🔄 重新輸入資料
                </button>
              </div>
            </div>
          )}

        </div>

        {/* 底部免責 */}
        <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
          此為系統根據公開研究文獻與公式自動估算之參考數據，不構成個人化營養指導或醫療建議。
          <br />實際數值會因個人代謝、活動量、飲食記錄完整度而有差異。如有健康疑慮，請諮詢合格醫師或營養師。
        </p>
      </div>
    </section>
  )
}
