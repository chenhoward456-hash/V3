'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'

type Tier = 'free' | 'self_managed' | 'coached'

const PLANS: Record<Tier, {
  name: string
  price: number
  priceLabel: string
  unit: string
  description: string
  features: string[]
  highlight?: boolean
  badge?: string
}> = {
  free: {
    name: '免費體驗',
    price: 0,
    priceLabel: '0',
    unit: '',
    description: '先體驗系統，滿意再升級',
    features: [
      '體重 / 體態紀錄與趨勢圖表',
      '每日飲食追蹤',
      'TDEE + 巨量營養素自動計算',
      '升級解鎖訓練追蹤、感受紀錄等',
    ],
    badge: '推薦先試',
  },
  self_managed: {
    name: '自主管理',
    price: 499,
    priceLabel: '499',
    unit: '/月',
    description: 'AI 系統完整存取，自動追蹤與分析',
    features: [
      '免費體驗所有功能',
      '不限期使用',
      '歷史數據完整保留',
      '持續 AI 分析與校正',
    ],
  },
  coached: {
    name: '教練指導',
    price: 2999,
    priceLabel: '2,999',
    unit: '/月',
    description: 'AI 系統 + CSCS 教練每週指導',
    features: [
      '包含自主管理所有功能',
      'CSCS 教練每週數據審閱',
      'LINE 一對一營養 / 訓練諮詢',
      '個人化補劑與血檢建議',
    ],
    highlight: true,
    badge: '全台適用',
  },
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <JoinPageInner />
    </Suspense>
  )
}

function JoinPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const refSource = searchParams.get('ref')
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null)
  const [formStep, setFormStep] = useState<'plans' | 'form'>('plans')

  // 表單欄位
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState<'男性' | '女性' | ''>('')
  const [age, setAge] = useState('')
  const [goalType, setGoalType] = useState<'cut' | 'bulk'>('cut')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)

  const handleSelectPlan = (tier: Tier) => {
    setSelectedTier(tier)
    setFormStep('form')
    trackEvent('plan_selected', { tier })
    setTimeout(() => {
      document.getElementById('registration-form')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('請輸入姓名'); return }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('請輸入有效的 Email'); return }
    if (!selectedTier) { setError('請選擇方案'); return }

    setError('')
    setIsSubmitting(true)

    // 免費體驗：直接建帳號，不經 ECPay
    if (selectedTier === 'free') {
      trackEvent('free_trial_initiated', { email })

      // 讀取 diagnosis 頁面的 localStorage 數據（如果有的話）
      let diagnosisData: Record<string, any> | undefined
      try {
        const dWeight = localStorage.getItem('demo_weight')
        const dHeight = localStorage.getItem('demo_height')
        const dBodyfat = localStorage.getItem('demo_bodyfat')
        const dTrainingDays = localStorage.getItem('demo_training_days')
        if (dWeight) {
          diagnosisData = {
            weight: parseFloat(dWeight),
            height: dHeight ? parseFloat(dHeight) : null,
            bodyFatPct: dBodyfat ? parseFloat(dBodyfat) : null,
            trainingDaysPerWeek: dTrainingDays ? parseInt(dTrainingDays) : null,
          }
        }
      } catch {}

      try {
        const res = await fetch('/api/subscribe/free-trial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            gender: gender || null,
            age: age ? parseInt(age) : null,
            goalType,
            diagnosisData,
            ...(refSource ? { ref: refSource } : {}),
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '建立帳號失敗')

        // 直接跳到 success 頁，帶上 unique code
        router.push(`/join/success?code=${data.uniqueCode}&name=${encodeURIComponent(data.name)}&tier=free`)
      } catch (err: any) {
        setError(err.message || '建立帳號失敗，請稍後再試')
        setIsSubmitting(false)
      }
      return
    }

    // 付費方案：走 ECPay
    trackEvent('subscribe_checkout_initiated', { tier: selectedTier, email })
    try {
      const res = await fetch('/api/subscribe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          tier: selectedTier,
          registrationData: {
            gender: gender || null,
            age: age ? parseInt(age) : null,
            goalType,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '結帳失敗')

      if (data.htmlForm) {
        // 用隱藏 div + form submit 替代 document.write，避免清掉 React DOM
        const container = document.createElement('div')
        container.style.display = 'none'
        container.innerHTML = data.htmlForm
        document.body.appendChild(container)
        const form = container.querySelector('form')
        if (form) {
          form.submit()
        }
      }
    } catch (err: any) {
      setError(err.message || '結帳失敗，請稍後再試')
      setIsSubmitting(false)
    }
  }

  const isFree = selectedTier === 'free'

  return (
    <section className="max-w-5xl mx-auto px-6 py-16 md:py-20">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-block bg-[#2563eb]/10 text-[#2563eb] text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
          自助加入
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: '#1e3a5f' }}>
          選擇你的方案
        </h1>
        <p className="text-gray-500 text-sm md:text-base max-w-xl mx-auto">
          免費體驗系統功能，不需信用卡。滿意再升級付費方案。
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-2 gap-5 mb-12 max-w-2xl mx-auto">
        {(Object.entries(PLANS) as [Tier, typeof PLANS[Tier]][]).map(([tier, plan]) => {
          const isLineOnly = tier === 'coached'
          return (
          <div
            key={tier}
            className={`relative bg-white rounded-2xl border-2 p-5 transition-all ${isLineOnly ? '' : 'cursor-pointer'} hover:shadow-lg ${
              selectedTier === tier
                ? 'border-[#2563eb] shadow-md'
                : plan.highlight
                ? 'border-[#2563eb]/50 shadow-sm'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => !isLineOnly && handleSelectPlan(tier)}
          >
            {(plan.badge || plan.highlight) && (
              <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap ${
                plan.highlight ? 'bg-[#1e3a5f]'
                : 'bg-green-500'
              }`}>
                {plan.badge || '全台適用'}
              </div>
            )}

            <div className="text-center mb-5">
              <h3 className="text-base font-bold mb-1" style={{ color: '#1e3a5f' }}>
                {plan.name}
              </h3>
              <p className="text-[11px] text-gray-500 mb-3">{plan.description}</p>
              <div className="flex items-baseline justify-center gap-1">
                {plan.price > 0 && <span className="text-xs text-gray-400">NT$</span>}
                <span className="text-3xl font-bold" style={{ color: plan.price === 0 ? '#16a34a' : '#1e3a5f' }}>
                  {plan.price === 0 ? '免費' : plan.priceLabel}
                </span>
                <span className="text-xs text-gray-400">{plan.unit}</span>
              </div>
            </div>

            <ul className="space-y-2 mb-5">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>

            {isLineOnly ? (
              <a
                href="https://lin.ee/LP65rCc"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block w-full py-2.5 rounded-xl font-semibold text-sm text-center transition-colors bg-[#1e3a5f] text-white hover:bg-[#162d4a]"
              >
                加 LINE 諮詢
              </a>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); handleSelectPlan(tier) }}
                className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                  selectedTier === tier
                    ? 'bg-[#2563eb] text-white'
                    : plan.price === 0
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : plan.highlight
                    ? 'bg-[#2563eb]/10 text-[#2563eb] hover:bg-[#2563eb]/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {selectedTier === tier ? '已選擇 ✓' : plan.price === 0 ? '免費開始' : '選擇方案'}
              </button>
            )}
          </div>
          )
        })}
      </div>

      {/* 499 候補名單收集 */}
      {!selectedTier && (
        <div className="max-w-md mx-auto mb-12">
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-center">
            <p className="text-sm font-semibold text-gray-700 mb-1">還沒準備好？</p>
            <p className="text-xs text-gray-500 mb-4">
              留下 Email，自主管理版上線新功能時優先通知你。
            </p>
            {waitlistSubmitted ? (
              <p className="text-sm text-green-600 font-semibold">✓ 已加入候補名單！上線時會優先通知你。</p>
            ) : (
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2563eb] transition-colors"
                />
                <button
                  onClick={async () => {
                    if (!waitlistEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waitlistEmail)) return
                    try {
                      await fetch('/api/subscribe/waitlist', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: waitlistEmail, tier: 'self_managed' }),
                      })
                      setWaitlistSubmitted(true)
                      trackEvent('upgrade_cta_clicked', { type: 'waitlist', tier: 'self_managed' })
                    } catch {}
                  }}
                  className="bg-[#2563eb] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] transition-colors whitespace-nowrap"
                >
                  加入候補
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Registration Form */}
      {formStep === 'form' && selectedTier && (
        <div id="registration-form" className="max-w-lg mx-auto">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-bold mb-1" style={{ color: '#1e3a5f' }}>
              填寫基本資料
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              已選：{PLANS[selectedTier].name}
              {PLANS[selectedTier].price > 0 && `（NT$${PLANS[selectedTier].priceLabel}/月）`}
              {isFree && '（免費）'}
              <button
                onClick={() => { setFormStep('plans'); setSelectedTier(null) }}
                className="text-[#2563eb] hover:underline ml-2"
              >
                更改
              </button>
            </p>

            <div className="space-y-4">
              {/* 姓名 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">姓名 *</label>
                <input
                  type="text"
                  placeholder="你的名字"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Email *</label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
                />
                <p className="text-xs text-gray-400 mt-1">帳號資訊會寄到這裡</p>
              </div>

              {/* 電話（付費才顯示） */}
              {!isFree && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">
                    手機號碼 <span className="text-gray-400 font-normal">— 選填</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="0912345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
                  />
                </div>
              )}

              {/* 性別 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">性別</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['男性', '女性'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`py-3 rounded-xl font-semibold text-sm transition-all border-2 ${
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

              {/* 年齡 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  年齡 <span className="text-gray-400 font-normal">— 選填</span>
                </label>
                <input
                  type="number"
                  placeholder="例如 28"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
                />
              </div>

              {/* 目標 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">你的目標</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: 'cut' as const, label: '減脂' },
                    { key: 'bulk' as const, label: '增肌' },
                  ]).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setGoalType(key)}
                      className={`py-3 rounded-xl font-semibold text-sm transition-all border-2 ${
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

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full py-4 rounded-xl font-bold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 ${
                  isFree
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]'
                }`}
              >
                {isSubmitting
                  ? isFree ? '正在建立帳號...' : '正在跳轉至付款頁面...'
                  : isFree ? '立即開始免費體驗' : `前往付款 — NT$${PLANS[selectedTier].priceLabel}`
                }
              </button>

              <p className="text-center text-xs text-gray-400 mt-2">
                {isFree
                  ? '不需信用卡，隨時可升級付費方案。'
                  : '付款由綠界科技（ECPay）安全處理，支援信用卡、ATM、超商付款'
                }
              </p>
              <p className="text-center text-[10px] text-gray-300 mt-3">
                服務提供：Howard Protocol ｜ chenhoward456@gmail.com ｜ 0978-185-268
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom */}
      <div className="text-center mt-10">
        <p className="text-sm text-gray-400">
          想先了解系統？
          <Link href="/diagnosis" className="text-[#2563eb] hover:underline ml-1">
            免費系統分析體驗
          </Link>
        </p>
      </div>
    </section>
  )
}
