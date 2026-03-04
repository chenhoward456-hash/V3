'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'

type Tier = 'self_managed' | 'coached' | 'combo'

const PLANS: Record<Tier, {
  name: string
  price: number
  unit: string
  description: string
  features: string[]
  highlight?: boolean
}> = {
  self_managed: {
    name: '自主管理',
    price: 499,
    unit: '/月',
    description: 'AI 系統完整存取，自動追蹤與分析',
    features: [
      'TDEE + 巨量營養素自動計算',
      '每日飲食 / 訓練 / 體態追蹤',
      'AI 智慧回饋與建議',
      '體組成趨勢圖表',
    ],
  },
  coached: {
    name: '教練指導',
    price: 2999,
    unit: '/月',
    description: 'AI 系統 + CSCS 教練每週指導',
    features: [
      '包含自主管理所有功能',
      'CSCS 教練每週數據審閱',
      'LINE 一對一營養 / 訓練諮詢',
      '個人化補劑與血檢建議',
    ],
    highlight: true,
  },
  combo: {
    name: '全方位',
    price: 5000,
    unit: '/月',
    description: '線上教練 + 台中實體訓練',
    features: [
      '包含教練指導所有功能',
      '台中 Coolday 一對一訓練',
      '動作矯正與課表設計',
      '優先預約與緊急諮詢',
    ],
  },
}

export default function JoinPage() {
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

  const handleSelectPlan = (tier: Tier) => {
    setSelectedTier(tier)
    setFormStep('form')
    trackEvent('plan_selected', { tier })
    // 滾動到表單
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
        document.open()
        document.write(data.htmlForm)
        document.close()
      }
    } catch (err: any) {
      setError(err.message || '結帳失敗，請稍後再試')
      setIsSubmitting(false)
    }
  }

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
          付款後系統自動開通帳號，立即開始追蹤。不需要等教練手動設定。
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {(Object.entries(PLANS) as [Tier, typeof PLANS[Tier]][]).map(([tier, plan]) => (
          <div
            key={tier}
            className={`relative bg-white rounded-2xl border-2 p-6 transition-all cursor-pointer hover:shadow-lg ${
              plan.highlight
                ? 'border-[#2563eb] shadow-md'
                : selectedTier === tier
                ? 'border-[#2563eb] shadow-md'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleSelectPlan(tier)}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2563eb] text-white text-xs font-bold px-4 py-1 rounded-full">
                最多人選
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-lg font-bold mb-1" style={{ color: '#1e3a5f' }}>
                {plan.name}
              </h3>
              <p className="text-xs text-gray-500 mb-4">{plan.description}</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-sm text-gray-400">NT$</span>
                <span className="text-4xl font-bold" style={{ color: '#1e3a5f' }}>
                  {plan.price.toLocaleString()}
                </span>
                <span className="text-sm text-gray-400">{plan.unit}</span>
              </div>
            </div>

            <ul className="space-y-2.5 mb-6">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={(e) => { e.stopPropagation(); handleSelectPlan(tier) }}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                plan.highlight || selectedTier === tier
                  ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {selectedTier === tier ? '已選擇 ✓' : '選擇方案'}
            </button>
          </div>
        ))}
      </div>

      {/* Registration Form */}
      {formStep === 'form' && selectedTier && (
        <div id="registration-form" className="max-w-lg mx-auto">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-bold mb-1" style={{ color: '#1e3a5f' }}>
              填寫基本資料
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              已選：{PLANS[selectedTier].name}（NT${PLANS[selectedTier].price}/月）
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
                <p className="text-xs text-gray-400 mt-1">帳號開通信會寄到這裡</p>
              </div>

              {/* 電話 */}
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
                className="w-full bg-[#2563eb] text-white py-4 rounded-xl font-bold text-base hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isSubmitting ? '正在跳轉至付款頁面...' : `前往付款 — NT$${PLANS[selectedTier].price}`}
              </button>

              <p className="text-center text-xs text-gray-400 mt-2">
                付款由綠界科技（ECPay）安全處理，支援信用卡、ATM、超商付款
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom */}
      <div className="text-center mt-10">
        <p className="text-sm text-gray-400">
          已經有帳號？
          <Link href="/diagnosis" className="text-[#2563eb] hover:underline ml-1">
            免費系統體驗
          </Link>
        </p>
      </div>
    </section>
  )
}
