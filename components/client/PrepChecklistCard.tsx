'use client'

import { useCallback, useEffect, useState } from 'react'
import { getLocalDateStr } from '@/lib/date-utils'
import { selectVisibleItems, type ChecklistItem } from '@/lib/peak-week-checklist'
import { TRIAL_VISUAL_LABEL, type TrialLoad, type TrialVisual } from '@/lib/peak-week-trial'

/**
 * 賽前清單（比賽前 14 天出現在首頁）
 * 只顯示：沒做完的、今天的、下一天要做的——不是整份清單往下滑。
 */

interface ChecklistData {
  competitionDate: string | null
  trial: TrialLoad | null
  items: ChecklistItem[]
  checked: Record<string, unknown>
  trialResult: TrialVisual | null
  suggestedPeak: number | null
}

const fmt = (d: string) => {
  const [, m, dd] = d.split('-')
  return `${parseInt(m)}/${parseInt(dd)}`
}

export default function PrepChecklistCard({ code }: { code: string }) {
  const [data, setData] = useState<ChecklistData | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const today = getLocalDateStr()

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/peak-week-checks?code=${encodeURIComponent(code)}`)
      if (res.ok) setData((await res.json()).data)
    } catch { /* 清單是輔助，失敗就不顯示 */ }
  }, [code])

  useEffect(() => { load() }, [load])

  const save = async (itemKey: string, checked: boolean, visual?: TrialVisual) => {
    setSaving(itemKey)
    // 先樂觀更新，勾選要立刻有反應
    setData(d => {
      if (!d) return d
      const next = { ...d.checked }
      if (checked) next[itemKey] = visual ? { visual } : true
      else delete next[itemKey]
      return { ...d, checked: next, ...(visual ? { trialResult: visual } : {}) }
    })
    try {
      await fetch('/api/peak-week-checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, itemKey, checked, ...(visual ? { visual } : {}) }),
      })
      if (visual) await load() // 試灌結果要拿回伺服器算的峰值建議
    } finally {
      setSaving(null)
    }
  }

  if (!data?.competitionDate || data.items.length === 0) return null

  const checkedSet = new Set(Object.keys(data.checked))
  const { overdue, today: todays, upcoming } = selectVisibleItems(data.items, today, checkedSet)
  if (overdue.length + todays.length + upcoming.length === 0) return null

  // 過期沒做的只列最近 3 項（太晚才開始備賽時，前面的事會一次全部過期，整片清單沒人會看）
  const OVERDUE_CAP = 3
  const overdueShown = overdue.slice(-OVERDUE_CAP)
  const overdueHidden = overdue.length - overdueShown.length

  const renderItem = (item: ChecklistItem, muted = false) => {
    const isOverdue = item.date < today
    const done = checkedSet.has(item.key)

    if (item.kind === 'trial_result') {
      return (
        <li key={item.key} className="py-3 border-t border-slate-100 first:border-0">
          <p className="text-sm text-slate-900 font-medium">{item.title}</p>
          {item.detail && <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>}
          <div className="flex gap-1.5 mt-2">
            {(['flat', 'full_hard', 'spilled'] as const).map(v => (
              <button
                key={v}
                disabled={muted || saving === item.key}
                onClick={() => save(item.key, true, v)}
                className={`flex-1 py-2 rounded-lg text-xs transition-colors disabled:opacity-50 ${
                  data.trialResult === v
                    ? 'bg-primary-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {TRIAL_VISUAL_LABEL[v]}
              </button>
            ))}
          </div>
          {data.trialResult && data.suggestedPeak != null && (
            <p className="text-xs text-slate-600 mt-2">
              正式峰值建議 <strong className="tabular-nums text-slate-900">{data.suggestedPeak}g</strong>
              {data.trial ? <span className="tabular-nums">（試灌 {data.trial.carbs}g）</span> : null}，教練會確認後排進 peak week。
            </p>
          )}
        </li>
      )
    }

    return (
      <li key={item.key} className="py-3 border-t border-slate-100 first:border-0">
        <label className={`flex gap-3 items-start ${muted ? '' : 'cursor-pointer'}`}>
          {!muted && (
            <input
              type="checkbox"
              checked={done}
              disabled={saving === item.key}
              onChange={e => save(item.key, e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
          )}
          <span className="flex-1">
            <span className={`text-sm ${done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
              {(isOverdue || item.slot !== '今天') && (
                <span className="text-xs text-slate-400 mr-1.5 tabular-nums">{isOverdue ? fmt(item.date) : item.slot}</span>
              )}
              {item.title}
            </span>
            {item.detail && !done && <span className="block text-xs text-slate-500 mt-0.5">{item.detail}</span>}
          </span>
        </label>
      </li>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-base font-semibold text-slate-900">賽前清單</h3>
        <span className="text-xs text-slate-400 tabular-nums">比賽 {fmt(data.competitionDate)}</span>
      </div>

      {overdue.length > 0 && (
        <>
          <p className="text-xs font-medium text-amber-700 mt-3">還沒做</p>
          <ul>{overdueShown.map(i => renderItem(i))}</ul>
          {overdueHidden > 0 && <p className="text-xs text-slate-400 pt-1">還有 {overdueHidden} 項更早的沒勾</p>}
        </>
      )}
      {todays.length > 0 && (
        <>
          <p className="text-xs font-medium text-slate-600 mt-3">今天</p>
          <ul>{todays.map(i => renderItem(i))}</ul>
        </>
      )}
      {upcoming.length > 0 && (
        <>
          <p className="text-xs font-medium text-slate-400 mt-3">{fmt(upcoming[0].date)} 要做</p>
          <ul className="opacity-70">{upcoming.map(i => renderItem(i, true))}</ul>
        </>
      )}
    </div>
  )
}
