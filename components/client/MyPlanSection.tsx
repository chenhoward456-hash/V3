'use client'

import { memo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * 我的計畫（reference 層）— 把 onboarding 產生的靜態參考（菜單／課表／補品／SOP）收在一處。
 * 預設收合，只列標題；點開才看內容 → 不佔動態儀表板的版面（跟「當週任務」的動態層分開）。
 * 資料來源 clients.onboarding_notes_rendered（push-onboarding 渲染的個人化版本快照）。
 */

interface PlanSection {
  slug: string
  title: string
  body: string
}

export interface OnboardingRendered {
  sections?: PlanSection[]
  rendered_at?: string
  template_id?: string
}

function MyPlanSectionInner({ data }: { data: OnboardingRendered | null }) {
  const sections = data?.sections
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  if (!sections || sections.length === 0) return null

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-semibold text-slate-900">我的計畫</h2>
        <span className="ml-auto text-[11px] text-slate-400">{sections.length} 份</span>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">菜單、課表、補品、SOP — 點開查看</p>
      <ul className="divide-y divide-slate-100">
        {sections.map((s) => {
          const isOpen = openSlug === s.slug
          return (
            <li key={s.slug}>
              <button
                type="button"
                onClick={() => setOpenSlug(isOpen ? null : s.slug)}
                className="w-full flex items-center gap-2 py-2.5 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-sm text-slate-800 flex-1 min-w-0 truncate">{s.title}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-600 leading-relaxed pb-3">{s.body}</pre>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default memo(MyPlanSectionInner)
