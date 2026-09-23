'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { HorsemanView, MarkerStory, StrengthPoint, LabHypothesis, HypothesisGrade } from '@/lib/longevity-lens'

interface LongevityData {
  client: { name: string; gender: string | null; nextCheckupDate: string | null }
  today: string
  horsemen: HorsemanView[]
  strength: StrengthPoint[]
  unmapped: string[]
  clientId: string
  hypotheses: (LabHypothesis & { grade: HypothesisGrade })[]
}

type GradedHypothesis = LongevityData['hypotheses'][number]

const GRADE_TEXT: Record<HypothesisGrade['status'], { text: string; cls: string }> = {
  pending: { text: '等重測', cls: 'text-slate-500' },
  overdue: { text: '過了重測日還沒測', cls: 'text-amber-700' },
  confirmed: { text: '猜對了：方向對、也到目標', cls: 'text-emerald-700' },
  partial: { text: '方向對，但還沒到目標', cls: 'text-amber-700' },
  no_change: { text: '沒有變（在正常波動內）→ 這個行動不夠，或原因不是這個', cls: 'text-slate-700' },
  refuted: { text: '猜錯了：往反方向走 → 換方向找原因', cls: 'text-red-700' },
}

function HypothesisRow({ h, onDelete }: { h: GradedHypothesis; onDelete: (id: string) => void }) {
  const g = GRADE_TEXT[h.grade.status]
  const arrow = h.expected_direction === 'up' ? '↑' : h.expected_direction === 'down' ? '↓' : '持平'
  const target = h.expected_value != null ? `${h.expected_direction === 'down' ? '≤' : '≥'} ${h.expected_value}` : ''
  return (
    <div className="mt-2 rounded-xl border border-slate-200 p-3 text-sm">
      <div className="flex justify-between gap-2">
        <span className="font-medium text-slate-900">預測：{arrow} {target}<span className="text-slate-400 font-normal">（從 {h.baseline_date} 的 {h.baseline_value} 起算）</span></span>
        <button onClick={() => onDelete(h.id)} className="text-xs text-slate-400 hover:text-slate-600 shrink-0">刪除</button>
      </div>
      {h.cause && <p className="text-slate-600 mt-1">推測原因：{h.cause}</p>}
      {h.action && <p className="text-slate-600 mt-0.5">行動：{h.action}</p>}
      {h.note && <p className="text-slate-400 text-xs mt-0.5">{h.note}</p>}
      <p className={`mt-1.5 font-medium ${g.cls}`}>
        {g.text}
        {h.grade.result && <span className="font-normal text-slate-600">（{h.grade.result.date}：{Math.round(h.grade.result.value * 100) / 100}，{h.grade.change!.pctChange > 0 ? '+' : ''}{h.grade.change!.pctChange.toFixed(0)}%）</span>}
        {!h.grade.result && h.retest_by && <span className="font-normal text-slate-500">（預計 {h.retest_by}）</span>}
      </p>
    </div>
  )
}

function HypothesisForm({ s, clientId, onSaved }: { s: MarkerStory; clientId: string; onSaved: () => void }) {
  const latest = s.latest!
  const defaultDir = s.spec.better === 'lower' ? 'down' : s.spec.better === 'higher' ? 'up'
    : s.change?.verdict === 'real_down' ? 'up' : s.change?.verdict === 'real_up' ? 'down' : 'stable'
  const [dir, setDir] = useState<'up' | 'down' | 'stable'>(defaultDir)
  const [target, setTarget] = useState('')
  const [cause, setCause] = useState('')
  const [action, setAction] = useState('')
  const [retestBy, setRetestBy] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    setSaving(true); setErr(null)
    const r = await fetch('/api/admin/longevity/hypotheses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, marker: s.name, baselineDate: latest.date, baselineValue: latest.value, expectedDirection: dir, expectedValue: target, cause, action, retestBy }),
    })
    const j = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok || !j.success) { setErr(j.error || `HTTP ${r.status}`); return }
    onSaved()
  }
  const input = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm'
  return (
    <div className="mt-2 rounded-xl border border-slate-200 p-3 space-y-2 text-sm">
      <p className="text-slate-600">起點：{latest.date} 的 {Math.round(latest.value * 100) / 100}</p>
      <div className="flex gap-2">
        {(['up', 'down', 'stable'] as const).map(d => (
          <button key={d} onClick={() => setDir(d)} className={`px-3 py-1.5 rounded-lg border text-sm ${dir === d ? 'border-[#1E4A73] text-[#1E4A73] font-medium' : 'border-slate-200 text-slate-600'}`}>
            {d === 'up' ? '會上升' : d === 'down' ? '會下降' : '維持'}
          </button>
        ))}
      </div>
      {dir !== 'stable' && <input className={input} inputMode="decimal" placeholder={dir === 'up' ? '目標：至少到多少（可空）' : '目標：至少降到多少（可空）'} value={target} onChange={e => setTarget(e.target.value)} />}
      <input className={input} placeholder="推測原因（例：減脂期每天少吃 300 大卡）" value={cause} onChange={e => setCause(e.target.value)} />
      <input className={input} placeholder="行動（例：吃回維持熱量 8 週）" value={action} onChange={e => setAction(e.target.value)} />
      <label className="block text-slate-500 text-xs">預計重測日<input type="date" className={input} value={retestBy} onChange={e => setRetestBy(e.target.value)} /></label>
      {err && <p className="text-red-700 text-xs">{err}</p>}
      <button disabled={saving} onClick={save} className="w-full bg-[#1E4A73] hover:bg-[#16385A] text-white rounded-lg py-2 font-medium disabled:opacity-50">{saving ? '儲存中…' : '記下這個預測'}</button>
    </div>
  )
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

function StoryRow({ s, hyps, clientId, onChanged }: { s: MarkerStory; hyps: GradedHypothesis[]; clientId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const del = async (id: string) => {
    await fetch(`/api/admin/longevity/hypotheses?id=${id}`, { method: 'DELETE' })
    onChanged()
  }
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
      {hyps.map(h => <HypothesisRow key={h.id} h={h} onDelete={del} />)}
      {s.latest && !s.spec.onceInLife && (
        open
          ? <HypothesisForm s={s} clientId={clientId} onSaved={() => { setOpen(false); onChanged() }} />
          : <button onClick={() => setOpen(true)} className="mt-2 text-xs text-[#1E4A73] font-medium">＋ 記一個預測</button>
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

  const load = useCallback(() => {
    fetch(`/api/admin/longevity?clientId=${encodeURIComponent(String(clientId))}`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`)
        setData(j.data)
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [clientId])
  useEffect(() => { load() }, [load])

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
            <div className="mt-2">{h.stories.map(s => (
              <StoryRow key={s.name} s={s} clientId={data.clientId} onChanged={load}
                hyps={data.hypotheses.filter(x => x.marker === s.name)} />
            ))}</div>
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
