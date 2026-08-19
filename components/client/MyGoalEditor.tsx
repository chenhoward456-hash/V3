'use client'

import { useState } from 'react'

/**
 * 學員自己改目標體重與目標日。
 *
 * ⚠️ 為什麼放手讓學員改（2026-08-19 Howard：「萬哲鴻比賽日過了、現在有新階段的
 * 增重目標，但他沒辦法自己設定，必須透過我這邊…有些學生我都是開給他們讓他們自己玩」）：
 *
 * 分界線是「**想要什麼** vs **處方**」——
 *   目標體重/日期＝他的意圖，本來就該他決定；
 *   每天吃幾克碳水＝處方，留給教練（法規線，見 lib/health-screening）。
 * 系統的角色是把「想要」翻譯成「安不安全」：超過 Helms 的速率上限就擋下、
 * 說明為什麼、並直接給一個做得到的日期讓他一鍵套用。
 */

type Props = {
  clientCode: string
  currentWeight: number | null
  targetWeight: number | null
  targetDate: string | null
  onSaved: () => void
}

export default function MyGoalEditor({ clientCode, currentWeight, targetWeight, targetDate, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [w, setW] = useState(targetWeight != null ? String(targetWeight) : '')
  const [d, setD] = useState(targetDate ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<{ targetDate?: string; label: string } | null>(null)

  const save = async (overrideDate?: string) => {
    setError(null); setSuggestion(null); setSaving(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientCode,
          target_weight: Number(w),
          target_date: overrideDate ?? d,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error ?? '存不起來，等一下再試')
        if (json?.suggestion) setSuggestion(json.suggestion)
        return
      }
      if (overrideDate) setD(overrideDate)
      setOpen(false)
      onSaved()
    } catch {
      setError('網路怪怪的，等一下再試')
    } finally {
      setSaving(false)
    }
  }

  // 即時把「一週要掉/增幾公斤」算給他看，不用等送出
  const preview = (() => {
    const tw = Number(w)
    if (!currentWeight || !Number.isFinite(tw) || !d) return null
    const days = (new Date(d + 'T00:00:00').getTime() - Date.now()) / 86_400_000
    if (days < 1) return null
    const rate = (tw - currentWeight) / (days / 7)
    if (!Number.isFinite(rate)) return null
    return `一週約 ${rate > 0 ? '+' : ''}${rate.toFixed(2)} 公斤（${Math.round(days)} 天）`
  })()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 hover:text-primary-600 transition-colors underline underline-offset-2"
      >
        改目標
      </button>
    )
  }

  return (
    <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
      <p className="text-sm font-medium text-gray-800 mb-3">設定你的目標</p>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11px] text-slate-500 mb-1">目標體重 (kg)</span>
          <input
            type="number" inputMode="decimal" step="0.1" value={w}
            onChange={e => setW(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] text-slate-500 mb-1">要在什麼時候</span>
          <input
            type="date" value={d}
            onChange={e => setD(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </label>
      </div>

      {preview && <p className="text-[11px] text-slate-500 mt-2 tabular-nums">{preview}</p>}

      {error && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-900 leading-relaxed">{error}</p>
          {suggestion?.targetDate && (
            <button
              type="button"
              onClick={() => save(suggestion.targetDate)}
              disabled={saving}
              className="mt-2 text-xs font-medium text-amber-900 underline underline-offset-2 disabled:opacity-50"
            >
              {suggestion.label}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button" onClick={() => save()} disabled={saving || !w || !d}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {saving ? '存檔中…' : '存起來'}
        </button>
        <button
          type="button" onClick={() => { setOpen(false); setError(null); setSuggestion(null) }}
          className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          取消
        </button>
      </div>

      <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
        改目標不會動到你每天的營養數字 —— 那個由教練設定。目標改了之後，教練會在後台看到。
      </p>
    </div>
  )
}
