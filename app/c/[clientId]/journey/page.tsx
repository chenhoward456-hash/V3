'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Journey } from '@/lib/journey'
import { LINE_OA_ID } from '@/lib/line-links'

// 「你這 N 週」—— 課程結束那一刻拿給學員看的回顧（見 lib/journey.ts 檔頭）。
// 同意 gate 由 app/c/[clientId]/layout.tsx 包住。

const NAVY = '#1E4A73'

function fmtDate(d: string) {
  return `${Number(d.slice(0, 4))}/${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
}
function signed(n: number, digits = 1) {
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}`
}

/** 每週平均體重折線：單一系列、2px 線、首末直接標值、hover 顯示該週 */
function WeightChart({ weekly }: { weekly: NonNullable<Journey['weight']>['weekly'] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 340, H = 180, padL = 8, padR = 44, padT = 18, padB = 34
  const vals = weekly.map(w => w.avg)
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = Math.max(1, max - min)
  const lo = min - span * 0.15, hi = max + span * 0.15
  const x = (i: number) => padL + (weekly.length === 1 ? 0 : (i / (weekly.length - 1)) * (W - padL - padR))
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB)
  const path = weekly.map((w, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(w.avg).toFixed(1)}`).join(' ')
  const grid = [lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75]
  const last = weekly.length - 1
  const h = hover != null ? weekly[hover] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`每週平均體重，從 ${vals[0]} 到 ${vals[last]} 公斤`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={e => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          let best = 0
          weekly.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i })
          setHover(best)
        }}>
        {grid.map(g => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#E2E8F0" strokeWidth={1} />
            <text x={W - padR + 6} y={y(g) + 4} fontSize={10} fill="#94A3B8" className="tabular-nums">{g.toFixed(1)}</text>
          </g>
        ))}
        {h && <line x1={x(hover!)} x2={x(hover!)} y1={padT - 6} y2={H - padB} stroke="#CBD5E1" strokeWidth={1} />}
        <path d={path} fill="none" stroke={NAVY} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {weekly.map((w, i) => (
          <circle key={w.week} cx={x(i)} cy={y(w.avg)} r={hover === i ? 5 : 4} fill={NAVY} stroke="#fff" strokeWidth={2} />
        ))}
        <text x={x(0)} y={y(vals[0]) + (weekly.length > 1 && vals[1] > vals[0] ? 18 : -10)} fontSize={11} fill="#334155" className="tabular-nums">{vals[0]}</text>
        <text x={x(last)} y={y(vals[last]) + (last > 0 && vals[last - 1] > vals[last] ? 18 : -10)} fontSize={11} fill="#0F172A" fontWeight={600} textAnchor="end" className="tabular-nums">{vals[last]}</text>
        <text x={x(0)} y={H - 8} fontSize={10} fill="#94A3B8">第 1 週</text>
        <text x={x(last)} y={H - 8} fontSize={10} fill="#94A3B8" textAnchor="end">第 {weekly[last].week} 週</text>
      </svg>
      {h && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 shadow-sm tabular-nums pointer-events-none">
          第 {h.week} 週（{fmtDate(h.start)} 起）平均 {h.avg} kg・{h.n} 筆
        </div>
      )}
    </div>
  )
}

function JourneyInner() {
  const { clientId } = useParams()
  const search = useSearchParams()
  const [data, setData] = useState<Journey | null>(null)
  const [failed, setFailed] = useState(false)
  const code = String(clientId)

  useEffect(() => {
    const from = search.get('from')
    fetch(`/api/journey?code=${encodeURIComponent(code)}${from ? `&from=${encodeURIComponent(from)}` : ''}`)
      .then(r => r.json())
      .then(j => (j.success ? setData(j.data) : setFailed(true)))
      .catch(() => setFailed(true))
  }, [code, search])

  const lineUrl = useMemo(() => {
    const text = encodeURIComponent('我想聊聊課程結束後的線上調整')
    return `https://line.me/R/oaMessage/${encodeURIComponent(LINE_OA_ID)}/?${text}`
  }, [])

  if (failed) return <div className="min-h-screen bg-slate-50 p-4"><p className="text-slate-600">讀取失敗，請稍後再試。</p></div>
  if (!data) return <div className="min-h-screen bg-slate-50 p-4"><p className="text-slate-400">整理你的資料中…</p></div>

  const L = data.logging
  const logRows = [
    { label: '量體重', value: `${L.weightDays} 天` },
    { label: '記飲食', value: `${L.nutritionDays} 天` },
    { label: '訓練', value: `${L.trainingSessions} 次` },
    { label: '記身體感受', value: `${L.wellnessDays} 天` },
  ]

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="print:hidden">
          <Link href={`/c/${code}`} className="text-sm text-[#1E4A73]">← 回首頁</Link>
        </div>

        <header>
          <p className="text-sm text-slate-500 tabular-nums">{fmtDate(data.from)} – {fmtDate(data.to)}</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{data.name}，你這 {data.weeks} 週</h1>
          <p className="text-sm text-slate-600 mt-2">這一頁只放量得到的東西。全部都是你自己記下來的。</p>
        </header>

        {data.weight && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-slate-900">體重</h2>
            <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">
              {data.weight.startAvg} → {data.weight.endAvg} <span className="text-base font-medium text-slate-500">kg</span>
            </p>
            <p className="text-sm text-slate-600 mt-1 tabular-nums">
              {signed(data.weight.delta)} kg，平均每週 {signed(data.weight.perWeek, 2)} kg
              {data.weight.toGoal != null && Math.abs(data.weight.toGoal) >= 0.3 && `｜離目標還差 ${Math.abs(data.weight.toGoal).toFixed(1)} kg`}
            </p>
            <p className="text-xs text-slate-400 mt-1">用第一週和最後一週的平均比，不用單日，避免水分波動騙人。</p>
            <div className="mt-3"><WeightChart weekly={data.weight.weekly} /></div>
            <details className="mt-2 print:hidden">
              <summary className="text-sm text-slate-500 cursor-pointer py-1">看每週數字</summary>
              <table className="w-full text-sm tabular-nums mt-1">
                <thead><tr className="text-slate-500 text-left"><th className="font-normal py-1">週</th><th className="font-normal">起始日</th><th className="font-normal text-right">平均</th><th className="font-normal text-right">筆數</th></tr></thead>
                <tbody>
                  {data.weight.weekly.map(w => (
                    <tr key={w.week} className="border-t border-slate-100"><td className="py-1">第 {w.week} 週</td><td>{fmtDate(w.start)}</td><td className="text-right">{w.avg} kg</td><td className="text-right text-slate-500">{w.n}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>
        )}

        {data.bodyFat && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-slate-900">體脂</h2>
            <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
              {data.bodyFat.first.value}% → {data.bodyFat.last.value}%
              <span className="text-base font-medium text-slate-500 ml-2">{signed(data.bodyFat.last.value - data.bodyFat.first.value)} 個百分點</span>
            </p>
            <p className="text-xs text-slate-400 mt-1 tabular-nums">{fmtDate(data.bodyFat.first.date)} 與 {fmtDate(data.bodyFat.last.date)} 兩次量測；不同儀器、不同時段量的數字會有落差。</p>
          </section>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-lg font-bold text-slate-900">你記了多少</h2>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {logRows.map(r => (
              <div key={r.label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{r.label}</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{r.value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600 mt-3 tabular-nums">{L.totalDays} 天裡，最長連續 {L.longestStreak} 天有記錄。</p>
        </section>

        {data.strength.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-slate-900">力量</h2>
            {data.strength.map(s => (
              <div key={s.exercise} className="py-2 border-t border-slate-100 first:border-t-0 flex items-baseline justify-between gap-3">
                <span className="text-slate-900">{s.exercise}</span>
                <span className="text-sm text-slate-700 tabular-nums">估計 1RM {s.first} → 最高 {s.best} kg</span>
              </div>
            ))}
            <p className="text-xs text-slate-400 mt-1">1RM＝最多能舉起一次的重量，由你記的重量和次數推算。</p>
          </section>
        )}

        {data.profileEntries.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-slate-900">我們對你的身體多知道了什麼</h2>
            <p className="text-xs text-slate-500 mt-1">公式誰都算得出來，這些只有你的數據才說得出來。</p>
            {data.profileEntries.map(e => (
              <div key={e.key} className="py-2 border-t border-slate-100 first:border-t-0 mt-1">
                <p className="text-sm text-slate-500">{e.label}</p>
                <p className="text-base font-semibold text-slate-900">{e.value}</p>
              </div>
            ))}
          </section>
        )}

        {data.experiments.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-slate-900">你做過的身體實驗</h2>
            {data.experiments.map(e => (
              <div key={e.title} className="py-2 border-t border-slate-100 first:border-t-0">
                <p className="font-medium text-slate-900">{e.title}</p>
                <p className="text-sm text-slate-700 tabular-nums">{e.resultText}</p>
                <p className="text-sm text-slate-500">{e.statusText}</p>
              </div>
            ))}
          </section>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-lg font-bold text-slate-900">接下來</h2>
          <p className="text-sm text-slate-700 mt-2">這些資料會一直留在你的帳號裡，之後記的每一筆都會接著往下算。</p>
          <p className="text-sm text-slate-700 mt-1">如果想要教練繼續每週幫你看數字、調整計畫，傳訊息給 Howard 聊線上調整。</p>
          <div className="flex gap-2 mt-4 print:hidden">
            <a href={lineUrl} className="flex-1 text-center bg-[#1E4A73] hover:bg-[#16385A] text-white rounded-lg py-2.5 font-medium">傳 LINE 給 Howard</a>
            <button onClick={() => window.print()} className="flex-1 border border-slate-200 rounded-lg py-2.5 text-slate-700">存成 PDF</button>
          </div>
        </section>

        <p className="text-xs text-slate-400 text-center pb-4">這是追蹤與教育用途，不是醫療診斷。</p>
      </div>
    </div>
  )
}

export default function JourneyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-4"><p className="text-slate-400">整理你的資料中…</p></div>}>
      <JourneyInner />
    </Suspense>
  )
}
