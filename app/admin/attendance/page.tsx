'use client'

import { useState } from 'react'
import { assessBatch, needsAction, type AttendanceRisk } from '@/lib/attendance-risk'

/**
 * 出席節奏檢查 —— 貼上上課日期，系統排序出「這週該顧誰」。
 *
 * ⚠️ 設計的兩個前提（2026-08-21 Howard 的原話）：
 * ①「我一天六堂課六小時，要用什麼時間去最簡化記錄的步驟？」
 *   → **出席是唯一零輸入的訊號**（BookFast／行事曆本來就有），
 *     所以起點必須是它，不是要教練另外記東西。
 * ②「選出核心學生，更用心去對待他們」
 *   → 方向對，但**不該讓教練決定誰是核心** —— 決定本身就是認知成本。
 *     系統用資料排序，教練只看最上面那兩三個。
 *
 * 不接 BookFast API 是刻意的：訊號準不準還沒驗證，先貼歷史案例試，
 * 判準對了再談自動化。
 */

const LEVEL_STYLE: Record<AttendanceRisk['level'], { box: string; text: string; label: string; chip: string }> = {
  alert: { box: 'bg-rose-50 border-rose-200',    text: 'text-rose-900',    label: '快掉了',   chip: 'bg-rose-600 text-white' },
  watch: { box: 'bg-amber-50 border-amber-200',  text: 'text-amber-900',   label: '開始變慢', chip: 'bg-amber-500 text-white' },
  gone:  { box: 'bg-slate-100 border-slate-300', text: 'text-slate-700',   label: '已經斷了', chip: 'bg-slate-500 text-white' },
  ok:    { box: 'bg-white border-slate-200',     text: 'text-slate-600',   label: '正常',     chip: 'bg-slate-200 text-slate-600' },
}

const SAMPLE = `王小明
2026-06-02, 2026-06-05, 2026-06-09, 2026-06-12, 2026-06-16, 2026-06-19
2026-06-23, 2026-06-26, 2026-07-01, 2026-07-08, 2026-07-22

李小華
2026-07-15, 2026-07-18, 2026-07-22, 2026-07-25, 2026-07-29
2026-08-01, 2026-08-05, 2026-08-08, 2026-08-12, 2026-08-15, 2026-08-19

陳大文
2026-05-06, 2026-05-13, 2026-05-20, 2026-05-27, 2026-06-03, 2026-06-10`

export default function AttendancePage() {
  const [raw, setRaw] = useState('')
  const rows = assessBatch(raw)
  const todo = needsAction(rows)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">這週該顧誰</h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            貼上學員的上課日期（BookFast、行事曆、報表都行），系統排出優先順序。
            <br />
            不用你決定誰是核心 —— 先看最上面那兩三個就好。
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <label className="block">
            <span className="block text-xs text-slate-500 mb-1.5">
              一行名字，接著他的上課日期（可以多行）
            </span>
            <textarea
              value={raw} onChange={e => setRaw(e.target.value)}
              rows={10}
              placeholder={SAMPLE}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button" onClick={() => setRaw(SAMPLE)}
              className="text-[11px] text-primary-600 hover:text-primary-800 transition-colors"
            >填入範例看看</button>
            {raw && (
              <button
                type="button" onClick={() => setRaw('')}
                className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
              >清空</button>
            )}
          </div>
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex items-baseline justify-between px-1">
              <p className="text-sm font-medium text-gray-800">
                {todo.length > 0 ? `${todo.length} 個要處理` : '全部正常'}
              </p>
              <p className="text-[11px] text-slate-400 tabular-nums">共 {rows.length} 人</p>
            </div>

            {rows.map(({ name, risk }) => {
              const st = LEVEL_STYLE[risk.level]
              return (
                <div key={name} className={`border rounded-2xl p-4 ${st.box}`}>
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span className="text-sm font-bold text-gray-900">{name}</span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${st.chip}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed ${st.text}`}>{risk.summary}</p>
                  {risk.level !== 'ok' && (
                    <p className="text-xs text-slate-700 mt-2 leading-relaxed font-medium">{risk.action}</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-2 tabular-nums">
                    {risk.sessions} 堂 · 最後 {risk.lastDate} · 距今 {risk.daysSinceLast} 天
                    {risk.baselineGapDays != null && ` · 平常每 ${risk.baselineGapDays} 天`}
                  </p>
                </div>
              )
            })}

            <p className="text-[11px] text-slate-400 leading-relaxed pb-6">
              排序規則：快掉了 → 開始變慢 → 已經斷了 → 正常。
              「快掉了」排最前面不是因為最嚴重，是因為那是還救得回來、而且成本最低的時間點。
            </p>
          </>
        )}

        {raw.trim() && rows.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-900 leading-relaxed">
              讀不出資料。格式是「一行名字，下面接日期」—— 按上面的「填入範例看看」對照一下。
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
