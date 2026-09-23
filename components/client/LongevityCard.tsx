'use client'

import { useEffect, useState } from 'react'
import type { HorsemanView, MarkerStory, LabHypothesis, HypothesisGrade, FitnessView } from '@/lib/longevity-lens'
import { FITNESS_META } from '@/lib/longevity-lens'

/**
 * 學員版長壽透鏡（「健康」分頁）：V3 的初衷——同一個人的血檢看得到進退。
 * 只把「真的在變」的指標攤開，沒變的收起來；每個變化附「是真的嗎／這段期間你做了什麼」。
 * 合規：分組用身體系統說法、不寫疾病名，教練手寫文字已在 API 端過降級。
 */

interface Data {
  today: string
  groups: (HorsemanView & { label: string; why: string })[]
  hypotheses: (LabHypothesis & { grade: HypothesisGrade })[]
  fitness: FitnessView[]
}

const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : String(Math.round(n * 100) / 100))

const GRADE: Record<HypothesisGrade['status'], { text: string; cls: string }> = {
  pending: { text: '等下次抽血對答案', cls: 'text-slate-500' },
  overdue: { text: '該重測了', cls: 'text-amber-700' },
  confirmed: { text: '達成：方向對、也到目標', cls: 'text-emerald-700' },
  partial: { text: '有進步，還沒到目標', cls: 'text-amber-700' },
  no_change: { text: '還沒看到變化，教練會一起看原因', cls: 'text-slate-700' },
  refuted: { text: '方向不如預期，教練會調整做法', cls: 'text-amber-700' },
}

function isReal(s: MarkerStory) {
  return !!s.change && s.change.verdict !== 'noise'
}

function contextText(s: MarkerStory): string | null {
  const x = s.context
  if (!x || !isReal(s)) return null
  const ctx: string[] = []
  if (x.avgCalories != null) ctx.push(`平均每天吃 ${x.avgCalories.toLocaleString()} 大卡`)
  if (x.weightStart != null && x.weightEnd != null) ctx.push(`體重 ${x.weightStart} → ${x.weightEnd} kg`)
  if (x.impliedDailyBalance != null && Math.abs(x.impliedDailyBalance) >= 100) {
    ctx.push(`換算每天約${x.impliedDailyBalance < 0 ? '少' : '多'}吃 ${Math.abs(x.impliedDailyBalance)} 大卡`)
  }
  if (x.trainingPerWeek != null) ctx.push(`每週練 ${x.trainingPerWeek} 次`)
  return ctx.length ? `那段期間：${ctx.join('、')}` : null
}

function Row({ s, hyps, ctxText }: { s: MarkerStory; hyps: Data['hypotheses']; ctxText: string | null }) {
  const unit = s.latest?.unit ? ` ${s.latest.unit}` : ''
  const c = s.change
  let retest: string | null = null
  if (s.freshness === 'once_ok' && !s.optimalNow) retest = '這項偏高，主要由基因決定、不太會變；教練會把其他能改變的數字一起顧好'
  else if (s.freshness === 'good_hold') retest = '上次數字很好、體重也沒大變，不用急著重測'
  else if (s.freshness === 'changed') retest = '上次很好，但之後體重變化比較大，下次抽血可以一起看'
  else if (s.freshness === 'stale' && s.spec.core) retest = `建議 ${s.retestBy} 前再測一次`

  return (
    <div className="py-3 border-t border-slate-100 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-slate-900">{s.name}</span>
        <span className="text-sm text-slate-600 tabular-nums text-right">{s.points.map(p => fmt(p.value)).join(' → ')}{unit}</span>
      </div>
      {c && isReal(s) && (
        <p className="text-sm text-slate-900 mt-1">
          比上次 {c.pctChange > 0 ? '+' : ''}{c.pctChange.toFixed(0)}%，超過正常波動（±{c.rcvPct.toFixed(0)}%）→ 是真的在變{s.optimalNow ? '，而且在很好的範圍' : ''}
        </p>
      )}
      {ctxText && <p className="text-sm text-slate-600 mt-1">{ctxText}</p>}
      {retest && <p className="text-xs text-slate-500 mt-1">{retest}</p>}
      {hyps.map(h => {
        const g = GRADE[h.grade.status]
        const target = h.expected_value != null ? `${h.expected_direction === 'down' ? '≤' : '≥'} ${h.expected_value}` : ''
        const dir = h.expected_direction === 'up' ? '回升' : h.expected_direction === 'down' ? '下降' : '維持'
        return (
          <div key={h.id} className="mt-2 rounded-xl border border-slate-200 p-3 text-sm">
            <p className="font-medium text-slate-900">教練的預測：{dir} {target}</p>
            {h.action && <p className="text-slate-600 mt-0.5">做法：{h.action}</p>}
            <p className={`mt-1 font-medium ${g.cls}`}>
              {g.text}
              {!h.grade.result && h.retest_by && <span className="font-normal text-slate-500">（預計 {h.retest_by}）</span>}
              {h.grade.result && <span className="font-normal text-slate-600">（{h.grade.result.date}：{fmt(h.grade.result.value)}）</span>}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default function LongevityCard({ code }: { code: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch(`/api/longevity?code=${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(j => (j.success ? setData(j.data) : setFailed(true)))
      .catch(() => setFailed(true))
  }, [code])

  if (failed) return null
  if (!data) return <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 text-sm text-slate-400">血檢進退載入中…</div>
  if (data.groups.length === 0 && data.fitness.length === 0) return null

  const hypsFor = (name: string) => data.hypotheses.filter(h => h.marker === name)

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <h2 className="text-lg font-bold text-slate-900">血檢進退</h2>
      <p className="text-xs text-slate-500 mt-1">每個數字都跟你自己的上一次比：先分清楚是真的在變，還是正常波動。</p>

      {data.groups.map(g => {
        // 攤開：真的在變、有預測、或「一生一次但偏高」（例 Lp(a)）——後者收起來學員就看不到
        const changed = g.stories.filter(s => isReal(s) || hypsFor(s.name).length > 0 || (s.freshness === 'once_ok' && !s.optimalNow))
        const steady = g.stories.filter(s => !changed.includes(s))
        return (
          <div key={g.key} className="mt-4">
            <h3 className="font-semibold text-slate-900">{g.label}</h3>
            <p className="text-xs text-slate-500">{g.why}</p>
            <div className="mt-1">{changed.map((s, i) => {
              // 同一區相鄰指標常共用同一段期間（例：三種睪固酮同一天抽），跟上一格一樣就不重寫
              const t = contextText(s)
              const prev = i > 0 ? contextText(changed[i - 1]) : null
              return <Row key={s.name} s={s} hyps={hypsFor(s.name)} ctxText={t && t !== prev ? t : null} />
            })}</div>
            {steady.length > 0 && (
              <details className="mt-1">
                <summary className="text-sm text-slate-500 cursor-pointer py-1">
                  {changed.length === 0 ? `${steady.length} 項：只測過一次或沒有明顯變化` : `其他 ${steady.length} 項：只測過一次或沒有明顯變化`}
                </summary>
                {steady.map(s => <Row key={s.name} s={s} hyps={[]} ctxText={null} />)}
              </details>
            )}
          </div>
        )
      })}

      {data.fitness.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-slate-900">身體能力</h3>
          {data.fitness.map(f => (
            <div key={f.kind} className="py-2 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-slate-900">{FITNESS_META[f.kind].label}</span>
              <span className="text-slate-600 tabular-nums">
                {f.latest!.value} {FITNESS_META[f.kind].unit}
                {f.pctChange != null && `（${f.pctChange > 0 ? '+' : ''}${f.pctChange.toFixed(1)}%）`}
              </span>
            </div>
          ))}
        </div>
      )}

      <a href={`/c/${code}/health/upload`} className="mt-4 block text-sm text-[#1E4A73] font-medium">有新的報告？拍照上傳 →</a>
      <p className="text-xs text-slate-400 mt-3">這是追蹤與教育用途，不是醫療診斷；數字有疑慮請與醫師討論。</p>
    </section>
  )
}
