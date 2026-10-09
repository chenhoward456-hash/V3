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
function WinChart({ points, target, unit }: { points: LabPoint[]; target: number | null; unit: string }) {
  const W = 320, H = 150, padX = 18, padTop = 26, padBottom = 30
  const vals = points.map(p => p.value).concat(target != null ? [target] : [])
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const span = hi - lo || 1
  const x = (i: number) => padX + (points.length === 1 ? (W - 2 * padX) / 2 : (i * (W - 2 * padX)) / (points.length - 1))
  const y = (v: number) => padTop + (1 - (v - lo) / span) * (H - padTop - padBottom)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points.length - 1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`歷次數值：${points.map(p => fmt(p.value)).join('、')}${unit ? ` ${unit}` : ''}`}>
      {target != null && (
        <g>
          <line x1={padX} x2={W - padX} y1={y(target)} y2={y(target)} stroke="rgba(52,211,153,0.6)" strokeDasharray="4 4" />
        </g>
      )}
      <path d={path} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.date}>
          <circle cx={x(i)} cy={y(p.value)} r={i === last ? 5.5 : 3} fill={i === last ? '#34d399' : '#fff'} />
          <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)">{
            // 跨年才標年份（8/13 其實是去年）：第一點、或跟前一點不同年
            i === 0 || p.date.slice(0, 4) !== points[i - 1].date.slice(0, 4) ? `${p.date.slice(2, 4)}/${md(p.date)}` : md(p.date)
          }</text>
          <text x={x(i)} y={y(p.value) - 9} textAnchor="middle" fontSize={i === last ? 12 : 10} fontWeight={i === last ? 700 : 400}
            fill={i === last ? '#fff' : 'rgba(255,255,255,0.6)'} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.value)}</text>
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
      <div className="px-5 pt-5">
        <p className="text-xs font-medium tracking-wide text-slate-400">你的身體有沒有照預測走</p>
        {graded.length > 0 ? (
          <div className="mt-2 flex items-end gap-3">
            <p className="text-5xl font-semibold tabular-nums leading-none">
              {hits.length}<span className="text-2xl text-slate-500"> / {graded.length}</span>
            </p>
            <p className="pb-1 text-sm text-slate-300">預測猜對</p>
          </div>
        ) : (
          <p className="mt-2 text-2xl font-semibold">{story.name} 真的變好了</p>
        )}
        {waiting.length > 0 && (
          <p className="mt-2 text-xs text-slate-400 tabular-nums">還有 {waiting.length} 題等{nextDate ? ` ${nextDate} ` : '下次'}抽血對答案</p>
        )}
      </div>

      <div className="mt-4 px-3">
        <p className="px-2 text-xs text-slate-400">
          {story.name}{unit ? `（${unit}）` : ''}
          {heroHyp?.expected_value != null && <span className="ml-2 text-emerald-300/80">- - 目標 {heroHyp.expected_direction === 'down' ? '≤' : '≥'}{fmt(heroHyp.expected_value)}</span>}
        </p>
        <WinChart points={story.points} target={heroHyp?.expected_value ?? null} unit={unit} />
      </div>

      <p className="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-slate-200">{sentence}</p>
    </section>
  )
}
