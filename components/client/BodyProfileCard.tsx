'use client'

import { memo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * 身體檔案 — 這個人的身體「已經被他自己的資料驗證過」的事實。
 *
 * 跟引擎建議的分界：引擎算的是公式（誰都算得出來），這裡放的是實測（只有時間買得到）。
 * 所以每一條都攤出 evidence / sample / confidence，讓學員自己判斷可信度——
 * 沒有證據的條目不該出現在這張卡上。
 *
 * 資料來源 clients.body_profile（教練端寫入，刻意不自動餵回引擎公式）。
 */

interface ProfileEntry {
  key: string
  label: string
  value: string
  detail?: string | null
  evidence?: string | null
  sample?: string | null
  confidence?: 'high' | 'medium' | 'low' | null
  caveat?: string | null
  measured_on?: string | null
}

export interface BodyProfile {
  updated_at?: string
  entries?: ProfileEntry[]
  gaps?: string[]
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: '證據充分',
  medium: '參考',
  low: '初步',
}

function BodyProfileCardInner({ data }: { data: BodyProfile | null }) {
  const entries = data?.entries
  const [openKey, setOpenKey] = useState<string | null>(null)

  if (!entries || entries.length === 0) return null

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-semibold text-slate-900">你的身體檔案</h2>
        <span className="ml-auto text-[11px] text-slate-400">{entries.length} 條已驗證</span>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        全部由你自己的紀錄算出來，不是公式估的 — 點開看依據
      </p>

      <ul className="divide-y divide-slate-100">
        {entries.map((e) => {
          const isOpen = openKey === e.key
          return (
            <li key={e.key}>
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : e.key)}
                className="w-full flex items-start gap-2 py-3 text-left"
                aria-expanded={isOpen}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-xs text-slate-500">{e.label}</span>
                  <span className="block text-sm font-semibold text-slate-900 mt-0.5 tabular-nums">{e.value}</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="pb-3 space-y-2">
                  {e.detail && (
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{e.detail}</p>
                  )}
                  {e.evidence && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-slate-400 mb-0.5">依據</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{e.evidence}</p>
                    </div>
                  )}
                  {e.caveat && (
                    <p className="text-[11px] text-slate-500 leading-relaxed">※ {e.caveat}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                    {e.sample && <span>樣本 {e.sample}</span>}
                    {e.confidence && <span>{CONFIDENCE_LABEL[e.confidence] ?? e.confidence}</span>}
                    {e.measured_on && <span>算於 {e.measured_on}</span>}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {data?.gaps && data.gaps.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 mb-1.5">還說不出來的（資料不夠）</p>
          <ul className="space-y-1">
            {data.gaps.map((g, i) => (
              <li key={i} className="text-[11px] text-slate-500 leading-relaxed">・{g}</li>
            ))}
          </ul>
        </div>
      )}

      {data?.updated_at && (
        <p className="mt-3 text-[10px] text-slate-400">更新於 {data.updated_at}</p>
      )}
    </section>
  )
}

export default memo(BodyProfileCardInner)
