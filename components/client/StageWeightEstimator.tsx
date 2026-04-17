'use client'

interface StageWeightEstimatorProps {
  currentWeight: number
  currentBodyFat: number  // percentage, e.g. 8.5
  targetWeight?: number | null
  targetBodyFat?: number | null
  competitionDate?: string | null
}

export default function StageWeightEstimator({ currentWeight, currentBodyFat, targetWeight, targetBodyFat, competitionDate }: StageWeightEstimatorProps) {
  const ffm = currentWeight * (1 - currentBodyFat / 100)

  // Estimate muscle loss during prep (1-2kg typical for natural athletes)
  const scenarios = [
    { muscleLoss: 0, label: '最佳狀況（零肌肉流失）' },
    { muscleLoss: 1.5, label: '正常範圍（流失 1.5kg）' },
    { muscleLoss: 3, label: '較多流失（流失 3kg）' },
  ]

  const bodyFatTargets = [4, 5, 6, 7]

  const daysLeft = competitionDate
    ? Math.max(0, Math.floor((new Date(competitionDate).getTime() - Date.now()) / (86400000)))
    : null

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">🎯 上台體重推算</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            根據 InBody：{currentWeight}kg / 體脂 {currentBodyFat}% / FFM {ffm.toFixed(1)}kg
          </p>
        </div>
        {daysLeft != null && daysLeft > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            {daysLeft} 天
          </span>
        )}
      </div>

      {/* 主要推算表 - 使用正常範圍 (1.5kg 肌肉流失) */}
      <div className="bg-white rounded-xl p-3 mb-3">
        <p className="text-[10px] text-gray-400 mb-2">預估上台體重（假設流失 1.5kg 肌肉）</p>
        <div className="grid grid-cols-4 gap-2">
          {bodyFatTargets.map(bf => {
            const adjFFM = ffm - 1.5
            const stageWeight = adjFFM / (1 - bf / 100)
            const needToLose = currentWeight - stageWeight
            const weeklyRate = daysLeft ? (needToLose / (daysLeft / 7)) : null
            const weeklyPct = weeklyRate ? (weeklyRate / currentWeight * 100) : null
            const feasibility = weeklyPct == null ? 'unknown'
              : weeklyPct <= 0.7 ? 'safe'
              : weeklyPct <= 1.0 ? 'aggressive'
              : 'extreme'
            const colors = {
              safe: 'bg-green-50 border-green-200 text-green-700',
              aggressive: 'bg-amber-50 border-amber-200 text-amber-700',
              extreme: 'bg-red-50 border-red-200 text-red-700',
              unknown: 'bg-gray-50 border-gray-200 text-gray-600',
            }

            return (
              <div key={bf} className={`border rounded-lg p-2 text-center ${colors[feasibility]}`}>
                <p className="text-[10px] font-medium">{bf}% 體脂</p>
                <p className="text-lg font-bold">{stageWeight.toFixed(1)}</p>
                <p className="text-[9px]">kg</p>
                {weeklyRate != null && (
                  <p className="text-[9px] mt-1">
                    -{needToLose.toFixed(1)}kg
                    <br />
                    {weeklyRate.toFixed(2)}kg/週
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-center gap-4 mt-2">
          <span className="text-[9px] text-green-600">🟢 安全（≤0.7%/週）</span>
          <span className="text-[9px] text-amber-600">🟡 積極（0.7-1%）</span>
          <span className="text-[9px] text-red-600">🔴 極限（&gt;1%）</span>
        </div>
      </div>

      {/* 目標對比 */}
      {targetWeight && targetBodyFat && (
        <div className="bg-white/70 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 mb-1">教練設定 vs 推算</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-gray-500">教練目標</p>
              <p className="text-base font-bold text-gray-900">{targetWeight}kg / {targetBodyFat}%</p>
              <p className="text-[10px] text-gray-400">FFM {(targetWeight * (1 - (targetBodyFat as number) / 100)).toFixed(1)}kg</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500">系統推算（5% 體脂）</p>
              <p className="text-base font-bold text-indigo-700">{((ffm - 1.5) / 0.95).toFixed(1)}kg</p>
              <p className="text-[10px] text-gray-400">FFM {(ffm - 1.5).toFixed(1)}kg</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-[9px] text-gray-400 mt-2 text-center">
        InBody 對低體脂選手可能偏低 1-2%。建議搭配皮脂夾或 DEXA 交叉驗證。
      </p>
    </div>
  )
}
