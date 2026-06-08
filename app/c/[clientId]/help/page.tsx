'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronDown, AlertTriangle } from 'lucide-react'
import { useClientData } from '@/hooks/useClientData'

interface Section {
  id: string
  emoji: string
  title: string
  body: React.ReactNode
}

export default function HelpPage() {
  const { clientId } = useParams()
  const { data: clientData, isLoading } = useClientData(clientId as string)
  const [open, setOpen] = useState<string | null>('how-to-use')

  const c = clientData?.client
  const tier: 'free' | 'self_managed' | 'coached' = c
    ? (c.subscription_tier === 'free' ? 'free'
      : c.subscription_tier === 'self_managed' ? 'self_managed'
      : 'coached')
    : 'free'
  const tierLabel = tier === 'free' ? '免費' : tier === 'self_managed' ? '499 自主管理' : '2999 教練指導'
  const tierColor = tier === 'free' ? 'bg-gray-100 text-gray-700'
    : tier === 'self_managed' ? 'bg-blue-100 text-blue-700'
    : 'bg-purple-100 text-purple-700'

  if (isLoading || !c) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  // tier-aware 5 個 section
  const allSections = [
    { key: 'body', enabled: c.body_composition_enabled, emoji: '⚖️', title: '身體數據', desc: '記錄體重、體脂。系統會算「週平均」比每日數字更穩定，避免被水分波動騙。' },
    { key: 'nutrition', enabled: c.nutrition_enabled, emoji: '🥗', title: '飲食紀錄', desc: '記錄卡路里、蛋白質、碳水、脂肪、飲水。對照目標，看達標率。' },
    { key: 'supplement', enabled: c.supplement_enabled, emoji: '💊', title: '補品打卡', desc: '每天該吃的補品打勾。' + (tier === 'coached' ? '教練會看你的服從率調整 protocol。' : '建議與你的醫師或營養師討論後再使用。') },
    { key: 'wellness', enabled: c.wellness_enabled, emoji: '😊', title: '每日感受', desc: '睡眠品質、精力、心情各 1-5 分。三個合起來看，能抓到「訓練過頭」或「壓力爆表」的訊號。' },
    { key: 'training', enabled: c.training_enabled, emoji: '🏋️', title: '訓練紀錄', desc: '訓練類型、時長、RPE（強度感受）。RPE 7-8 是進步區間，9+ 該休息，6 以下可加重。' },
  ]
  const yourSections = allSections.filter(s => s.enabled)
  const lockedSections = allSections.filter(s => !s.enabled)

  const sections: Section[] = [
    {
      id: 'how-to-use',
      emoji: '⏱️',
      title: '每天怎麼用？5 分鐘流程',
      body: (
        <div className="space-y-3 text-sm text-gray-700">
          <p>把這套系統當成「健康儀表板」，每天花 5 分鐘打卡就會看到累積成果。</p>
          <div className="space-y-2">
            {c.body_composition_enabled && (
              <div className="flex gap-3 items-start">
                <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">1</span>
                <div>
                  <p className="font-semibold">早上：量體重{c.supplement_enabled ? ' + 補品' : ''}</p>
                  <p className="text-xs text-gray-500 mt-0.5">起床上完廁所就量，最準。打開 app → 點 ⚖️ 身體數據</p>
                </div>
              </div>
            )}
            {c.nutrition_enabled && (
              <div className="flex gap-3 items-start">
                <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">2</span>
                <div>
                  <p className="font-semibold">三餐後：記飲食</p>
                  <p className="text-xs text-gray-500 mt-0.5">吃完直接記，不要等。🥗 飲食紀錄</p>
                </div>
              </div>
            )}
            {c.training_enabled && (
              <div className="flex gap-3 items-start">
                <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">3</span>
                <div>
                  <p className="font-semibold">訓練完：打卡 + RPE</p>
                  <p className="text-xs text-gray-500 mt-0.5">訓練類型、感受強度 1-10。🏋️ 訓練紀錄</p>
                </div>
              </div>
            )}
            {c.wellness_enabled && (
              <div className="flex gap-3 items-start">
                <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">4</span>
                <div>
                  <p className="font-semibold">睡前：感受紀錄</p>
                  <p className="text-xs text-gray-500 mt-0.5">當天精力、心情、睡眠品質。😊 每日感受</p>
                </div>
              </div>
            )}
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
      title: '你的記錄區塊在做什麼？',
      body: (
        <div className="space-y-3 text-sm text-gray-700">
          {yourSections.map(s => (
            <div key={s.key} className="border border-gray-100 rounded-xl p-3">
              <p className="font-semibold flex items-center gap-2">{s.emoji} {s.title}</p>
              <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
            </div>
          ))}
          {lockedSections.length > 0 && (
            <div className="border border-dashed border-gray-200 rounded-xl p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 mb-2">🔒 你的方案還沒解鎖的功能</p>
              <div className="flex flex-wrap gap-2">
                {lockedSections.map(s => (
                  <span key={s.key} className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-500">
                    {s.emoji} {s.title}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">想開啟其他功能：右上 ⚙️ 自行打開（部分功能限制方案），或升級方案。</p>
            </div>
          )}
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
            <p className="text-xs text-gray-500 mt-1">只要當天有任何打卡，就算數。漏一天歸零。建立習慣最強的動力。</p>
          </div>
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="font-semibold">📅 本週一句話摘要</p>
            <p className="text-xs text-gray-500 mt-1">「訓練 X 天 · 體重 ±X kg · 蛋白質達標 Y/Z 天」一眼看自己這週實際發生了什麼。</p>
          </div>
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="font-semibold">💡 Howard 解讀句</p>
            <p className="text-xs text-gray-500 mt-1">每張數據卡下方會有一句解讀，例如「速率 -0.3 kg/週，符合健康減脂節奏」。這是系統依規則自動產生的<b>數據觀察</b>，不是醫療意見，僅供參考。</p>
          </div>
          {c.body_composition_enabled && (
            <div className="border border-gray-100 rounded-xl p-3">
              <p className="font-semibold">🎯 目標進度</p>
              <p className="text-xs text-gray-500 mt-1">當前體重 → 目標體重的差距、當前速率（kg/週）。{tier === 'coached' ? '教練會用這個調整方向。' : '你會用這個調整自己的方向。'}</p>
            </div>
          )}
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="font-semibold">📈 週平均體重（8 週）</p>
            <p className="text-xs text-gray-500 mt-1">每日體重會跳，週平均才是真實趨勢。看 4 週變化最準。</p>
          </div>
          {tier === 'coached' && (
            <>
              <div className="border border-purple-100 bg-purple-50/30 rounded-xl p-3">
                <p className="font-semibold text-purple-900">💪 主項力量 E1RM</p>
                <p className="text-xs text-purple-700 mt-1">用 Brzycki 公式估算最大肌力（kg）。看你的硬舉/臥推/深蹲 90 天進步幅度。</p>
              </div>
              <div className="border border-purple-100 bg-purple-50/30 rounded-xl p-3">
                <p className="font-semibold text-purple-900">🩸 血檢追蹤</p>
                <p className="text-xs text-purple-700 mt-1">最新血檢值 + 狀態（正常/注意/警示）。<b>系統呈現的觀察與建議僅為生活型態建議，不構成醫療診斷或治療指引</b>，最終判斷請與你的醫師討論。</p>
              </div>
            </>
          )}
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
                  <th className={`text-center p-2 border border-gray-200 font-semibold ${tier === 'free' ? 'bg-yellow-50' : ''}`}>免費{tier === 'free' && ' ★'}</th>
                  <th className={`text-center p-2 border border-gray-200 font-semibold text-blue-700 ${tier === 'self_managed' ? 'bg-yellow-50' : ''}`}>499 自主{tier === 'self_managed' && ' ★'}</th>
                  <th className={`text-center p-2 border border-gray-200 font-semibold text-purple-700 ${tier === 'coached' ? 'bg-yellow-50' : ''}`}>2999 教練{tier === 'coached' && ' ★'}</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr><td className="p-2 border border-gray-200">每日打卡</td><td className="text-center border border-gray-200">✓</td><td className="text-center border border-gray-200">✓</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">體重 / 訓練 / 飲食趨勢</td><td className="text-center border border-gray-200">✓</td><td className="text-center border border-gray-200">✓</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">完整數據儀表板</td><td className="text-center border border-gray-200 text-gray-400">基本版</td><td className="text-center border border-gray-200">✓</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">營養目標計算 + 智能調整</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200">✓</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">血檢數據追蹤 *</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">力量 / 訓練量 / 肌群分析</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">補品 protocol 個別化 *</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">Howard 看數據 + 調整 *</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200">✓</td></tr>
                <tr><td className="p-2 border border-gray-200">每週 / 每月觀察筆記</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200 text-gray-400">—</td><td className="text-center border border-gray-200">✓</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            ★ 你目前的方案。<br />
            * 標示項目為「生活型態 / 運動表現觀察與建議」，<b>非醫療診斷、非處方藥建議</b>，最終決策請結合醫師、營養師、藥師專業判斷。詳見<Link href="/medical-disclaimer" className="text-blue-600 underline">醫療免責聲明</Link>。
          </p>
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
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              {tier === 'coached'
                ? '跟 Howard 說，他會幫你調整並寫進觀察筆記。'
                : '右上角 ⚙️ 設定 → 改目標。系統會自動重算營養建議。'}
            </p>
          </details>
          <details className="border border-gray-100 rounded-xl p-3">
            <summary className="font-semibold cursor-pointer">LINE 沒連到怎麼辦？</summary>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">回首頁找「綁定 LINE」按鈕，掃 QR code 加 Howard 助手 → 跟它說「綁定」即可。綁定後可以直接傳訊息記錄當天數據。</p>
          </details>
          {tier !== 'coached' && (
            <details className="border border-purple-100 bg-purple-50/30 rounded-xl p-3">
              <summary className="font-semibold cursor-pointer text-purple-900">想看血檢追蹤 / 力量分析？</summary>
              <p className="text-xs text-purple-700 mt-2 leading-relaxed">這些功能在 2999 教練指導方案。包含 Howard 親自看數據、補品 protocol 個別化、每週觀察筆記。LINE 找 Howard 諮詢升級。</p>
            </details>
          )}
          {tier === 'coached' && (
            <details className="border border-gray-100 rounded-xl p-3">
              <summary className="font-semibold cursor-pointer">血檢看不到 / 還沒上傳？</summary>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">從首頁找「📥 上傳健檢報告」。可以手打、CSV、或直接拍 PDF 給 AI 辨識。辨識後你可以再確認 / 修改數值。</p>
            </details>
          )}
          <details className="border border-gray-100 rounded-xl p-3">
            <summary className="font-semibold cursor-pointer">想找 Howard 諮詢</summary>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">直接 LINE 訊息或填首頁的諮詢表單。三個方案任何問題都可以問。</p>
          </details>
          <details className="border border-red-100 bg-red-50/30 rounded-xl p-3">
            <summary className="font-semibold cursor-pointer text-red-900">什麼情況不該用這套系統？</summary>
            <p className="text-xs text-red-700 mt-2 leading-relaxed">急性疾病、術後恢復、懷孕哺乳、正在服用處方藥、進食障礙等情況，請優先諮詢醫師，不要依賴本系統的飲食 / 訓練 / 補品建議。詳見<Link href="/medical-disclaimer" className="underline">完整禁用情況列表</Link>。</p>
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm opacity-90">Howard Protocol 使用指南</p>
              <h2 className="text-xl font-bold mt-1">5 分鐘讀完，你就能上手</h2>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${tierColor} whitespace-nowrap`}>
              {tierLabel}
            </span>
          </div>
          <p className="text-xs opacity-90 mt-3 leading-relaxed">隨時可從首頁右上角 ❓ 重新打開這份說明。</p>
        </div>

        {/* 核心邏輯 — 一句話定位 */}
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-indigo-700 mb-1">💡 這套系統的核心邏輯</p>
          <p className="text-sm text-indigo-900 leading-relaxed">
            <b>不是「算營養素」</b>，是<b>「連續追蹤 + 累積對照 + 找出你自己的 what works」</b>。
            算得再準，沒連續記 4 週也沒用。先別卡在「夠不夠精準」，連續打卡 14 天看趨勢，再判斷下一步。
          </p>
        </div>

        {/* 法律提醒 banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
          <AlertTriangle size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-900 mb-1">使用前須知</p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              本系統提供<b>運動表現 / 生活型態觀察與建議</b>，<b>非醫療診斷</b>、非處方藥建議、亦不取代醫師、營養師、藥師之專業意見。使用前請閱讀完整
              <Link href="/medical-disclaimer" className="underline font-semibold ml-1">醫療免責聲明</Link>。
            </p>
          </div>
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
            {tier === 'coached' && (
              <Link href={`/c/${clientId}/welcome`} className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                <span>🎯</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">2 分鐘新手導覽</p>
                  <p className="text-[10px] text-gray-500">血檢追蹤入門流程</p>
                </div>
              </Link>
            )}
            <Link href="/blog" className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
              <span>📚</span>
              <div>
                <p className="text-sm font-medium text-gray-800">深入學原理</p>
                <p className="text-[10px] text-gray-500">29 篇研究文章</p>
              </div>
            </Link>
            <Link href="/medical-disclaimer" className="flex items-center gap-2 p-3 rounded-xl border border-red-100 bg-red-50/30 hover:bg-red-50">
              <span>⚠️</span>
              <div>
                <p className="text-sm font-medium text-red-900">醫療免責聲明（必讀）</p>
                <p className="text-[10px] text-red-700">教練資格、系統限制、禁用情況</p>
              </div>
            </Link>
            {c.lab_enabled && (
              <Link href={`/c/${clientId}/health/learn`} className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                <span>📖</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">健康知識 FAQ</p>
                  <p className="text-[10px] text-gray-500">18 個常見問題 + 文獻</p>
                </div>
              </Link>
            )}
            <Link href="/terms" className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
              <span>📋</span>
              <div>
                <p className="text-sm font-medium text-gray-800">服務條款 / 隱私政策</p>
                <p className="text-[10px] text-gray-500">資料使用、退費政策</p>
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
