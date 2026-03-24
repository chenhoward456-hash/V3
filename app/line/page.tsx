'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { trackLineClick } from '@/lib/analytics'

const LINE_URL = 'https://lin.ee/LP65rCc'

type Intent = 'fat_loss' | 'recovery' | 'muscle_gain'

export default function LineEntryPage() {
  const searchParams = useSearchParams()
  const prefillMsg = searchParams.get('msg')
  const prefillSrc = searchParams.get('src') || 'direct'

  const [copied, setCopied] = useState<Intent | null>(null)
  const [quickCopied, setQuickCopied] = useState(false)

  const presets = useMemo(() => {
    return [
      {
        intent: 'fat_loss' as const,
        title: 'A 我想減脂 / 腰圍下降',
        description: '適合：肚子卡住、體脂下降停滯、腰圍偏高',
        message: '我想減脂/改善腰圍，想從「三層脂肪」順序開始。我的目標是＿＿＿，目前困擾是＿＿＿。',
        preview: [
          { sender: 'user', text: '我想減脂/改善腰圍...' },
          { sender: 'howard', text: '收到！先問你 3 個問題確認狀況：' },
          { sender: 'howard', text: '1. 目前腰圍/身高？（算 WHtR）' },
          { sender: 'howard', text: '2. 有在運動嗎？頻率？' },
          { sender: 'howard', text: '3. 飲食習慣？（外食/自煮）' },
        ]
      },
      {
        intent: 'recovery' as const,
        title: 'B 我想改善睡眠 / 精神',
        description: '適合：腦霧、睡不飽、恢復差、壓力大',
        message: '我想改善睡眠/精神/恢復，想從 HRV 與作息優化開始。我的狀況是＿＿＿，目前作息是＿＿＿。',
        preview: [
          { sender: 'user', text: '我想改善睡眠/精神...' },
          { sender: 'howard', text: '了解！先確認幾個關鍵點：' },
          { sender: 'howard', text: '1. 平均睡眠時間？幾點睡？' },
          { sender: 'howard', text: '2. 有追蹤 HRV 或睡眠數據嗎？' },
          { sender: 'howard', text: '3. 壓力來源？（工作/訓練/生活）' },
        ]
      },
      {
        intent: 'muscle_gain' as const,
        title: 'C 我想增肌 / 訓練更有效',
        description: '適合：練很久沒進步、動作品質不穩、想更系統化',
        message: '我想增肌，想先確認目前訓練計畫與動作品質。我的訓練週期是＿＿＿，卡關點是＿＿＿。',
        preview: [
          { sender: 'user', text: '我想增肌，想確認訓練計畫...' },
          { sender: 'howard', text: '好！先了解你的訓練背景：' },
          { sender: 'howard', text: '1. 目前訓練頻率？（週幾次）' },
          { sender: 'howard', text: '2. 主要動作？（深蹲/臥推/硬舉）' },
          { sender: 'howard', text: '3. 卡關多久了？重量/圍度？' },
        ]
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

  const handleQuickCopy = async () => {
    if (!prefillMsg) return
    try {
      await navigator.clipboard.writeText(prefillMsg)
    } catch {
      // clipboard API 可能不支援
    }
    setQuickCopied(true)
    trackLineClick('line_entry', { intent: 'prefill', variant: prefillSrc })
    window.open(LINE_URL, '_blank', 'noopener,noreferrer')
  }

  // 如果有預填訊息，顯示精簡的「快速複製 + 開啟 LINE」流程
  if (prefillMsg) {
    return (
      <section className="section-container">
        <div className="max-w-lg mx-auto text-center">
          <div className="text-6xl mb-6">💬</div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#2D2D2D' }}>
            加 LINE 跟我聊
          </h2>
          <p className="text-gray-600 mb-8">
            按下面的按鈕會自動複製訊息，接著開啟 LINE 貼上就好
          </p>

          {/* 訊息預覽 */}
          <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-6 mb-6 text-left">
            <div className="text-xs text-gray-500 mb-2">你會發送的訊息：</div>
            <p className="text-gray-800 text-sm leading-relaxed">{prefillMsg}</p>
          </div>

          {/* 主要 CTA */}
          <button
            onClick={handleQuickCopy}
            className="w-full bg-[#06C755] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#05b34d] transition-colors shadow-lg shadow-[#06C755]/25 mb-4"
          >
            {quickCopied ? '已複製！請在 LINE 貼上 ✓' : '複製訊息 + 開啟 LINE'}
          </button>

          {quickCopied && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-green-800 text-sm font-medium">
                訊息已複製！請在 LINE 聊天室中長按貼上。
              </p>
            </div>
          )}

          <p className="text-xs text-gray-400 mb-8">
            還沒加好友？點擊後會先引導你加入
          </p>

          {/* 備選：直接開 LINE（不複製） */}
          <div className="border-t border-gray-200 pt-6">
            <a
              href={LINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-primary transition-colors"
              onClick={() => trackLineClick('line_entry', { intent: 'prefill_direct', variant: prefillSrc })}
            >
              或直接開啟 LINE（不複製訊息）→
            </a>
          </div>

          {/* 引導到其他選項 */}
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/line" className="text-sm text-primary hover:underline">
              想選不同的諮詢方向？看所有選項 →
            </Link>
            <Link href="/diagnosis" className="text-sm text-gray-500 hover:text-primary transition-colors">
              或先免費體驗系統分析 →
            </Link>
          </div>
        </div>
      </section>
    )
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

              {/* 預覽對話 */}
              <div className="mt-6">
                <div className="text-xs text-gray-500 mb-3">💬 點開後我會這樣回你：</div>
                <div className="space-y-2">
                  {p.preview.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`text-xs p-2 rounded-lg ${
                        msg.sender === 'user'
                          ? 'bg-primary/10 text-primary ml-4'
                          : 'bg-gray-100 text-gray-700 mr-4'
                      }`}
                    >
                      <div className="font-semibold text-[10px] mb-1">
                        {msg.sender === 'user' ? '你' : 'Howard'}
                      </div>
                      {msg.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href="/diagnosis" className="text-primary hover:underline text-sm">
            或先免費體驗系統分析 →
          </Link>
        </div>
      </div>

      {/* 方案推薦 */}
      <div className="my-20 max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-10 border-2 border-gray-200">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold mb-3" style={{color: '#2D2D2D'}}>
              或直接了解智能管理方案
            </h3>
            <p className="text-gray-600 mb-4">
              智能引擎 24 小時自動分析 + CSCS 教練每週監督
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">🧠</span>
                <div>
                  <h4 className="font-bold" style={{color: '#2D2D2D'}}>Howard Protocol 智能管理</h4>
                  <p className="text-primary text-sm">全台適用</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• 智能引擎每週自動分析體重趨勢</li>
                <li>• 自適應 TDEE 持續校正</li>
                <li>• Refeed / Diet Break 自動觸發</li>
                <li>• CSCS 教練監督 + LINE 諮詢</li>
              </ul>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">💪</span>
                <div>
                  <h4 className="font-bold" style={{color: '#2D2D2D'}}>實體訓練 + 智能管理</h4>
                  <p className="text-warning text-sm">台中限定</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• 包含所有智能管理功能</li>
                <li>• 一對一動作評估與矯正</li>
                <li>• 即時訓練指導與調整</li>
                <li>• Coolday Fitness 北屯館</li>
              </ul>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/remote"
              className="inline-block bg-gray-900 text-white px-8 py-3 rounded-full font-bold hover:bg-gray-800 transition-colors"
            >
              查看完整方案說明 →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
