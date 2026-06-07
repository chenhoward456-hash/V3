'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronDown } from 'lucide-react'

interface Section {
  id: string
  emoji: string
  title: string
  body: React.ReactNode
}

export default function HelpPage() {
  const { clientId } = useParams()
  const [open, setOpen] = useState<string | null>('how-to-use')

  const sections: Section[] = [
    {
      id: 'how-to-use',
      emoji: '⏱️',
      title: '每天怎麼用？5 分鐘流程',
      body: (
        <div className="space-y-3 text-sm text-gray-700">
          <p>把這套系統當成「健康儀表板」，每天花 5 分鐘打卡就會看到累積成果。</p>
          <div className="space-y-2">
            <div className="flex gap-3 items-start">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">1</span>
              <div>
                <p className="font-semibold">早上：量體重 + 補品 + 喝電解質水</p>
                <p className="text-xs text-gray-500 mt-0.5">起床上完廁所就量，最準。打開 app → 點 ⚖️ 身體數據</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">2</span>
              <div>
                <p className="font-semibold">三餐後：記飲食</p>
                <p className="text-xs text-gray-500 mt-0.5">吃完直接記，不要等。🥗 飲食紀錄</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">3</span>
              <div>
                <p className="font-semibold">訓練完：打卡 + RPE</p>
                <p className="text-xs text-gray-500 mt-0.5">訓練類型、感受強度 1-10。🏋️ 訓練紀錄</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">4</span>
              <div>
                <p className="font-semibold">睡前：感受紀錄</p>
                <p className="text-xs text-gray-500 mt-0.5">當天精力、心情、睡眠品質。😊 每日感受</p>
              </div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mt-3">
            <p className="text-xs text-amber-800"><b>關鍵</b>：不需要每天填到 100%。每天打到一項就有 streak 🔥，連續打卡才是進步的關鍵。</p>
          </div>
        </div>
      ),
    },
    {
      id: 'sections',
      emoji: '🧭',
      title: '5 個記錄區塊在做什麼？',
      body: (
        <div className="space-y-3 text-sm text-gray-700">
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="font-semibold flex items-center gap-2">⚖️ 身體數據</p>
            <p className="text-xs text-gray-500 mt-1">記錄體重、體脂。系統會算「週平均」比每日數字更穩定，避免被水分波動騙。</p>
          </div>
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="font-semibold flex items-center gap-2">🥗 飲食紀錄</p>
            <p className="text-xs text-gray-500 mt-1">記錄卡路里、蛋白質、碳水、脂肪、飲水。對照目標，看達標率。</p>
          </div>
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="font-semibold flex items-center gap-2">💊 補品打卡</p>
            <p className="text-xs text-gray-500 mt-1">每天該吃的補品打勾。教練會看你的服從率調整 protocol。</p>
          </div>
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="font-semibold flex items-center gap-2">😊 每日感受</p>
            <p className="text-xs text-gray-500 mt-1">睡眠品質、精力、心情各 1-5 分。三個合起來看，能抓到「訓練過頭」或「壓力爆表」的訊號。</p>
          </div>
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="font-semibold flex items-center gap-2">🏋️ 訓練紀錄</p>
            <p className="text-xs text-gray-500 mt-1">訓練類型、時長、RPE（強度感受）。RPE 7-8 是進步區間，9+ 該休息，6 以下可加重。</p>
          </div>
        </div>
      ),
    },
    {
      id: 'data',
      emoji: '📊',
      title: '怎麼看懂你的數據？',
      body: (
        <div className="space-y-3 text-sm text-gray-700">
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="font-semibold">🔥 Streak（連續打卡天數）</p>
            <p className="text-xs text-gray-500 mt-1">只要當天有任何打卡（體重 / 訓練 / 飲食 / 補品 / 感受 任一），就算數。漏一天歸零。這是建立習慣最強的動力。</p>
          </div>
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="font-semibold">📅 本週一句話摘要</p>
            <p className="text-xs text-gray-500 mt-1">「訓練 4 天 · 體重 -0.3 kg · 蛋白質達標 5/7 天」一眼看自己這週實際發生了什麼。</p>
          </div>
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="font-semibold">💡 Howard 解讀句</p>
            <p className="text-xs text-gray-500 mt-1">每張數據卡下方會有一句解讀，例如「速率 -0.3 kg/週，符合健康減脂節奏 ✅」。這是規則演算出來的，不需要教練親說也能即時看到方向對不對。</p>
          </div>
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="font-semibold">🎯 目標進度</p>
            <p className="text-xs text-gray-500 mt-1">當前體重 → 目標體重的差距、當前速率（kg/週）。教練/自己會用這個調整方向。</p>
          </div>
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="font-semibold">📈 週平均體重（8 週）</p>
            <p className="text-xs text-gray-500 mt-1">每日體重會跳，週平均才是真實趨勢。看 4 週變化最準。</p>
          </div>
          <div className="mt-3">
            <Link
              href={`/c/${clientId}/overview`}
              className="block bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white"
            >
              <p className="text-sm font-semibold">📊 想看自己的完整數據？</p>
              <p className="text-xs opacity-90 mt-1">點這裡打開「我的完整數據」頁 →</p>
            </Link>
          </div>
        </div>
      ),
    },
    {
      id: 'plans',
      emoji: '💎',
      title: '三個方案差在哪？',
      body: (
        <div className="space-y-3 text-sm text-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 border border-gray-200 font-semibold">功能</th>
                  <th className="text-center p-2 border border-gray-200 font-semibold">免費</th>
                  <th className="text-center p-2 border border-gray-200 font-semibold text-blue-700">499 自主</th>
                  <th className="text-center p-2 border border-gray-200 font-semibold text-purple-700">2999 教練</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr><td className="p-2 border border-gray-200">每日打卡</td><td className="text-center border border-gray-200">✓</td><td className="text-center border border-gray-200">✓</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">體重 / 訓練 / 飲食趨勢</td><td className="text-center border border-gray-200">✓</td><td className="text-center border border-gray-200">✓</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">完整數據儀表板</td><td className="text-center border border-gray-200 text-gray-400">基本版</td><td className="text-center border border-gray-200">✓</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">營養目標自動計算</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200">✓</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">智能營養引擎</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200">✓</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">血檢數據追蹤</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">主項力量 E1RM / 訓練量分析</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">補品 protocol 客製</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">Howard 親自看數據 + 調整</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">每週 / 每月教練筆記</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200">✓</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">想升級或諮詢方案，直接 LINE 找 Howard。</p>
        </div>
      ),
    },
    {
      id: 'faq',
      emoji: '❓',
      title: '常見問題',
      body: (
        <div className="space-y-3 text-sm text-gray-700">
          <details className="border border-gray-100 rounded-xl p-3">
            <summary className="font-semibold cursor-pointer">數據沒進來 / 趨勢圖空白？</summary>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">趨勢圖至少要 2 筆資料才會畫。剛開始用會空 1-2 天，連續打卡 3 天後就會出現曲線。</p>
          </details>
          <details className="border border-gray-100 rounded-xl p-3">
            <summary className="font-semibold cursor-pointer">想改目標體重 / 卡路里？</summary>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">免費 / 499 自主管理：右上角 ⚙️ 設定 → 改目標。2999 教練：跟 Howard 說，他會幫你調整並寫進教練筆記。</p>
          </details>
          <details className="border border-gray-100 rounded-xl p-3">
            <summary className="font-semibold cursor-pointer">LINE 沒連到怎麼辦？</summary>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">回首頁找「綁定 LINE」按鈕，掃 QR code 加 Howard 助手 → 跟它說「綁定」即可。綁定後可以直接傳訊息記錄當天數據。</p>
          </details>
          <details className="border border-gray-100 rounded-xl p-3">
            <summary className="font-semibold cursor-pointer">完整數據頁打不開 / 沒看到血檢？</summary>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">血檢追蹤只有 2999 教練方案才有。如果你已經是教練方案還看不到，可能是還沒上傳血檢報告。從首頁 📥 上傳健檢報告開始。</p>
          </details>
          <details className="border border-gray-100 rounded-xl p-3">
            <summary className="font-semibold cursor-pointer">想找 Howard 諮詢</summary>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">直接 LINE 訊息或填首頁的諮詢表單。三個方案任何問題都可以問。</p>
          </details>
        </div>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`/c/${clientId}`} className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
            <ChevronLeft size={20} />
            <span className="text-sm">返回</span>
          </Link>
          <h1 className="text-base font-bold text-gray-900">📖 使用說明</h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-3">
        <div className="bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl p-5 text-white">
          <p className="text-sm opacity-90">Howard Protocol 完整使用指南</p>
          <h2 className="text-xl font-bold mt-1">5 分鐘讀完，你就能上手</h2>
          <p className="text-xs opacity-90 mt-2 leading-relaxed">這份說明書永遠在這裡。隨時可以從首頁右上角 ❓ 重新打開。</p>
        </div>

        {sections.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setOpen(open === s.id ? null : s.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{s.emoji}</span>
                <span className="text-sm font-semibold text-gray-900 text-left">{s.title}</span>
              </div>
              <ChevronDown
                size={18}
                className={`text-gray-400 transition-transform ${open === s.id ? 'rotate-180' : ''}`}
              />
            </button>
            {open === s.id && (
              <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                {s.body}
              </div>
            )}
          </div>
        ))}

        {/* 相關連結 */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">更多資源</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link href={`/c/${clientId}/welcome`} className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
              <span>🎯</span>
              <div>
                <p className="text-sm font-medium text-gray-800">2 分鐘新手導覽</p>
                <p className="text-[10px] text-gray-500">5 步驟，講血檢追蹤流程</p>
              </div>
            </Link>
            <Link href="/blog" className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
              <span>📚</span>
              <div>
                <p className="text-sm font-medium text-gray-800">深入學原理</p>
                <p className="text-[10px] text-gray-500">29 篇研究文章</p>
              </div>
            </Link>
            <Link href="/medical-disclaimer" className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
              <span>⚠️</span>
              <div>
                <p className="text-sm font-medium text-gray-800">醫療免責聲明</p>
                <p className="text-[10px] text-gray-500">使用前必讀</p>
              </div>
            </Link>
            <Link href={`/c/${clientId}/health/learn`} className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
              <span>📖</span>
              <div>
                <p className="text-sm font-medium text-gray-800">健康知識 FAQ</p>
                <p className="text-[10px] text-gray-500">18 個常見問題 + 文獻</p>
              </div>
            </Link>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 py-4">
          有任何問題，LINE 找 Howard 都可以
        </div>
      </main>
    </div>
  )
}
