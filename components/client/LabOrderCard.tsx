'use client'

import { useEffect, useState } from 'react'

/**
 * 學員版「下次抽血驗這些」：學員打開自己就知道要驗什麼、大約多少錢、哪些不用花錢、抽血前注意什麼。
 * 資料來自減法開單引擎（/api/lab-order → lib/lab-order.ts），跟教練晨報／LINE 推播同一支。
 */

interface Line { label: string; price: number | null; why: string }
interface Data {
  enabled: boolean
  nextCheckupDate?: string | null
  must?: Line[]
  defer?: Line[]
  skip?: Line[]
  mustCost?: number
  unknownPriceCount?: number
  basePackage?: { price: number | null; skippable: boolean; why: string }
  prepNotes?: string | null
}

const money = (n: number) => `NT$${n.toLocaleString()}`

function Item({ l }: { l: Line }) {
  return (
    <li className="py-2 border-t border-slate-100 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-slate-900">{l.label}</span>
        <span className="text-xs text-slate-500 tabular-nums shrink-0">{l.price != null ? money(l.price) : '開單時問價'}</span>
      </div>
      <p className="text-xs text-slate-500 mt-0.5">{l.why}</p>
    </li>
  )
}

export default function LabOrderCard({ code, today }: { code: string; today: string }) {
  const [d, setD] = useState<Data | null>(null)
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)

  useEffect(() => {
    fetch(`/api/lab-order?code=${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(j => j.success && setD(j.data))
      .catch(() => {})
  }, [code])

  if (!d || !d.enabled || !d.must) return null

  const due = d.nextCheckupDate
  const dueText = due
    ? (due <= today ? `預定 ${due}，已經可以去抽了` : `預定 ${due}`)
    : null
  const listText = [
    ...(d.basePackage && !d.basePackage.skippable ? ['底盤套餐'] : []),
    ...d.must.map(l => l.label),
  ].join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(listText)
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <h2 className="text-lg font-bold text-slate-900">下次抽血驗這些</h2>
      {dueText && <p className={`text-sm mt-0.5 ${due! <= today ? 'text-amber-700' : 'text-slate-500'}`}>{dueText}</p>}
      <p className="text-xs text-slate-500 mt-1">已經扣掉不用花錢的項目：最近驗過且很好的、算得出來的、要等別項結果的。</p>

      {d.basePackage?.price != null && (
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-slate-900">底盤套餐（肝腎、血脂、血糖）</span>
            <span className="text-xs text-slate-500 tabular-nums">{d.basePackage.skippable ? '這次可以不開' : money(d.basePackage.price)}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{d.basePackage.why}</p>
        </div>
      )}

      <div className="mt-3">
        <p className="text-sm font-semibold text-slate-900">
          必驗 {d.must.length} 項　<span className="font-normal text-slate-600 tabular-nums">{money(d.mustCost ?? 0)}{d.unknownPriceCount ? `（另 ${d.unknownPriceCount} 項開單時問價）` : ''}</span>
        </p>
        <ul className="mt-1">{d.must.map(l => <Item key={l.label} l={l} />)}</ul>
      </div>

      <button type="button" onClick={copy} className="mt-3 w-full border border-slate-200 rounded-lg py-2 text-sm text-[#1E4A73] font-medium">
        {copied === 'ok' ? '已複製，貼給檢驗所就好' : '複製清單（底盤＋必驗）'}
      </button>
      {copied === 'fail' && (
        <pre className="mt-2 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-2 select-all">{listText}</pre>
      )}

      {(d.defer?.length ?? 0) > 0 && (
        <details className="mt-3">
          <summary className="text-sm text-slate-500 cursor-pointer py-1">有預算再加 {d.defer!.length} 項（純基準線）</summary>
          <ul>{d.defer!.map(l => <Item key={l.label} l={l} />)}</ul>
        </details>
      )}
      {(d.skip?.length ?? 0) > 0 && (
        <details className="mt-1">
          <summary className="text-sm text-slate-500 cursor-pointer py-1">這次不用驗 {d.skip!.length} 項</summary>
          <ul>{d.skip!.map(l => <Item key={l.label} l={l} />)}</ul>
        </details>
      )}

      {d.prepNotes && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-sm font-semibold text-slate-900">抽血前</p>
          <ul className="mt-1 space-y-0.5">
            {d.prepNotes.split('\n').filter(Boolean).map(t => <li key={t} className="text-xs text-slate-600">・{t}</li>)}
          </ul>
        </div>
      )}
      {/* 抽完就從這裡上傳：結果進來 → 血檢進退自動更新、預測自動對答案 */}
      <a href={`/c/${code}/health/upload`} className="mt-3 block text-center text-sm text-[#1E4A73] font-medium py-2">
        抽完了？拍報告上傳 →
      </a>
    </section>
  )
}
