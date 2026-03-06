'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { X, Send } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface NutritionEntry {
  date: string
  protein_grams?: number | null
  carbs_grams?: number | null
  fat_grams?: number | null
  calories?: number | null
  water_ml?: number | null
  compliant?: boolean | null
}

interface WellnessEntry {
  date: string
  mood?: number | null
  energy_level?: number | null
  sleep_quality?: number | null
  hunger?: number | null
  digestion?: number | null
  stress?: number | null
}

interface AiChatDrawerProps {
  open: boolean
  onClose: () => void
  // Auth
  clientId: string
  // Client context
  clientName: string
  gender: string | null
  goalType: string | null
  // Today's nutrition
  todayNutrition: NutritionEntry | null
  // Targets
  caloriesTarget: number | null
  proteinTarget: number | null
  carbsTarget: number | null
  fatTarget: number | null
  waterTarget: number | null
  // Context
  isTrainingDay: boolean
  competitionEnabled: boolean
  latestWeight?: number | null
  latestBodyFat?: number | null
  // Extended context
  nutritionLogs?: NutritionEntry[]
  wellnessLogs?: WellnessEntry[]
  trainingLogs?: { date: string; training_type?: string; note?: string }[]
  supplements?: { name: string; dosage?: string; timing?: string }[]
  supplementComplianceRate?: number
  todayWellness?: WellnessEntry | null
  wearableData?: { hrv?: number | null; resting_hr?: number | null; device_recovery_score?: number | null } | null
  onFirstMessage?: () => void
}

export default function AiChatDrawer({
  open, onClose,
  clientId,
  clientName, gender, goalType,
  todayNutrition,
  caloriesTarget, proteinTarget, carbsTarget, fatTarget, waterTarget,
  isTrainingDay, competitionEnabled,
  latestWeight, latestBodyFat,
  nutritionLogs, wellnessLogs, trainingLogs,
  supplements, supplementComplianceRate,
  todayWellness, wearableData,
  onFirstMessage,
}: AiChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + 'px'
    }
  }, [input])

  const systemPrompt = useMemo(() => {
    const eaten = todayNutrition
    const pEaten = eaten?.protein_grams ?? 0
    const cEaten = eaten?.carbs_grams ?? 0
    const fEaten = eaten?.fat_grams ?? 0
    const calEaten = eaten?.calories ?? 0
    const wEaten = eaten?.water_ml ?? 0

    const pLeft = proteinTarget ? Math.max(0, proteinTarget - pEaten) : null
    const cLeft = carbsTarget ? Math.max(0, carbsTarget - cEaten) : null
    const fLeft = fatTarget ? Math.max(0, fatTarget - fEaten) : null
    const calLeft = caloriesTarget ? Math.max(0, caloriesTarget - calEaten) : null
    const wLeft = waterTarget ? Math.max(0, waterTarget - wEaten) : null

    // Build 7-day nutrition summary
    const last7Nutrition = (nutritionLogs || [])
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .map(n => `${n.date}: ${n.calories ?? 0}kcal P${n.protein_grams ?? 0}g C${n.carbs_grams ?? 0}g F${n.fat_grams ?? 0}g ${n.compliant ? '✓合規' : n.compliant === false ? '✗未合規' : ''}`)
      .join('\n')

    // Build 7-day wellness summary
    const last7Wellness = (wellnessLogs || [])
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .map(w => {
        const parts = [w.date]
        if (w.mood != null) parts.push(`心情${w.mood}/5`)
        if (w.energy_level != null) parts.push(`精力${w.energy_level}/5`)
        if (w.sleep_quality != null) parts.push(`睡眠${w.sleep_quality}/5`)
        if (w.hunger != null) parts.push(`飢餓${w.hunger}/5`)
        if (w.stress != null) parts.push(`壓力${w.stress}/5`)
        return parts.join(' ')
      })
      .join('\n')

    // Build 7-day training summary
    const last7Training = (trainingLogs || [])
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .map(t => `${t.date}: ${t.training_type || '訓練'}${t.note ? ` (${t.note.slice(0, 30)})` : ''}`)
      .join('\n')

    // Supplement list
    const suppList = (supplements || [])
      .map(s => `${s.name}${s.dosage ? ` ${s.dosage}` : ''}${s.timing ? ` (${s.timing})` : ''}`)
      .join('、')

    // Today's wellness
    const wellnessStr = todayWellness
      ? [
          todayWellness.mood != null ? `心情${todayWellness.mood}/5` : '',
          todayWellness.energy_level != null ? `精力${todayWellness.energy_level}/5` : '',
          todayWellness.sleep_quality != null ? `睡眠${todayWellness.sleep_quality}/5` : '',
          todayWellness.hunger != null ? `飢餓感${todayWellness.hunger}/5` : '',
          todayWellness.stress != null ? `壓力${todayWellness.stress}/5` : '',
        ].filter(Boolean).join('、')
      : ''

    // Wearable data
    const wearableStr = wearableData
      ? [
          wearableData.hrv != null ? `HRV ${wearableData.hrv}` : '',
          wearableData.resting_hr != null ? `靜息心率 ${wearableData.resting_hr}` : '',
          wearableData.device_recovery_score != null ? `恢復分數 ${wearableData.device_recovery_score}/100` : '',
        ].filter(Boolean).join('、')
      : ''

    return `你是 Howard Protocol 的 AI 健康顧問助手。你正在協助一位學員規劃飲食和健康管理。

## 學員資料
- 姓名：${clientName}
- 性別：${gender || '未設定'}
- 目標：${goalType === 'cut' ? '減脂' : goalType === 'bulk' ? '增肌' : '未設定'}
- 今天是${isTrainingDay ? '訓練日' : '休息日'}
${competitionEnabled ? '- 備賽模式' : ''}
${latestWeight ? `- 最新體重：${latestWeight} kg` : ''}
${latestBodyFat ? `- 最新體脂：${latestBodyFat}%` : ''}

## 今日營養目標
${caloriesTarget ? `- 熱量目標：${caloriesTarget} kcal` : ''}
${proteinTarget ? `- 蛋白質目標：${proteinTarget}g` : ''}
${carbsTarget ? `- 碳水目標：${carbsTarget}g` : ''}
${fatTarget ? `- 脂肪目標：${fatTarget}g` : ''}
${waterTarget ? `- 水分目標：${waterTarget} ml` : ''}

## 今日已攝取
- 熱量：${calEaten} kcal
- 蛋白質：${pEaten}g
- 碳水：${cEaten}g
- 脂肪：${fEaten}g
- 水分：${wEaten} ml

## 今日剩餘需求
${calLeft != null ? `- 熱量：還需 ${calLeft} kcal` : ''}
${pLeft != null ? `- 蛋白質：還需 ${pLeft}g` : ''}
${cLeft != null ? `- 碳水：還需 ${cLeft}g` : ''}
${fLeft != null ? `- 脂肪：還需 ${fLeft}g` : ''}
${wLeft != null ? `- 水分：還需 ${wLeft} ml` : ''}
${wellnessStr ? `\n## 今日身心狀態\n${wellnessStr}` : ''}
${wearableStr ? `\n## 穿戴裝置數據\n${wearableStr}` : ''}
${last7Nutrition ? `\n## 過去 7 天營養紀錄\n${last7Nutrition}` : ''}
${last7Wellness ? `\n## 過去 7 天身心狀態\n${last7Wellness}` : ''}
${last7Training ? `\n## 過去 7 天訓練紀錄\n${last7Training}` : ''}
${suppList ? `\n## 目前補劑清單\n${suppList}${supplementComplianceRate != null ? `\n- 近 7 天服從率：${supplementComplianceRate}%` : ''}` : ''}

## 回答原則
1. 根據「剩餘需求」給出具體的外食建議（711、全家、超商、自助餐、外送等）
2. 每個建議要附上大約的營養素估算（蛋白質、碳水、脂肪、熱量）
3. 回答以繁體中文為主，語氣親切實用
4. 建議要具體到品項名稱，不要只說「高蛋白食物」
5. 如果學員已經吃超標，提醒但不責備，給出調整方案
6. 根據過去 7 天的趨勢給出更精準的建議（例如連續幾天蛋白質不足、睡眠差影響恢復等）
7. 如果身心狀態不佳（精力低、壓力高、睡眠差），適當調整飲食建議（例如建議含鎂食物助眠、抗氧化食物抗壓）
8. 可以根據補劑清單給出搭配飲食的建議
9. 不做醫療診斷，建議以科學為基礎
10. 回答簡潔，不超過 400 字`
  }, [clientName, gender, goalType, todayNutrition, caloriesTarget, proteinTarget, carbsTarget, fatTarget, waterTarget, isTrainingDay, competitionEnabled, latestWeight, latestBodyFat, nutritionLogs, wellnessLogs, trainingLogs, supplements, supplementComplianceRate, todayWellness, wearableData])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    // 標記免費用戶的首次使用
    if (messages.length === 0 && onFirstMessage) {
      onFirstMessage()
    }

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, systemPrompt, clientId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err.quota_exceeded) {
          setMessages([
            ...newMessages,
            { role: 'assistant', content: '本月免費體驗次數已用完 🙏\n\n你可以選擇：' },
          ])
          setQuotaExceeded(true)
          setLoading(false)
          return
        }
        throw new Error(err.error || '回覆失敗')
      }

      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.reply }])
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `抱歉，發生錯誤：${err.message || '請稍後再試'}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Remaining macros summary
  const remaining = useMemo(() => {
    const eaten = todayNutrition
    const parts: string[] = []
    if (proteinTarget) {
      const left = Math.max(0, proteinTarget - (eaten?.protein_grams ?? 0))
      if (left > 0) parts.push(`蛋白質 ${left}g`)
    }
    if (carbsTarget) {
      const left = Math.max(0, carbsTarget - (eaten?.carbs_grams ?? 0))
      if (left > 0) parts.push(`碳水 ${left}g`)
    }
    if (fatTarget) {
      const left = Math.max(0, fatTarget - (eaten?.fat_grams ?? 0))
      if (left > 0) parts.push(`脂肪 ${left}g`)
    }
    return parts
  }, [todayNutrition, proteinTarget, carbsTarget, fatTarget])

  if (!open) return null

  const quickQuestions = [
    '我今天剩餘的量，去 711 要怎麼買？',
    '幫我配一餐自助餐的組合',
    '推薦適合的宵夜選擇',
    '外食怎麼搭才能補齊蛋白質？',
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[90] backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-[100] bg-white rounded-t-2xl shadow-2xl flex flex-col animate-slide-up"
        style={{ maxHeight: '85vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">AI 飲食顧問</p>
              {remaining.length > 0 && (
                <p className="text-[10px] text-gray-400">今日還需：{remaining.join('、')}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: '200px' }}>
          {messages.length === 0 && (
            <div className="py-6">
              <p className="text-sm text-gray-500 text-center mb-4">
                我知道你今天的營養目標和已攝取量，直接問我怎麼吃就好！
              </p>
              <div className="space-y-2">
                {quickQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus() }}
                    className="w-full text-left text-sm text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-[#2563eb] px-4 py-2.5 rounded-xl transition-colors border border-gray-100"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#2563eb] text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {quotaExceeded && (
            <div className="space-y-2 ml-1 max-w-[85%]">
              <a
                href="/join?waitlist=self_managed"
                className="block w-full text-center bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors text-sm"
              >
                升級自主管理版 NT$499/月
                <span className="block text-[10px] font-normal opacity-80 mt-0.5">即將開放，先加入候補名單</span>
              </a>
              <a
                href="https://lin.ee/LP65rCc"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-[#06C755] text-white font-semibold py-3 px-4 rounded-xl hover:bg-[#05b04d] transition-colors text-sm"
              >
                💬 加 LINE 讓 Howard 直接幫你分析
                <span className="block text-[10px] font-normal opacity-80 mt-0.5">現在就可以，真人回覆</span>
              </a>
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-500 px-4 py-3 rounded-2xl rounded-bl-md text-sm">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-3 py-2.5 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="問我今天怎麼吃..."
              rows={1}
              className="flex-1 resize-none px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2563eb] transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="bg-[#2563eb] text-white p-2.5 rounded-xl hover:bg-[#1d4ed8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center">
            AI 建議僅供參考，不構成醫療診斷
          </p>
        </div>
      </div>
    </>
  )
}
