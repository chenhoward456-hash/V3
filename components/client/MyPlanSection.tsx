'use client'

import { memo, useEffect, useState } from 'react'
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

/** 退場條件是「他看過了」，不是「過了幾天」。
 *
 *  看過的字不該每天佔首頁——但用時間退場會漏掉一件事：教練改了計畫，學員永遠不知道。
 *  所以綁 `rendered_at`（教練每次改寫都會更新）：
 *    · 沒看過 / 教練改過 → 攤開 + 標「有更新」
 *    · 看過這個版本了     → 收成一行，要看再點
 *  存 localStorage（顯示偏好，不是資料，不值得為它打 DB）。 */
const SEEN_KEY = 'plan_seen_rendered_at'

function MyPlanSectionInner({ data }: { data: OnboardingRendered | null }) {
  const sections = data?.sections
  const renderedAt = data?.rendered_at ?? ''
  const [seenAt, setSeenAt] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try { setSeenAt(localStorage.getItem(SEEN_KEY)) } catch { /* 無痕模式等 */ }
    setReady(true)
  }, [])

  // 沒看過，或教練改寫過（rendered_at 比記錄的新）
  const hasUpdate = !seenAt || (!!renderedAt && renderedAt > seenAt)
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)
  const listOpen = manualOpen ?? hasUpdate

  const toggle = () => {
    setManualOpen(!listOpen)
    // 只要他跟這張卡互動過就算看過（初始是展開的，第一下多半是「收起來」，
    // 若只在展開時記，永遠記不到）。下次就收成一行，直到教練再改內容。
    if (renderedAt) {
      try { localStorage.setItem(SEEN_KEY, renderedAt); setSeenAt(renderedAt) } catch { /* ignore */ }
    }
  }

  const [openSlug, setOpenSlug] = useState<string | null>(null)

  if (!sections || sections.length === 0) return null

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-2 text-left"
        aria-expanded={listOpen}
      >
        <h2 className="text-sm font-semibold text-slate-900">我的計畫</h2>
        {ready && hasUpdate && (
          <span className="text-[10px] font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded px-1.5 py-0.5">
            {seenAt ? '教練更新了' : '新的'}
          </span>
        )}
        <span className="ml-auto text-[11px] text-slate-400">{sections.length} 份</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${listOpen ? 'rotate-180' : ''}`} />
      </button>
      {listOpen && <p className="text-[11px] text-slate-400 mb-2 mt-1">菜單、課表、補品、SOP — 點開查看</p>}
      {listOpen && <ul className="divide-y divide-slate-100">
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
      </ul>}
    </section>
  )
}

export default memo(MyPlanSectionInner)
