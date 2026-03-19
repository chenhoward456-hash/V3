'use client'

import { useState, useEffect } from 'react'
import type { Client } from '@/hooks/useClientData'
import { trackEvent } from '@/lib/analytics'

/** Dismissable retention card — stores dismissed state in localStorage */
export function RetentionCard({ children, onDismiss, id }: { children: React.ReactNode; onDismiss: () => void; id: string }) {
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(`retention_${id}_dismissed`)) {
      setDismissed(true)
    }
  }, [id])
  if (dismissed) return null
  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 mb-3 relative">
      <button
        onClick={() => {
          localStorage.setItem(`retention_${id}_dismissed`, '1')
          setDismissed(true)
          onDismiss()
        }}
        className="absolute top-2 right-2 text-gray-300 hover:text-gray-500 transition-colors p-1"
        aria-label="關閉"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      {children}
    </div>
  )
}

/** Day 14 TDEE Calibration WOW Moment Card */
export function TDEECalibrationCard({ client }: { client: Client }) {
  const [dismissed, setDismissed] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(`tdee_calibration_${client.id}_seen`)) {
      setDismissed(true)
    }
  }, [client.id])

  if (dismissed) return null

  // Calculate initial vs calibrated TDEE difference
  const initialTDEE = client.calories_target ? Math.round(client.calories_target / 0.8) : null // rough estimate of original TDEE
  const currentCalories = client.calories_target
  if (!currentCalories) return null

  // We show the card as a "report" style
  return (
    <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 border-2 border-indigo-200 rounded-2xl p-5 mb-3 shadow-sm">
      <div className="text-center mb-4">
        <span className="text-3xl">🧠</span>
        <h3 className="text-base font-bold text-gray-900 mt-2">14 天智能校正完成</h3>
      </div>

      <div className="bg-white/70 rounded-xl p-4 mb-4 space-y-3">
        <p className="text-xs text-gray-500 text-center">
          根據你過去 14 天的真實體重趨勢，系統已自動校正你的代謝估算。
        </p>
        {initialTDEE && (
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-gray-400">初始估算 TDEE</p>
              <p className="text-lg font-bold text-gray-500">{initialTDEE.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">kcal</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-indigo-500">校正後目標熱量</p>
              <p className="text-lg font-bold text-indigo-700">{currentCalories.toLocaleString()}</p>
              <p className="text-[10px] text-indigo-500">kcal</p>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-600 text-center leading-relaxed">
          你的新目標已自動更新 ✓
        </p>
      </div>

      <div className="text-center space-y-2">
        <p className="text-xs text-gray-500">想知道接下來怎麼調整策略？</p>
        <a
          href="https://lin.ee/LP65rCc"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('tdee_calibration_line_click')}
          className="inline-block bg-[#06C755] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#05b04d] transition-colors"
        >
          💬 加 LINE 找 Howard 分析
        </a>
      </div>

      {!confirmed ? (
        <button
          onClick={() => {
            setConfirmed(true)
            localStorage.setItem(`tdee_calibration_${client.id}_seen`, '1')
            trackEvent('tdee_calibration_confirmed')
            setTimeout(() => setDismissed(true), 500)
          }}
          className="block w-full mt-3 text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
        >
          我知道了
        </button>
      ) : (
        <p className="text-center text-xs text-green-500 mt-3">✓ 已確認</p>
      )}
    </div>
  )
}
