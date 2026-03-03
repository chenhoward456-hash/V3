'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { calcRecommendedStageWeight, type RecommendedStageWeightResult } from '@/lib/nutrition-engine'

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
  competition_enabled: boolean
  competition_date: string | null
  prep_phase: string
  protein_target: number | null
  water_target: number | null
  carbs_target: number | null
  fat_target: number | null
  calories_target: number | null
  target_weight: number | null
  body_fat_target: number | null
  is_active: boolean
  carbs_training_day: number | null
  carbs_rest_day: number | null
  goal_type: 'cut' | 'bulk' | null
  diet_start_date: string | null
  activity_profile: 'sedentary' | 'high_energy_flux' | null
  health_mode_enabled: boolean
  quarterly_cycle_start: string | null

  lab_results: LabResult[]
  supplements: Supplement[]
}

export default function ClientEditor() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.clientId as string

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [activeTab, setActiveTab] = useState<EditorTab>('basic')
  const [latestBodyComp, setLatestBodyComp] = useState<{ weight: number | null; body_fat: number | null; height: number | null } | null>(null)

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
        competition_enabled: false,
        competition_date: null,
        prep_phase: 'off_season',
        protein_target: null,
        water_target: null,
        carbs_target: null,
        fat_target: null,
        calories_target: null,
        target_weight: null,
        body_fat_target: null,
        is_active: true,
        carbs_training_day: null,
        carbs_rest_day: null,
        goal_type: null,
        diet_start_date: null,
        activity_profile: null,
        health_mode_enabled: false,
        quarterly_cycle_start: null,

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
        setError('載入學員資料失敗')
        return
      }
      const data = await clientRes.json()
      setClient(data)

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
        protein_target: client.protein_target || null,
        water_target: client.water_target || null,
        carbs_target: client.carbs_target || null,
        fat_target: client.fat_target || null,
        calories_target: client.calories_target || null,
        target_weight: client.target_weight || null,
        body_fat_target: client.body_fat_target || null,
        is_active: client.is_active,
        carbs_training_day: client.carbs_training_day || null,
        carbs_rest_day: client.carbs_rest_day || null,
        goal_type: client.goal_type || null,
        diet_start_date: client.diet_start_date || null,
        activity_profile: client.activity_profile || null,
        health_mode_enabled: client.health_mode_enabled,
        quarterly_cycle_start: client.quarterly_cycle_start || null,
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
        alert(`✅ 學員「${client.name}」新增成功！\n代碼：${uniqueCode}`)
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
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
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
                  { key: 'body_composition_enabled', label: '體重/體態紀錄', desc: '體重、體脂、肌肉量登記（最基本功能）' },
                  { key: 'wellness_enabled', label: '每日感受紀錄', desc: '心情、睡眠品質、能量追蹤' },
                  { key: 'nutrition_enabled', label: '飲食追蹤', desc: '每日飲食合規紀錄' },
                  { key: 'training_enabled', label: '訓練追蹤', desc: '每日訓練類型與強度紀錄' },
                  { key: 'supplement_enabled', label: '補品管理', desc: '補品清單與每日打卡' },
                  { key: 'lab_enabled', label: '血檢追蹤', desc: '血檢數據與健康指標' },
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

                {/* 模式選擇：健康模式 vs 備賽模式（互斥） */}
                <div className="border-t border-gray-100 pt-4 mt-2">
                  <p className="text-xs text-gray-400 mb-3">進階模式（兩者互斥）</p>

                  {/* 健康模式 */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">健康模式 🌿</p>
                      <p className="text-xs text-gray-500 mt-0.5">季費制、健康分數、四柱追蹤（吃睡練補）、無截止日</p>
                    </div>
                    <button
                      onClick={() => setClient(prev => prev ? ({
                        ...prev,
                        health_mode_enabled: !prev.health_mode_enabled,
                        competition_enabled: false,  // 互斥
                      }) : prev)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        client.health_mode_enabled ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        client.health_mode_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {/* 備賽模式 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">備賽模式 🏆</p>
                      <p className="text-xs text-gray-500 mt-0.5">健美備賽倒數、完整巨量營養素、進階感受追蹤</p>
                    </div>
                    <button
                      onClick={() => setClient(prev => prev ? ({
                        ...prev,
                        competition_enabled: !prev.competition_enabled,
                        health_mode_enabled: false,  // 互斥
                      }) : prev)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        client.competition_enabled ? 'bg-amber-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        client.competition_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Nutrition Targets */}
            {client.nutrition_enabled && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">飲食目標設定</h2>
                <p className="text-xs text-gray-400 mb-4">設定後學員記錄飲食時會看到目標對比</p>
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
                  {client.competition_enabled ? '🎯 目標上台體重' : '🎯 目標體重'}
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  {client.competition_enabled ? '設定比賽日目標體重，系統會自動推算建議範圍' : '設定目標體重，系統會依體組成推算健康體重範圍'}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">目標體重 (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={client.target_weight ?? ''}
                      onChange={(e) => updateClient('target_weight', e.target.value ? Number(e.target.value) : null)}
                      placeholder={client.competition_enabled ? '例如：65.0' : '例如：65.0'}
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
                      !!client.competition_enabled
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
            {client.nutrition_enabled && client.competition_enabled && (
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
            {client.health_mode_enabled && (
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
                    const elapsed = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
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

            {/* Competition Prep Settings — 備賽專屬（比賽日期、備賽階段） */}
            {client.competition_enabled && (
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-400">
                <h2 className="text-lg font-medium text-gray-900 mb-1">🏆 備賽設定</h2>
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
                        距離比賽還有 {Math.max(0, Math.ceil((new Date(client.competition_date).getTime() - new Date().getTime()) / 86400000))} 天
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
                      <option value="off_season">休賽期</option>
                      <option value="bulk">增肌期</option>
                      <option value="cut">減脂期</option>
                      <option value="peak_week">Peak Week</option>
                      <option value="competition">比賽日</option>
                      <option value="recovery">賽後恢復</option>
                    </select>
                  </div>
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
