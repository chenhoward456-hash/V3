'use client'

import { useState } from 'react'
import { assessAttendance, type AttendanceRisk } from '@/lib/attendance-risk'

/**
 * 出席節奏檢查 —— 貼上某個學員的上課日期，看他離「消失」多遠。
 *
 * ⚠️ 為什麼是「貼上」而不是接 BookFast（2026-08-21）：
 * Howard 的痛點是「買五十堂上不到一半就消失」，軌跡是
 * 「開始忙了 → 取消率變多 → 最後就不約課了」。
 *
 * **但訊號準不準還沒驗證過。** 先用他手上現成的歷史案例貼進來看，
 * 判準對了再談自動化 —— 反過來做的話，可能接了半天串接一個沒用的指標。
 * 資料來源不管是 Google 行事曆、BookFast 還是報表，複製貼上都能用。
 */

const LEVEL_STYLE: Record<AttendanceRisk['level'], { box: string; text: string; label: string }> = {
  ok:    { box: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', label: '節奏正常' },
  watch: { box: 'bg-amber-50 border-amber-200',     text: 'text-amber-900',   label: '開始變慢' },
  alert: { box: 'bg-rose-50 border-rose-200',       text: 'text-rose-900',    label: '快掉了' },
  gone:  { box: 'bg-slate-100 border-slate-300',    text: 'text-slate-700',   label: '已經斷了' },
}

export default function AttendancePage() {
  const [raw, setRaw] = useState('')
  const [name, setName] = useState('')
  const result = assessAttendance(raw)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">出席節奏檢查</h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            貼上某個學員的上課日期（行事曆、BookFast、報表都行），看他離「不約課」還有多遠。
            <br />
            先拿已經掉線的舊案例試，看這個判準抓不抓得到 —— 準了再談自動接系統。
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <label className="block mb-3">
            <span className="block text-xs text-slate-500 mb-1.5">學員（只給你自己看，不會存）</span>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="暱稱或代號"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-slate-500 mb-1.5">
              上課日期（一行一個，或用逗號分隔）
            </span>
            <textarea
              value={raw} onChange={e => setRaw(e.target.value)}
              rows={8}
              placeholder={'2026-06-03\n2026-06-07\n2026/6/12\n6/18'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="block text-[11px] text-slate-400 mt-1.5">
              格式隨便：2026-08-21 / 2026/8/21 / 8/21 都讀得懂，重複的會自動去掉。
            </span>
          </label>
        </div>

        {result && (
          <>
            <div className={`border rounded-2xl p-5 ${LEVEL_STYLE[result.level].box}`}>
              <div className="flex items-baseline justify-between mb-2">
                <span className={`text-sm font-bold ${LEVEL_STYLE[result.level].text}`}>
                  {name ? `${name} — ` : ''}{LEVEL_STYLE[result.level].label}
                </span>
                <span className="text-[11px] text-slate-500 tabular-nums">{result.sessions} 堂</span>
              </div>
              <p className={`text-sm leading-relaxed ${LEVEL_STYLE[result.level].text}`}>
                {result.summary}
              </p>
              <p className="text-sm text-slate-700 mt-3 leading-relaxed font-medium">
                {result.action}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs tabular-nums">
                {([
                  ['最後一堂', result.lastDate],
                  ['距今', `${result.daysSinceLast} 天`],
                  ['平常間隔', result.baselineGapDays != null ? `${result.baselineGapDays} 天` : '資料不足'],
                  ['最近間隔', result.recentGapDays != null ? `${result.recentGapDays} 天` : '資料不足'],
                ] as [string, string][]).map(([l, v]) => (
                  <div key={l} className="flex justify-between border-b border-slate-50 py-1">
                    <span className="text-slate-500">{l}</span>
                    <span className="text-gray-900">{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                平常間隔用<b>中位數</b>不用平均 —— 一次出國或受傷造成的長間隔不該把基準線拉歪。
                主訊號看「間隔」不看「取消次數」：取消代表還有意願（約了才能取消），
                <b>不約課才是真正的訊號</b>。
              </p>
            </div>
          </>
        )}

        {raw.trim() && !result && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-900">讀不出日期。確認格式是 2026-08-21 或 8/21 這種。</p>
          </div>
        )}
      </div>
    </main>
  )
}
