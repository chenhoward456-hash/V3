'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type Gender = 'male' | 'female'
type Goal = 'cut' | 'maintain' | 'bulk'

interface ActivityOption {
  label: string
  value: number
}

const ACTIVITY_OPTIONS: ActivityOption[] = [
  { label: '久坐（幾乎不運動）', value: 1.2 },
  { label: '輕度活動（每週 1-3 天）', value: 1.375 },
  { label: '中度活動（每週 3-5 天）', value: 1.55 },
  { label: '高度活動（每週 6-7 天）', value: 1.725 },
  { label: '非常活躍（體力勞動 / 一天兩練）', value: 1.9 },
]

// Macro ratios per goal (g per kg bodyweight, except carbs which fill remaining)
const MACRO_CONFIG: Record<Goal, { proteinPerKg: number; fatPerKg: number }> = {
  cut: { proteinPerKg: 2.2, fatPerKg: 0.8 },
  maintain: { proteinPerKg: 2.0, fatPerKg: 0.9 },
  bulk: { proteinPerKg: 1.8, fatPerKg: 1.0 },
}

const GOAL_META: Record<Goal, { label: string; sub: string; multiplier: number; color: string; bgColor: string; borderColor: string; ringColor: string }> = {
  cut: {
    label: '減脂',
    sub: 'TDEE x 0.8',
    multiplier: 0.8,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    ringColor: 'ring-red-500',
  },
  maintain: {
    label: '維持',
    sub: 'TDEE x 1.0',
    multiplier: 1.0,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    ringColor: 'ring-blue-500',
  },
  bulk: {
    label: '增肌',
    sub: 'TDEE x 1.1',
    multiplier: 1.1,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    ringColor: 'ring-green-500',
  },
}

// ---------------------------------------------------------------------------
// Calculation helpers
// ---------------------------------------------------------------------------

function calcBMR(gender: Gender, weightKg: number, heightCm: number, age: number): number {
  // Mifflin-St Jeor
  if (gender === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161
}

function calcMacros(goal: Goal, targetKcal: number, weightKg: number) {
  const { proteinPerKg, fatPerKg } = MACRO_CONFIG[goal]
  const proteinG = Math.round(proteinPerKg * weightKg)
  const fatG = Math.round(fatPerKg * weightKg)
  const proteinKcal = proteinG * 4
  const fatKcal = fatG * 9
  const carbKcal = Math.max(0, targetKcal - proteinKcal - fatKcal)
  const carbG = Math.round(carbKcal / 4)
  return { proteinG, fatG, carbG }
}

// ---------------------------------------------------------------------------
// Structured data (schema.org)
// ---------------------------------------------------------------------------

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'TDEE 計算機',
  description:
    '免費 TDEE 計算機，根據你的性別、體重、身高、年齡和活動量精準計算每日總消耗熱量。還能進一步計算減脂/增肌的建議熱量和巨量營養素分配。',
  url: `${SITE_URL}/tools/tdee`,
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web',
  inLanguage: 'zh-TW',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'TWD',
  },
  author: {
    '@type': 'Organization',
    name: 'Howard Protocol',
    url: SITE_URL,
  },
  featureList: [
    'Mifflin-St Jeor BMR 計算',
    '五種活動量級別',
    '減脂/維持/增肌 熱量建議',
    '蛋白質/碳水/脂肪 巨量營養素分配',
  ],
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TdeeCalculatorPage() {
  // Form state
  const [gender, setGender] = useState<Gender>('male')
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [activityIdx, setActivityIdx] = useState(0)

  // Results state
  const [bmr, setBmr] = useState<number | null>(null)
  const [tdee, setTdee] = useState<number | null>(null)
  const [activeGoal, setActiveGoal] = useState<Goal>('cut')
  const [showResults, setShowResults] = useState(false)

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback(() => {
    const e: Record<string, string> = {}
    const ageN = Number(age)
    const heightN = Number(height)
    const weightN = Number(weight)

    if (!age || isNaN(ageN) || ageN < 10 || ageN > 120) e.age = '請輸入有效年齡（10-120）'
    if (!height || isNaN(heightN) || heightN < 100 || heightN > 250) e.height = '請輸入有效身高（100-250 cm）'
    if (!weight || isNaN(weightN) || weightN < 30 || weightN > 300) e.weight = '請輸入有效體重（30-300 kg）'

    setErrors(e)
    return Object.keys(e).length === 0
  }, [age, height, weight])

  const handleCalculate = useCallback(() => {
    if (!validate()) return

    const ageN = Number(age)
    const heightN = Number(height)
    const weightN = Number(weight)
    const activityMultiplier = ACTIVITY_OPTIONS[activityIdx].value

    const calculatedBmr = Math.round(calcBMR(gender, weightN, heightN, ageN))
    const calculatedTdee = Math.round(calculatedBmr * activityMultiplier)

    setBmr(calculatedBmr)
    setTdee(calculatedTdee)
    setShowResults(true)

    trackEvent('tdee_calculator_used', {
      gender,
      age: ageN,
      activity_level: ACTIVITY_OPTIONS[activityIdx].label,
      bmr: calculatedBmr,
      tdee: calculatedTdee,
    })
  }, [gender, age, height, weight, activityIdx, validate])

  const handleCtaClick = useCallback(() => {
    trackEvent('tdee_calculator_cta_click', {
      source: 'tdee_tool',
      tdee: tdee ?? 0,
      bmr: bmr ?? 0,
    })
  }, [tdee, bmr])

  // Macro display helper
  const renderMacroCard = (goal: Goal) => {
    if (!tdee || !weight) return null
    const meta = GOAL_META[goal]
    const targetKcal = Math.round(tdee * meta.multiplier)
    const macros = calcMacros(goal, targetKcal, Number(weight))
    const isActive = activeGoal === goal

    return (
      <button
        key={goal}
        onClick={() => setActiveGoal(goal)}
        className={`
          flex-1 rounded-2xl p-5 border-2 transition-all duration-200 text-left cursor-pointer
          ${isActive ? `${meta.borderColor} ${meta.bgColor} ring-2 ${meta.ringColor} shadow-sm` : 'border-gray-200 bg-white hover:border-gray-300'}
        `}
      >
        <p className={`text-sm font-bold mb-1 ${isActive ? meta.color : 'text-gray-500'}`}>
          {meta.label}
        </p>
        <p className="text-xs text-gray-400 mb-3">{meta.sub}</p>
        <p className={`text-2xl font-bold mb-3 ${isActive ? meta.color : 'text-gray-800'}`}>
          {targetKcal.toLocaleString()}
          <span className="text-sm font-normal text-gray-400 ml-1">kcal</span>
        </p>
        <div className="space-y-1.5">
          <MacroRow label="蛋白質" grams={macros.proteinG} color="bg-red-400" />
          <MacroRow label="碳水" grams={macros.carbG} color="bg-yellow-400" />
          <MacroRow label="脂肪" grams={macros.fatG} color="bg-blue-400" />
        </div>
      </button>
    )
  }

  return (
    <>
      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="min-h-screen bg-gradient-to-b from-white to-[#f5f7fa]">
        {/* Hero header */}
        <section className="max-w-3xl mx-auto px-6 pt-12 pb-8 md:pt-20 md:pb-12 text-center">
          <div className="inline-block bg-primary/10 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            免費工具
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-navy mb-4 leading-tight">
            TDEE 計算機
          </h1>
          <p className="text-gray-500 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
            根據 Mifflin-St Jeor 公式，精準計算你的<strong className="text-navy">每日總熱量消耗</strong>
            ，並提供減脂、維持、增肌三種目標的熱量與巨量營養素建議。
          </p>
        </section>

        {/* Calculator card */}
        <section className="max-w-2xl mx-auto px-6 pb-8">
          <div className="bg-white rounded-3xl shadow-[0_2px_24px_rgba(0,0,0,0.06)] p-6 md:p-10">
            {/* Gender toggle */}
            <fieldset className="mb-6">
              <legend className="block text-sm font-semibold text-gray-700 mb-2">性別</legend>
              <div className="flex gap-3">
                {(['male', 'female'] as Gender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`
                      flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200
                      ${gender === g
                        ? 'bg-primary text-white shadow-md shadow-blue-500/20'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }
                    `}
                    aria-pressed={gender === g}
                  >
                    {g === 'male' ? '男' : '女'}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Number inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <NumberField
                label="年齡"
                unit="歲"
                value={age}
                onChange={setAge}
                error={errors.age}
                placeholder="25"
                min={10}
                max={120}
              />
              <NumberField
                label="身高"
                unit="cm"
                value={height}
                onChange={setHeight}
                error={errors.height}
                placeholder="170"
                min={100}
                max={250}
              />
              <NumberField
                label="體重"
                unit="kg"
                value={weight}
                onChange={setWeight}
                error={errors.weight}
                placeholder="70"
                min={30}
                max={300}
              />
            </div>

            {/* Activity select */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="activity">
                活動量
              </label>
              <select
                id="activity"
                value={activityIdx}
                onChange={(e) => setActivityIdx(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%236b7280' viewBox='0 0 16 16'%3E%3Cpath d='M4.646 5.646a.5.5 0 0 1 .708 0L8 8.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E")`, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', paddingRight: '2.5rem' }}
              >
                {ACTIVITY_OPTIONS.map((opt, i) => (
                  <option key={i} value={i}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Calculate button */}
            <button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-primary-dark transition-colors shadow-lg shadow-blue-500/20 active:scale-[0.98] min-h-[48px]"
            >
              計算 TDEE
            </button>
          </div>
        </section>

        {/* Results */}
        {showResults && tdee !== null && bmr !== null && (
          <section className="max-w-2xl mx-auto px-6 pb-8 animate-fade-in-up">
            <div className="bg-white rounded-3xl shadow-[0_2px_24px_rgba(0,0,0,0.06)] p-6 md:p-10">
              {/* TDEE & BMR headline */}
              <div className="text-center mb-8">
                <p className="text-sm text-gray-400 mb-1">你的每日總熱量消耗</p>
                <p className="text-5xl md:text-6xl font-bold text-navy mb-1">
                  {tdee.toLocaleString()}
                </p>
                <p className="text-sm text-gray-400">kcal / 天</p>
                <div className="mt-4 inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1.5">
                  <span className="text-xs text-gray-400">BMR</span>
                  <span className="text-sm font-semibold text-gray-600">{bmr.toLocaleString()} kcal</span>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-100 mb-8" />

              {/* Goal cards */}
              <p className="text-sm font-semibold text-gray-700 mb-4">選擇你的目標</p>
              <div className="flex flex-col sm:flex-row gap-3 mb-2">
                {(['cut', 'maintain', 'bulk'] as Goal[]).map((g) => renderMacroCard(g))}
              </div>
              <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
                * 蛋白質與脂肪依據體重計算，剩餘熱量分配給碳水化合物。實際需求因個人狀況而異。
              </p>
            </div>
          </section>
        )}

        {/* Hook section */}
        {showResults && (
          <section className="max-w-2xl mx-auto px-6 pb-16 animate-fade-in-up">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-3xl p-6 md:p-10">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl flex-shrink-0 mt-0.5" role="img" aria-label="warning">
                  &#x26A0;&#xFE0F;
                </span>
                <h2 className="text-xl md:text-2xl font-bold text-navy">
                  但這只是估計值
                </h2>
              </div>
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                <p>
                  公式算出的 TDEE 誤差可能高達 <strong className="text-gray-800">20%</strong>。你的真實
                  TDEE 取決於基因、代謝適應、睡眠品質、壓力等因素，每個人都不一樣。
                </p>
                <p>
                  Howard Protocol 的系統會根據你<strong className="text-gray-800">每週的體重變化</strong>
                  ，自動校正你的真實 TDEE — 不再猜，用數據說話。
                </p>
              </div>
              <div className="mt-6">
                <Link
                  href="/join"
                  onClick={handleCtaClick}
                  className="inline-block bg-primary text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-primary-dark transition-all shadow-lg shadow-blue-500/25 min-h-[48px]"
                >
                  免費開始 7 天追蹤 &rarr;
                </Link>
                <p className="text-xs text-gray-400 mt-3">
                  不需信用卡，30 秒建立帳號。14 天後系統自動校正你的真實 TDEE。
                </p>
              </div>
            </div>
          </section>
        )}

        {/* SEO content below the fold */}
        <section className="max-w-3xl mx-auto px-6 pb-20">
          <div className="border-t border-gray-200 pt-12">
            <h2 className="text-2xl font-bold text-navy mb-6">什麼是 TDEE？</h2>
            <div className="prose prose-sm text-gray-600 leading-relaxed space-y-4">
              <p>
                TDEE（Total Daily Energy Expenditure，每日總熱量消耗）是你每天消耗的總卡路里數。它包含了基礎代謝率（BMR）、食物熱效應（TEF）、以及日常活動和運動消耗。
              </p>
              <p>
                了解你的 TDEE 是制定有效飲食計畫的第一步。無論你的目標是減脂、維持體重、還是增肌，都需要以 TDEE 為基準來設定每日熱量攝取。
              </p>

              <h3 className="text-lg font-bold text-navy mt-8 mb-3">Mifflin-St Jeor 公式</h3>
              <p>
                本計算機使用經過科學驗證的 Mifflin-St Jeor 公式來計算 BMR。多項研究表明，這是目前預測基礎代謝率最準確的公式之一。
              </p>
              <div className="bg-gray-50 rounded-xl p-4 text-sm font-mono text-gray-700">
                <p className="mb-1">男性 BMR = 10 x 體重(kg) + 6.25 x 身高(cm) - 5 x 年齡 + 5</p>
                <p>女性 BMR = 10 x 體重(kg) + 6.25 x 身高(cm) - 5 x 年齡 - 161</p>
              </div>

              <h3 className="text-lg font-bold text-navy mt-8 mb-3">活動量乘數</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">活動量</th>
                      <th className="text-left p-3 font-semibold text-gray-700">乘數</th>
                      <th className="text-left p-3 font-semibold text-gray-700">說明</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    <tr className="border-t border-gray-100">
                      <td className="p-3">久坐</td>
                      <td className="p-3">1.2</td>
                      <td className="p-3">辦公室工作，幾乎不運動</td>
                    </tr>
                    <tr className="border-t border-gray-100">
                      <td className="p-3">輕度活動</td>
                      <td className="p-3">1.375</td>
                      <td className="p-3">每週運動 1-3 天</td>
                    </tr>
                    <tr className="border-t border-gray-100">
                      <td className="p-3">中度活動</td>
                      <td className="p-3">1.55</td>
                      <td className="p-3">每週運動 3-5 天</td>
                    </tr>
                    <tr className="border-t border-gray-100">
                      <td className="p-3">高度活動</td>
                      <td className="p-3">1.725</td>
                      <td className="p-3">每週運動 6-7 天</td>
                    </tr>
                    <tr className="border-t border-gray-100">
                      <td className="p-3">非常活躍</td>
                      <td className="p-3">1.9</td>
                      <td className="p-3">體力勞動或一天兩練</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-bold text-navy mt-8 mb-3">為什麼公式只是起點？</h3>
              <p>
                TDEE 公式的準確率約在 80% 左右。每個人的基因、腸道菌叢、荷爾蒙狀態、睡眠品質和壓力水平都不同。
                真正精準的 TDEE 需要透過持續追蹤體重變化來反推計算。Howard Protocol 的系統正是為此而設計 —
                用你的真實數據取代公式估算。
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NumberField({
  label,
  unit,
  value,
  onChange,
  error,
  placeholder,
  min,
  max,
}: {
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder: string
  min: number
  max: number
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}<span className="text-gray-400 font-normal ml-1">({unit})</span>
      </label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        className={`
          w-full border rounded-xl px-4 py-3 text-sm text-gray-700 bg-white
          focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
          transition-all placeholder:text-gray-300
          ${error ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'}
        `}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function MacroRow({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />
      <span className="text-xs text-gray-500 w-12">{label}</span>
      <span className="text-xs font-semibold text-gray-700">{grams}g</span>
    </div>
  )
}
