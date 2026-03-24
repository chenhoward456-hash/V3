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
  promoPrice?: number
  promoLabel?: string
}> = {
  free: {
    name: '免費體驗',
    price: 0,
    priceLabel: '0',
    unit: '',
    description: '你一直想改變，但不知道從哪開始',
    features: [
      '記錄體重，看 7 天趨勢有沒有在動',
      '記錄飲食，系統算出你該吃多少',
      '不綁卡、不推銷，純粹讓你體驗',
    ],
    badge: '推薦先試',
  },
  self_managed: {
    name: '自主管理',
    price: 499,
    priceLabel: '499',
    unit: '/月',
    promoPrice: 399,
    promoLabel: '首月 $399',
    description: '你會記錄，但不知道記完之後要幹嘛',
    features: [
      '卡住時 AI 告訴你原因，不用自己猜',
      '每週自動調整熱量，不用重新算',
      '訓練日多吃、休息日少吃，系統自動排',
      '你只管執行，判斷的事交給系統',
    ],
  },
  coached: {
    name: '教練指導',
    price: 2999,
    priceLabel: '2,999',
    unit: '/月',
    description: '你不缺努力，缺的是有人確認方向對不對',
    features: [
      '教練每週看你的數據，告訴你哪裡要調',
      '根據你的血檢和基因，給只屬於你的建議',
      'LINE 隨時問，不用等、不用猜、不用自己扛',
      '你負責執行，教練負責確保方向正確',
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
  const promoParam = searchParams.get('promo')
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null)
  const [formStep, setFormStep] = useState<'plans' | 'form'>('plans')

  // 從 URL params 預填（來自 diagnosis 頁面）
  const paramGender = searchParams.get('gender') as '男性' | '女性' | null
  const paramGoal = searchParams.get('goal') as 'cut' | 'bulk' | null
  const paramWeight = searchParams.get('weight')
  const paramHeight = searchParams.get('height')
  const paramBf = searchParams.get('bf')
  const paramTw = searchParams.get('tw')
  const paramTd = searchParams.get('td')

  // 表單欄位
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState<'男性' | '女性' | ''>(paramGender || '')
  const [age, setAge] = useState('')
  const [goalType, setGoalType] = useState<'cut' | 'bulk' | 'recomp'>(paramGoal || 'cut')
  const [weight, setWeight] = useState(paramWeight || '')
  const [height, setHeight] = useState(paramHeight || '')
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'moderate' | 'high_energy_flux'>('moderate')
  const [trainingDays, setTrainingDays] = useState(paramTd || '3')
  const [targetWeight, setTargetWeight] = useState(paramTw || '')
  const [bodyFatPct, setBodyFatPct] = useState(paramBf || '')
  const [targetBodyFatPct, setTargetBodyFatPct] = useState('')

  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [showOptionalFields, setShowOptionalFields] = useState(false)

  // Per-field validation errors (shown on blur)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set())

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'name':
        if (!value.trim()) return '請輸入姓名'
        if (value.trim().length < 2) return '姓名至少 2 個字'
        return ''
      case 'email':
        if (!value) return '請輸入 Email'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '請輸入有效的 Email 格式'
        return ''
      case 'weight': {
        if (!value) return '請輸入目前體重'
        const w = parseFloat(value)
        if (isNaN(w) || w < 30 || w > 300) return '體重請輸入 30-300 kg'
        return ''
      }
      case 'height': {
        if (!value) return '' // optional
        const h = parseFloat(value)
        if (isNaN(h) || h < 100 || h > 250) return '身高請輸入 100-250 cm'
        return ''
      }
      case 'age': {
        if (!value) return '' // optional
        const a = parseInt(value)
        if (isNaN(a) || a < 10 || a > 100) return '年齡請輸入 10-100 歲'
        return ''
      }
      case 'bodyFatPct': {
        if (!value) return '' // optional
        const bf = parseFloat(value)
        if (isNaN(bf) || bf < 3 || bf > 60) return '體脂率請輸入 3-60%'
        return ''
      }
      default:
        return ''
    }
  }

  const handleBlur = (field: string, value: string) => {
    setTouchedFields(prev => new Set(prev).add(field))
    const err = validateField(field, value)
    setFieldErrors(prev => ({ ...prev, [field]: err }))
  }

  const getInputClassName = (field: string, base?: string) => {
    const hasError = touchedFields.has(field) && fieldErrors[field]
    return `w-full px-4 py-3 border-2 rounded-xl text-base focus:outline-none transition-colors ${
      hasError
        ? 'border-red-400 bg-red-50/30 focus:border-red-500'
        : 'border-gray-200 focus:border-[#2563eb]'
    } ${base || ''}`
  }

  const handleSelectPlan = (tier: Tier) => {
    setSelectedTier(tier)
    setFormStep('form')
    trackEvent('plan_selected', { tier })
    setTimeout(() => {
      document.getElementById('registration-form')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleSubmit = async () => {
    // Run all field validations and show errors
    const fieldsToValidate = { name, email, weight, height, age, bodyFatPct }
    const newErrors: Record<string, string> = {}
    const newTouched = new Set(touchedFields)
    for (const [field, value] of Object.entries(fieldsToValidate)) {
      newTouched.add(field)
      const err = validateField(field, value)
      if (err) newErrors[field] = err
    }
    setTouchedFields(newTouched)
    setFieldErrors(prev => ({ ...prev, ...newErrors }))

    // Check required fields with specific messages
    if (!agreedToTerms) { setError('請先同意服務條款與隱私政策'); return }
    if (newErrors.name) { setError(newErrors.name); return }
    if (newErrors.email) { setError(newErrors.email); return }
    if (!selectedTier) { setError('請選擇方案'); return }
    if (newErrors.weight) { setError(newErrors.weight); return }
    if (!gender) { setError('請選擇性別（系統需要此資訊計算 TDEE）'); return }
    // Check optional field errors
    if (newErrors.height || newErrors.age || newErrors.bodyFatPct) {
      setError('請修正標記為紅色的欄位')
      return
    }
    const weightNum = parseFloat(weight)

    setError('')
    setIsSubmitting(true)

    // 免費體驗：直接建帳號，不經 ECPay
    if (selectedTier === 'free') {
      trackEvent('free_trial_initiated', { email })

      // 組合表單資料 + diagnosis 頁的 localStorage 資料
      const heightNum = height ? parseFloat(height) : null
      const trainingDaysNum = trainingDays ? parseInt(trainingDays) : 3
      const targetWeightNum = targetWeight ? parseFloat(targetWeight) : null
      const bodyFatNum = bodyFatPct ? parseFloat(bodyFatPct) : null
      const targetBodyFatNum = targetBodyFatPct ? parseFloat(targetBodyFatPct) : null
      let diagnosisData: Record<string, any> = {
        weight: weightNum,
        ...(heightNum && heightNum > 100 && heightNum < 250 ? { height: heightNum } : {}),
        activityProfile: activityLevel === 'moderate' ? undefined : activityLevel,
        trainingDaysPerWeek: trainingDaysNum,
        ...(targetWeightNum && targetWeightNum >= 30 && targetWeightNum <= 300 ? { targetWeight: targetWeightNum } : {}),
        ...(bodyFatNum && bodyFatNum > 3 && bodyFatNum < 60 ? { bodyFatPct: bodyFatNum } : {}),
        ...(targetBodyFatNum && targetBodyFatNum > 3 && targetBodyFatNum < 60 ? { targetBodyFatPct: targetBodyFatNum } : {}),
      }
      // 如果表單沒填體脂率，嘗試從 diagnosis 頁帶入
      try {
        if (!bodyFatNum) {
          const dBodyfat = localStorage.getItem('demo_bodyfat')
          if (dBodyfat) diagnosisData.bodyFatPct = parseFloat(dBodyfat)
        }
        // diagnosis 頁的身高只在表單沒填時才用
        if (!heightNum) {
          const dHeight = localStorage.getItem('demo_height')
          if (dHeight) diagnosisData.height = parseFloat(dHeight)
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

        // 把營養目標存到 sessionStorage 帶到 success 頁
        if (data.targets) {
          try { sessionStorage.setItem('signup_targets', JSON.stringify(data.targets)) } catch {}
        }
        if (targetWeight) {
          try { sessionStorage.setItem('signup_target_weight', targetWeight) } catch {}
        }
        if (targetBodyFatPct) {
          try { sessionStorage.setItem('signup_target_body_fat', targetBodyFatPct) } catch {}
        }
        if (weight) {
          try { sessionStorage.setItem('signup_weight', weight) } catch {}
        }
        try { sessionStorage.setItem('signup_goal_type', goalType) } catch {}

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
            weight: weightNum,
            ...(refSource ? { ref: refSource } : {}),
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '結帳失敗')

      if (data.htmlForm) {
        const parser = new DOMParser()
        const doc = parser.parseFromString(data.htmlForm, 'text/html')
        const form = doc.querySelector('form')
        if (form) {
          document.body.appendChild(document.adoptNode(form))
          form.submit()
        }
      }
    } catch (err: any) {
      setError(err.message || '結帳失敗，請稍後再試')
      setIsSubmitting(false)
    }
  }

  const isFree = selectedTier === 'free'

  // Progress step calculation
  const totalSteps = 2
  const currentStep = formStep === 'plans' ? 1 : 2
  const stepLabels = ['選擇方案', '填寫資料']
  const progressPercent = (currentStep / totalSteps) * 100

  return (
    <section className="max-w-5xl mx-auto px-6 py-16 md:py-20">
      {/* Progress Indicator */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md -mx-6 px-6 pt-4 pb-3 mb-8 border-b border-gray-100">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">Step {currentStep} of {totalSteps}</span>
            <span className="text-xs text-gray-400">{stepLabels[currentStep - 1]}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2563eb] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  i + 1 <= currentStep
                    ? 'bg-[#2563eb] text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  {i + 1 <= currentStep ? '\u2713' : i + 1}
                </div>
                <span className={`text-xs transition-colors ${
                  i + 1 <= currentStep ? 'text-[#2563eb] font-semibold' : 'text-gray-400'
                }`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-block bg-[#2563eb]/10 text-[#2563eb] text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
          自助加入
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: '#1e3a5f' }}>
          找到適合你的方式
        </h1>
        <p className="text-gray-500 text-sm md:text-base max-w-xl mx-auto">
          不確定的話，先從免費開始。不綁卡，隨時升級。
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
              {tier === 'self_managed' && plan.promoPrice ? (
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="line-through text-gray-400 text-sm">NT${plan.priceLabel}</span>
                    <span className="text-2xl font-bold text-blue-600">NT${plan.promoPrice}</span>
                    <span className="text-xs text-gray-400">/首月</span>
                  </div>
                  <span className="text-xs text-gray-500">次月起 NT${plan.priceLabel}/月</span>
                </div>
              ) : (
              <div className="flex items-baseline justify-center gap-1">
                {plan.price > 0 && <span className="text-xs text-gray-400">NT$</span>}
                <span className="text-3xl font-bold" style={{ color: plan.price === 0 ? '#16a34a' : '#1e3a5f' }}>
                  {plan.price === 0 ? '免費' : plan.priceLabel}
                </span>
                <span className="text-xs text-gray-400">{plan.unit}</span>
              </div>
              )}
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

      {/* Free plan escape link -- shown when a paid plan is selected */}
      {selectedTier && selectedTier !== 'free' && (
        <div className="text-center mb-6 -mt-6">
          <button
            onClick={() => handleSelectPlan('free')}
            className="text-sm text-gray-400 hover:text-[#2563eb] transition-colors"
          >
            還沒準備好？先從免費方案開始 &rarr;
          </button>
        </div>
      )}

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
                  onChange={(e) => { setName(e.target.value); if (touchedFields.has('name')) handleBlur('name', e.target.value) }}
                  onBlur={() => handleBlur('name', name)}
                  className={getInputClassName('name')}
                />
                {touchedFields.has('name') && fieldErrors.name && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Email *</label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (touchedFields.has('email')) handleBlur('email', e.target.value) }}
                  onBlur={() => handleBlur('email', email)}
                  className={getInputClassName('email')}
                />
                {touchedFields.has('email') && fieldErrors.email ? (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">帳號資訊會寄到這裡</p>
                )}
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

              {/* 性別（所有方案都在主表單顯示，必填） */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">性別 *</label>
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

              {/* 年齡（所有方案都在主表單顯示，選填） */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  年齡 <span className="text-gray-400 font-normal">— 選填，影響 TDEE 計算</span>
                </label>
                <input
                  type="number"
                  placeholder="例如 28"
                  value={age}
                  onChange={(e) => { setAge(e.target.value); if (touchedFields.has('age')) handleBlur('age', e.target.value) }}
                  onBlur={() => handleBlur('age', age)}
                  className={getInputClassName('age')}
                />
                {touchedFields.has('age') && fieldErrors.age && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.age}</p>
                )}
              </div>

              {/* 目標 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">你的目標</label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { key: 'cut' as const, label: '減脂' },
                    { key: 'recomp' as const, label: '體態重組' },
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

              {/* 體重 & 身高 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">目前體重 (kg) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="例如 65"
                    value={weight}
                    onChange={(e) => { setWeight(e.target.value); if (touchedFields.has('weight')) handleBlur('weight', e.target.value) }}
                    onBlur={() => handleBlur('weight', weight)}
                    min="30"
                    max="300"
                    step="0.1"
                    className={getInputClassName('weight')}
                  />
                  {touchedFields.has('weight') && fieldErrors.weight && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.weight}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">身高 (cm)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="例如 170"
                    value={height}
                    onChange={(e) => { setHeight(e.target.value); if (touchedFields.has('height')) handleBlur('height', e.target.value) }}
                    onBlur={() => handleBlur('height', height)}
                    min="100"
                    max="250"
                    step="0.1"
                    className={getInputClassName('height')}
                  />
                  {touchedFields.has('height') && fieldErrors.height && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.height}</p>
                  )}
                </div>
              </div>

              {/* 免費版：選填欄位折疊區 */}
              {isFree && !showOptionalFields && (
                <button
                  type="button"
                  onClick={() => setShowOptionalFields(true)}
                  className="w-full text-center text-sm text-[#2563eb] hover:underline py-2"
                >
                  填寫更多資料（選填，計算更準確）
                </button>
              )}

              {/* 免費版折疊區包含：體脂率、目標體重、目標體脂、活動量、訓練天數 */}

              {/* 體脂率（付費版顯示 or 免費版展開時顯示） */}
              {(!isFree || showOptionalFields) && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  體脂率 (%) <span className="text-gray-400 font-normal">— 選填，有填計算更準</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="例如 20"
                  value={bodyFatPct}
                  onChange={(e) => { setBodyFatPct(e.target.value); if (touchedFields.has('bodyFatPct')) handleBlur('bodyFatPct', e.target.value) }}
                  onBlur={() => handleBlur('bodyFatPct', bodyFatPct)}
                  min="3"
                  max="60"
                  step="0.1"
                  className={getInputClassName('bodyFatPct')}
                />
                {touchedFields.has('bodyFatPct') && fieldErrors.bodyFatPct ? (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.bodyFatPct}</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">InBody、體脂計或健身房量測的數字。沒有也沒關係，系統會用體重估算。</p>
                )}
              </div>
              )}

              {/* 目標體重 & 目標體脂（付費版 or 免費版展開） */}
              {(!isFree || showOptionalFields) && (
              <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">
                    目標體重 (kg) <span className="text-gray-400 font-normal">— 選填</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder={goalType === 'cut' ? '例如 60' : goalType === 'bulk' ? '例如 72' : '例如 68'}
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                    min="30"
                    max="300"
                    step="0.1"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">
                    目標體脂 (%) <span className="text-gray-400 font-normal">— 選填</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="例如 15"
                    value={targetBodyFatPct}
                    onChange={(e) => setTargetBodyFatPct(e.target.value)}
                    min="3"
                    max="60"
                    step="0.1"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
                  />
                </div>
              </div>
              {goalType === 'recomp' && (
                <p className="text-xs text-gray-400 mt-1">體態重組：體重可能不變，但體脂下降、肌肉增加。建議填寫目標體脂。</p>
              )}
              </>
              )}

              {/* 活動量（付費版 or 免費版展開） */}
              {(!isFree || showOptionalFields) && (
              <>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">日常活動量</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'sedentary' as const, label: '久坐', desc: '辦公室為主' },
                    { key: 'moderate' as const, label: '中等', desc: '偶爾走動' },
                    { key: 'high_energy_flux' as const, label: '活躍', desc: '常走動/體力活' },
                  ]).map(({ key, label, desc }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActivityLevel(key)}
                      className={`py-2.5 rounded-xl text-sm transition-all border-2 ${
                        activityLevel === key
                          ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb] font-semibold'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium">{label}</div>
                      <div className="text-[10px] opacity-70">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 每週訓練天數 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">每週訓練幾天</label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTrainingDays(String(d))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                        parseInt(trainingDays) === d
                          ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]'
                          : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">包含重訓和有氧</p>
              </div>
              </>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </div>
              )}

              {/* 同意條款 */}
              <label className="flex items-start gap-3 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#2563eb] focus:ring-[#2563eb]"
                />
                <span className="text-xs text-gray-500 leading-relaxed">
                  我已閱讀並同意{' '}
                  <Link href="/terms" target="_blank" className="text-[#2563eb] hover:underline">服務條款</Link>、
                  <Link href="/privacy" target="_blank" className="text-[#2563eb] hover:underline">隱私政策</Link>
                  {' '}及{' '}
                  <Link href="/refund-policy" target="_blank" className="text-[#2563eb] hover:underline">退費政策</Link>
                </span>
              </label>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full py-4 rounded-xl font-bold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2 ${
                  isFree
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]'
                }`}
              >
                {isSubmitting && (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {isSubmitting
                  ? isFree ? '正在建立帳號...' : '正在跳轉至付款頁面...'
                  : isFree ? '立即開始免費體驗' : `前往付款 — NT$${PLANS[selectedTier].priceLabel}`
                }
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">提交後系統會自動建立帳號，登入資訊會寄到你的 Email</p>

              {/* Reassurance text */}
              {!isFree && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-center gap-4 text-gray-400">
                    <span className="flex items-center gap-1 text-xs">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      隨時取消
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      無綁約
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      無違約金
                    </span>
                  </div>
                  <p className="text-center text-xs text-gray-400">
                    月繳制，不滿意隨時停止
                  </p>
                  <div className="flex items-center justify-center gap-1.5 text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-[11px]">付款資訊由 ECPay 安全加密處理</span>
                  </div>
                </div>
              )}

              <p className="text-center text-xs text-gray-400 mt-2">
                {isFree
                  ? '不需信用卡，隨時可升級付費方案。'
                  : '支援信用卡、ATM、超商付款'
                }
              </p>

              {/* Free plan escape in form step for paid plans */}
              {!isFree && (
                <div className="text-center mt-3">
                  <button
                    onClick={() => {
                      setSelectedTier('free')
                      trackEvent('plan_downgrade_to_free', { from: selectedTier })
                    }}
                    className="text-xs text-gray-400 hover:text-[#2563eb] transition-colors"
                  >
                    還沒準備好？先從免費方案開始 &rarr;
                  </button>
                </div>
              )}

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
