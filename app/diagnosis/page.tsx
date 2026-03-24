'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { generateDemoAnalysis, type DemoAnalysisInput, type DemoAnalysisResult } from '@/lib/nutrition-engine'
import LineButton from '@/components/LineButton'
import { trackEvent } from '@/lib/analytics'

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
  const hasTrackedStart = useRef(false)

  // Email capture state
  const [emailInput, setEmailInput] = useState('')
  const [emailSubmitting, setEmailSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  // Share link state
  const [linkCopied, setLinkCopied] = useState(false)

  // 追蹤診斷頁面進入
  useEffect(() => {
    if (!hasTrackedStart.current) {
      trackEvent('diagnosis_page_view')
      hasTrackedStart.current = true
    }
  }, [])

  const canProceedStep1 = gender && bodyWeight && parseFloat(bodyWeight) > 0 && goalType
  const canProceedStep2 = trainingDays >= 1 && trainingDays <= 7

  // 如果 step=3 但沒有 result，嘗試重新計算
  useEffect(() => {
    if (step === 3 && !result && gender && bodyWeight && goalType) {
      const input: DemoAnalysisInput = {
        gender: gender as '男性' | '女性',
        bodyWeight: parseFloat(bodyWeight),
        height: height ? parseFloat(height) : null,
        bodyFatPct: bodyFatPct ? parseFloat(bodyFatPct) : null,
        goalType: goalType as 'cut' | 'bulk',
        targetWeight: targetWeight ? parseFloat(targetWeight) : null,
        trainingDaysPerWeek: trainingDays,
      }
      setResult(generateDemoAnalysis(input))
    }
  }, [step, result, gender, bodyWeight, goalType, height, bodyFatPct, targetWeight, trainingDays])

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
    trackEvent('diagnosis_analysis_complete', {
      gender,
      goal_type: goalType,
      has_body_fat: !!bodyFatPct,
      has_target_weight: !!targetWeight,
      training_days: trainingDays,
    })
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

  // Check localStorage for previously sent email on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sent = localStorage.getItem('diagnosis_email_sent')
      if (sent) setEmailSent(true)
    }
  }, [])

  const handleEmailSubmit = async () => {
    if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setEmailError('請輸入有效的 Email')
      return
    }
    setEmailError('')
    setEmailSubmitting(true)

    try {
      const res = await fetch('/api/diagnosis/email-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          tdee: result?.estimatedTDEE ?? null,
          gender: gender || null,
          age: null,
          weight: bodyWeight ? parseFloat(bodyWeight) : null,
          height: height ? parseFloat(height) : null,
          goal: goalType || null,
        }),
      })
      if (res.ok) {
        setEmailSent(true)
        localStorage.setItem('diagnosis_email_sent', '1')
        trackEvent('diagnosis_email_capture', { email: emailInput })
      } else {
        setEmailError('寄送失敗，請稍後再試')
      }
    } catch {
      setEmailError('網路錯誤，請稍後再試')
    } finally {
      setEmailSubmitting(false)
    }
  }

  const handleCopyShareLink = async () => {
    const url = 'https://howard456.vercel.app/diagnosis?ref=share'
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      trackEvent('diagnosis_share_copy')
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setLinkCopied(true)
      trackEvent('diagnosis_share_copy')
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  const handleLineShare = () => {
    trackEvent('diagnosis_share_line')
    const text = encodeURIComponent('我剛做了免費體態分析，你也來試試！ https://howard456.vercel.app/diagnosis?ref=line_share')
    window.open(`https://line.me/R/msg/text/?${text}`, '_blank', 'noopener,noreferrer')
  }

  // ========== 子元件：模糊化 wrapper ==========
  const BlurredSection = ({ children }: { children: React.ReactNode }) => (
    <div className="relative">
      <div className="filter blur-[6px] pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/20">
        <span className="bg-white/95 px-5 py-2 rounded-full text-sm font-semibold text-gray-500 shadow-sm border border-gray-100">
          🔒 加 LINE 解鎖
        </span>
      </div>
    </div>
  )

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
                onClick={() => {
                  setStep(2)
                  trackEvent('diagnosis_step1_complete', { gender, goal_type: goalType })
                }}
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
                  <span className="text-green-700 font-mono font-bold text-xs">{'/// ANALYSIS_COMPLETE'}</span>
                </div>
                <h2 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>系統分析結果</h2>
              </div>

              {/* 狀態卡片 — FREE */}
              <div className={`rounded-xl p-4 border ${
                result.safetyNotes.length > 0
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                <p className={`text-sm font-medium ${
                  result.safetyNotes.length > 0 ? 'text-amber-700' : 'text-green-700'
                }`}>
                  {result.safetyNotes.length > 0
                    ? '🟡 目標可行，但有安全提醒'
                    : goalType === 'cut'
                    ? '🟢 目標可行，預估進度在安全範圍內'
                    : '🟢 增肌計畫已生成'
                  }
                </p>
              </div>

              {/* TDEE 計算方法 — FREE */}
              <div className="bg-gray-50 rounded-xl px-4 py-2.5">
                <p className="text-xs text-gray-500">
                  TDEE 估算方式：{result.tdeeMethod === 'katch_mcardle' ? 'Katch-McArdle 公式（基於體脂率）' : '體重公式（未填體脂率）'}
                </p>
              </div>

              {/* TDEE 顯示 */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* TDEE — FREE */}
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-gray-400 mb-1">估算 TDEE</p>
                      <p className="text-xl font-bold text-gray-900">{result.estimatedTDEE.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">kcal/天</p>
                    </div>
                    {/* 目標熱量 — BLURRED unless email sent */}
                    <div className="relative rounded-xl overflow-hidden">
                      <div className={`bg-[#2563eb]/5 p-3 text-center border border-[#2563eb]/20 ${!emailSent ? 'filter blur-[5px] pointer-events-none select-none' : ''}`}>
                        <p className="text-[10px] text-[#2563eb] mb-1">目標熱量</p>
                        <p className="text-xl font-bold text-[#2563eb]">{result.suggestedCalories.toLocaleString()}</p>
                        <p className="text-[10px] text-[#2563eb]">kcal/天</p>
                      </div>
                      {!emailSent && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-gray-400 text-lg">🔒</span>
                        </div>
                      )}
                    </div>
                    {/* 赤字/盈餘 — BLURRED unless email sent */}
                    <div className="relative rounded-xl overflow-hidden">
                      <div className={`bg-gray-50 p-3 text-center ${!emailSent ? 'filter blur-[5px] pointer-events-none select-none' : ''}`}>
                        <p className="text-[10px] text-gray-400 mb-1">每日{goalType === 'cut' ? '赤字' : '盈餘'}</p>
                        <p className="text-xl font-bold text-green-600">{Math.abs(result.dailyDeficit)}</p>
                        <p className="text-[10px] text-gray-400">kcal</p>
                      </div>
                      {!emailSent && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-gray-400 text-lg">🔒</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ===== Email Gate: 輸入 Email 解鎖完整結果 ===== */}
                  {!emailSent && (
                    <div className="bg-gradient-to-br from-[#2563eb]/5 to-[#2563eb]/10 border-2 border-[#2563eb]/20 rounded-2xl p-5 md:p-6">
                      <div className="text-center mb-4">
                        <p className="text-lg font-bold" style={{ color: '#1e3a5f' }}>📧 輸入 Email 解鎖完整分析</p>
                        <p className="text-xs text-gray-500 mt-1">完整目標熱量、巨量營養素、安全性評估會同步寄到你的信箱</p>
                      </div>

                      <div>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            placeholder="your@email.com"
                            value={emailInput}
                            onChange={(e) => {
                              setEmailInput(e.target.value)
                              if (emailError) setEmailError('')
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit() }}
                            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2563eb] transition-colors bg-white"
                          />
                          <button
                            onClick={handleEmailSubmit}
                            disabled={emailSubmitting}
                            className="px-6 py-3 bg-[#2563eb] text-white text-sm font-bold rounded-xl hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {emailSubmitting ? '解鎖中...' : '解鎖結果'}
                          </button>
                        </div>
                        {emailError && (
                          <p className="text-xs text-red-500 mt-1.5 ml-1">{emailError}</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-2 text-center">
                          僅用於寄送分析結果，不會發送垃圾郵件
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 巨量營養素 — BLURRED unless email sent */}
                  {emailSent ? (
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
                  ) : (
                  <BlurredSection>
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
                  </BlurredSection>
                  )}

                  {/* 預估時程 — FREE（勾慾望） */}
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

                  {/* 安全提醒 — 解鎖後顯示 */}
                  {result.safetyNotes.length > 0 && (
                    emailSent ? (
                      <div className="space-y-2">
                        {result.safetyNotes.map((note, i) => (
                          <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <p className="text-xs text-amber-700">⚠️ {note}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <BlurredSection>
                        <div className="space-y-2">
                          {result.safetyNotes.map((note, i) => (
                            <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              <p className="text-xs text-amber-700">⚠️ {note}</p>
                            </div>
                          ))}
                        </div>
                      </BlurredSection>
                    )
                  )}

                  {/* Email 已解鎖後的確認訊息 */}
                  {emailSent && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-green-700 font-medium">完整結果已解鎖，同時寄到你的信箱了！</p>
                    </div>
                  )}

                  {/* ===== Share Section ===== */}
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      onClick={handleCopyShareLink}
                      className="relative flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-[#2563eb] hover:text-[#2563eb] transition-all bg-white"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0-12.814a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0 12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                      </svg>
                      {linkCopied ? '已複製連結！' : '分享給朋友，一起做免費診斷'}
                      {linkCopied && (
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-1 rounded-lg whitespace-nowrap">
                          已複製連結！
                          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                        </span>
                      )}
                    </button>
                    <button
                      onClick={handleLineShare}
                      className="flex items-center justify-center gap-2 py-3 px-5 bg-[#06C755] text-white rounded-xl text-sm font-semibold hover:bg-[#05b34d] transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                      </svg>
                      LINE 分享
                    </button>
                  </div>

                  {/* ===== 訂閱方案 CTA ===== */}
                  <div className="border-t border-gray-100 pt-6 mt-2">
                    <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] rounded-2xl p-6 md:p-8 text-center">
                      <p className="text-white text-lg font-bold mb-2">
                        想讓系統每天幫你追蹤？
                      </p>
                      <div className="space-y-1.5 text-white/80 text-sm mb-6">
                        <p>✓ 完整 TDEE、巨量營養素、安全性分析</p>
                        <p>✓ 每日飲食 / 訓練 / 體態自動追蹤</p>
                        <p>✓ AI 智慧回饋，最低 NT$499/月</p>
                      </div>
                      <Link
                        href={`/join?ref=diagnosis&gender=${encodeURIComponent(gender)}&goal=${goalType}&weight=${bodyWeight}${height ? `&height=${height}` : ''}${bodyFatPct ? `&bf=${bodyFatPct}` : ''}${targetWeight ? `&tw=${targetWeight}` : ''}&td=${trainingDays}`}
                        onClick={() => trackEvent('diagnosis_to_join_click')}
                        className="inline-block bg-white text-[#1e3a5f] px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors shadow-lg"
                      >
                        查看方案 & 立即加入
                      </Link>
                      <p className="text-white/60 text-[11px] mt-4">
                        付款後立即開通，不需等待
                      </p>
                    </div>

                    {/* LINE 替代 CTA */}
                    <div className="text-center mt-4">
                      <LineButton
                        source="diagnosis_teaser"
                        intent="unlock_full_report"
                        className="text-sm text-gray-500 hover:text-[#06C755] transition-colors"
                      >
                        或加 LINE 免費諮詢 →
                      </LineButton>
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
