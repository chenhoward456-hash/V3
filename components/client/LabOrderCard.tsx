'use client'

import { useEffect, useState } from 'react'
import { buildStudentLabVisit, visitToText, type StudentLabOrderInput, type StudentLabProfile } from '@/lib/lab-order-student'

/**
 * 學員版「下次抽血」：去看哪一科、進診間怎麼說、請醫生開哪幾項、抽血前準備、報告拿到後上傳。
 * 要驗什麼照減法開單引擎（/api/lab-order → lib/lab-order.ts），翻譯成白話在 lib/lab-order-student.ts。
 * ⚠️ 學員端不顯示價格／套餐／分級——那是教練開單用的（/admin、晨報），不是給學員看的。
 */

interface Data extends StudentLabOrderInput {
  enabled: boolean
  nextCheckupDate?: string | null
}

export default function LabOrderCard({ code, today, profile }: { code: string; today: string; profile?: StudentLabProfile }) {
  const [d, setD] = useState<Data | null>(null)
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)

  useEffect(() => {
    fetch(`/api/lab-order?code=${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(j => j.success && setD(j.data))
      .catch(() => {})
  }, [code])

  if (!d || !d.enabled || !d.must) return null

  const v = buildStudentLabVisit(d, profile ?? {})
  if (v.items.length === 0) return null

  const due = d.nextCheckupDate
  const dueText = due
    ? (due <= today ? `預定 ${due}，已經可以去抽了` : `預定 ${due}`)
    : null
  const text = visitToText(v)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <h2 className="text-lg font-bold text-slate-900">下次抽血</h2>
      {dueText && <p className={`text-sm mt-0.5 ${due! <= today ? 'text-amber-700' : 'text-slate-500'}`}>{dueText}</p>}

      <div className="mt-4">
        <p className="text-xs text-slate-500">建議掛</p>
        <p className="text-sm font-medium text-slate-900 mt-0.5">{v.department}</p>
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-900">進診間可以這樣說</p>
        <p className="mt-1.5 text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl px-3 py-2.5">{v.script}</p>
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-900">如果醫生問要驗什麼</p>
        <ul className="mt-1">
          {v.items.map(i => (
            <li key={i.name} className="py-2 border-t border-slate-100 first:border-t-0">
              <p className="text-sm font-medium text-slate-900">
                {i.name}
                {i.optional && <span className="ml-1.5 text-xs font-normal text-slate-500">可一起驗</span>}
              </p>
              {i.why && <p className="text-xs text-slate-500 mt-0.5">{i.why}</p>}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 mt-2">{v.selfPayNote}</p>
      </div>

      <button type="button" onClick={copy} className="mt-3 w-full border border-slate-200 rounded-lg py-2 text-sm text-primary-600 font-medium">
        {copied === 'ok' ? '已複製，看診時打開給醫生看' : '複製這段話＋清單'}
      </button>
      {copied === 'fail' && (
        <pre className="mt-2 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-2 select-all">{text}</pre>
      )}

      {v.prepNotes.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-sm font-semibold text-slate-900">抽血前準備</p>
          <ul className="mt-1 space-y-0.5">
            {v.prepNotes.map(t => <li key={t} className="text-xs text-slate-600">・{t}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-sm font-semibold text-slate-900">看報告時可以問醫生</p>
        <ul className="mt-1 space-y-0.5">
          {v.reportQuestions.map(t => <li key={t} className="text-xs text-slate-600">・{t}</li>)}
        </ul>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-sm text-slate-700">報告拿到後，拍照上傳到「健康」分頁，數字會自動進你的血檢紀錄。</p>
        <a href={`/c/${code}/health/upload`} className="mt-2 block text-center text-sm text-primary-600 font-medium py-2">
          上傳血檢報告 →
        </a>
      </div>
    </section>
  )
}
