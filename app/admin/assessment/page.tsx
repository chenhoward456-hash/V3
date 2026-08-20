'use client'

import { useState } from 'react'
import ReportView from '@/components/assessment/ReportView'
import type { AssessmentReport, ActivityLevel } from '@/lib/assessment-report'
import type { InBodyReading } from '@/lib/inbody-ocr'

/**
 * 教練端：拍一張 ACCUNIQ 報表 → 產出會員報告。
 *
 * 動線設計（2026-08-21）：會員做完體測 → 教練在手機上拍一張 → 15~30 秒 →
 * 教練當場對著螢幕講解，或把內容傳給會員。
 * **教練不需要會判讀** —— 系統把判斷做完了，他只要念。
 *
 * ⚠️ 這頁不寫任何資料庫。體測報表含個資，保存政策定案前一律不落地。
 */

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: '幾乎不動' },
  { value: 'light', label: '一週 1–2 次' },
  { value: 'moderate', label: '一週 3–4 次' },
  { value: 'active', label: '一週 5 次以上' },
]

export default function AdminAssessmentPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState<InBodyReading | null>(null)
  const [report, setReport] = useState<AssessmentReport | null>(null)
  const [activity, setActivity] = useState<ActivityLevel>('light')
  const [preview, setPreview] = useState<string | null>(null)

  const run = async (file: File) => {
    setBusy(true); setError(null); setReport(null); setReading(null)
    setPreview(URL.createObjectURL(file))
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(String(fr.result).split(',')[1] ?? '')
        fr.onerror = () => rej(new Error('讀檔失敗'))
        fr.readAsDataURL(file)
      })
      const r = await fetch('/api/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [{ mediaType: file.type, data: b64 }], activity }),
      })
      const json = await r.json()
      if (!r.ok) { setError(json?.error ?? '讀取失敗'); if (json?.reading) setReading(json.reading); return }
      setReading(json.reading)
      setReport(json.report)
    } catch (e) {
      setError(e instanceof Error ? e.message : '出錯了')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">體測報告</h1>
          <p className="text-xs text-slate-500 mt-1">
            拍一張 ACCUNIQ 報表，系統讀完直接產出會員看得懂的版本。約 30 秒。
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <label className="block mb-3">
            <span className="block text-xs text-slate-500 mb-1.5">這位會員平常一週練幾次？</span>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITY_OPTIONS.map(o => (
                <button
                  key={o.value} type="button" onClick={() => setActivity(o.value)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    activity === o.value
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >{o.label}</button>
              ))}
            </div>
            <span className="block text-[11px] text-slate-400 mt-1.5">這會影響每日熱量的計算。</span>
          </label>

          <label className="block">
            <input
              type="file" accept="image/*" capture="environment" disabled={busy}
              onChange={e => { const f = e.target.files?.[0]; if (f) run(f) }}
              className="block w-full text-sm text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-primary-600 file:text-white hover:file:bg-primary-700 disabled:opacity-50"
            />
          </label>

          {busy && <p className="text-sm text-slate-500 mt-3">讀取中… 通常 25–30 秒</p>}
          {error && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-900 leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* 讀出來的原始數值 —— 教練要能一眼核對，不能只給結論 */}
        {reading && (
          <details className="bg-white border border-slate-200 rounded-2xl p-5">
            <summary className="cursor-pointer text-sm font-medium text-gray-800 select-none">
              核對讀到的數值
              {reading.uncertain.length > 0 && (
                <span className="ml-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                  {reading.uncertain.length} 項要確認
                </span>
              )}
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs tabular-nums">
              {([
                ['體重', reading.weight, 'kg'], ['身高', reading.height, 'cm'],
                ['年齡', reading.age, '歲'], ['體脂率', reading.body_fat_pct, '%'],
                ['體脂重', reading.body_fat_mass, 'kg'], ['骨骼肌', reading.skeletal_muscle, 'kg'],
                ['除脂體重', reading.lean_mass, 'kg'], ['SMI', reading.smi, ''],
                ['腹圍', reading.waist_cm, 'cm'], ['腰臀比', reading.whr, ''],
                ['內臟脂肪', reading.visceral_fat, '級'], ['BMR', reading.bmr, 'kcal'],
              ] as [string, number | null, string][]).map(([l, v, u]) => (
                <div key={l} className="flex justify-between border-b border-slate-50 py-0.5">
                  <span className="text-slate-500">{l}</span>
                  <span className={v == null ? 'text-amber-600' : 'text-gray-900'}>
                    {v == null ? '讀不到' : `${v}${u}`}
                  </span>
                </div>
              ))}
            </div>
            {reading.waist_was_inches && (
              <p className="text-[11px] text-slate-500 mt-2.5">腹圍原本印的是英吋，已換算成公分。</p>
            )}
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="體測報表" className="mt-3 w-full rounded-xl border border-slate-200" />
            )}
          </details>
        )}

        {report?.warnings.map(w => (
          <div key={w} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-900 leading-relaxed">{w}</p>
          </div>
        ))}
        {report && report.missing.length > 0 && (
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              這幾項讀不到，報告會少對應的段落：{report.missing.join('、')}
            </p>
          </div>
        )}

        {report && (
          <>
            <div className="pt-2">
              <p className="text-xs font-medium text-slate-500">↓ 以下是會員看到的版本</p>
            </div>
            <div className="bg-slate-50 -mx-4 px-4 py-4 border-y border-slate-200">
              <ReportView
                report={report}
                meta={{
                  measuredAt: reading?.measured_at, gender: reading?.gender,
                  age: reading?.age, height: reading?.height, weight: reading?.weight,
                }}
              />
            </div>
          </>
        )}
      </div>
    </main>
  )
}
