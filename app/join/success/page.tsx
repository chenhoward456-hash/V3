'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'

const TIER_NAMES: Record<string, string> = {
  free: '免費體驗',
  self_managed: '自主管理方案',
  coached: '教練指導方案',
}

// Feature definitions for each tier
const SELF_MANAGED_FEATURES = [
  { icon: '📊', label: '身體狀態追蹤', desc: '體重、體脂、感受紀錄' },
  { icon: '🏋️', label: '訓練日誌', desc: '記錄每次訓練內容' },
  { icon: '🤖', label: 'AI 私人顧問', desc: '根據你的數據回答' },
  { icon: '🔄', label: '碳循環規劃', desc: '自動配置高低碳日' },
]

const COACHED_EXTRA_FEATURES = [
  { icon: '💊', label: '補充品建議', desc: '個人化補充品方案' },
  { icon: '🔬', label: '血液檢驗分析', desc: '上傳報告 AI 解讀' },
  { icon: '🧬', label: '基因體質分析', desc: '基因報告整合建議' },
  { icon: '💬', label: '教練回饋', desc: '專業教練定期檢視' },
  { icon: '📋', label: '週報分析', desc: '每週自動產出進度報告' },
]

export default function JoinSuccessPage() {
  return (
    <Suspense
      fallback={
        <section className="max-w-2xl mx-auto px-6 py-16 md:py-24 text-center">
          <div className="inline-block w-12 h-12 border-4 border-[#2563eb]/20 border-t-[#2563eb] rounded-full animate-spin mb-6" />
          <p className="text-gray-500">載入中...</p>
        </section>
      }
    >
      <JoinSuccessContent />
    </Suspense>
  )
}

// CSS-only confetti celebration component
function ConfettiCelebration() {
  const sparkles = ['✨', '🎉', '🌟', '⭐', '💫', '🎊', '✨', '🌟', '🎉', '⭐', '💫', '🎊']
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10vh) rotate(0deg) scale(1);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg) scale(0.3);
            opacity: 0;
          }
        }
        @keyframes confetti-sway {
          0%, 100% {
            transform: translateX(0px);
          }
          25% {
            transform: translateX(30px);
          }
          75% {
            transform: translateX(-30px);
          }
        }
        .confetti-particle {
          position: absolute;
          top: -5vh;
          animation:
            confetti-fall var(--fall-duration) var(--fall-delay) ease-in forwards,
            confetti-sway var(--sway-duration) var(--fall-delay) ease-in-out infinite;
        }
      `}</style>
      {sparkles.map((emoji, i) => (
        <span
          key={i}
          className="confetti-particle text-2xl md:text-3xl"
          style={{
            left: `${5 + (i * 8) % 90}%`,
            '--fall-duration': `${2.5 + (i % 5) * 0.5}s`,
            '--fall-delay': `${(i % 4) * 0.3}s`,
            '--sway-duration': `${1.5 + (i % 3) * 0.5}s`,
            fontSize: `${1.2 + (i % 3) * 0.4}rem`,
          } as React.CSSProperties}
        >
          {emoji}
        </span>
      ))}
    </div>
  )
}

function JoinSuccessContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id')
  // 免費體驗：直接從 query params 取得
  const directCode = searchParams.get('code')
  const directName = searchParams.get('name')
  const directTier = searchParams.get('tier')
  const upgradeParam = searchParams.get('upgrade')

  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'timeout'>('loading')
  const [uniqueCode, setUniqueCode] = useState<string | null>(directCode)
  const [tier, setTier] = useState<string | null>(directTier)
  const [name, setName] = useState<string | null>(directName)
  const [copied, setCopied] = useState(false)
  const [targets, setTargets] = useState<{ calories: number; protein: number; carbs: number; fat: number; targetWeight?: number } | null>(null)
  const [goalInfo, setGoalInfo] = useState<{ currentWeight?: number; targetWeight?: number; goalType?: string } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isUpgrade, setIsUpgrade] = useState(upgradeParam === '1')

  // 讀取 sessionStorage 中的營養目標
  useEffect(() => {
    try {
      const t = sessionStorage.getItem('signup_targets')
      if (t) setTargets(JSON.parse(t))
      const tw = sessionStorage.getItem('signup_target_weight')
      const cw = sessionStorage.getItem('signup_weight')
      const gt = sessionStorage.getItem('signup_goal_type')
      if (tw || cw) {
        setGoalInfo({
          currentWeight: cw ? parseFloat(cw) : undefined,
          targetWeight: tw ? parseFloat(tw) : undefined,
          goalType: gt || undefined,
        })
      }
    } catch {}
  }, [])

  useEffect(() => {
    // 免費體驗：已有 code，直接顯示成功
    if (directCode) {
      setStatus('success')
      setShowConfetti(true)
      trackEvent('free_trial_success', { tier: 'free' })
      return
    }

    // 付費方案：polling 等待 webhook 處理
    if (!orderId) {
      setStatus('failed')
      return
    }

    let attempts = 0
    const maxAttempts = 15

    const poll = async () => {
      try {
        const res = await fetch(`/api/subscribe/verify?order_id=${orderId}`)
        const data = await res.json()

        if (data.completed && data.uniqueCode) {
          setUniqueCode(data.uniqueCode)
          setTier(data.tier)
          setName(data.name)
          setStatus('success')
          setShowConfetti(true)
          trackEvent('subscribe_success', { tier: data.tier, orderId })
          return
        }

        if (data.failed) {
          setStatus('failed')
          return
        }

        attempts++
        if (attempts >= maxAttempts) {
          setStatus('timeout')
          return
        }

        setTimeout(poll, 2000)
      } catch {
        attempts++
        if (attempts >= maxAttempts) {
          setStatus('timeout')
          return
        }
        setTimeout(poll, 3000)
      }
    }

    poll()
  }, [orderId, directCode])

  // Auto-hide confetti after animation completes
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [showConfetti])

  const handleCopy = () => {
    if (uniqueCode) {
      navigator.clipboard.writeText(uniqueCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const [copiedBind, setCopiedBind] = useState(false)
  const handleCopyBind = () => {
    if (uniqueCode) {
      navigator.clipboard.writeText(`綁定 ${uniqueCode}`)
      setCopiedBind(true)
      setTimeout(() => setCopiedBind(false), 2000)
    }
  }

  const isFree = tier === 'free'
  const isPaid = tier === 'self_managed' || tier === 'coached'
  const isCoached = tier === 'coached'

  // Determine which features to show
  const unlockedFeatures = isCoached
    ? [...SELF_MANAGED_FEATURES, ...COACHED_EXTRA_FEATURES]
    : SELF_MANAGED_FEATURES

  // For upgrades from self_managed to coached, show only the delta
  const upgradeNewFeatures = isUpgrade && isCoached ? COACHED_EXTRA_FEATURES : unlockedFeatures

  return (
    <section className="max-w-2xl mx-auto px-6 py-16 md:py-24">
      {/* Confetti celebration */}
      {showConfetti && status === 'success' && <ConfettiCelebration />}

      {/* Loading */}
      {status === 'loading' && (
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-[#2563eb]/20 border-t-[#2563eb] rounded-full animate-spin mb-6" />
          <h1 className="text-2xl font-bold mb-3" style={{ color: '#1e3a5f' }}>
            正在開通你的帳號...
          </h1>
          <p className="text-gray-500 text-sm">
            付款已確認，系統正在建立你的專屬儀表板，請稍候
          </p>
        </div>
      )}

      {/* Success */}
      {status === 'success' && uniqueCode && (
        <div className="text-center">
          <div className="inline-block bg-green-100 border border-green-300 rounded-full px-6 py-2 mb-6">
            <span className="text-green-700 font-bold text-sm">
              &#10003; {isUpgrade ? '方案升級成功' : '帳號開通成功'}
            </span>
          </div>

          <h1 className="text-3xl font-bold mb-2" style={{ color: '#1e3a5f' }}>
            {isUpgrade ? `升級完成，${name}！` : `歡迎，${name}！`}
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            {isUpgrade
              ? `你已成功升級至 ${TIER_NAMES[tier || ''] || '方案'}，所有新功能已解鎖`
              : (
                <>
                  你的 {TIER_NAMES[tier || ''] || '方案'} 已啟用
                  {isFree && '，開始追蹤你的體重與飲食'}
                </>
              )
            }
          </p>

          {/* Unique Code Card */}
          <div className="bg-white border-2 border-[#2563eb] rounded-2xl p-8 mb-8 shadow-sm">
            <p className="text-sm text-gray-500 mb-3">你的專屬代碼</p>
            <div
              className="text-4xl md:text-5xl font-bold font-mono tracking-[4px] text-[#2563eb] mb-4 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handleCopy}
              title="點擊複製"
            >
              {uniqueCode}
            </div>
            <button
              onClick={handleCopy}
              className="text-sm text-gray-500 hover:text-[#2563eb] transition-colors"
            >
              {copied ? '已複製 ✓' : '點擊複製代碼'}
            </button>
            <p className="text-xs text-gray-400 mt-4">
              這是你登入儀表板的唯一憑證，請妥善保存。我們也已將此代碼寄到你的 Email。
            </p>
          </div>

          {/* What's Unlocked - for paid tiers */}
          {isPaid && (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-6 mb-8 text-left">
              <p className="text-sm font-semibold text-gray-800 mb-4">
                {isUpgrade ? '🔓 新解鎖的功能' : '🔓 你已解鎖的功能'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(isUpgrade ? upgradeNewFeatures : unlockedFeatures).map((feat, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="text-xl mb-1">{feat.icon}</div>
                    <p className="text-sm font-semibold text-gray-800">{feat.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{feat.desc}</p>
                  </div>
                ))}
              </div>
              {isUpgrade && isCoached && (
                <p className="text-xs text-indigo-500 mt-3 text-center">
                  加上原有的自主管理功能，你現在擁有所有完整功能
                </p>
              )}
            </div>
          )}

          {/* LINE 綁定引導 */}
          <div className="bg-[#06C755]/10 border border-[#06C755]/30 rounded-2xl p-5 mb-8 text-left">
            <p className="text-sm font-semibold text-gray-800 mb-3">💬 綁定 LINE，用訊息就能記錄</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#06C755]/20 flex items-center justify-center text-xs font-bold text-[#06C755] shrink-0">1</span>
                <p className="text-sm text-gray-600">
                  <a href="https://lin.ee/LP65rCc" target="_blank" rel="noopener noreferrer" className="text-[#06C755] font-semibold hover:underline">
                    點此加入 LINE 好友
                  </a>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#06C755]/20 flex items-center justify-center text-xs font-bold text-[#06C755] shrink-0 mt-0.5">2</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">複製下方指令，貼到 LINE 對話送出：</p>
                  <button
                    onClick={handleCopyBind}
                    className="w-full flex items-center justify-between gap-2 bg-white border-2 border-[#06C755]/40 rounded-xl px-4 py-3 hover:border-[#06C755] transition-colors group"
                  >
                    <span className="font-mono text-sm font-semibold text-gray-800">綁定 {uniqueCode}</span>
                    <span className="text-xs text-[#06C755] font-semibold whitespace-nowrap">
                      {copiedBind ? '已複製 ✓' : '點此複製'}
                    </span>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#06C755]/20 flex items-center justify-center text-xs font-bold text-[#06C755] shrink-0">3</span>
                <p className="text-sm text-gray-600">完成！之後傳訊息就能快速記錄，還會收到提醒</p>
              </div>
            </div>
          </div>

          {/* Nutrition Targets Summary */}
          {isFree && targets && (
            <div className="bg-gradient-to-br from-blue-50 to-amber-50 border border-blue-200 rounded-2xl p-5 mb-6 text-left">
              <p className="text-sm font-semibold text-gray-800 mb-3">
                系統已幫你算好每日營養目標
              </p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <p className="text-[10px] text-gray-500">熱量</p>
                  <p className="text-lg font-bold text-amber-600">{targets.calories}</p>
                  <p className="text-[10px] text-gray-400">kcal</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <p className="text-[10px] text-gray-500">蛋白質</p>
                  <p className="text-lg font-bold text-red-500">{targets.protein}</p>
                  <p className="text-[10px] text-gray-400">g</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <p className="text-[10px] text-gray-500">碳水</p>
                  <p className="text-lg font-bold text-blue-500">{targets.carbs}</p>
                  <p className="text-[10px] text-gray-400">g</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <p className="text-[10px] text-gray-500">脂肪</p>
                  <p className="text-lg font-bold text-green-600">{targets.fat}</p>
                  <p className="text-[10px] text-gray-400">g</p>
                </div>
              </div>
              {goalInfo?.targetWeight && goalInfo?.currentWeight && (
                <div className="bg-white/80 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-600">
                    {goalInfo.goalType === 'cut' ? '減脂' : '增肌'}目標：
                    <strong>{goalInfo.currentWeight} kg → {goalInfo.targetWeight} kg</strong>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    預估約 <strong>
                    {(() => {
                      const diff = Math.abs(goalInfo.currentWeight - goalInfo.targetWeight)
                      const rate = goalInfo.goalType === 'cut' ? 0.5 : 0.25
                      const weeks = Math.ceil(diff / rate)
                      return weeks <= 4 ? `${weeks} 週` : `${Math.round(weeks / 4.3)} 個月`
                    })()}
                    </strong> 達成（依執行一致性調整）
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Quick Guide - Free tier */}
          {isFree && (
            <div className="bg-gray-50 rounded-2xl p-5 mb-8 text-left">
              <p className="text-sm font-semibold text-gray-700 mb-3">接下來要做什麼？</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">1</span>
                  <p className="text-sm text-gray-600"><strong>每天量體重</strong>，在儀表板輸入或用 LINE 傳數字</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600 shrink-0">2</span>
                  <p className="text-sm text-gray-600"><strong>每天記錄飲食</strong>是否達標，照著上面的營養目標吃</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-600 shrink-0">3</span>
                  <p className="text-sm text-gray-600">持續 2 週，系統會自動<strong>校正你的 TDEE</strong> 讓目標更準</p>
                </div>
              </div>
            </div>
          )}

          {/* First Steps Guide - Paid tiers (self_managed) */}
          {isPaid && !isCoached && (
            <div className="bg-gray-50 rounded-2xl p-5 mb-8 text-left">
              <p className="text-sm font-semibold text-gray-700 mb-3">開始你的第一步</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-600 shrink-0">1</span>
                  <p className="text-sm text-gray-600">
                    <strong>綁定 LINE</strong>（如果還沒綁定，參考上方步驟）
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">2</span>
                  <p className="text-sm text-gray-600">
                    <strong>記錄你的第一筆體重</strong>，進儀表板輸入或 LINE 傳數字
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600 shrink-0">3</span>
                  <p className="text-sm text-gray-600">
                    <strong>試試 AI 私人顧問</strong>，問任何飲食相關問題
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600 shrink-0">4</span>
                  <p className="text-sm text-gray-600">
                    <strong>記錄今天的訓練</strong>，開始建立你的訓練日誌
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* First Steps Guide - Coached tier */}
          {isCoached && (
            <div className="bg-gray-50 rounded-2xl p-5 mb-8 text-left">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                {isUpgrade ? '升級後的下一步' : '開始你的第一步'}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-600 shrink-0">1</span>
                  <p className="text-sm text-gray-600">
                    <strong>綁定 LINE</strong>（如果還沒綁定，參考上方步驟）
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">2</span>
                  <p className="text-sm text-gray-600">
                    <strong>記錄你的第一筆體重</strong>，進儀表板輸入或 LINE 傳數字
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600 shrink-0">3</span>
                  <p className="text-sm text-gray-600">
                    <strong>試試 AI 私人顧問</strong>，問任何飲食相關問題
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600 shrink-0">4</span>
                  <p className="text-sm text-gray-600">
                    <strong>記錄今天的訓練</strong>，開始建立你的訓練日誌
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CTA */}
          <Link
            href={`/c/${uniqueCode}`}
            className="inline-block bg-[#2563eb] text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-[#1d4ed8] transition-colors shadow-lg mb-6"
          >
            進入我的儀表板 →
          </Link>

          <div className="space-y-2 mt-6">
            <p className="text-sm text-gray-500">
              下次登入只需訪問：
            </p>
            <code className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg text-gray-600">
              howard456.vercel.app/c/{uniqueCode}
            </code>
          </div>

          {/* 免費體驗升級提示 */}
          {isFree && (
            <div className="mt-8 bg-[#2563eb]/5 border border-[#2563eb]/20 rounded-xl p-4">
              <p className="text-sm text-[#2563eb] font-medium">
                想要訓練追蹤、感受紀錄等完整功能？隨時可升級
              </p>
              <Link
                href="/remote"
                className="text-xs text-[#2563eb] hover:underline mt-1 inline-block"
              >
                查看付費方案 →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Failed */}
      {status === 'failed' && (
        <div className="text-center">
          <div className="inline-block bg-red-100 border border-red-300 rounded-full px-6 py-2 mb-6">
            <span className="text-red-700 font-bold text-sm">付款未完成</span>
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: '#1e3a5f' }}>
            付款未成功
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            如果款項已扣除但看到此頁面，請聯繫我們處理。
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/join"
              className="bg-[#2563eb] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#1d4ed8] transition-colors"
            >
              重新選擇方案
            </Link>
            <a
              href="https://lin.ee/LP65rCc"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#06C755] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#05b34d] transition-colors"
            >
              聯繫客服
            </a>
          </div>
        </div>
      )}

      {/* Timeout */}
      {status === 'timeout' && (
        <div className="text-center">
          <div className="inline-block bg-amber-100 border border-amber-300 rounded-full px-6 py-2 mb-6">
            <span className="text-amber-700 font-bold text-sm">處理中</span>
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: '#1e3a5f' }}>
            帳號開通中，請稍後
          </h1>
          <p className="text-gray-500 text-sm mb-4">
            付款已收到，但帳號建立需要較長時間處理。
          </p>
          <p className="text-gray-500 text-sm mb-8">
            你的帳號資訊會在幾分鐘內寄到你的 Email，也可以加 LINE 聯繫我們。
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-100 text-gray-700 px-8 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              重新整理
            </button>
            <a
              href="https://lin.ee/LP65rCc"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#06C755] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#05b34d] transition-colors"
            >
              加 LINE 聯繫
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
