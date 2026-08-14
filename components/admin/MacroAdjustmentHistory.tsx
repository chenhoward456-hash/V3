'use client'

import { useEffect, useState } from 'react'

/**
 * 最近的 macro 調整紀錄（教練後台，收合式）。
 *
 * 為什麼要有：`macro_adjustment_log` 一直有在寫，但**後台沒有任何地方看得到**——
 * 教練填的調整理由等於寫進黑洞。多教練上線後這是「誰依什麼改了這個人的數字」
 * 唯一的答案來源，也是營養建議的責任軌跡。
 *
 * 只讀、不寫；預設收合，不佔版面。
 */

type LogRow = {
  applied_at: string
  applied_by: string
  trigger_source: string
  reason: string | null
  old_macros: Record<string, number | null> | null
  new_macros: Record<string, number | null> | null
}

const FIELD_LABEL: Record<string, string> = {
  calories_target: '熱量',
  protein_target: '蛋白',
  carbs_target: '碳水',
  fat_target: '脂肪',
  carbs_training_day: '訓練日碳水',
  carbs_rest_day: '休息日碳水',
  cardio_minutes_per_day: '有氧',
}

const SOURCE_LABEL: Record<string, string> = {
  trajectory: '系統依進度',
  manual: '手動',
  tdee_weekly: '系統週更 TDEE',
}

/** 只列真的變了的欄位，省得一排「220 → 220」 */
function diffLine(row: LogRow): string {
  const oldM = row.old_macros ?? {}
  const newM = row.new_macros ?? {}
  const parts: string[] = []
  for (const key of Object.keys(FIELD_LABEL)) {
    const o = oldM[key]
    const n = newM[key]
    if (o == null || n == null) continue
    if (Number(o) === Number(n)) continue
    parts.push(`${FIELD_LABEL[key]} ${o} → ${n}`)
  }
  return parts.join('、')
}

export default function MacroAdjustmentHistory({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<LogRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open || rows || loading) return
    setLoading(true)
    fetch(`/api/admin/macro-adjustment-log?clientId=${clientId}`)
      .then(r => r.json())
      .then(j => setRows(Array.isArray(j?.data) ? j.data.slice(0, 10) : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [open, rows, loading, clientId])

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        {open ? '▾' : '▸'} 最近的調整紀錄
      </button>

      {open && (
        <div className="mt-3 space-y-2.5">
          {loading && <p className="text-xs text-slate-400">讀取中…</p>}
          {!loading && rows?.length === 0 && (
            <p className="text-xs text-slate-400">還沒有調整紀錄。</p>
          )}
          {rows?.map((row, i) => {
            const diff = diffLine(row)
            return (
              <div key={`${row.applied_at}-${i}`} className="text-xs leading-relaxed">
                <div className="flex flex-wrap items-baseline gap-x-2 text-slate-500 tabular-nums">
                  <span>{row.applied_at.slice(0, 10)}</span>
                  <span>·</span>
                  <span>{row.applied_by === 'coach' ? '教練' : '系統'}</span>
                  <span className="text-slate-400">{SOURCE_LABEL[row.trigger_source] ?? row.trigger_source}</span>
                </div>
                {diff && <div className="text-slate-700 mt-0.5">{diff}</div>}
                {row.reason && <div className="text-slate-500 mt-0.5">{row.reason}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
