'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { trackLineClick } from '@/lib/analytics'

const LINE_URL = 'https://lin.ee/dnbucVw'

type Intent = 'fat_loss' | 'recovery' | 'muscle_gain'

export default function LineEntryPage() {
  const [copied, setCopied] = useState<Intent | null>(null)

  const presets = useMemo(() => {
    return [
      {
        intent: 'fat_loss' as const,
        title: 'A 我想減脂 / 腰圍下降',
        description: '適合：肚子卡住、體脂下降停滯、腰圍偏高',
        message: '我想減脂/改善腰圍，想從「三層脂肪」順序開始。我的目標是＿＿＿，目前困擾是＿＿＿。',
      },
      {
        intent: 'recovery' as const,
        title: 'B 我想改善睡眠 / 精神',
        description: '適合：腦霧、睡不飽、恢復差、壓力大',
        message: '我想改善睡眠/精神/恢復，想從 HRV 與作息優化開始。我的狀況是＿＿＿，目前作息是＿＿＿。',
      },
      {
        intent: 'muscle_gain' as const,
        title: 'C 我想增肌 / 訓練更有效',
        description: '適合：練很久沒進步、動作品質不穩、想更系統化',
        message: '我想增肌，想先確認目前訓練計畫與動作品質。我的訓練週期是＿＿＿，卡關點是＿＿＿。',
      },
    ]
  }, [])

  const handleStart = async (intent: Intent, message: string) => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(intent)
    } catch {
      setCopied(intent)
    }

    trackLineClick('line_entry', { intent })
    window.open(LINE_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="section-container">
      <h2 className="doc-title">LINE 分眾入口</h2>
      <p className="doc-subtitle">選一個目標，我會用更精準的方式跟你對話（不用來回問半天）</p>

      <div className="max-w-4xl mx-auto">
        <div className="bg-warning/5 border-2 border-warning/30 rounded-xl p-6 mb-8">
          <p className="text-text-secondary text-sm leading-relaxed">
            ⚠️ 這裡提供的是教練個人經驗整理，不構成醫療建議或診斷；如有健康疑慮請先諮詢合格醫師。
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {presets.map((p) => (
            <div key={p.intent} className="bg-white border-2 border-border rounded-2xl p-8 shadow-lg">
              <h3 className="text-lg font-bold mb-2" style={{ color: '#2D2D2D' }}>{p.title}</h3>
              <p className="text-text-secondary text-sm mb-5">{p.description}</p>

              <button
                className="w-full bg-success text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all"
                onClick={() => handleStart(p.intent, p.message)}
              >
                {copied === p.intent ? '已複製並開啟 LINE' : '一鍵複製訊息 + 開啟 LINE'}
              </button>

              <div className="mt-4 text-xs text-gray-500 leading-relaxed">
                你會複製這段訊息：
                <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {p.message}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href="/diagnosis" className="text-primary hover:underline text-sm">
            或先做 30 秒系統診斷 →
          </Link>
        </div>
      </div>
    </section>
  )
}
