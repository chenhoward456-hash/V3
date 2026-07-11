'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Check } from 'lucide-react'
import type { Client, ClientDataPayload } from '@/hooks/useClientData'
import type { KeyedMutator } from 'swr'
import PushNotificationPrompt from '@/components/client/PushNotificationPrompt'

interface Props {
  client: Client
  clientData: ClientDataPayload
  selectedDate: string
  mutate: KeyedMutator<ClientDataPayload>
  onShowFullDashboard: () => void
}

const STORAGE_KEY = 'hp_force_full_dashboard'

export function shouldUseNewUserMode(clientData: ClientDataPayload | undefined): boolean {
  if (!clientData) return false
  const totalEntries =
    (clientData.bodyData?.length || 0) +
    (clientData.trainingLogs?.length || 0) +
    (clientData.nutritionLogs?.length || 0) +
    (clientData.wellness?.length || 0)
  if (totalEntries > 0) return false
  try {
    if (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'true') {
      return false
    }
  } catch {}
  return true
}

export default function NewUserLanding({
  client,
  clientData: _clientData,
  selectedDate,
  mutate,
  onShowFullDashboard,
}: Props) {
  const [weight, setWeight] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const w = parseFloat(weight)
    if (isNaN(w) || w < 20 || w > 300) {
      setError('請輸入 20-300 kg 之間的數值')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/body-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.unique_code,
          date: selectedDate,
          weight: w,
          bodyFat: null,
          muscleMass: null,
          height: client.height || null,
          visceralFat: null,
        }),
      })
      if (!res.ok) throw new Error('保存失敗')
      setSubmitted(true)
      await mutate()
    } catch (err) {
      setError('保存失敗，再試一次')
    } finally {
      setSubmitting(false)
    }
  }

  const unlockFullDashboard = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true')
    } catch {}
    onShowFullDashboard()
  }

  const firstName = client.name || '你'
  const helpUrl = `/c/${client.unique_code}/help`

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Hero — 一個動作就好 */}
      <div className="bg-zinc-900 rounded-2xl p-5 text-white">
        <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-400 font-semibold">Day 1 · Start your streak</p>
        <h1 className="text-5xl font-black tracking-tight mt-3 leading-[1.05]">
          量今天<br />的體重。
        </h1>
        <div className="mt-5 inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
          <span className="text-emerald-400 font-bold tabular-nums">
            {submitted ? '1' : '0'}
          </span>
          <span className="text-xs text-zinc-300">
            {submitted ? '明天再打卡，streak 跳成 2' : '今天打卡，streak 跳成 1'}
          </span>
        </div>
        <p className="text-xs text-zinc-400 mt-5 leading-relaxed">
          {firstName}，重點不是算營養素，是<b className="text-zinc-200">連續追蹤</b>。先連續打卡 14 天，趨勢才會說話。
        </p>
      </div>

      {/* 體重輸入 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        {submitted ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-emerald-700">
              <div className="bg-emerald-100 rounded-full p-2">
                <Check size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold">第一筆紀錄完成</p>
                <p className="text-xs text-emerald-600 mt-0.5">明天起床後再打一次，連續 3 天解鎖飲食記錄</p>
              </div>
            </div>
            {/* 第一筆完成＝熱度最高的一刻，立刻把唯一已驗證的留存槓桿（開推播）擺成下一個動作。
                新用戶過去走這條 NewUserLanding 分支時根本看不到推播卡 → 留存稽核點名的根因。 */}
            <PushNotificationPrompt code={client.unique_code} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="text-sm font-semibold text-gray-900">今天的體重 (kg)</span>
              <p className="text-[11px] text-gray-500 mt-0.5">早上起床、上完廁所、空腹量最準</p>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="例如 73.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="mt-2 w-full px-4 py-3 text-2xl font-bold border border-slate-200 rounded-xl focus:border-primary-500 focus:outline-none"
                autoFocus
              />
            </label>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !weight}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {submitting ? '記錄中…' : '記錄體重'}
            </button>
          </form>
        )}
      </div>

      {/* 接下來會發生什麼 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">接下來會發生什麼</p>
        <div className="space-y-2.5 text-xs text-gray-600">
          <div className="flex gap-2 items-start">
            <span className="bg-primary-100 text-primary-700 text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">1</span>
            <span><b className="text-gray-800">今天</b>：先打第一筆體重，認識介面。其他先別管。</span>
          </div>
          <div className="flex gap-2 items-start">
            <span className="bg-primary-100 text-primary-700 text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">2</span>
            <span><b className="text-gray-800">第 3 天</b>：解鎖飲食記錄。看你想不想加。</span>
          </div>
          <div className="flex gap-2 items-start">
            <span className="bg-primary-100 text-primary-700 text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">3</span>
            <span><b className="text-gray-800">第 7 天</b>：你會看到體重趨勢線。第一次數據說話。</span>
          </div>
          <div className="flex gap-2 items-start">
            <span className="bg-primary-100 text-primary-700 text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">4</span>
            <span><b className="text-gray-800">第 14 天</b>：完整儀表板解鎖，週平均 + Howard 解讀句。</span>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-4">不想等？下方可以直接顯示完整版。</p>
      </div>

      {/* 想看完整版 escape hatch */}
      <button
        onClick={unlockFullDashboard}
        className="w-full bg-white border border-dashed border-gray-300 hover:border-primary-300 rounded-2xl p-4 text-left flex items-center justify-between gap-3 group transition-colors"
      >
        <div>
          <p className="text-sm font-semibold text-gray-800">我已經熟悉這類系統，給我完整版</p>
          <p className="text-[11px] text-gray-500 mt-1">解鎖全部功能：飲食、訓練、補品、感受、AI 分析</p>
        </div>
        <ChevronRight size={20} className="text-gray-400 group-hover:text-primary-500 flex-shrink-0" />
      </button>

      {/* Help + LINE 提醒 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href={helpUrl} className="bg-white border border-slate-200 rounded-2xl p-5 transition-colors">
          <p className="text-sm font-semibold text-gray-800">完整使用說明</p>
          <p className="text-[11px] text-gray-500 mt-1">5 分鐘讀完</p>
        </Link>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
          <p className="text-sm font-semibold text-emerald-900">{client.has_line_binding ? 'LINE 已綁定 ✓' : 'LINE 還沒綁？'}</p>
          <p className="text-[11px] text-emerald-700 mt-1">{client.has_line_binding ? '可直接傳體重數字記錄' : '綁了就能用 LINE 快速回報體重'}</p>
        </div>
      </div>
    </div>
  )
}
