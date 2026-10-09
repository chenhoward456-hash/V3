'use client'

import { useEffect, useState } from 'react'
import type { HorsemanView, MarkerStory, LabHypothesis, HypothesisGrade, LabPoint } from '@/lib/longevity-lens'

/**
 * 「健康」分頁的主角：你的身體有沒有照預測走。
 *
 * 2026-10-09 Howard：「系統看起來就沒有很爽。」
 * 健康分頁什麼都用同一個音量講；真正「贏了」的那一刻——3 月寫下預測、9/30 驗出來猜對——
 * 原本只是顧問卡裡第 5 段的一行小字。這張卡只講三件事：預測成績、一張主角圖、一句話。
 * 數字全部照 /api/longevity 給的，不在這裡另算判定。
 */

type Hyp = LabHypothesis & { grade: HypothesisGrade }
interface Data { today: string; groups: HorsemanView[]; hypotheses: Hyp[] }

const GRADED = new Set(['confirmed', 'partial', 'no_change', 'refuted'])
const VERDICT: Record<string, string> = {
  confirmed: '猜對了', partial: '方向對，還沒到目標', no_change: '還沒看到明顯變化', refuted: '跟預期相反',
}
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString())

/** 折線＋目標線。點少（2–6 個）所以不用圖表庫，手畫 SVG 才能把「目標線」和「猜中的那一點」做成主角 */
function WinChart({ points, target, unit, win = false }: { points: LabPoint[]; target: number | null; unit: string; win?: boolean }) {
  // 猜中那一點用綠色＝「贏了」的訊號；不是猜中（例如只是真的變好）就維持主色
  const hit = win ? '#059669' : '#1E4A73'
  const W = 360, H = 210, padX = 28, padTop = 36, padBottom = 32
  const vals = points.map(p => p.value).concat(target != null ? [target] : [])
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const span = hi - lo || 1
  const x = (i: number) => padX + (points.length === 1 ? (W - 2 * padX) / 2 : (i * (W - 2 * padX)) / (points.length - 1))
  const y = (v: number) => padTop + (1 - (v - lo) / span) * (H - padTop - padBottom)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points.length - 1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[520px] h-auto" role="img" aria-label={`歷次數值：${points.map(p => fmt(p.value)).join('、')}${unit ? ` ${unit}` : ''}`}>
      {target != null && (
        <g>
          <line x1={padX} x2={W - padX} y1={y(target)} y2={y(target)} stroke="#1E4A73" strokeOpacity="0.65" strokeDasharray="5 5" />
        </g>
      )}
      <line x1={padX} x2={W - padX} y1={H - padBottom} y2={H - padBottom} stroke="#e2e8f0" />
      <path d={path} fill="none" stroke="#1E4A73" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.date}>
          {i === last && <circle cx={x(i)} cy={y(p.value)} r={10} fill={win ? '#d1fae5' : 'white'} stroke={hit} strokeWidth="1.5" />}
          <circle cx={x(i)} cy={y(p.value)} r={i === last ? 5 : 3.5} fill={i === last ? hit : '#1E4A73'} />
          <text x={x(i)} y={H - 9} textAnchor="middle" fontSize="14" fill="#64748b">{
            // 跨年才標年份（8/13 其實是去年）：第一點、或跟前一點不同年
            i === 0 || p.date.slice(0, 4) !== points[i - 1].date.slice(0, 4) ? `${p.date.slice(2, 4)}/${md(p.date)}` : md(p.date)
          }</text>
          <text x={x(i)} y={y(p.value) - (i === last ? 17 : 12)} textAnchor="middle" fontSize={i === last ? 18 : 15} fontWeight={i === last ? 700 : 500}
            fill={i === last ? (win ? '#047857' : '#0f172a') : '#475569'} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.value)}</text>
        </g>
      ))}
    </svg>
  )
}

export default function HealthWinHero({ code }: { code: string }) {
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => {
    fetch(`/api/longevity?code=${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data) })
      .catch(() => {})
  }, [code])
  if (!data) return null

  const stories = new Map<string, MarkerStory>()
  for (const g of data.groups) for (const s of g.stories) stories.set(s.name, s)

  const graded = data.hypotheses.filter(h => GRADED.has(h.grade.status) && h.grade.result)
  const hits = graded.filter(h => h.grade.status === 'confirmed')
  const waiting = data.hypotheses.filter(h => h.grade.status === 'pending' || h.grade.status === 'overdue')
  const nextDate = waiting.map(h => h.retest_by).filter(Boolean).sort()[0] ?? null

  // 主角：最近對完答案的那題（猜對的優先）；沒有就用最近一次「真的變好」的指標
  const byResultDate = (a: Hyp, b: Hyp) => b.grade.result!.date.localeCompare(a.grade.result!.date)
  const heroHyp = [...hits].sort(byResultDate)[0] ?? [...graded].sort(byResultDate)[0] ?? null
  const fallback = heroHyp ? null : [...stories.values()]
    .filter(s => s.direction === 'better' && s.change && s.change.verdict !== 'noise')
    .sort((a, b) => (b.latest?.date ?? '').localeCompare(a.latest?.date ?? ''))[0] ?? null
  const story = heroHyp ? stories.get(heroHyp.marker) ?? null : fallback
  if (!story || story.points.length < 2) return null

  const unit = story.latest?.unit ?? ''
  const sentence = heroHyp
    ? `${md(heroHyp.baseline_date)} 預測${heroHyp.marker}${heroHyp.expected_direction === 'down' ? '降到' : heroHyp.expected_direction === 'up' ? '回到' : '維持在'}${heroHyp.expected_value != null ? ` ${heroHyp.expected_direction === 'down' ? '≤' : '≥'}${fmt(heroHyp.expected_value)}` : ''}，${md(heroHyp.grade.result!.date)} 驗出 ${fmt(heroHyp.grade.result!.value)}——${VERDICT[heroHyp.grade.status]}`
    : `${story.name} ${fmt(story.change!.from.value)} → ${fmt(story.change!.to.value)}，超過你自己的正常波動，是真的變好`

  return (
    <section className="mb-4 overflow-hidden rounded-2xl bg-slate-950 text-white">
      <div className="px-6 pb-6 pt-6">
        <p className="text-xs font-medium tracking-wide text-slate-400">你的身體有沒有照預測走</p>
        <div className="mt-5 flex items-end gap-5">
          <div className="min-w-0 flex-1">
            {graded.length > 0 ? (
              <>
                <p className="flex flex-wrap items-baseline gap-2 font-semibold tabular-nums leading-none" style={{ fontFamily: 'var(--font-inter), var(--font-noto-sans-tc), sans-serif' }}>
                  <span className="text-[4.5rem] tracking-[-0.065em] sm:text-[5.5rem]">{hits.length}</span>
                  <span className="text-[1.75rem] font-normal tracking-tight text-slate-500"> / {graded.length}</span>
                </p>
                <p className="mt-3 flex items-center gap-2 text-sm text-slate-200">
                  {hits.length > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />}
                  預測猜對
                </p>
              </>
            ) : (
              <p className="text-2xl font-semibold leading-snug">{story.name} 真的變好了</p>
            )}
          </div>
          {waiting.length > 0 && (
            <p className="w-[46%] shrink-0 border-l border-white/15 pl-5 text-xs leading-relaxed text-slate-400 tabular-nums">
              <span className="block">還有 <span className="text-base font-semibold text-slate-200">{waiting.length}</span> 題等</span>
              <span className="my-1 block font-medium text-slate-200">{nextDate ? ` ${nextDate} ` : '下次'}</span>
              <span className="block">抽血對答案</span>
            </p>
          )}
        </div>
      </div>

      <div className="bg-white px-5 pb-3 pt-5 text-slate-900">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold">
            {story.name}<span className="text-xs font-normal text-slate-500">{unit ? `（${unit}）` : ''}</span>
          </p>
          {heroHyp?.expected_value != null && (
            <span className="text-xs font-medium text-primary-600">- - 目標 {heroHyp.expected_direction === 'down' ? '≤' : '≥'}{fmt(heroHyp.expected_value)}</span>
          )}
        </div>
        <WinChart points={story.points} target={heroHyp?.expected_value ?? null} unit={unit} win={heroHyp?.grade.status === 'confirmed'} />
      </div>

      <p className="px-6 py-5 text-sm leading-relaxed text-slate-200">{sentence}</p>
    </section>
  )
}
