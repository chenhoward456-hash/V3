'use client'

import { useState, useOptimistic } from 'react'
import React from 'react'
import { getLocalDateStr } from '@/lib/date-utils'

interface Supplement {
  id: string
  name: string
  dosage: string
  timing: string
  why?: string
}

interface SupplementLog {
  id: string
  supplement_id: string
  date: string
  completed: boolean
}

interface SupplementChecklistProps {
  clientId: string
  supplements: Supplement[]
  initialLogs: SupplementLog[]
}

function SupplementChecklist({ 
  clientId, 
  supplements,
  initialLogs = []
}: SupplementChecklistProps) {
  const today = getLocalDateStr()
  
  // 樂觀更新狀態
  const [optimisticLogs, addOptimisticLog] = useOptimistic(
    initialLogs,
    (state, newLog: { supplement_id: string; completed: boolean }) => {
      const exists = state.find(log => log.supplement_id === newLog.supplement_id)
      if (exists) {
        return state.map(log => 
          log.supplement_id === newLog.supplement_id 
            ? { ...log, completed: newLog.completed }
            : log
        )
      }
      return [...state, { 
        id: crypto.randomUUID(), 
        supplement_id: newLog.supplement_id, 
        date: today, 
        completed: newLog.completed 
      }]
    }
  )
  
  // 處理打勾
  const handleToggle = async (supplementId: string) => {
    const currentLog = optimisticLogs.find(log => log.supplement_id === supplementId)
    const newCompleted = !currentLog?.completed
    
    // 立即更新 UI（樂觀更新）
    addOptimisticLog({ supplement_id: supplementId, completed: newCompleted })
    
    // 背景同步到資料庫（不等待完成）
    fetch('/api/supplement-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        supplement_id: supplementId,
        date: today,
        completed: newCompleted
      })
    }).catch(error => {
      console.error('打卡失敗:', error)
      // 回滾樂觀更新
      addOptimisticLog({ supplement_id: supplementId, completed: !newCompleted })
    })
  }
  
  // 檢查是否已打勾
  const isChecked = (supplementId: string) => {
    const log = optimisticLogs.find(log => log.supplement_id === supplementId)
    return log?.completed || false
  }
  
  // 計算完成率
  const completionRate = Math.round(
    (optimisticLogs.filter(log => log.completed).length / supplements.length) * 100
  )
  
  // 按優先級分組
  const groupByPriority = (priority: string) => {
    return supplements.filter(sup => {
      // 根據補品名稱判斷優先級
      if (sup.name.includes('B群') || sup.name.includes('D3') || sup.name.includes('鐵劑') || sup.name.includes('肌醇') || sup.name.includes('鉻')) return priority === 'Lv.1'
      if (sup.name.includes('魚油') || sup.name.includes('鎂')) return priority === 'Lv.1'
      return priority === 'Lv.2'
    })
  }
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-xl font-medium text-gray-900 mb-2">📅 今日補品 {today}</h2>
        <p className="text-sm text-gray-600">
          完成率：{completionRate}% ({optimisticLogs.filter(l => l.completed).length}/{supplements.length})
        </p>
      </div>
      
      <div className="space-y-6">
        {/* Lv.1 優先級 */}
        {groupByPriority('Lv.1').length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              🔥 Lv.1 優先級
            </h3>
            <div className="space-y-2">
              {groupByPriority('Lv.1').map(sup => (
                <SupplementItem
                  key={sup.id}
                  supplement={sup}
                  isChecked={isChecked(sup.id)}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Lv.2 優先級 */}
        {groupByPriority('Lv.2').length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              ⭐ Lv.2 優先級
            </h3>
            <div className="space-y-2">
              {groupByPriority('Lv.2').map(sup => (
                <SupplementItem
                  key={sup.id}
                  supplement={sup}
                  isChecked={isChecked(sup.id)}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 時段區塊組件
function TimingSection({ title, supplements, isChecked, onToggle }: {
  title: string
  supplements: Supplement[]
  isChecked: (id: string) => boolean
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        {title}
      </h3>
      <div className="space-y-2">
        {supplements.map(sup => (
          <SupplementItem
            key={sup.id}
            supplement={sup}
            isChecked={isChecked(sup.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  )
}

// 單個補品項目
const SupplementItem = React.memo(function SupplementItem({ supplement, isChecked, onToggle }: {
  supplement: Supplement
  isChecked: boolean
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
      {/* Checkbox */}
      <input
        type="checkbox"
        id={supplement.id}
        checked={isChecked}
        onChange={() => onToggle(supplement.id)}
        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
      />
      
      {/* 內容 */}
      <div className="flex-1">
        <label 
          htmlFor={supplement.id}
          className={`block font-medium cursor-pointer ${
            isChecked ? 'text-gray-400 line-through' : 'text-gray-900'
          }`}
        >
          {supplement.name} <span className="text-sm text-gray-600">{supplement.dosage}</span>
        </label>
        
        {/* 為什麼要吃 */}
        {supplement.why && (
          <p className="text-xs text-gray-500 mt-1">
            💡 {supplement.why}
          </p>
        )}
      </div>
    </div>
  )
})

export default React.memo(SupplementChecklist)
