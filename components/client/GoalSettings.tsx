'use client'

import { useState } from 'react'
import { Target, ChevronDown, ChevronUp, Check } from 'lucide-react'

interface GoalSettingsProps {
  clientId: string
  uniqueCode: string
  currentGoalType: string | null
  currentTargetWeight: number | null
  currentTargetBodyFat: number | null
  currentTargetDate: string | null
  latestWeight: number | null
  latestBodyFat: number | null
  onMutate: () => void
}

const GOAL_OPTIONS = [
  { key: 'cut' as const, label: '減脂', desc: '降低體重和體脂' },
  { key: 'recomp' as const, label: '體態重組', desc: '維持體重、降體脂增肌' },
  { key: 'bulk' as const, label: '增肌', desc: '增加肌肉量' },
]

export default function GoalSettings({
  clientId,
  uniqueCode,
  currentGoalType,
  currentTargetWeight,
  currentTargetBodyFat,
  currentTargetDate,
  latestWeight,
  latestBodyFat,
  onMutate,
}: GoalSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [goalType, setGoalType] = useState(currentGoalType || 'cut')
  const [targetWeight, setTargetWeight] = useState(currentTargetWeight?.toString() || '')
  const [targetBodyFat, setTargetBodyFat] = useState(currentTargetBodyFat?.toString() || '')
  const [targetDate, setTargetDate] = useState(currentTargetDate || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const hasChanges =
    goalType !== (currentGoalType || 'cut') ||
    targetWeight !== (currentTargetWeight?.toString() || '') ||
    targetBodyFat !== (currentTargetBodyFat?.toString() || '') ||
    targetDate !== (currentTargetDate || '')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const body: Record<string, string | number | null> = {
        clientId,
        goal_type: goalType,
      }

      const tw = targetWeight ? parseFloat(targetWeight) : null
      if (tw && tw > 30 && tw < 300) body.target_weight = tw

      const tbf = targetBodyFat ? parseFloat(targetBodyFat) : null
      if (tbf && tbf > 3 && tbf < 60) body.target_body_fat = tbf

      if (targetDate) body.target_date = targetDate

      const res = await fetch('/api/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '儲存失敗')
      }

      setSaved(true)
      onMutate()
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err.message || '儲存失敗，請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  const goalLabel = GOAL_OPTIONS.find(g => g.key === currentGoalType)?.label || '未設定'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
            <Target size={16} className="text-blue-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-800">目標設定</p>
            <p className="text-[11px] text-gray-400">
              {goalLabel}
              {currentTargetWeight ? ` · ${currentTargetWeight}kg` : ''}
              {currentTargetBodyFat ? ` · ${currentTargetBodyFat}%` : ''}
            </p>
          </div>
        </div>
        {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {/* Expandable form */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          {/* Goal Type */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">目標類型</label>
            <div className="grid grid-cols-3 gap-2">
              {GOAL_OPTIONS.map(({ key, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGoalType(key)}
                  className={`py-2 px-1 rounded-xl text-xs transition-all border-2 ${
                    goalType === key
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Target Weight & Body Fat */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                目標體重 (kg)
              </label>
              <input
                type="number"
                inputMode="decimal"
                placeholder={latestWeight ? `目前 ${latestWeight}` : '例如 65'}
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                min="30"
                max="300"
                step="0.1"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                目標體脂 (%)
              </label>
              <input
                type="number"
                inputMode="decimal"
                placeholder={latestBodyFat ? `目前 ${latestBodyFat}%` : '例如 15'}
                value={targetBodyFat}
                onChange={(e) => setTargetBodyFat(e.target.value)}
                min="3"
                max="60"
                step="0.1"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Target Date */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              目標日期 <span className="text-gray-400 font-normal">— 選填</span>
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
            <p className="text-[10px] text-gray-400 mt-1">有設定日期時，系統會計算每週需要的進度</p>
          </div>

          {goalType === 'recomp' && (
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-700 leading-relaxed">
                <strong>體態重組</strong>：適合體重 OK 但想降體脂、增肌肉的人。
                系統會用接近 TDEE 的熱量 + 高蛋白策略，幫你同時減脂增肌。
                建議填寫目標體脂率。
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
              saved
                ? 'bg-green-500 text-white'
                : hasChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? '儲存中...' : saved ? (
              <span className="flex items-center justify-center gap-1"><Check size={14} /> 已儲存</span>
            ) : '儲存目標'}
          </button>
        </div>
      )}
    </div>
  )
}
