'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'

interface Step {
  icon: string
  title: string
  desc: string
  cta?: { label: string; href: (clientId: string) => string }
  tips?: string[]
}

const STEPS: Step[] = [
  {
    icon: '👋',
    title: '歡迎來到 Howard Protocol',
    desc: '這是專為「想優化長期健康」的人設計的連續追蹤 + AI 教練系統。\n\n接下來 2 分鐘帶你熟悉 5 個核心功能。',
    tips: [
      '隨時可以左上角 ← 跳出',
      '介紹完從主頁就可以開始',
    ],
  },
  {
    icon: '📥',
    title: '第一步：上傳你的健檢報告',
    desc: '可以手打、上傳 CSV，或最方便 — 直接拍照 PDF 給 AI 自動辨識。\n\n上傳後系統會自動產生「教練觀察筆記」（約 15 秒）。',
    cta: { label: '📥 去上傳血檢', href: (id) => `/c/${id}/health/upload` },
    tips: [
      '一次最多 5 個檔案',
      'AI 辨識台灣健檢報告格式',
      '辨識結果你可以再確認 / 修改',
    ],
  },
  {
    icon: '📊',
    title: '看你的健康趨勢儀表板',
    desc: '6 大類指標連續追蹤：代謝、心血管、發炎、肝腎、荷爾蒙、微量營養。\n\n趨勢比單一數字更重要 — 同個數字「在進步」跟「在惡化」意義不同。',
    cta: { label: '📊 開儀表板', href: (id) => `/c/${id}/health/timeline` },
    tips: [
      '紅色 = critical（必須注意）',
      '黃色 = attention',
      '綠色 = 已達 Howard 最佳化目標',
    ],
  },
  {
    icon: '🩺',
    title: 'Howard 標準 vs 醫院標準',
    desc: '一般醫院 ApoB < 130 算「正常」，但長壽研究指出 < 80（最佳 < 50）才是真正低風險。\n\n你的 dashboard 雙軌呈現「沒病門檻」+「最佳化目標」。',
    cta: { label: '📏 看完整對照', href: (id) => `/c/${id}/health/standards` },
    tips: [
      '警示閾值參考國際醫學共識（AHA / Endocrine Society 等）',
      '最佳化閾值參考國際長壽研究文獻',
      '兩套標準都看才完整',
    ],
  },
  {
    icon: '💊',
    title: '補品 Protocol 是「進化的」',
    desc: '一般教練 / app 只記「現在吃什麼」。我們記錄每個補品的：\n• 為什麼開立（哪個血檢指標）\n• 何時開始 / 停止\n• 被誰取代\n\n這樣你能看到自己 protocol 的演變故事。',
    cta: { label: '💊 看補品 Protocol', href: (id) => `/c/${id}/health/timeline#supplements` },
  },
  {
    icon: '📖',
    title: '常見問題 / 文獻參考',
    desc: 'FAQ 涵蓋 18 個常見問題：基礎觀念、補品策略、進階追蹤、實務操作。\n\n所有 claim 都附主要文獻來源（國際醫學共識 + 長壽研究文獻）。',
    cta: { label: '📖 開 FAQ 頁面', href: (id) => `/c/${id}/health/learn` },
  },
  {
    icon: '✅',
    title: '導覽完成 — 接下來呢？',
    desc: '你已經了解 Howard Protocol 的核心。\n\n下一步：去抽血、上傳結果、看 AI 自動生成的觀察筆記。\n\n有問題隨時用 LINE 或系統內 AI chat 問。',
    tips: [
      '想再看一次：主頁進入「📖 健康知識」會有指引',
      '抽血前空腹 8 小時、上午抽',
      '報告拿到拍照丟系統就好',
    ],
  },
]

const STORAGE_KEY = 'hp_welcome_completed'

export default function WelcomePage() {
  const params = useParams()
  const router = useRouter()
  const clientId = (params?.clientId as string) ?? ''
  const [step, setStep] = useState(0)

  const current = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  // 標記已看過
  useEffect(() => {
    if (isLast && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, new Date().toISOString())
      } catch {}
    }
  }, [isLast])

  const finishAndGoHome = () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, new Date().toISOString())
      } catch {}
    }
    router.push(`/c/${clientId}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex flex-col">
      {/* Top bar */}
      <div className="px-4 py-4 flex items-center justify-between">
        <Link
          href={`/c/${clientId}`}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          跳過
        </Link>
        <div className="text-xs text-gray-500">
          {step + 1} / {STEPS.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 mb-4">
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-6 sm:py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">{current.icon}</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              {current.title}
            </h1>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {current.desc}
            </p>
          </div>

          {/* Tips */}
          {current.tips && current.tips.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-2">
              {current.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}

          {/* CTA link */}
          {current.cta && (
            <Link
              href={current.cta.href(clientId)}
              className="block w-full bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-800 text-sm py-3 rounded-xl text-center mb-4 transition-colors"
            >
              {current.cta.label}（先看，等下回來）
            </Link>
          )}

          {/* Nav buttons */}
          <div className="flex gap-2 mt-6">
            {!isFirst && (
              <button
                onClick={() => setStep(s => Math.max(0, s - 1))}
                className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
              >
                上一步
              </button>
            )}
            {!isLast ? (
              <button
                onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-xl flex items-center justify-center gap-1"
              >
                下一步
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={finishAndGoHome}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-xl"
              >
                ✅ 完成，進主頁
              </button>
            )}
          </div>

          {/* Step dots */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`transition-all ${
                  i === step
                    ? 'w-6 h-2 bg-emerald-600 rounded-full'
                    : 'w-2 h-2 bg-gray-300 rounded-full hover:bg-gray-400'
                }`}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
