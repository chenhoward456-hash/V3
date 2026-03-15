'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tier = 'free' | 'self_managed' | 'coached'

interface TierPlan {
  key: Tier
  name: string
  price: string
  priceValue: number
  unit: string
  tagline: string
  highlight: boolean
  badge?: string
}

interface FeatureRow {
  label: string
  free: string | boolean
  self_managed: string | boolean
  coached: string | boolean
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const TIERS: TierPlan[] = [
  {
    key: 'free',
    name: '免費體驗',
    price: '0',
    priceValue: 0,
    unit: '',
    tagline: '先體驗系統，滿意再升級',
    highlight: false,
  },
  {
    key: 'self_managed',
    name: '自主管理',
    price: '499',
    priceValue: 499,
    unit: '/月',
    tagline: 'AI 系統完整存取，自動追蹤與分析',
    highlight: false,
    badge: '超值推薦',
  },
  {
    key: 'coached',
    name: '教練指導',
    price: '2,999',
    priceValue: 2999,
    unit: '/月',
    tagline: 'AI 系統 + CSCS 教練每週指導',
    highlight: false,
    badge: '最完整',
  },
]

const FEATURES: FeatureRow[] = [
  { label: '體重追蹤', free: true, self_managed: true, coached: true },
  { label: '基礎營養目標', free: true, self_managed: true, coached: true },
  { label: '自動 TDEE 校正', free: true, self_managed: true, coached: true },
  { label: '身心狀態追蹤', free: false, self_managed: true, coached: true },
  { label: '訓練記錄', free: false, self_managed: true, coached: true },
  { label: 'AI 私人顧問', free: '每月1次', self_managed: '無限', coached: '無限' },
  { label: '碳水循環', free: false, self_managed: true, coached: true },
  { label: '每日補品管理', free: false, self_managed: false, coached: true },
  { label: '血檢分析', free: false, self_managed: false, coached: true },
  { label: '基因風險管理', free: false, self_managed: false, coached: true },
  { label: 'LINE 教練回覆', free: false, self_managed: false, coached: true },
  { label: '每週報告回饋', free: false, self_managed: false, coached: true },
  { label: '客製營養調整', free: false, self_managed: false, coached: true },
]

// ---------------------------------------------------------------------------
// Helper to determine recommended tier based on current tier
// ---------------------------------------------------------------------------

function getRecommendedTier(from?: string | null): Tier | null {
  if (from === 'free') return 'self_managed'
  if (from === 'self_managed') return 'coached'
  return null
}

// ---------------------------------------------------------------------------
// Feature cell rendering
// ---------------------------------------------------------------------------

function FeatureCell({ value }: { value: string | boolean }) {
  if (typeof value === 'string') {
    return <span className="text-xs font-medium text-blue-600">{value}</span>
  }
  if (value) {
    return (
      <svg className="w-5 h-5 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    )
  }
  return (
    <svg className="w-5 h-5 text-gray-300 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main page (with Suspense boundary)
// ---------------------------------------------------------------------------

export default function UpgradePage() {
  return (
    <Suspense fallback={<UpgradePageSkeleton />}>
      <UpgradePageInner />
    </Suspense>
  )
}

function UpgradePageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inner component that reads searchParams
// ---------------------------------------------------------------------------

function UpgradePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') as Tier | null
  const featureTrigger = searchParams.get('feature')
  const recommended = getRecommendedTier(from)

  // Determine which tiers should be highlighted
  const tiersWithState = TIERS.map((tier) => ({
    ...tier,
    isCurrent: tier.key === from,
    isRecommended: tier.key === recommended,
    highlight: tier.key === recommended,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
          <button
            onClick={() => from ? router.back() : router.push('/')}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            返回
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            選擇適合你的方案
          </h1>
          <p className="text-sm sm:text-base text-gray-500 mt-2">
            所有方案皆可隨時升級或取消，不綁約。
          </p>
          {featureTrigger && (
            <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm px-3 py-1.5 rounded-full">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              你想使用的「{featureTrigger}」需要升級方案
            </div>
          )}
        </div>
      </div>

      {/* Tier Cards */}
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-12">
          {tiersWithState.map((tier) => (
            <TierCard
              key={tier.key}
              tier={tier}
              isCurrent={tier.isCurrent}
              isRecommended={tier.isRecommended}
              from={from}
            />
          ))}
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">功能比較</h2>
            <p className="text-xs text-gray-500 mt-0.5">完整了解每個方案包含的功能</p>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3 w-1/4">功能</th>
                  {TIERS.map((tier) => (
                    <th key={tier.key} className="text-center text-xs font-semibold text-gray-500 px-4 py-3 w-1/4">
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{tier.name}</span>
                        {tier.priceValue > 0 && (
                          <span className="text-[10px] font-normal text-gray-400">NT${tier.price}{tier.unit}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="text-sm text-gray-700 px-6 py-3">{row.label}</td>
                    <td className="text-center px-4 py-3"><FeatureCell value={row.free} /></td>
                    <td className="text-center px-4 py-3"><FeatureCell value={row.self_managed} /></td>
                    <td className="text-center px-4 py-3"><FeatureCell value={row.coached} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile comparison: collapsible per tier */}
          <div className="sm:hidden divide-y divide-gray-100">
            {TIERS.map((tier) => (
              <MobileFeatureList key={tier.key} tier={tier} features={FEATURES} isCurrent={tier.key === from} />
            ))}
          </div>
        </div>

        {/* FAQ / Reassurance */}
        <div className="mt-12 max-w-2xl mx-auto text-center space-y-3 pb-12">
          <p className="text-sm text-gray-500">
            有問題嗎？直接透過 LINE 聯繫 Howard，我會親自回覆你。
          </p>
          <a
            href="https://lin.ee/LP65rCc"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#06C755] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#05b04d] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            加 LINE 找 Howard
          </a>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tier Card
// ---------------------------------------------------------------------------

function TierCard({
  tier,
  isCurrent,
  isRecommended,
  from,
}: {
  tier: TierPlan & { isCurrent: boolean; isRecommended: boolean }
  isCurrent: boolean
  isRecommended: boolean
  from: Tier | null
}) {
  const showCTA = !isCurrent && tier.key !== 'free'
  const isUpgrade = from && tierOrder(tier.key) > tierOrder(from)

  return (
    <div
      className={`
        relative bg-white rounded-2xl border-2 p-5 sm:p-6 transition-all
        ${isRecommended
          ? 'border-blue-500 shadow-lg shadow-blue-100 scale-[1.02]'
          : isCurrent
            ? 'border-green-300 bg-green-50/30'
            : 'border-gray-200 hover:border-gray-300'
        }
      `}
    >
      {/* Badges */}
      <div className="flex items-center gap-2 mb-3">
        {isCurrent && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            目前方案
          </span>
        )}
        {isRecommended && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-600 text-white px-2.5 py-0.5 rounded-full">
            推薦升級
          </span>
        )}
        {!isRecommended && !isCurrent && tier.badge && (
          <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {tier.badge}
          </span>
        )}
      </div>

      {/* Plan name */}
      <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
      <p className="text-xs text-gray-500 mt-0.5 mb-4">{tier.tagline}</p>

      {/* Price */}
      <div className="flex items-baseline gap-0.5 mb-5">
        <span className="text-sm text-gray-500">NT$</span>
        <span className="text-3xl font-bold text-gray-900">{tier.price}</span>
        {tier.unit && <span className="text-sm text-gray-400">{tier.unit}</span>}
      </div>

      {/* CTA */}
      {showCTA && isUpgrade ? (
        <Link
          href={`/join?tier=${tier.key}`}
          onClick={() =>
            trackEvent('upgrade_plan_selected', {
              from,
              to: tier.key,
              source: 'upgrade_page',
            })
          }
          className={`
            block text-center text-sm font-bold py-3 rounded-xl transition-all
            ${isRecommended
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md'
              : 'bg-gray-900 text-white hover:bg-gray-800'
            }
          `}
        >
          立即升級
        </Link>
      ) : isCurrent ? (
        <div className="text-center text-sm font-semibold text-green-600 py-3 bg-green-50 rounded-xl border border-green-200">
          你的目前方案
        </div>
      ) : tier.key === 'free' && !from ? (
        <Link
          href="/join"
          className="block text-center text-sm font-bold py-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          免費開始
        </Link>
      ) : tier.key === 'free' ? (
        <div className="text-center text-sm text-gray-400 py-3">
          基礎方案
        </div>
      ) : (
        <Link
          href={`/join?tier=${tier.key}`}
          onClick={() =>
            trackEvent('upgrade_plan_selected', {
              from: from ?? 'none',
              to: tier.key,
              source: 'upgrade_page',
            })
          }
          className="block text-center text-sm font-bold py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors"
        >
          選擇此方案
        </Link>
      )}

      {/* Quick feature highlights */}
      <ul className="mt-5 space-y-2">
        {getQuickFeatures(tier.key).map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
            <svg className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mobile Feature List
// ---------------------------------------------------------------------------

function MobileFeatureList({
  tier,
  features,
  isCurrent,
}: {
  tier: TierPlan
  features: FeatureRow[]
  isCurrent: boolean
}) {
  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-bold text-gray-800">{tier.name}</h3>
        {tier.priceValue > 0 && (
          <span className="text-xs text-gray-400">NT${tier.price}{tier.unit}</span>
        )}
        {isCurrent && (
          <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
            目前
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-1">
        {features.map((row) => {
          const val = row[tier.key]
          return (
            <div key={row.label} className="flex items-center justify-between py-1">
              <span className="text-xs text-gray-600">{row.label}</span>
              <FeatureCell value={val} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tierOrder(tier: Tier): number {
  const order: Record<Tier, number> = { free: 0, self_managed: 1, coached: 2 }
  return order[tier]
}

function getQuickFeatures(tier: Tier): string[] {
  switch (tier) {
    case 'free':
      return [
        '體重 / 體態紀錄與趨勢',
        '每日飲食追蹤',
        'TDEE 自動計算',
      ]
    case 'self_managed':
      return [
        '包含免費版所有功能',
        'AI 私人顧問無限次',
        '身心狀態 + 訓練追蹤',
        '碳水循環 & 停滯期偵測',
      ]
    case 'coached':
      return [
        '包含自主管理所有功能',
        'CSCS 教練每週審閱',
        'LINE 一對一諮詢',
        '補劑 + 血檢 + 基因分析',
        '客製營養調整',
      ]
  }
}
