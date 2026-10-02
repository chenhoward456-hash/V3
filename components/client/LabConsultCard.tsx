'use client'

import { useEffect, useState } from 'react'
import type { LabConsult, ConsultChange } from '@/lib/lab-consult'

/**
 * 這次血檢顧問卡（學員「健康」分頁最上面）：抽完血、上傳完，系統先講——
 * 這次重點（真的有變的）、要留意什麼、已經很好的、預測對答案、下次什麼時候驗、驗什麼。
 * 確定性規則（lib/lab-consult.ts），不經 AI、不等教練審。只在最近一次抽血 60 天內顯示。
 */

interface Data {
  consult: LabConsult | null
  nextCheckupDate: string | null
}

const sign = (n: number) => (n > 0 ? `+${n}` : String(n))
const unit = (u: string | null) => (u ? ` ${u}` : '')

function ChangeRow({ x, tone, label }: { x: ConsultChange; tone: 'good' | 'bad' | 'neutral'; label: string }) {
  const dot = tone === 'good' ? 'bg-emerald-600' : tone === 'bad' ? 'bg-amber-600' : 'bg-slate-300'
  const txt = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-amber-700' : 'text-slate-500'
  return (
    <div className="py-2.5 border-t border-slate-100 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-slate-900">{x.name}</span>
        <span className="text-sm text-slate-600 tabular-nums text-right">
          {x.from} → {x.to}{unit(x.unit)}
          <b className="ml-2 text-slate-900">{sign(x.pct)}%</b>
        </span>
      </div>
      <p className={`text-xs font-medium mt-0.5 flex items-center gap-1.5 ${txt}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
        {label}{x.outOfRange ? '，而且落在要留意的範圍' : ''}
      </p>
      {x.hint && <p className="text-sm text-slate-600 mt-0.5">{x.hint}</p>}
      {x.medNote && <p className="text-sm text-slate-700 mt-0.5">💊 {x.medNote}</p>}
    </div>
  )
}

export default function LabConsultCard({ code }: { code: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch(`/api/lab-consult?code=${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(j => (j.success ? setData(j.data) : setFailed(true)))
      .catch(() => setFailed(true))
  }, [code])

  if (failed || !data) return null
  const c = data.consult
  if (!c || !c.fresh) return null

  const changes = c.better.length + c.worse.length + c.shiftedInRange.length
  // 教練排在這次之後的日期優先（上傳後系統也會自動排成建議日，兩者通常一樣）
  const coachDate = data.nextCheckupDate && data.nextCheckupDate >= c.drawDate ? data.nextCheckupDate : null
  const nextDate = coachDate ?? c.next.date

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">這次血檢重點</h2>
        <span className="text-xs text-slate-500 tabular-nums">{c.drawDate} 抽血・{c.drawCount} 項</span>
      </div>
      <p className="text-xs text-slate-500 mt-1">系統依你的數字自動整理，教練看過後會再補充。</p>

      {/* 1. 真的有變的 */}
      <div className="mt-4">
        <h3 className="font-semibold text-slate-900">跟你上一次比</h3>
        {changes === 0 ? (
          <p className="text-sm text-slate-600 mt-1">
            {c.noiseCount > 0 ? '沒有超過你自己正常波動的變化。' : '這次的項目還沒有上一次可以比，這次就是你的基準值。'}
          </p>
        ) : (
          <div className="mt-1">
            {c.better.map(x => <ChangeRow key={x.name} x={x} tone="good" label="變好" />)}
            {c.worse.map(x => <ChangeRow key={x.name} x={x} tone="bad" label="變差" />)}
            {c.shiftedInRange.map(x => <ChangeRow key={x.name} x={x} tone="neutral" label="有變動，但前後都在很好的範圍" />)}
          </div>
        )}
        {c.noiseCount > 0 && changes > 0 && (
          <p className="text-xs text-slate-500 mt-1">另外 {c.noiseCount} 項有上下，但在你自己的正常波動內，不用放心上。</p>
        )}
      </div>

      {/* 2. 要留意 */}
      <div className="mt-4">
        <h3 className="font-semibold text-slate-900">要留意</h3>
        {c.watch.length === 0 ? (
          <p className="text-sm text-slate-600 mt-1 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600" />這次沒有
          </p>
        ) : (
          <div className="mt-1">
            {c.watch.map(w => {
              const side = w.side === 'high' ? '偏高' : w.side === 'low' ? '偏低' : ''
              const dot = w.level === 'high' ? 'bg-rose-600' : 'bg-amber-600'
              return (
                <div key={w.name} className="py-2.5 border-t border-slate-100 first:border-t-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-slate-900 flex items-center gap-1.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />{w.name}
                    </span>
                    <span className="text-sm text-slate-600 tabular-nums text-right">
                      {w.value}{unit(w.unit)}{side && <span className="ml-1">{side}</span>}
                    </span>
                  </div>
                  {w.idealText && <p className="text-xs text-slate-500 mt-0.5 tabular-nums">理想 {w.idealText}</p>}
                  {w.labRangeText && <p className="text-xs text-slate-500 mt-0.5 tabular-nums">檢驗所範圍 {w.labRangeText}</p>}
                  <p className="text-sm text-slate-600 mt-0.5">{w.note}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 2.5 接下來怎麼做（營養引擎＋補品引擎，按血檢項目接起來＋下次驗收） */}
      {c.actions && c.actions.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-slate-900">接下來怎麼做</h3>
          <p className="text-xs text-slate-500 mt-0.5">每一項做到下次抽血，那次就看有沒有到目標</p>
          <div className="mt-1">
            {c.actions.map(a => (
              <div key={a.name} className="py-2.5 border-t border-slate-100 first:border-t-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-slate-900">{a.name}</span>
                  {a.value != null && (
                    <span className="text-sm text-slate-600 tabular-nums text-right">
                      {a.value}{unit(a.unit)}{a.target && <span className="text-slate-500">　目標 {a.target.replace(/（最佳）/, '')}</span>}
                    </span>
                  )}
                </div>
                {a.medNote && <p className="text-sm text-slate-700 mt-1">💊 {a.medNote}</p>}
                {a.doThis.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {a.doThis.map(d => <li key={d} className="text-sm text-slate-700">・{d}</li>)}
                  </ul>
                )}
                {a.supplements.map(sp => (
                  <div key={sp.name} className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <p className="text-sm font-medium text-slate-900">{sp.name.replace(/^⚠️\s*/, '')}</p>
                    <p className="text-xs text-slate-600 tabular-nums">{[sp.dosage, sp.timing !== '—' ? sp.timing : ''].filter(Boolean).join('｜')}</p>
                  </div>
                ))}
                <p className="text-xs text-slate-500 mt-1 tabular-nums">驗收：{a.retestDate} 抽血時看這項</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2.6 你在吃的保健品：有沒有血檢依據＋吃了有沒有效 */}
      {c.stack && c.stack.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-slate-900">你在吃的保健品</h3>
          <div className="mt-1">
            {c.stack.map(x => {
              const tag = x.status === 'caution' ? { t: '要注意', cls: 'text-rose-700 bg-rose-50' }
                : x.status === 'no-indication' ? { t: '沒有血檢依據', cls: 'text-amber-700 bg-amber-50' }
                : x.status === 'indicated' ? { t: '有血檢依據', cls: 'text-emerald-700 bg-emerald-50' }
                : { t: '生活型', cls: 'text-slate-600 bg-slate-100' }
              return (
                <div key={x.name} className="py-2.5 border-t border-slate-100 first:border-t-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-slate-900">{x.name}</span>
                    <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${tag.cls}`}>{tag.t}</span>
                  </div>
                  {x.dose && <p className="text-xs text-slate-500 mt-0.5">{x.dose}</p>}
                  <p className="text-sm text-slate-700 mt-0.5">{x.basis}</p>
                  {x.effect && <p className="text-xs text-slate-600 mt-0.5 tabular-nums">{x.effect}</p>}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-500 mt-1">「沒有血檢依據」不代表有害，是這份血檢看不出你需要它；要不要繼續跟教練討論。</p>
        </div>
      )}

      {/* 3. 已經很好 */}
      {c.good.count > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-slate-900">已經很好</h3>
          <p className="text-sm text-slate-600 mt-1">
            <span className="tabular-nums">{c.good.count}</span> 項在理想範圍：{c.good.names.join('、')}{c.good.count > c.good.names.length ? ' 等' : ''}
          </p>
        </div>
      )}

      {/* 4. 預測對答案 */}
      {c.answered.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-slate-900">預測對答案</h3>
          {c.answered.map(a => (
            <div key={a.marker} className="mt-2 rounded-xl border border-slate-200 p-3 text-sm">
              <p className="text-slate-900">{a.marker}：預測{a.expected}</p>
              <p className="text-slate-600 tabular-nums mt-0.5">{a.baseline} → {a.result}</p>
              <p className={`mt-0.5 font-medium ${a.status === 'confirmed' ? 'text-emerald-700' : a.status === 'no_change' ? 'text-slate-700' : 'text-amber-700'}`}>{a.verdict}</p>
            </div>
          ))}
        </div>
      )}

      {/* 5. 下次抽血 */}
      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <h3 className="font-semibold text-slate-900">下次抽血</h3>
        <p className="text-sm text-slate-900 mt-1 tabular-nums">
          {coachDate ? `教練排的日期：${nextDate}` : `建議 ${nextDate} 左右`}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {coachDate ? `系統依這次結果建議 ${c.next.date} 左右（${c.next.reason}）；以教練排的為準` : c.next.reason}
        </p>
        {c.next.items.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {c.next.items.map(i => (
              <li key={i.label} className="text-sm">
                <span className="text-slate-900">{i.label}</span>
                <span className="text-slate-500">：{i.why}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600 mt-2">要驗哪些，抽血前跟教練確認。</p>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-3">這是追蹤與教育用途，不是醫療診斷；數字有疑慮請與醫師討論。</p>
    </section>
  )
}
