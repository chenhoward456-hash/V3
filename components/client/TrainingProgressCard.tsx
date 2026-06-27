'use client'

import { useMemo } from 'react'
import { computeTrainingProgress, type TrainingSetRow } from '@/lib/training-progress'

/**
 * 訓練進步卡（學員端）：推估 1RM 進步 / PR / 停滯 / 本週各肌群組數。
 * 看得到自己的進步 = 回來的理由。資料來自 trainingSets（近 120 天）。
 */
export default function TrainingProgressCard({ sets }: { sets: TrainingSetRow[] }) {
  const p = useMemo(() => computeTrainingProgress(sets || []), [sets])

  const tracked = p.exercises.filter(e => e.bestE1RM != null).slice(0, 6)
  if (tracked.length === 0 && p.muscleGroupSets.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">💪</span>
        <h3 className="text-base font-semibold text-gray-900">訓練進步</h3>
      </div>

      {p.prsThisWeek.length > 0 && (
        <div className="mb-3 text-sm bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-800">
          🎉 本週刷新個人紀錄：<b>{p.prsThisWeek.join('、')}</b>
        </div>
      )}

      {tracked.length > 0 && (
        <div className="space-y-2">
          {tracked.map(e => (
            <div key={e.exercise} className="flex items-center justify-between gap-3 text-sm border-b border-gray-50 pb-2 last:border-0">
              <div className="min-w-0">
                <span className="font-medium text-gray-900">{e.exercise}</span>
                {e.isPR && <span className="ml-1.5 text-[11px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">PR</span>}
                {e.plateau && <span className="ml-1.5 text-[11px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">停滯</span>}
                <div className="text-xs text-gray-400 mt-0.5">最重 {e.topWeight}kg · 練過 {e.sessions} 次</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold text-gray-900">推估 1RM {e.latestE1RM}<span className="text-xs font-normal text-gray-400">kg</span></div>
                {e.gainPct != null && e.gainPct !== 0 && (
                  <div className={`text-xs font-medium ${e.gainPct > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {e.gainPct > 0 ? '↗ +' : '↘ '}{e.gainPct}%
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {p.plateaus.length > 0 && (
        <p className="mt-3 text-xs text-amber-700">
          ⚠️ {p.plateaus.slice(0, 3).join('、')} 已 4 週沒突破——可考慮換動作、加組數或調整重量區間，找教練聊聊。
        </p>
      )}

      {p.weeklyVolume.length >= 2 && (() => {
        const maxVol = Math.max(...p.weeklyVolume.map(w => w.volume))
        return (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">每週訓練量（總重量×次數，kg）</p>
            <div className="flex items-end gap-1.5 h-20">
              {p.weeklyVolume.map(w => (
                <div key={w.week} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${w.week}：${w.volume.toLocaleString()} kg`}>
                  <span className="text-[11px] text-gray-400">{(w.volume / 1000).toFixed(1)}k</span>
                  <div
                    className="w-full bg-blue-400 rounded-t"
                    style={{ height: `${maxVol > 0 ? Math.max(4, (w.volume / maxVol) * 56) : 4}px` }}
                  />
                  <span className="text-[11px] text-gray-400">{w.week.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {p.muscleGroupSets.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-1.5">本週各肌群訓練組數</p>
          <div className="flex flex-wrap gap-1.5">
            {p.muscleGroupSets.map(m => (
              <span key={m.group} className="text-xs bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5 text-gray-700">
                {m.group} <b>{m.sets}</b> 組
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
