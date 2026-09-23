'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { HorsemanView, MarkerStory, StrengthPoint } from '@/lib/longevity-lens'

interface LongevityData {
  client: { name: string; gender: string | null; nextCheckupDate: string | null }
  today: string
  horsemen: HorsemanView[]
  strength: StrengthPoint[]
  unmapped: string[]
}

const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : String(Math.round(n * 100) / 100))

function freshnessLine(s: MarkerStory): { text: string; tone: 'ok' | 'warn' | 'muted' } {
  switch (s.freshness) {
    case 'good_hold': return { text: '上次數字很好，之後體重沒大變 → 不用花錢重測', tone: 'ok' }
    case 'once_ok': return { text: '主要由基因決定，一生測一次，已完成', tone: 'ok' }
    case 'changed': return { text: `上次很好，但之後體重變了 ${s.weightChangeSincePct?.toFixed(1)}% → 那個數字不一定代表現在，值得補一個點`, tone: 'warn' }
    // 橘色只給核心指標；非核心太久沒測用灰色，不催（Howard：好的數字不必一直花錢買）
    case 'stale': return { text: `已 ${s.daysSinceLast} 天沒測（建議 ${s.retestBy} 前）`, tone: s.spec.core ? 'warn' : 'muted' }
    case 'single': return { text: `只有一個點，還看不出趨勢（下次 ${s.retestBy} 前）`, tone: 'muted' }
    case 'fresh': return { text: `下次 ${s.retestBy} 前`, tone: 'muted' }
    default: return { text: '', tone: 'muted' }
  }
}

function changeLine(s: MarkerStory): string | null {
  const c = s.change
  if (!c) return null
  const pct = `${c.pctChange > 0 ? '+' : ''}${c.pctChange.toFixed(0)}%`
  const band = `正常波動約 ±${c.rcvPct.toFixed(0)}%`
  if (c.verdict === 'noise') return `${pct}，在${band}內 → 當作沒變`
  const still = s.optimalNow ? '，但仍在很好的範圍' : ''
  return `${pct}，超過${band} → 不是測量誤差，身體真的在變${still}`
}

function contextLine(s: MarkerStory): string | null {
  const x = s.context
  if (!x || !s.change) return null
  const parts: string[] = []
  if (x.avgCalories != null) parts.push(`平均每天 ${x.avgCalories.toLocaleString()} 大卡（記了 ${x.calorieDays} 天）`)
  if (x.weightStart != null && x.weightEnd != null) {
    const rate = x.weightRatePerWeek != null ? `，${x.weightRatePerWeek > 0 ? '+' : ''}${x.weightRatePerWeek.toFixed(2)} kg/週` : ''
    parts.push(`體重 ${x.weightStart} → ${x.weightEnd} kg${rate}`)
  }
  if (x.impliedDailyBalance != null && Math.abs(x.impliedDailyBalance) >= 100) {
    parts.push(`從體重反推每天約${x.impliedDailyBalance < 0 ? '少' : '多'}吃 ${Math.abs(x.impliedDailyBalance)} 大卡`)
  }
  if (x.trainingPerWeek != null) parts.push(`每週練 ${x.trainingPerWeek} 次`)
  if (x.avgSleepQuality != null) parts.push(`睡眠品質 ${x.avgSleepQuality}/5`)
  if (parts.length === 0) return `這 ${x.days} 天幾乎沒有日常紀錄，說不出原因`
  return `這 ${x.days} 天：${parts.join('、')}`
}

function StoryRow({ s }: { s: MarkerStory }) {
  const unit = s.latest?.unit ? ` ${s.latest.unit}` : ''
  const f = freshnessLine(s)
  const change = changeLine(s)
  const ctx = contextLine(s)
  const real = s.change && s.change.verdict !== 'noise'
  return (
    <div className="py-3 border-t border-slate-100 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-slate-900">{s.name}</span>
        <span className="text-sm text-slate-600 tabular-nums text-right">
          {s.points.map(p => fmt(p.value)).join(' → ')}{unit}
        </span>
      </div>
      <div className="text-xs text-slate-400 tabular-nums mt-0.5">{s.points.map(p => p.date).join('、')}</div>
      {change && <p className={`text-sm mt-1.5 ${real ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>{change}</p>}
      {ctx && real && <p className="text-sm text-slate-600 mt-1">{ctx}</p>}
      {f.text && (
        <p className={`text-xs mt-1.5 ${f.tone === 'warn' ? 'text-amber-700' : f.tone === 'ok' ? 'text-emerald-700' : 'text-slate-500'}`}>{f.text}</p>
      )}
    </div>
  )
}

function StrengthCard({ points }: { points: StrengthPoint[] }) {
  const byEx = new Map<string, StrengthPoint[]>()
  for (const p of points) byEx.set(p.exercise, [...(byEx.get(p.exercise) ?? []), p])
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="text-lg font-bold text-slate-900">身體能力</h2>
      <p className="text-xs text-slate-500 mt-1">肌力和心肺本身就是預測壽命的指標，份量不輸血檢。</p>
      {byEx.size === 0 && <p className="text-sm text-slate-600 mt-3">還沒有主項的重量紀錄。</p>}
      {[...byEx.entries()].map(([ex, pts]) => {
        const first = pts[0], last = pts[pts.length - 1], peak = pts.reduce((a, b) => (b.e1rm > a.e1rm ? b : a))
        return (
          <div key={ex} className="py-3 border-t border-slate-100 first:border-t-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold text-slate-900">{ex}</span>
              <span className="text-sm text-slate-600 tabular-nums">估計 1RM {first.e1rm} → {last.e1rm} kg</span>
            </div>
            <p className="text-xs text-slate-400 tabular-nums mt-0.5">{first.month} → {last.month}；最高 {peak.e1rm} kg（{peak.month}）</p>
          </div>
        )
      })}
      <p className="text-xs text-amber-700 mt-3">心肺（最大攝氧量 VO2max）還沒有資料。</p>
    </section>
  )
}

export default function LongevityPage() {
  const { clientId } = useParams()
  const [data, setData] = useState<LongevityData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/longevity?clientId=${encodeURIComponent(String(clientId))}`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`)
        setData(j.data)
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [clientId])

  if (error) return <main className="min-h-screen bg-slate-50 p-4"><p className="text-red-700">載入失敗：{error}</p></main>
  if (!data) return <main className="min-h-screen bg-slate-50 p-4"><p className="text-slate-500">載入中…</p></main>

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div>
          <Link href={`/admin/clients/${clientId}`} className="text-sm text-[#1E4A73]">← 回學員頁</Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">{data.client.name}｜長壽透鏡</h1>
          <p className="text-sm text-slate-600 mt-1">血檢照「在防哪一類病」排。每個變化先判斷是真的還是誤差，再對上那段期間做了什麼。</p>
          <p className="text-xs text-slate-400 mt-1">教練預覽版；判斷真假用的「正常波動」是文獻近似值。</p>
        </div>

        {data.horsemen.map(h => (
          <section key={h.key} className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-slate-900">{h.label}</h2>
            <p className="text-xs text-slate-500 mt-1">{h.why}</p>
            {h.blindSpots.length > 0 && (
              <ul className="mt-3 space-y-1">
                {h.blindSpots.map(b => <li key={b} className="text-sm text-amber-700">・{b}</li>)}
              </ul>
            )}
            {h.stories.length === 0 && h.blindSpots.length === 0 && (
              <p className="text-sm text-slate-600 mt-3">{h.key === 'cancer' ? '血檢看不到，靠定期篩檢（不在 V3 裡）。' : '這一區還沒有資料。'}</p>
            )}
            <div className="mt-2">{h.stories.map(s => <StoryRow key={s.name} s={s} />)}</div>
          </section>
        ))}

        <StrengthCard points={data.strength} />

        {data.unmapped.length > 0 && (
          <p className="text-xs text-slate-400">還沒分類的指標：{data.unmapped.join('、')}</p>
        )}
      </div>
    </main>
  )
}
