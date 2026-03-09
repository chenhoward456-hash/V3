'use client'

import { useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'

interface OnboardingGuideProps {
  clientId: string
  clientName: string
  tier: string
  features: {
    body_composition_enabled: boolean
    nutrition_enabled: boolean
    training_enabled: boolean
    wellness_enabled: boolean
    supplement_enabled: boolean
    lab_enabled: boolean
    ai_chat_enabled: boolean
  }
  nutritionTargets?: {
    calories?: number | null
    protein?: number | null
    carbs?: number | null
    fat?: number | null
  } | null
  goalInfo?: {
    goalType?: string | null
    currentWeight?: number | null
    targetWeight?: number | null
  } | null
}

const STEPS = [
  {
    icon: '👋',
    title: '歡迎加入！',
    desc: '這是你的專屬健康儀表板，所有數據都在這裡追蹤。',
  },
  {
    icon: '⚖️',
    title: '每天量體重',
    desc: '每天早上量體重，直接在「體組成」區塊輸入，或透過 LINE 輸入「體重 72.5」。',
    feature: 'body_composition_enabled',
  },
  {
    icon: '🍽️',
    title: '記錄飲食',
    desc: '每天記錄飲食是否達標，也可以用 AI 顧問拍照估算營養素。',
    feature: 'nutrition_enabled',
  },
  {
    icon: '🏋️',
    title: '追蹤訓練',
    desc: '記錄每次訓練的部位、時間和強度，系統會自動分析你的訓練量。',
    feature: 'training_enabled',
  },
  {
    icon: '😊',
    title: '身心狀態',
    desc: '每天花 10 秒記錄心情、精力、睡眠品質，幫助教練了解你的恢復狀態。',
    feature: 'wellness_enabled',
  },
  {
    icon: '💬',
    title: '加 LINE 更方便',
    desc: '綁定 LINE 後可以用訊息快速記錄，還會收到每日提醒和每週報告。',
  },
  {
    icon: '📱',
    title: '加到主畫面',
    desc: '把這個頁面加到手機主畫面，像 App 一樣一鍵開啟，不用每次開瀏覽器找。',
  },
]

// 免費用戶步驟工廠：根據營養目標和 goalInfo 動態產生
function buildFreeSteps(
  nutritionTargets?: OnboardingGuideProps['nutritionTargets'],
  goalInfo?: OnboardingGuideProps['goalInfo'],
) {
  // 歡迎步驟：如果有營養目標就顯示具體數字
  let welcomeDesc = '系統已經根據你的資料算好了 TDEE 和營養目標，直接開始記錄吧！'
  if (nutritionTargets?.calories) {
    welcomeDesc = `系統已幫你算好每日目標：${nutritionTargets.calories} kcal、蛋白質 ${nutritionTargets.protein}g、碳水 ${nutritionTargets.carbs}g、脂肪 ${nutritionTargets.fat}g。`
  }

  // 目標步驟：如果有目標體重就顯示時程
  let goalStep = null
  if (goalInfo?.targetWeight && goalInfo?.currentWeight) {
    const diff = Math.abs(goalInfo.currentWeight - goalInfo.targetWeight)
    const rate = goalInfo.goalType === 'cut' ? 0.5 : 0.25
    const weeks = Math.ceil(diff / rate)
    const timeStr = weeks <= 4 ? `${weeks} 週` : `約 ${Math.round(weeks / 4.3)} 個月`
    goalStep = {
      icon: '🎯',
      title: '你的目標',
      desc: `${goalInfo.goalType === 'cut' ? '減脂' : '增肌'}：${goalInfo.currentWeight} kg → ${goalInfo.targetWeight} kg，預估 ${timeStr} 達成。持續記錄，系統會每週校正讓計畫更精準。`,
    }
  }

  const steps: Array<{ icon: string; title: string; desc: string }> = [
    { icon: '👋', title: '歡迎體驗！', desc: welcomeDesc },
  ]
  if (goalStep) steps.push(goalStep)
  steps.push(
    { icon: '⚖️', title: '第一步：記錄體重', desc: '每天量體重是最重要的習慣。在下方「體組成」區塊輸入，或綁定 LINE 後直接傳數字。' },
    { icon: '🍽️', title: '第二步：追蹤飲食', desc: '每天記錄飲食是否達標，照著你的營養目標吃。持續記錄 2 週，系統會自動校正 TDEE。' },
    { icon: '📱', title: '加到主畫面', desc: '把這個頁面加到手機主畫面，像 App 一樣一鍵開啟，不用每次開瀏覽器找。' },
  )
  return steps
}

export default function OnboardingGuide({ clientId, clientName, tier, features, nutritionTargets, goalInfo }: OnboardingGuideProps) {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)

  const storageKey = `onboarding_done_${clientId}`

  useEffect(() => {
    if (typeof window === 'undefined') return
    const done = localStorage.getItem(storageKey)
    if (!done) setShow(true)
  }, [storageKey])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem(storageKey, '1')
  }

  const isFree = tier === 'free'

  // 根據方案選擇步驟
  const activeSteps = isFree
    ? buildFreeSteps(nutritionTargets, goalInfo)
    : STEPS.filter(s => {
        if (!('feature' in s) || !s.feature) return true
        return features[s.feature as keyof typeof features]
      })

  if (!show) return null

  const current = activeSteps[step]
  const isLast = step === activeSteps.length - 1

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[80] backdrop-blur-sm" onClick={dismiss} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[85] max-w-sm mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Progress */}
          <div className="flex gap-1 px-6 pt-5">
            {activeSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="px-6 py-8 text-center">
            <div className="text-5xl mb-4">{current.icon}</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {step === 0 ? `${clientName}，${current.title}` : current.title}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">{current.desc}</p>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={dismiss}
              className="flex-1 py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              跳過
            </button>
            <button
              onClick={() => {
                if (isLast) dismiss()
                else setStep(step + 1)
              }}
              className="flex-1 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
            >
              {isLast ? '開始使用' : '下一步'}
              {!isLast && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
