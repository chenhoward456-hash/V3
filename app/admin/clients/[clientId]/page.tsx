'use client'

import { useState, useEffect, useMemo } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { calcRecommendedStageWeight, type RecommendedStageWeightResult } from '@/lib/nutrition-engine'
import { daysUntilDateTW, DAY_MS } from '@/lib/date-utils'
import { getDefaultFeatures, type SubscriptionTier } from '@/lib/tier-defaults'
import { isCompetitionMode, isHealthMode, ALL_CLIENT_MODES, MODE_LABELS, MODE_EMOJIS, MODE_CONFIG, BODYBUILDING_PHASE_OPTIONS, ATHLETIC_PHASE_OPTIONS, PHASE_LABELS } from '@/lib/client-mode'

type EditorTab = 'basic' | 'features' | 'notes' | 'lab' | 'supplements'

interface LabResult {
  id?: string
  test_name: string
  value: number
  unit: string
  reference_range: string
  status: 'normal' | 'attention' | 'alert'
  date: string
  custom_advice?: string
  custom_target?: string
}

interface Supplement {
  id?: string
  name: string
  dosage: string
  timing: string
  why?: string
}

interface Client {
  id: string
  unique_code: string
  name: string
  age: number
  gender: string
  status: 'normal' | 'attention' | 'alert'
  coach_summary: string
  coach_weekly_note: string
  next_checkup_date: string
  health_goals: string
  training_enabled: boolean
  nutrition_enabled: boolean
  body_composition_enabled: boolean
  wellness_enabled: boolean
  supplement_enabled: boolean
  lab_enabled: boolean
  client_mode: string
  competition_enabled: boolean
  competition_date: string | null
  prep_phase: string
  weigh_in_gap_hours: number | null
  protein_target: number | null
  water_target: number | null
  carbs_target: number | null
  fat_target: number | null
  calories_target: number | null
  target_weight: number | null
  body_fat_target: number | null
  target_date: string | null
  is_active: boolean
  subscription_tier: 'free' | 'self_managed' | 'coached'
  expires_at: string | null
  ai_chat_enabled: boolean
  carbs_training_day: number | null
  carbs_rest_day: number | null
  goal_type: 'cut' | 'bulk' | null
  diet_start_date: string | null
  activity_profile: 'sedentary' | 'high_energy_flux' | null
  health_mode_enabled: boolean
  simple_mode: boolean
  quarterly_cycle_start: string | null
  coach_macro_override: { locked_at: string; locked_fields: string[]; previous_values?: Record<string, number | null> } | null
  // 基因風險欄位
  gene_mthfr: 'normal' | 'heterozygous' | 'homozygous' | null
  gene_apoe: 'e2/e2' | 'e2/e3' | 'e3/e3' | 'e3/e4' | 'e4/e4' | null
  gene_depression_risk: 'LL' | 'SL' | 'SS' | 'low' | 'moderate' | 'high' | null
  gene_notes: string | null

  training_plan: any | null
  training_experience: 'beginner' | 'intermediate' | 'advanced' | null

  lab_results: LabResult[]
  supplements: Supplement[]
}

export default function ClientEditor() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()
  const clientId = params.clientId as string

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [activeTab, setActiveTab] = useState<EditorTab>('basic')
  const [latestBodyComp, setLatestBodyComp] = useState<{ weight: number | null; body_fat: number | null; height: number | null } | null>(null)
  const [upgradeLink, setUpgradeLink] = useState('')
  const [upgradeCopied, setUpgradeCopied] = useState(false)
  const [cancellingOldSub, setCancellingOldSub] = useState(false)
  const [showCancelOldConfirm, setShowCancelOldConfirm] = useState(false)
  const [trainingPlanText, setTrainingPlanText] = useState('')
  const [trainingPlanParseError, setTrainingPlanParseError] = useState('')
  const [showTrainingPlanPreview, setShowTrainingPlanPreview] = useState(true)

  const tabs: { key: EditorTab; label: string; icon: string }[] = useMemo(() => {
    if (!client) return []
    const t: { key: EditorTab; label: string; icon: string }[] = [
      { key: 'basic', label: '基本資料', icon: '👤' },
      { key: 'features', label: '功能 / 目標', icon: '⚙️' },
      { key: 'notes', label: '教練筆記', icon: '💬' },
    ]
    if (client.lab_enabled) t.push({ key: 'lab', label: '血檢', icon: '🩸' })
    if (client.supplement_enabled) t.push({ key: 'supplements', label: '補品', icon: '💊' })
    return t
  }, [client?.lab_enabled, client?.supplement_enabled])

  useEffect(() => {
    if (clientId === 'new') {
      // 新增學員
      setClient({
        id: '',
        unique_code: '',
        name: '',
        age: 25,
        gender: '女性',
        status: 'normal',
        coach_summary: '',
        coach_weekly_note: '',
        next_checkup_date: '',
        health_goals: '',
        training_enabled: false,
        nutrition_enabled: false,
        body_composition_enabled: true,
        wellness_enabled: false,
        supplement_enabled: false,
        lab_enabled: false,
        ai_chat_enabled: false,
        subscription_tier: 'free',
        client_mode: 'standard',
        competition_enabled: false,
        competition_date: null,
        prep_phase: 'off_season',
        weigh_in_gap_hours: null,
        protein_target: null,
        water_target: null,
        carbs_target: null,
        fat_target: null,
        calories_target: null,
        target_weight: null,
        body_fat_target: null,
        target_date: null,
        is_active: true,
        expires_at: null,
        carbs_training_day: null,
        carbs_rest_day: null,
        goal_type: null,
        diet_start_date: null,
        activity_profile: null,
        health_mode_enabled: false,
        simple_mode: true,
        quarterly_cycle_start: null,
        coach_macro_override: null,
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        gene_notes: null,
        training_plan: null,
        training_experience: 'intermediate',

        lab_results: [],
        supplements: []
      })
      setLoading(false)
    } else {
      // 編輯現有學員
      fetchClient()
    }
  }, [clientId])

  const fetchClient = async () => {
    try {
      const [clientRes, overviewRes] = await Promise.all([
        fetch(`/api/admin/clients?id=${clientId}`),
        fetch(`/api/client-overview?clientId=${clientId}`),
      ])
      if (!clientRes.ok) {
        const errData = await clientRes.json().catch(() => ({}))
        setError(`載入學員資料失敗${errData.detail ? `（${errData.detail}）` : ''}`)
        return
      }
      const data = await clientRes.json()
      setClient({ ...data, client_mode: data.client_mode || 'standard' })

      if (overviewRes.ok) {
        const overview = await overviewRes.json()
        const entries: any[] = overview.bodyData || []
        const findLatest = (field: string) =>
          [...entries].reverse().find((e: any) => e[field] != null)?.[field] ?? null
        setLatestBodyComp({
          weight: findLatest('weight'),
          body_fat: findLatest('body_fat'),
          height: findLatest('height'),
        })
      }
    } catch (error) {
      setError('載入學員資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!client) return

    setSaving(true)
    setError('')

    // 基本驗證
    if (!client.name.trim()) {
      setError('請輸入學員姓名')
      setSaving(false)
      return
    }

    try {
      // 組裝 client 欄位（不含 lab_results / supplements）
      const clientFields = {
        client_mode: client.client_mode || 'standard',
        name: client.name,
        age: client.age,
        gender: client.gender,
        status: client.status,
        coach_summary: client.coach_summary || null,
        coach_weekly_note: client.coach_weekly_note || null,
        next_checkup_date: client.next_checkup_date || null,
        health_goals: client.health_goals || null,
        training_enabled: client.training_enabled,
        nutrition_enabled: client.nutrition_enabled,
        body_composition_enabled: client.body_composition_enabled,
        wellness_enabled: client.wellness_enabled,
        supplement_enabled: client.supplement_enabled,
        lab_enabled: client.lab_enabled,
        competition_enabled: client.competition_enabled,
        competition_date: client.competition_date || null,
        prep_phase: client.prep_phase || 'off_season',
        weigh_in_gap_hours: client.weigh_in_gap_hours ?? null,
        protein_target: client.protein_target ?? null,
        water_target: client.water_target ?? null,
        carbs_target: client.carbs_target ?? null,
        fat_target: client.fat_target ?? null,
        calories_target: client.calories_target ?? null,
        target_weight: client.target_weight ?? null,
        body_fat_target: client.body_fat_target ?? null,
        target_date: client.target_date || null,
        is_active: client.is_active,
        expires_at: client.expires_at || null,
        carbs_training_day: client.carbs_training_day ?? null,
        carbs_rest_day: client.carbs_rest_day ?? null,
        goal_type: client.goal_type || null,
        diet_start_date: client.diet_start_date || null,
        activity_profile: client.activity_profile || null,
        health_mode_enabled: client.health_mode_enabled,
        simple_mode: client.simple_mode,
        quarterly_cycle_start: client.quarterly_cycle_start || null,
        subscription_tier: client.subscription_tier,
        ai_chat_enabled: client.ai_chat_enabled,
        gene_mthfr: client.gene_mthfr || null,
        gene_apoe: client.gene_apoe || null,
        gene_depression_risk: client.gene_depression_risk || null,
        gene_notes: client.gene_notes || null,
        training_plan: client.training_plan || null,
        training_experience: client.training_experience || 'intermediate',
        // coach_macro_override 由後端自動處理（修改 macro 時自動鎖定）
        // 只有教練明確解鎖時才送 null
        ...(client.coach_macro_override === null && clientId !== 'new'
          ? { coach_macro_override: null }
          : {}),
      }

      if (clientId === 'new') {
        // 新增學員
        const uniqueCode = generateUniqueCode()
        const expiresAt = new Date()
        expiresAt.setMonth(expiresAt.getMonth() + 3)

        const res = await fetch('/api/admin/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientData: {
              ...clientFields,
              unique_code: uniqueCode,
              expires_at: expiresAt.toISOString(),
            },
            labResults: client.lab_results,
            supplements: client.supplements,
          }),
        })

        if (!res.ok) {
          if (res.status === 401) {
            setError('登入已過期，請重新登入')
            setTimeout(() => router.push('/admin/login'), 1500)
            return
          }
          const data = await res.json().catch(() => ({}))
          const detail = data.detail ? `（${data.detail}）` : ''
          setError(`${data.error || '新增學員失敗'}${detail}`)
          console.error('新增學員失敗:', res.status, data)
          return
        }

        const result = await res.json().catch(() => ({}))
        showToast(`學員「${client.name}」新增成功！代碼：${uniqueCode}`, 'success')
        window.location.href = '/admin'
      } else {
        // 更新現有學員
        const res = await fetch('/api/admin/clients', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            clientData: clientFields,
            labResults: client.lab_results,
            supplements: client.supplements,
          }),
        })

        if (!res.ok) {
          if (res.status === 401) {
            setError('登入已過期，請重新登入')
            setTimeout(() => router.push('/admin/login'), 1500)
            return
          }
          const data = await res.json().catch(() => ({}))
          const detail = data.detail ? `（${data.detail}）` : ''
          setError(`${data.error || '更新學員資料失敗'}${detail}`)
          console.error('更新學員失敗:', res.status, data)
          return
        }

        // 留在原頁，顯示成功提示
        setSuccessMsg('已保存')
        setTimeout(() => setSuccessMsg(''), 2500)
      }
    } catch (error) {
      setError('保存失敗，請重試')
    } finally {
      setSaving(false)
    }
  }

  const generateUniqueCode = () => {
    const array = new Uint8Array(8)
    crypto.getRandomValues(array)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from(array, (byte) => chars[byte % chars.length]).join('')
  }

  const updateClient = (field: string, value: any) => {
    if (!client) return
    setClient({ ...client, [field]: value })
  }

  const addLabResult = () => {
    if (!client) return
    setClient({
      ...client,
      lab_results: [...client.lab_results, {
        test_name: '',
        value: 0,
        unit: '',
        reference_range: '',
        status: 'normal',
        date: new Date().toISOString().split('T')[0]
      }]
    })
  }

  const updateLabResult = (index: number, field: string, value: any) => {
    if (!client) return
    const updatedResults = [...client.lab_results]
    updatedResults[index] = { ...updatedResults[index], [field]: value }
    setClient({ ...client, lab_results: updatedResults })
  }

  const removeLabResult = (index: number) => {
    if (!client) return
    const updatedResults = client.lab_results.filter((_, i) => i !== index)
    setClient({ ...client, lab_results: updatedResults })
  }

  const addSupplement = () => {
    if (!client) return
    setClient({
      ...client,
      supplements: [...client.supplements, {
        name: '',
        dosage: '',
        timing: '早餐',
        why: ''
      }]
    })
  }

  const updateSupplement = (index: number, field: string, value: any) => {
    if (!client) return
    const updatedSupplements = [...client.supplements]
    updatedSupplements[index] = { ...updatedSupplements[index], [field]: value }
    setClient({ ...client, supplements: updatedSupplements })
  }

  const removeSupplement = (index: number) => {
    if (!client) return
    const updatedSupplements = client.supplements.filter((_, i) => i !== index)
    setClient({ ...client, supplements: updatedSupplements })
  }

  // === Training Plan Parser ===
  const DAY_MAP: Record<string, number> = {
    '週一': 1, '周一': 1, '星期一': 1, 'monday': 1, 'mon': 1,
    '週二': 2, '周二': 2, '星期二': 2, 'tuesday': 2, 'tue': 2,
    '週三': 3, '周三': 3, '星期三': 3, 'wednesday': 3, 'wed': 3,
    '週四': 4, '周四': 4, '星期四': 4, 'thursday': 4, 'thu': 4,
    '週五': 5, '周五': 5, '星期五': 5, 'friday': 5, 'fri': 5,
    '週六': 6, '周六': 6, '星期六': 6, 'saturday': 6, 'sat': 6,
    '週日': 7, '周日': 7, '星期日': 7, 'sunday': 7, 'sun': 7,
  }

  const DAY_LABELS: Record<number, string> = {
    1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六', 7: '週日',
  }

  const parseTrainingPlanText = (text: string) => {
    setTrainingPlanParseError('')
    if (!text.trim()) {
      updateClient('training_plan', null)
      return
    }

    try {
      const lines = text.split('\n')
      let planName = ''
      const days: any[] = []
      let currentDay: any = null

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) {
          // blank line ends current day block
          if (currentDay) {
            days.push(currentDay)
            currentDay = null
          }
          continue
        }

        // Check for plan name line
        const nameMatch = line.match(/^計[畫劃]名[稱称][\s：:]+(.+)$/i)
        if (nameMatch) {
          planName = nameMatch[1].trim()
          continue
        }

        // Check if line starts a new day
        let dayFound = false
        for (const [key, num] of Object.entries(DAY_MAP)) {
          if (line.toLowerCase().startsWith(key)) {
            if (currentDay) days.push(currentDay)
            const label = line.slice(key.length).trim().replace(/^[\s：:]+/, '').trim()
            currentDay = { dayOfWeek: num, label: label || `Day ${num}`, exercises: [] }
            dayFound = true
            break
          }
        }
        if (dayFound) continue

        // Must be an exercise line — parse it
        if (!currentDay) {
          // If no day header yet, auto-create one
          if (days.length === 0 && !currentDay) {
            currentDay = { dayOfWeek: 1, label: 'Day 1', exercises: [] }
          } else {
            continue
          }
        }

        // Split by | or 、
        const parts = line.split(/[|、｜]/).map(p => p.trim()).filter(Boolean)
        if (parts.length === 0) continue

        const exercise: any = { name: parts[0] }
        if (parts.length >= 2) exercise.sets = parts[1].replace(/組$/, '').trim()
        if (parts.length >= 3) exercise.reps = parts[2].replace(/下$/, '').trim()
        if (parts.length >= 4) exercise.rpe = parts[3].replace(/^RPE\s*/i, '').trim()
        if (parts.length >= 5) exercise.note = parts.slice(4).join('、').trim()

        currentDay.exercises.push(exercise)
      }

      if (currentDay) days.push(currentDay)

      if (days.length === 0) {
        setTrainingPlanParseError('無法解析任何訓練日，請檢查格式')
        return
      }

      const plan = {
        name: planName || '訓練計畫',
        days,
      }
      updateClient('training_plan', plan)
    } catch (e) {
      setTrainingPlanParseError('解析失敗，請檢查格式')
    }
  }

  const serializeTrainingPlan = (plan: any): string => {
    if (!plan) return ''
    const lines: string[] = []
    if (plan.name) lines.push(`計畫名稱：${plan.name}`)
    lines.push('')
    for (const day of plan.days || []) {
      const dayLabel = DAY_LABELS[day.dayOfWeek] || `Day ${day.dayOfWeek}`
      lines.push(`${dayLabel} ${day.label || ''}`.trim())
      for (const ex of day.exercises || []) {
        const parts = [ex.name || '']
        if (ex.sets) parts.push(`${ex.sets}組`)
        if (ex.reps) parts.push(`${ex.reps}下`)
        if (ex.rpe) parts.push(`RPE ${ex.rpe}`)
        if (ex.note) parts.push(ex.note)
        lines.push(parts.join(' | '))
      }
      lines.push('')
    }
    return lines.join('\n').trim()
  }

  // Initialize training plan text from existing data
  useEffect(() => {
    if (client?.training_plan && !trainingPlanText) {
      setTrainingPlanText(serializeTrainingPlan(client.training_plan))
    }
  }, [client?.training_plan])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">找不到學員資料</h1>
          {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
          <Link href="/admin" className="text-blue-600 hover:text-blue-800">
            返回後台
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/admin" className="text-gray-600 hover:text-gray-900 mr-4">
                ← 返回
              </Link>
              <h1 className="text-xl font-bold text-gray-900">
                {clientId === 'new' ? '新增學員' : `編輯 ${client.name}`}
              </h1>
            </div>
            {clientId !== 'new' && (
              <Link href={`/admin/clients/${clientId}/overview`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                📊 總覽
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* 保存成功 Toast */}
        {successMsg && (
          <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-[slideIn_0.3s_ease-out]">
            <span className="text-lg">✓</span>
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-0 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ===== Tab: 基本資料 ===== */}
        {activeTab === 'basic' && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">基本資料</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
                  <input
                    type="text"
                    value={client.name}
                    onChange={(e) => updateClient('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">年齡</label>
                  <input
                    type="number"
                    value={client.age}
                    onChange={(e) => updateClient('age', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">性別</label>
                  <select
                    value={client.gender}
                    onChange={(e) => updateClient('gender', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="女性">女性</option>
                    <option value="男性">男性</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">狀態</label>
                  <select
                    value={client.status}
                    onChange={(e) => updateClient('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="normal">正常</option>
                    <option value="attention">需要關注</option>
                    <option value="alert">警示</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">訂閱方案</label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {([['free', '免費體驗', '$0', 'border-gray-300 bg-gray-50 text-gray-700'],
                       ['self_managed', '自主管理', '$499', 'border-blue-300 bg-blue-50 text-blue-700'],
                       ['coached', '教練指導', '$2999', 'border-purple-300 bg-purple-50 text-purple-700']] as const).map(([tier, label, price, style]) => (
                      <button
                        key={tier}
                        onClick={() => {
                          const defaults = getDefaultFeatures(tier)
                          setClient(prev => prev ? ({ ...prev, subscription_tier: tier, ...defaults }) : prev)
                        }}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          client.subscription_tier === tier
                            ? style + ' ring-2 ring-offset-1 ring-blue-500'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-sm font-bold">{price}</p>
                        <p className="text-[10px]">{label}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">切換方案會自動調整功能開關（仍可手動 override）</p>

                  {/* 升級 / 取消定期定額 */}
                  {/* 升級至教練指導（僅 self_managed 顯示） */}
                  {client.id && client.subscription_tier === 'self_managed' && (
                    <div className="mt-3 p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-2">
                      <p className="text-xs font-semibold text-purple-700">升級至教練指導 $2999</p>
                      {!upgradeLink ? (
                        <button
                          onClick={() => {
                            const origin = typeof window !== 'undefined' ? window.location.origin : ''
                            const params = new URLSearchParams({ tier: 'coached', name: client.name || '' })
                            setUpgradeLink(`${origin}/pay?${params.toString()}`)
                          }}
                          className="w-full py-2 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          產生付款連結
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="bg-white rounded-lg px-3 py-2 text-xs text-gray-600 break-all font-mono border border-purple-200">
                            {upgradeLink}
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(upgradeLink)
                              setUpgradeCopied(true)
                              setTimeout(() => setUpgradeCopied(false), 2000)
                            }}
                            className="w-full py-2 text-xs font-semibold bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                          >
                            {upgradeCopied ? '已複製 ✓' : '複製連結（丟 LINE 給客戶）'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 取消定期定額（self_managed 或 coached 都可取消） */}
                  {client.id && client.subscription_tier !== 'free' && (
                    <div className="mt-2">
                      {!showCancelOldConfirm ? (
                        <button
                          onClick={() => setShowCancelOldConfirm(true)}
                          className="text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                        >
                          取消定期定額（${client.subscription_tier === 'coached' ? '2999' : '499'}）
                        </button>
                      ) : (
                        <div className="p-3 bg-red-50 rounded-xl border border-red-200 space-y-1.5">
                          <p className="text-[11px] text-red-600 font-medium">
                            確定取消 ${client.subscription_tier === 'coached' ? '2999' : '499'} 定期定額？綠界會停止自動扣款。
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                setCancellingOldSub(true)
                                try {
                                  const res = await fetch('/api/subscribe/cancel', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ clientId: client.id, uniqueCode: client.unique_code }),
                                  })
                                  const data = await res.json()
                                  if (!res.ok) throw new Error(data.error || '取消失敗')
                                  showToast('已取消定期定額', 'success')
                                  setShowCancelOldConfirm(false)
                                } catch (err: any) {
                                  showToast(err.message || '取消失敗', 'error')
                                } finally {
                                  setCancellingOldSub(false)
                                }
                              }}
                              disabled={cancellingOldSub}
                              className="px-3 py-1 bg-red-500 text-white text-[11px] rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                            >
                              {cancellingOldSub ? '處理中...' : '確認取消'}
                            </button>
                            <button
                              onClick={() => setShowCancelOldConfirm(false)}
                              className="px-3 py-1 bg-gray-100 text-gray-600 text-[11px] rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              返回
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 到期日管理 */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">到期日</label>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={client.expires_at ? new Date(client.expires_at).toISOString().split('T')[0] : ''}
                    onChange={(e) => setClient({ ...client, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => { const d = new Date(); d.setMonth(d.getMonth() + 1); setClient({ ...client, expires_at: d.toISOString() }) }}
                    className="px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                  >+1 月</button>
                  <button
                    onClick={() => { const d = new Date(); d.setMonth(d.getMonth() + 3); setClient({ ...client, expires_at: d.toISOString() }) }}
                    className="px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                  >+3 月</button>
                  <button
                    onClick={() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); setClient({ ...client, expires_at: d.toISOString() }) }}
                    className="px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                  >+1 年</button>
                </div>
                {client.expires_at && (() => {
                  const days = Math.ceil((new Date(client.expires_at).getTime() - Date.now()) / DAY_MS)
                  if (days < 0) return <p className="text-xs text-red-600 mt-1">已過期 {Math.abs(days)} 天</p>
                  if (days <= 7) return <p className="text-xs text-orange-600 mt-1">剩餘 {days} 天</p>
                  return <p className="text-xs text-gray-400 mt-1">剩餘 {days} 天（到 {new Date(client.expires_at).toLocaleDateString('zh-TW')}）</p>
                })()}
              </div>
            </div>

            {/* 帳號啟用狀態 */}
            <div className={`rounded-lg shadow p-6 ${client.is_active ? 'bg-white' : 'bg-red-50 border-2 border-red-300'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">帳號權限</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {client.is_active ? '學員可正常使用 app' : '⛔ 已停用 — 學員打開網址會看到「帳號已暫停」'}
                  </p>
                </div>
                <button
                  onClick={() => updateClient('is_active', !client.is_active)}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${client.is_active ? 'bg-green-500' : 'bg-red-400'}`}
                >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow ${client.is_active ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== Tab: 功能 / 目標 ===== */}
        {activeTab === 'features' && (
          <div className="space-y-6">
            {/* Feature Toggles */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">功能設定</h2>
              <p className="text-xs text-gray-400 mb-4">依學員階段逐步開放功能</p>
              <div className="space-y-4">
                {([
                  { key: 'simple_mode', label: '簡單模式', desc: '簡化介面：只顯示體重、熱量、蛋白質等核心欄位，適合入門用戶' },
                  { key: 'body_composition_enabled', label: '體重/體態紀錄', desc: '體重、體脂、肌肉量登記（最基本功能）' },
                  { key: 'wellness_enabled', label: '每日感受紀錄', desc: '心情、睡眠品質、能量追蹤' },
                  { key: 'nutrition_enabled', label: '飲食追蹤', desc: '每日飲食合規紀錄' },
                  { key: 'training_enabled', label: '訓練追蹤', desc: '每日訓練類型與強度紀錄' },
                  { key: 'supplement_enabled', label: '補品管理', desc: '補品清單與每日打卡' },
                  { key: 'lab_enabled', label: '血檢追蹤', desc: '血檢數據與健康指標' },
                  { key: 'ai_chat_enabled', label: 'AI 私人顧問', desc: '開放無限次 AI 聊天（關閉＝每月 3 次免費）' },
                ] as const).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                    <button
                      onClick={() => updateClient(key, !(client as any)[key])}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        (client as any)[key] ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          (client as any)[key] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}

                {/* 客戶模式 — 4 選 1 segmented control */}
                <div className="border-t border-gray-100 pt-4 mt-2">
                  <label className="text-sm font-medium text-gray-700">客戶模式</label>
                  <div className="mt-1 grid grid-cols-4 gap-1 p-1 bg-gray-100 rounded-lg">
                    {ALL_CLIENT_MODES.map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setClient(prev => prev ? ({
                          ...prev,
                          client_mode: mode,
                          health_mode_enabled: mode === 'health',
                          competition_enabled: mode === 'bodybuilding' || mode === 'athletic',
                          // Reset prep_phase when switching away from competition modes
                          prep_phase: (mode === 'bodybuilding' || mode === 'athletic') ? prev.prep_phase : 'off_season',
                          // Auto-upgrade from free when setting non-standard mode
                          subscription_tier: mode !== 'standard' && prev.subscription_tier === 'free' ? 'self_managed' : prev.subscription_tier,
                        }) : prev)}
                        className={`px-2 py-2 text-xs font-medium rounded-md transition-all ${
                          client.client_mode === mode
                            ? 'bg-white shadow text-gray-900'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {MODE_EMOJIS[mode as keyof typeof MODE_EMOJIS]} {MODE_LABELS[mode as keyof typeof MODE_LABELS]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {MODE_CONFIG[client.client_mode as keyof typeof MODE_CONFIG]?.description || ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Nutrition Targets */}
            {client.nutrition_enabled && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">飲食目標設定</h2>
                    <p className="text-xs text-gray-400">設定後學員記錄飲食時會看到目標對比</p>
                  </div>
                </div>
                {/* 教練覆寫鎖定狀態 */}
                {client.coach_macro_override && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔒</span>
                      <div>
                        <p className="text-sm font-medium text-amber-800">教練覆寫模式啟動中</p>
                        <p className="text-xs text-amber-600">
                          系統自動調整已暫停。上次鎖定：{new Date(client.coach_macro_override.locked_at).toLocaleDateString('zh-TW')}
                          {client.coach_macro_override.locked_fields && (
                            <span>（{client.coach_macro_override.locked_fields.join('、').replace(/calories_target/g, '熱量').replace(/protein_target/g, '蛋白質').replace(/carbs_target/g, '碳水').replace(/fat_target/g, '脂肪').replace(/carbs_training_day/g, '訓練日碳水').replace(/carbs_rest_day/g, '休息日碳水')}）</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setClient({ ...client, coach_macro_override: null })}
                      className="px-3 py-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors"
                    >
                      解除鎖定
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mb-3">修改營養目標後會自動鎖定，防止系統覆蓋你的設定。可隨時解除鎖定恢復自動調整。</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">每日蛋白質目標（g）</label>
                    <input
                      type="number"
                      value={client.protein_target ?? ''}
                      onChange={(e) => updateClient('protein_target', e.target.value ? Number(e.target.value) : null)}
                      placeholder="例如：120"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">每日飲水目標（ml）</label>
                    <input
                      type="number"
                      value={client.water_target ?? ''}
                      onChange={(e) => updateClient('water_target', e.target.value ? Number(e.target.value) : null)}
                      placeholder="例如：2500"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 營養分析引擎 */}
            {client.nutrition_enabled && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="border-t border-gray-100 pt-4 mt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">🧮 營養分析引擎</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">目標類型</label>
                      <select
                        value={client.goal_type || ''}
                        onChange={(e) => setClient({ ...client, goal_type: e.target.value as 'cut' | 'bulk' || null })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="">未設定</option>
                        <option value="cut">🔻 減脂</option>
                        <option value="bulk">🔺 增肌</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">營養目標開始日</label>
                      <input
                        type="date"
                        value={client.diet_start_date || ''}
                        onChange={(e) => setClient({ ...client, diet_start_date: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs text-gray-500 mb-1">活動量分型（影響 TDEE 估算與有氧/步數參考）</label>
                    <select
                      value={client.activity_profile || ''}
                      onChange={(e) => setClient({ ...client, activity_profile: e.target.value as 'sedentary' | 'high_energy_flux' || null })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="">預設（中等活動量）</option>
                      <option value="sedentary">🪑 上班族 — 步數受限，以飲食控制為主</option>
                      <option value="high_energy_flux">⚡ 高能量通量 — 主動提高活動消耗，多吃多動</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      上班族：TDEE 係數低、步數目標低（3,000→8,000步）｜高能量通量：TDEE 係數高、步數目標高（8,000→15,000步）
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 目標體重與體態推算 — 所有學員都可看到 */}
            {client.body_composition_enabled && (
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-400">
                <h2 className="text-lg font-medium text-gray-900 mb-1">
                  {isCompetitionMode(client.client_mode) ? '🎯 目標上台體重' : '🎯 目標體重'}
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  {isCompetitionMode(client.client_mode) ? '設定比賽日目標體重，系統會自動推算建議範圍' : '設定目標體重，系統會依體組成推算健康體重範圍'}
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">目標體重 (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={client.target_weight ?? ''}
                      onChange={(e) => updateClient('target_weight', e.target.value ? Number(e.target.value) : null)}
                      placeholder={isCompetitionMode(client.client_mode) ? '例如：65.0' : '例如：65.0'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">目標體脂率 (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={client.body_fat_target ?? ''}
                      onChange={(e) => updateClient('body_fat_target', e.target.value ? Number(e.target.value) : null)}
                      placeholder="例如：15.0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {!isCompetitionMode(client.client_mode) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">目標日期</label>
                      <input
                        type="date"
                        value={client.target_date || ''}
                        onChange={(e) => setClient({ ...client, target_date: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
                <div>
                  {/* 體態推算：根據最新體組成自動計算建議體重 */}
                  {(() => {
                    if (!latestBodyComp?.weight || !latestBodyComp?.body_fat) return null
                    const rec = calcRecommendedStageWeight(
                      latestBodyComp.weight,
                      latestBodyComp.body_fat,
                      client.gender,
                      latestBodyComp.height,
                      isCompetitionMode(client.client_mode)
                    )
                    const isBelow = client.target_weight ? client.target_weight < rec.recommendedLow - 0.5 : false
                    const isAbove = client.target_weight ? client.target_weight > rec.recommendedHigh + 0.5 : false
                    const isOutOfRange = isBelow || isAbove
                    return (
                      <div className={`mt-2 p-3 rounded-lg text-xs border ${isOutOfRange ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-100'}`}>
                        <p className="font-semibold text-gray-700 mb-1">🔬 體態推算（依最新紀錄）</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
                          <span>最新體重</span><span className="font-medium text-gray-800">{rec.currentWeight} kg</span>
                          <span>最新體脂率</span><span className="font-medium text-gray-800">{rec.currentBF}%</span>
                          <span>去脂體重 (FFM)</span><span className="font-medium text-gray-800">{rec.ffm} kg</span>
                          <span>脂肪量</span><span className="font-medium text-gray-800">{rec.fatMass} kg</span>
                          {rec.ffmi !== null && <><span>FFMI</span><span className="font-medium text-gray-800">{rec.ffmi} kg/m²</span></>}
                        </div>
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <p className="text-gray-600">
                            {rec.mode === 'competition' ? '建議上台體重範圍' : '建議健康體重範圍'}
                            <span className="ml-1 text-xs text-gray-400">（目標體脂 {rec.targetBFLow}–{rec.targetBFHigh}%）</span>
                          </p>
                          <p className="text-base font-bold text-blue-700 mt-0.5">
                            {rec.recommendedLow} – {rec.recommendedHigh} kg
                          </p>
                          {client.target_weight && (
                            <p className={`mt-1 ${isOutOfRange ? 'text-amber-600 font-medium' : 'text-green-600'}`}>
                              {isBelow
                                ? `⚠️ 手動目標 ${client.target_weight} kg 低於建議下限 ${(rec.recommendedLow - client.target_weight).toFixed(1)} kg，可能壓縮 FFM`
                                : isAbove
                                ? `⚠️ 手動目標 ${client.target_weight} kg 高於建議上限 ${(client.target_weight - rec.recommendedHigh).toFixed(1)} kg，${rec.mode === 'competition' ? '上台體脂可能偏高' : '體脂可能高於健康目標'}`
                                : `✅ 手動目標 ${client.target_weight} kg 在建議範圍內`}
                            </p>
                          )}
                          {rec.fatToLose !== null && (
                            <p className="text-gray-500 mt-0.5">預估需減脂 {rec.fatToLose} kg（以建議中點計算）</p>
                          )}
                        </div>
                        <p className="text-gray-400 mt-1">* 參考：Helms 2014；Rossow 2013；Halliday 2016；ACSM 2021 | 目標值由教練手動設定，此框僅供參考</p>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* 碳循環設定 */}
            {client.nutrition_enabled && isCompetitionMode(client.client_mode) && (
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-cyan-400">
                <h2 className="text-lg font-medium text-gray-900 mb-1">🔄 碳循環設定</h2>
                <p className="text-xs text-gray-400 mb-4">設定後系統會根據當天有無訓練自動切換碳水目標</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">訓練日碳水（g）</label>
                    <input
                      type="number"
                      value={client.carbs_training_day ?? ''}
                      onChange={(e) => updateClient('carbs_training_day', e.target.value ? Number(e.target.value) : null)}
                      placeholder="例如：300"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">有記錄訓練（非休息日）時使用</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">休息日碳水（g）</label>
                    <input
                      type="number"
                      value={client.carbs_rest_day ?? ''}
                      onChange={(e) => updateClient('carbs_rest_day', e.target.value ? Number(e.target.value) : null)}
                      placeholder="例如：100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">休息日 / 未記錄訓練時使用</p>
                  </div>
                </div>
                {client.carbs_training_day && client.carbs_rest_day && (
                  <div className="mt-3 bg-cyan-50 rounded-lg px-3 py-2 text-xs text-cyan-700">
                    訓練日 {client.carbs_training_day}g → 休息日 {client.carbs_rest_day}g（差距 {client.carbs_training_day - client.carbs_rest_day}g）
                  </div>
                )}
              </div>
            )}

            {/* 每日巨量營養素目標 — 有開飲食追蹤就顯示 */}
            {client.nutrition_enabled && (
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-400">
                <h2 className="text-lg font-medium text-gray-900 mb-1">🍽️ 每日巨量營養素目標</h2>
                <p className="text-xs text-gray-400 mb-4">手動設定熱量與巨量營養素，引擎也會自動建議調整</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">熱量 (kcal)</label>
                    <input
                      type="number"
                      value={client.calories_target ?? ''}
                      onChange={(e) => updateClient('calories_target', e.target.value ? Number(e.target.value) : null)}
                      placeholder="2200"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">碳水 (g)</label>
                    <input
                      type="number"
                      value={client.carbs_target ?? ''}
                      onChange={(e) => updateClient('carbs_target', e.target.value ? Number(e.target.value) : null)}
                      placeholder="250"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">脂肪 (g)</label>
                    <input
                      type="number"
                      value={client.fat_target ?? ''}
                      onChange={(e) => updateClient('fat_target', e.target.value ? Number(e.target.value) : null)}
                      placeholder="60"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Health Mode Settings — 健康模式季度週期 */}
            {isHealthMode(client.client_mode) && (
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-emerald-400">
                <h2 className="text-lg font-medium text-gray-900 mb-1">🌿 健康模式設定</h2>
                <p className="text-xs text-gray-400 mb-4">每 90 天一個季度週期，配合季度血檢追蹤健康進步</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">本季週期起始日</label>
                  <input
                    type="date"
                    value={client.quarterly_cycle_start || ''}
                    onChange={(e) => updateClient('quarterly_cycle_start', e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {client.quarterly_cycle_start && (() => {
                    const start = new Date(client.quarterly_cycle_start)
                    const today = new Date()
                    const elapsed = Math.floor((today.getTime() - start.getTime()) / DAY_MS) + 1
                    const daysLeft = Math.max(0, 90 - elapsed)
                    const cycleEnd = new Date(start)
                    cycleEnd.setDate(cycleEnd.getDate() + 89)
                    return (
                      <div className="mt-2 bg-emerald-50 rounded-lg px-3 py-2 text-xs text-emerald-700">
                        <p>本季第 <span className="font-bold">{Math.min(90, elapsed)}</span> 天 / 90 天</p>
                        <p className="mt-0.5">預計血檢日：{cycleEnd.toLocaleDateString('zh-TW')}（距今 {daysLeft} 天）</p>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* Genetic Risk Profile — 基因風險欄位 */}
            {isHealthMode(client.client_mode) && (
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-400">
                <h2 className="text-lg font-medium text-gray-900 mb-1">🧬 基因風險設定</h2>
                <p className="text-xs text-gray-400 mb-4">根據基因檢測結果設定，系統會自動調整補品建議與 AI 顧問回覆</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">MTHFR 基因</label>
                    <select
                      value={client.gene_mthfr || ''}
                      onChange={(e) => updateClient('gene_mthfr', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">未檢測</option>
                      <option value="normal">正常</option>
                      <option value="heterozygous">雜合突變（C677T 或 A1298C）</option>
                      <option value="homozygous">純合突變（C677T）</option>
                    </select>
                    {client.gene_mthfr && client.gene_mthfr !== 'normal' && (
                      <p className="text-xs text-purple-600 mt-1">補品引擎將建議活性葉酸（5-MTHF）取代一般葉酸</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">APOE 基因型</label>
                    <select
                      value={client.gene_apoe || ''}
                      onChange={(e) => updateClient('gene_apoe', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">未檢測</option>
                      <option value="e2/e2">e2/e2</option>
                      <option value="e2/e3">e2/e3</option>
                      <option value="e3/e3">e3/e3（最常見）</option>
                      <option value="e3/e4">e3/e4（一個 e4 等位基因）</option>
                      <option value="e4/e4">e4/e4（高風險）</option>
                    </select>
                    {(client.gene_apoe === 'e3/e4' || client.gene_apoe === 'e4/e4') && (
                      <p className="text-xs text-purple-600 mt-1">將強調 Omega-3 DHA、降低飽和脂肪、加強心血管監控</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">5-HTTLPR 血清素轉運體基因</label>
                    <select
                      value={client.gene_depression_risk || ''}
                      onChange={(e) => updateClient('gene_depression_risk', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">未檢測</option>
                      <option value="LL">LL（長/長）— 低風險</option>
                      <option value="SL">SL（短/長）— 中風險</option>
                      <option value="SS">SS（短/短）— 高風險</option>
                    </select>
                    {client.gene_depression_risk && client.gene_depression_risk !== 'LL' && client.gene_depression_risk !== 'low' && (
                      <p className="text-xs text-purple-600 mt-1">碳水下限提高、赤字期飲食多樣性保護、Peak Week 耗竭策略緩和</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">基因備註</label>
                    <input
                      type="text"
                      value={client.gene_notes || ''}
                      onChange={(e) => updateClient('gene_notes', e.target.value || null)}
                      placeholder="其他基因相關資訊..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Competition Prep Settings — 備賽專屬（比賽日期、備賽階段） */}
            {isCompetitionMode(client.client_mode) && (
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-400">
                <h2 className="text-lg font-medium text-gray-900 mb-1">
                  {MODE_EMOJIS[client.client_mode as keyof typeof MODE_EMOJIS] || '🏆'} 備賽設定
                </h2>
                <p className="text-xs text-gray-400 mb-4">設定比賽日期與備賽階段</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">比賽日期</label>
                    <input
                      type="date"
                      value={client.competition_date || ''}
                      onChange={(e) => updateClient('competition_date', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {client.competition_date && (
                      <p className="text-xs text-amber-600 mt-1 font-medium">
                        距離比賽還有 {Math.max(0, daysUntilDateTW(client.competition_date))} 天
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">備賽階段</label>
                    <select
                      value={client.prep_phase || 'off_season'}
                      onChange={(e) => updateClient('prep_phase', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {(client.client_mode === 'athletic' ? ATHLETIC_PHASE_OPTIONS : BODYBUILDING_PHASE_OPTIONS).map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  {client.client_mode === 'athletic' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">秤重到比賽間距（小時）</label>
                      <input
                        type="number"
                        min={1}
                        max={48}
                        value={client.weigh_in_gap_hours ?? ''}
                        onChange={(e) => updateClient('weigh_in_gap_hours', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="例如：24"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">影響超補償期的碳水計算策略</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Tab: 教練筆記 ===== */}
        {activeTab === 'notes' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">教練備註</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">💬 本週回饋給學員</label>
                  <p className="text-xs text-gray-400 mb-1">學員打開 app 第一眼就會看到，建議每週更新</p>
                  <textarea
                    value={client.coach_weekly_note || ''}
                    onChange={(e) => updateClient('coach_weekly_note', e.target.value)}
                    rows={3}
                    placeholder="例如：這週體重控制得不錯，繼續保持！碳水可以再多吃一點。"
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">教練健康摘要</label>
                  <textarea
                    value={client.coach_summary || ''}
                    onChange={(e) => updateClient('coach_summary', e.target.value)}
                    rows={5}
                    placeholder="本月健康分析..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">下次回檢日期</label>
                  <input
                    type="date"
                    value={client.next_checkup_date || ''}
                    onChange={(e) => updateClient('next_checkup_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">健康目標</label>
                  <textarea
                    value={client.health_goals || ''}
                    onChange={(e) => updateClient('health_goals', e.target.value)}
                    rows={3}
                    placeholder="例如：同半胱胺酸降到 8 以下"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 訓練經驗等級 */}
            {client.training_enabled && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-2">📊 訓練經驗</h2>
                <p className="text-xs text-gray-400 mb-3">影響建議組數：新手多練動作、進階少量高強度</p>
                <div className="flex gap-2">
                  {([
                    { value: 'beginner', label: '新手（<1年）', desc: '組數 +15%' },
                    { value: 'intermediate', label: '中階（1-3年）', desc: '正常量' },
                    { value: 'advanced', label: '進階（3年+）', desc: '組數 -15%' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateClient('training_experience', opt.value)}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                        client.training_experience === opt.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <div>{opt.label}</div>
                      <div className="text-[10px] mt-0.5 opacity-75">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 訓練計畫編輯器 */}
            {client.training_enabled && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">🏋️ 週間訓練計畫</h2>
                    <p className="text-xs text-gray-400 mt-1">學員會在首頁看到「今日訓練」卡片</p>
                  </div>
                  {client.training_plan && (
                    <button
                      onClick={() => {
                        if (confirm('確定清除訓練計畫？')) {
                          updateClient('training_plan', null)
                          setTrainingPlanText('')
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      清除計畫
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      貼上訓練計畫（格式如下方範例）
                    </label>
                    <textarea
                      value={trainingPlanText}
                      onChange={(e) => {
                        setTrainingPlanText(e.target.value)
                        setTrainingPlanParseError('')
                      }}
                      rows={12}
                      placeholder={`計畫名稱：5天分化 — 減脂期\n\n週一 Push Day\n啞鈴臥推 | 4組 | 8-10下 | RPE 8 | 主項\n上斜啞鈴飛鳥 | 3組 | 12-15下 | RPE 7 | 胸肌上部\n\n週二 Pull Day\n引體向上 | 4組 | 6-8下 | RPE 8 | 主項\n坐姿划船 | 3組 | 10-12下 | RPE 7 | 背厚度\n\n週三 Leg Day\n深蹲 | 4組 | 6-8下 | RPE 9 | 主項\n腿推 | 3組 | 10-12下 | RPE 7`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => parseTrainingPlanText(trainingPlanText)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      解析並套用
                    </button>
                    <span className="text-xs text-gray-400">
                      解析後按最下方「保存」才會存入資料庫
                    </span>
                  </div>

                  {trainingPlanParseError && (
                    <p className="text-sm text-red-600">{trainingPlanParseError}</p>
                  )}

                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      格式說明：第一行可寫「計畫名稱：...」。每天以「週X 標籤」開頭（如「週一 Push Day」），
                      動作格式為「動作名 | 組數 | 次數 | RPE | 備註」，各欄位以 | 分隔。
                      天與天之間空一行。沒有訓練的日子不用寫（自動視為休息日）。
                    </p>
                  </div>
                </div>

                {/* 預覽目前的訓練計畫 */}
                {client.training_plan && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <button
                      onClick={() => setShowTrainingPlanPreview(!showTrainingPlanPreview)}
                      className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-3"
                    >
                      <span>{showTrainingPlanPreview ? '▼' : '▶'}</span>
                      目前計畫預覽：{client.training_plan.name || '訓練計畫'}
                    </button>
                    {showTrainingPlanPreview && (
                      <div className="space-y-3">
                        {(client.training_plan.days || []).map((day: any, di: number) => (
                          <div key={di} className="bg-blue-50 rounded-lg p-3">
                            <p className="text-sm font-semibold text-blue-800 mb-2">
                              {DAY_LABELS[day.dayOfWeek] || `Day ${day.dayOfWeek}`} — {day.label}
                            </p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 border-b border-blue-100">
                                  <th className="text-left py-1 pr-2">動作</th>
                                  <th className="text-center py-1 px-1">組x次</th>
                                  <th className="text-center py-1 px-1">RPE</th>
                                  <th className="text-left py-1 pl-2">備註</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(day.exercises || []).map((ex: any, ei: number) => (
                                  <tr key={ei} className="border-b border-blue-50 last:border-b-0">
                                    <td className="py-1 pr-2 font-medium text-gray-800">{ex.name}</td>
                                    <td className="py-1 px-1 text-center text-gray-600">
                                      {ex.sets && ex.reps ? `${ex.sets}x${ex.reps}` : ex.sets || ex.reps || '-'}
                                    </td>
                                    <td className="py-1 px-1 text-center text-gray-600">{ex.rpe || '-'}</td>
                                    <td className="py-1 pl-2 text-gray-500">{ex.note || ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== Tab: 血檢 ===== */}
        {activeTab === 'lab' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">血檢數據</h2>
                <button
                  onClick={addLabResult}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  新增檢測項目
                </button>
              </div>

              {client.lab_results.length === 0 && (
                <p className="text-center text-gray-400 py-8">尚未新增血檢數據，點擊上方按鈕新增</p>
              )}

              <div className="space-y-4">
                {client.lab_results.map((result, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">檢測項目</label>
                        <input
                          type="text"
                          value={result.test_name}
                          onChange={(e) => updateLabResult(index, 'test_name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">數值</label>
                        <input
                          type="number"
                          step="0.01"
                          value={result.value}
                          onChange={(e) => updateLabResult(index, 'value', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">單位</label>
                        <input
                          type="text"
                          value={result.unit}
                          onChange={(e) => updateLabResult(index, 'unit', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">參考範圍</label>
                        <input
                          type="text"
                          value={result.reference_range}
                          onChange={(e) => updateLabResult(index, 'reference_range', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">狀態</label>
                        <select
                          value={result.status}
                          onChange={(e) => updateLabResult(index, 'status', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="normal">正常</option>
                          <option value="attention">注意</option>
                          <option value="alert">警示</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">檢測日期</label>
                        <input
                          type="date"
                          value={result.date}
                          onChange={(e) => updateLabResult(index, 'date', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">自訂建議</label>
                        <textarea
                          value={result.custom_advice || ''}
                          onChange={(e) => updateLabResult(index, 'custom_advice', e.target.value)}
                          rows={2}
                          placeholder="留空則使用預設建議"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">自訂目標範圍</label>
                        <input
                          type="text"
                          value={result.custom_target || ''}
                          onChange={(e) => updateLabResult(index, 'custom_target', e.target.value)}
                          placeholder="留空則使用預設範圍"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeLabResult(index)}
                      className="mt-4 text-red-600 hover:text-red-800 text-sm"
                    >
                      刪除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== Tab: 補品 ===== */}
        {activeTab === 'supplements' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">補品清單</h2>
                <button
                  onClick={addSupplement}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  新增補品
                </button>
              </div>

              {client.supplements.length === 0 && (
                <p className="text-center text-gray-400 py-8">尚未新增補品，點擊上方按鈕新增</p>
              )}

              <div className="space-y-4">
                {client.supplements.map((supplement, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">補品名稱</label>
                        <input
                          type="text"
                          value={supplement.name}
                          onChange={(e) => updateSupplement(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">劑量</label>
                        <input
                          type="text"
                          value={supplement.dosage}
                          onChange={(e) => updateSupplement(index, 'dosage', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">服用時間</label>
                        <select
                          value={supplement.timing}
                          onChange={(e) => updateSupplement(index, 'timing', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="早餐">早餐</option>
                          <option value="午餐">午餐</option>
                          <option value="晚餐">晚餐</option>
                          <option value="訓練後">訓練後</option>
                          <option value="睡前">睡前</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">說明（可選）</label>
                        <input
                          type="text"
                          value={supplement.why || ''}
                          onChange={(e) => updateSupplement(index, 'why', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeSupplement(index)}
                      className="mt-4 text-red-600 hover:text-red-800 text-sm"
                    >
                      刪除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actions — 固定在底部，所有 tab 都看得到 */}
        <div className="flex justify-end space-x-4 mt-6 sticky bottom-4">
          <Link
            href="/admin"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors bg-white shadow-sm"
          >
            取消
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
