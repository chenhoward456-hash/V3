'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'
import { computeSleepRegularity, type DayEntry } from '@/lib/sleep-regularity'

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const

const EMPTY: DayEntry[] = DAY_LABELS.map(() => ({ bed: '', wake: '' }))

const CHECKLIST = [
  { title: '固定起床時間', body: '平日假日差在 1 小時內。這條做到就贏一半。' },
  { title: '起床後出門走一走', body: '1 小時內曬到光。時機比亮度重要。' },
  { title: '咖啡因設一條截止線', body: '下午 2 點後不喝，代謝慢的人再往前抓。' },
  { title: '睡前 3 小時不吃大餐', body: '夜間訓練後只補好消化的蛋白質＋碳水。' },
  { title: '週末別補超過 1 小時', body: '想補就白天小睡 20 分鐘，別動起床時間。' },
]

const CITATIONS = [
  {
    text: '作息規律比睡眠時數更能預測死亡風險（60,977 人，配戴式裝置實測）',
    cite: 'Windred et al., Sleep (2024) · PMID: 37738616',
    href: 'https://pubmed.ncbi.nlm.nih.gov/37738616/',
  },
  {
    text: '作息最不規律者心血管事件風險較高；睡足時數也無法完全抵銷（72,269 人）',
    cite: 'Chaput et al., J Epidemiol Community Health (2025) · PMID: 39603689',
    href: 'https://pubmed.ncbi.nlm.nih.gov/39603689/',
  },
  {
    text: '睡眠時數與死亡風險呈 U 型，最低點約 7 小時',
    cite: 'Yin et al., J Am Heart Assoc (2017) · PMID: 28889101',
    href: 'https://pubmed.ncbi.nlm.nih.gov/28889101/',
  },
]

const LEVEL_STYLE: Record<string, { pill: string; dot: string; label: string }> = {
  steady: { pill: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-600', label: '穩定' },
  drifting: { pill: 'bg-amber-50 text-amber-700', dot: 'bg-amber-600', label: '有點漂' },
  chaotic: { pill: 'bg-rose-50 text-rose-700', dot: 'bg-rose-600', label: '很亂' },
  insufficient: { pill: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', label: '資料不足' },
}

export default function SleepRegularityPage() {
  const [days, setDays] = useState<DayEntry[]>(EMPTY)
  const [showResult, setShowResult] = useState(false)

  const result = useMemo(() => computeSleepRegularity(days), [days])

  const setField = useCallback((idx: number, key: keyof DayEntry, value: string) => {
    setDays(prev => prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d)))
  }, [])

  // 便利：把週一填的時間套到週二~週五（多數人平日一樣）
  const copyWeekdays = useCallback(() => {
    setDays(prev => {
      const mon = prev[0]
      if (!mon.bed && !mon.wake) return prev
      return prev.map((d, i) => (i >= 1 && i <= 4 ? { ...mon } : d))
    })
    trackEvent('sleep_tool_copy_weekdays')
  }, [])

  const handleCalculate = useCallback(() => {
    setShowResult(true)
    trackEvent('sleep_tool_calculate', { days_filled: result.daysFilled, level: result.level })
    requestAnimationFrame(() => {
      document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [result.daysFilled, result.level])

  const handleReset = useCallback(() => {
    setDays(EMPTY)
    setShowResult(false)
  }, [])

  const style = LEVEL_STYLE[result.level]

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-2xl mx-auto px-5 py-12 md:py-16">
        {/* Hero */}
        <header className="mb-8">
          <p className="text-sm font-semibold text-primary-600 mb-3">免費工具 · 睡眠</p>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-snug mb-4">
            你這週的起床時間，
            <br />
            漂了幾小時？
          </h1>
          <p className="text-slate-600 leading-relaxed">
            預測健康結果時，作息規律比睡眠時數更關鍵。填入這週的上床與起床時間，看看你的漂移有多大。
          </p>
          <p className="mt-4 text-xs text-slate-500 leading-relaxed">
            這頁不會傳送或儲存你的任何資料——全部在你的瀏覽器裡算完。重新整理就消失。
          </p>
        </header>

        {/* 輸入表 */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">這週的作息</h2>
            <button
              type="button"
              onClick={copyWeekdays}
              className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              平日都一樣？套用週一
            </button>
          </div>

          <div className="grid grid-cols-[2rem_1fr_1fr] gap-x-3 gap-y-2 items-center">
            <span />
            <span className="text-xs font-medium text-slate-500">上床時間</span>
            <span className="text-xs font-medium text-slate-500">起床時間</span>

            {DAY_LABELS.map((label, i) => (
              <TimeRow
                key={label}
                label={label}
                entry={days[i]}
                onChange={(key, value) => setField(i, key, value)}
              />
            ))}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            估到最接近的 15 分鐘就夠了。想不起來的日子可以空著（至少填 3 天）。
          </p>
        </section>

        <div className="flex gap-3 mb-10">
          <button
            type="button"
            onClick={handleCalculate}
            className="flex-1 bg-primary-600 hover:bg-primary-700 transition-colors text-white font-bold px-6 py-3.5 rounded-xl"
          >
            算我的漂移
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-white transition-colors"
          >
            清空
          </button>
        </div>

        {/* 結果。scroll-mt-24 是因為站上 Navigation 為 sticky（約 77px 高），留白不足會蓋住結果標題 */}
        {showResult && (
          <section id="result" className="bg-white border border-slate-200 rounded-2xl p-5 mb-10 scroll-mt-24">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${style.dot}`} aria-hidden />
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${style.pill}`}>{style.label}</span>
              <span className="text-xs text-slate-400 ml-auto">已填 {result.daysFilled} 天</span>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-3 tabular-nums">{result.headline}</h2>
            <p className="text-slate-600 leading-relaxed mb-5">{result.detail}</p>

            {result.driftHours != null && (
              <dl className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                <Stat label="起床漂移" value={result.wakeDriftHours} unit="小時" />
                <Stat label="上床漂移" value={result.bedDriftHours} unit="小時" />
                <Stat label="平均睡眠" value={result.avgSleepHours} unit="小時" />
              </dl>
            )}

            <p className="mt-5 text-xs text-slate-500 leading-relaxed">
              這是你自己填的時間的全距，用來對照，不是醫療評估，也不是對你個人的健康預測。
            </p>
          </section>
        )}

        {/* 檢查表 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">把作息變規律的 5 件事</h2>
          <ol className="space-y-3">
            {CHECKLIST.map((item, i) => (
              <li key={item.title} className="bg-white border border-slate-200 rounded-2xl p-5 flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full border border-primary-600 bg-primary-50 text-primary-600 font-bold text-sm flex items-center justify-center tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 研究出處 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">這些說法的出處</h2>
          <ul className="space-y-3">
            {CITATIONS.map(c => (
              <li key={c.cite} className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-sm text-slate-700 leading-relaxed mb-2">{c.text}</p>
                <a
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
                >
                  {c.cite} ↗
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500 leading-relaxed">
            以上數字描述的是研究族群的統計結果，不是對任何個人的預測。我是 CSCS 肌力與體能訓練專家，不是醫師；
            這頁是我的整理與研究分享，不是診斷。睡眠長期出狀況，請找專業醫療人員。
          </p>
        </section>

        {/* CTA */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">想知道你的身體其他數據怎麼說？</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-5">
            睡眠只是其中一塊。免費體驗一次系統分析，看看訓練、營養、體組成怎麼互相牽動。
          </p>
          <Link
            href="/diagnosis"
            onClick={() => trackEvent('cta_click', { source: 'tools_sleep', destination: 'diagnosis' })}
            className="inline-block bg-primary-600 hover:bg-primary-700 transition-colors text-white font-bold px-8 py-4 rounded-xl"
          >
            免費體驗系統分析
          </Link>
        </section>
      </div>
    </div>
  )
}

function TimeRow({
  label,
  entry,
  onChange,
}: {
  label: string
  entry: DayEntry
  onChange: (key: keyof DayEntry, value: string) => void
}) {
  const cls =
    'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent bg-white'
  return (
    <>
      <span className="text-sm font-medium text-slate-600 text-center">{label}</span>
      <input
        type="time"
        aria-label={`星期${label} 上床時間`}
        value={entry.bed}
        onChange={e => onChange('bed', e.target.value)}
        className={cls}
      />
      <input
        type="time"
        aria-label={`星期${label} 起床時間`}
        value={entry.wake}
        onChange={e => onChange('wake', e.target.value)}
        className={cls}
      />
    </>
  )
}

function Stat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 mb-1">{label}</dt>
      <dd className="text-lg font-bold text-slate-900 tabular-nums">
        {value == null ? '—' : value}
        <span className="text-xs font-normal text-slate-500 ml-1">{unit}</span>
      </dd>
    </div>
  )
}
