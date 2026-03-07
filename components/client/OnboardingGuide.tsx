'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight } from 'lucide-react'

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
]

export default function OnboardingGuide({ clientId, clientName, tier, features }: OnboardingGuideProps) {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)

  const storageKey = `onboarding_done_${clientId}`

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (tier === 'free') return // 免費用戶不顯示
    const done = localStorage.getItem(storageKey)
    if (!done) setShow(true)
  }, [storageKey, tier])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem(storageKey, '1')
  }

  // 根據用戶功能過濾步驟
  const activeSteps = STEPS.filter(s => {
    if (!s.feature) return true
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
