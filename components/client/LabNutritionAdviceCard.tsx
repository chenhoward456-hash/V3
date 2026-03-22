'use client'

import { useState } from 'react'
import { generateLabNutritionAdvice, type LabNutritionAdvice } from '@/lib/lab-nutrition-advisor'

interface LabNutritionAdviceCardProps {
  labResults: Array<{ test_name: string; value: number | null; unit: string; status: 'normal' | 'attention' | 'alert'; date?: string }>
  gender?: '男性' | '女性'
  goalType?: 'cut' | 'bulk' | null
}

export default function LabNutritionAdviceCard({ labResults, gender, goalType }: LabNutritionAdviceCardProps) {
  const advice = generateLabNutritionAdvice(labResults, { gender, goalType })

  if (advice.length === 0) return null

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🩸</span>
        <div>
          <h2 className="text-lg font-bold text-gray-900">血檢飲食建議</h2>
          <p className="text-[10px] text-gray-400">根據你的血檢結果，系統自動產出的飲食調整方案</p>
        </div>
      </div>
      <div className="space-y-3">
        {advice.map((item, i) => (
          <AdviceItem key={i} advice={item} />
        ))}
      </div>
    </div>
  )
}

function AdviceItem({ advice }: { advice: LabNutritionAdvice }) {
  const [expanded, setExpanded] = useState(false)
  const bgColor = advice.severity === 'high'
    ? 'bg-red-50 border-red-200'
    : advice.severity === 'positive'
      ? 'bg-green-50 border-green-200'
      : 'bg-amber-50 border-amber-200'
  const textColor = advice.severity === 'high'
    ? 'text-red-700'
    : advice.severity === 'positive'
      ? 'text-green-700'
      : 'text-amber-700'

  return (
    <div className={`${bgColor} border rounded-2xl p-4`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{advice.icon}</span>
            <div>
              <p className={`text-sm font-bold ${textColor}`}>{advice.title}</p>
              <p className="text-[10px] text-gray-500">
                {advice.labMarker} {advice.currentValue}{advice.unit}（目標：{advice.targetRange}）
              </p>
            </div>
          </div>
          <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-[10px] font-bold text-gray-700 mb-1">📋 飲食調整</p>
            <ul className="space-y-1">
              {advice.dietaryChanges.map((change, i) => (
                <li key={i} className="text-[11px] text-gray-700 flex gap-1">
                  <span className="text-gray-400">•</span>
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>

          {advice.foodsToIncrease.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-green-700 mb-1">✅ 建議多吃</p>
              <div className="flex flex-wrap gap-1.5">
                {advice.foodsToIncrease.map((food, i) => (
                  <span key={i} className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    {food}
                  </span>
                ))}
              </div>
            </div>
          )}

          {advice.foodsToReduce.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-red-700 mb-1">⚠️ 建議減少</p>
              <div className="flex flex-wrap gap-1.5">
                {advice.foodsToReduce.map((food, i) => (
                  <span key={i} className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    {food}
                  </span>
                ))}
              </div>
            </div>
          )}

          {advice.macroAdjustment && (
            <div className="bg-white bg-opacity-70 rounded-xl p-2.5">
              <p className="text-[10px] font-bold text-blue-700 mb-0.5">
                🔧 {advice.macroAdjustment.nutrient}調整
              </p>
              <p className="text-[10px] text-blue-600">{advice.macroAdjustment.detail}</p>
            </div>
          )}

          {advice.caveat && (
            <div className="bg-gray-100 rounded-xl p-2.5">
              <p className="text-[10px] font-bold text-gray-600 mb-0.5">⚠️ 判讀提醒</p>
              <p className="text-[10px] text-gray-500">{advice.caveat}</p>
            </div>
          )}

          {advice.references.length > 0 && (
            <div className="border-t border-gray-200 pt-2">
              <p className="text-[10px] font-bold text-gray-400 mb-1">📚 文獻依據</p>
              <ul className="space-y-0.5">
                {advice.references.map((ref, i) => (
                  <li key={i} className="text-[9px] text-gray-400">{ref}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
