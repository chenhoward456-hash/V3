'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ChevronUp, ChevronDown, Search, Users, Activity, AlertTriangle, TrendingUp, Copy, ExternalLink } from 'lucide-react'

interface Client {
  id: string
  unique_code: string
  name: string
  age: number
  gender: string
  status: 'normal' | 'attention' | 'alert'
  created_at: string
  expires_at: string
  next_checkup_date: string | null
  training_enabled: boolean
  nutrition_enabled: boolean
  body_composition_enabled: boolean
  wellness_enabled: boolean
  supplement_enabled: boolean
  lab_enabled: boolean
}

interface TrainingLogRecord {
  client_id: string
  training_type: string
}

interface SupplementLog {
  client_id: string
  supplement_id: string
  date: string
  completed: boolean
}

interface SupplementRecord {
  client_id: string
}

type SortKey = 'name' | 'status' | 'compliance' | 'lastActivity' | 'nextCheckup'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'normal' | 'attention'

export default function AdminDashboard() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [allLogs, setAllLogs] = useState<SupplementLog[]>([])
  const [allSupplements, setAllSupplements] = useState<SupplementRecord[]>([])
  const [todayWellnessIds, setTodayWellnessIds] = useState<Set<string>>(new Set())
  const [todayLogIds, setTodayLogIds] = useState<Set<string>>(new Set())
  const [todayBodyIds, setTodayBodyIds] = useState<Set<string>>(new Set())
  const [todayTrainingMap, setTodayTrainingMap] = useState<Record<string, string>>({})
  const [todayNutritionMap, setTodayNutritionMap] = useState<Record<string, boolean>>({})

  // 搜尋、排序、篩選
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('lastActivity')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    const cookies = document.cookie.split(';')
    const adminCookie = cookies.find(cookie => cookie.trim().startsWith('admin_password='))
    if (!adminCookie) {
      router.push('/admin/login')
      return
    }
    fetchData()
  }, [router])

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const [clientsRes, logsRes, supplementsRes, wellnessRes, todayLogsRes, trainingRes, nutritionRes, bodyRes] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('supplement_logs').select('client_id, supplement_id, date, completed').gte('date', sevenDaysAgo),
        supabase.from('supplements').select('client_id'),
        supabase.from('daily_wellness').select('client_id').eq('date', today),
        supabase.from('supplement_logs').select('client_id').eq('date', today).eq('completed', true),
        supabase.from('training_logs').select('client_id, training_type').eq('date', today),
        supabase.from('nutrition_logs').select('client_id, compliant').eq('date', today),
        supabase.from('body_composition').select('client_id').eq('date', today),
      ])

      setClients(clientsRes.data || [])
      setAllLogs(logsRes.data || [])
      setAllSupplements(supplementsRes.data || [])
      setTodayWellnessIds(new Set((wellnessRes.data || []).map((r: any) => r.client_id)))
      setTodayLogIds(new Set((todayLogsRes.data || []).map((r: any) => r.client_id)))
      const tMap: Record<string, string> = {}
      for (const r of (trainingRes.data || []) as TrainingLogRecord[]) {
        tMap[r.client_id] = r.training_type
      }
      setTodayTrainingMap(tMap)
      const nMap: Record<string, boolean> = {}
      for (const r of (nutritionRes.data || []) as any[]) {
        nMap[r.client_id] = r.compliant
      }
      setTodayNutritionMap(nMap)
      setTodayBodyIds(new Set((bodyRes.data || []).map((r: any) => r.client_id)))
    } catch (error) {
      console.error('載入資料錯誤:', error)
    } finally {
      setLoading(false)
    }
  }

  // 每個學員的統計
  const clientStats = useMemo(() => {
    const stats: Record<string, { weekRate: number; lastActivity: string | null; supplementCount: number }> = {}

    for (const client of clients) {
      const clientLogs = allLogs.filter(l => l.client_id === client.id)
      const supplementCount = allSupplements.filter(s => s.client_id === client.id).length

      // 本週服從率
      let weekRate = 0
      if (supplementCount > 0) {
        const completedCount = clientLogs.filter(l => l.completed).length
        const totalPossible = supplementCount * 7
        weekRate = Math.round((completedCount / totalPossible) * 100)
      }

      // 最後活動日期（最近一筆 completed log）
      const completedLogs = clientLogs.filter(l => l.completed)
      let lastActivity: string | null = null
      if (completedLogs.length > 0) {
        lastActivity = completedLogs.sort((a, b) => b.date.localeCompare(a.date))[0].date
      }

      stats[client.id] = { weekRate, lastActivity, supplementCount }
    }
    return stats
  }, [clients, allLogs, allSupplements])

  // === 摘要卡片數據 ===
  const summaryStats = useMemo(() => {
    const totalClients = clients.length
    const todayActive = clients.filter(c => todayLogIds.has(c.id) || todayWellnessIds.has(c.id)).length
    const needAttention = clients.filter(c => c.status !== 'normal').length
    const rates = Object.values(clientStats).filter(s => s.supplementCount > 0).map(s => s.weekRate)
    const avgCompliance = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0

    return { totalClients, todayActive, needAttention, avgCompliance }
  }, [clients, clientStats, todayLogIds, todayWellnessIds])

  // === 警示列表 ===
  const alerts = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const items: { clientId: string; name: string; uniqueCode: string; text: string; color: string; priority: number }[] = []

    for (const client of clients) {
      const stat = clientStats[client.id]

      // 超過 3 天沒打卡
      if (stat) {
        let daysSinceActivity = Infinity
        if (stat.lastActivity) {
          daysSinceActivity = Math.floor((today.getTime() - new Date(stat.lastActivity).getTime()) / (1000 * 60 * 60 * 24))
        }
        if (daysSinceActivity >= 3 && stat.supplementCount > 0) {
          items.push({
            clientId: client.id, name: client.name, uniqueCode: client.unique_code,
            text: daysSinceActivity === Infinity ? '從未打卡' : `${daysSinceActivity}天未活動`,
            color: 'text-red-600 bg-red-50', priority: 0,
          })
        }

        // 本週服從率低於 50%
        if (stat.weekRate < 50 && stat.supplementCount > 0) {
          items.push({
            clientId: client.id, name: client.name, uniqueCode: client.unique_code,
            text: `本週服從率 ${stat.weekRate}%`,
            color: 'text-yellow-700 bg-yellow-50', priority: 2,
          })
        }
      }

      // 回檢日期
      if (client.next_checkup_date) {
        const checkup = new Date(client.next_checkup_date)
        checkup.setHours(0, 0, 0, 0)
        const diffDays = Math.floor((checkup.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays < 0) {
          items.push({
            clientId: client.id, name: client.name, uniqueCode: client.unique_code,
            text: `回檢已逾期 ${Math.abs(diffDays)}天`,
            color: 'text-red-600 bg-red-50', priority: 0,
          })
        } else if (diffDays <= 7) {
          items.push({
            clientId: client.id, name: client.name, uniqueCode: client.unique_code,
            text: `回檢日 ${client.next_checkup_date}`,
            color: 'text-orange-600 bg-orange-50', priority: 1,
          })
        }
      }
    }

    return items.sort((a, b) => a.priority - b.priority)
  }, [clients, clientStats])

  // === 排序、搜尋、篩選 ===
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const filteredClients = useMemo(() => {
    let list = [...clients]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q))
    }

    if (statusFilter === 'normal') {
      list = list.filter(c => c.status === 'normal')
    } else if (statusFilter === 'attention') {
      list = list.filter(c => c.status !== 'normal')
    }

    list.sort((a, b) => {
      let cmp = 0
      const statA = clientStats[a.id]
      const statB = clientStats[b.id]
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name, 'zh-TW')
      } else if (sortKey === 'status') {
        const order = { normal: 0, attention: 1, alert: 2 }
        cmp = order[a.status] - order[b.status]
      } else if (sortKey === 'compliance') {
        cmp = (statA?.weekRate ?? 0) - (statB?.weekRate ?? 0)
      } else if (sortKey === 'lastActivity') {
        const dateA = statA?.lastActivity ? new Date(statA.lastActivity).getTime() : 0
        const dateB = statB?.lastActivity ? new Date(statB.lastActivity).getTime() : 0
        cmp = dateA - dateB
      } else if (sortKey === 'nextCheckup') {
        const dateA = a.next_checkup_date ? new Date(a.next_checkup_date).getTime() : Infinity
        const dateB = b.next_checkup_date ? new Date(b.next_checkup_date).getTime() : Infinity
        cmp = dateA - dateB
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [clients, search, statusFilter, sortKey, sortDir, clientStats])

  const copyClientUrl = (uniqueCode: string) => {
    const url = `${window.location.origin}/c/${uniqueCode}`
    navigator.clipboard.writeText(url).then(() => {
      alert('學員網址已複製到剪貼簿')
    })
  }

  const handleLogout = () => {
    document.cookie = 'admin_password=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    router.push('/admin/login')
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ChevronUp size={14} className="text-gray-300 ml-1 inline" />
    return sortDir === 'asc'
      ? <ChevronUp size={14} className="text-blue-600 ml-1 inline" />
      : <ChevronDown size={14} className="text-blue-600 ml-1 inline" />
  }

  const getActivityLabel = (clientId: string) => {
    const stat = clientStats[clientId]
    if (!stat?.lastActivity) return { text: '無記錄', color: 'text-gray-400' }
    const diff = Math.floor((Date.now() - new Date(stat.lastActivity).getTime()) / (1000 * 60 * 60 * 24))
    if (diff >= 3) return { text: `${diff}天未活動`, color: 'text-red-600 font-medium' }
    if (diff === 0) return { text: '今天', color: 'text-green-600' }
    return { text: `${diff}天前`, color: 'text-gray-600' }
  }

  const getCheckupLabel = (client: Client) => {
    if (!client.next_checkup_date) return { text: '未設定', color: 'text-gray-400' }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkup = new Date(client.next_checkup_date)
    checkup.setHours(0, 0, 0, 0)
    const diff = Math.floor((checkup.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const dateStr = client.next_checkup_date
    if (diff < 0) return { text: `逾期 ${Math.abs(diff)}天`, color: 'text-red-600 font-medium' }
    if (diff <= 7) return { text: dateStr, color: 'text-orange-600 font-medium' }
    return { text: dateStr, color: 'text-gray-600' }
  }

  const getTrainingEmoji = (type: string) => {
    const map: Record<string, string> = {
      push: '🫸',
      pull: '🫷',
      legs: '🦵',
      full_body: '🏋️',
      cardio: '🏃',
      rest: '😴',
      chest: '💪',
      shoulder: '🏔️',
      arms: '💪🏼',
    }
    return map[type] || ''
  }

  const getComplianceColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600'
    if (rate >= 50) return 'text-yellow-600'
    return 'text-red-600'
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-bold text-gray-900">教練儀表板</h1>
              <p className="text-sm text-gray-500">Howard 健康管理系統</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/clients/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">
                新增學員
              </Link>
              <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700 text-sm">
                登出
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* === 1. 摘要卡片 === */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">總學員數</span>
              <Users size={18} className="text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{summaryStats.totalClients}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">今日活躍</span>
              <Activity size={18} className="text-green-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{summaryStats.todayActive}</p>
            <p className="text-xs text-gray-400 mt-1">{summaryStats.totalClients > 0 ? Math.round((summaryStats.todayActive / summaryStats.totalClients) * 100) : 0}% 的學員</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">需要關注</span>
              <AlertTriangle size={18} className="text-red-500" />
            </div>
            <p className={`text-3xl font-bold ${summaryStats.needAttention > 0 ? 'text-red-600' : 'text-gray-900'}`}>{summaryStats.needAttention}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">平均服從率</span>
              <TrendingUp size={18} className="text-purple-500" />
            </div>
            <p className={`text-3xl font-bold ${getComplianceColor(summaryStats.avgCompliance)}`}>{summaryStats.avgCompliance}%</p>
            <p className="text-xs text-gray-400 mt-1">本週平均</p>
          </div>
        </div>

        {/* === 2. 警示區塊 === */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">⚠️ 需要你注意</h3>
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <Link
                  key={`${alert.clientId}-${i}`}
                  href={`/admin/clients/${alert.clientId}`}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl ${alert.color.split(' ')[1]} hover:opacity-80 transition-opacity`}
                >
                  <span className={`text-sm font-medium ${alert.color.split(' ')[0]}`}>
                    {alert.name} — {alert.text}
                  </span>
                  <ExternalLink size={14} className="text-gray-400" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 py-2">✅ 所有學員狀態正常</p>
          )}
        </div>

        {/* === 3. 學員列表 === */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜尋學員姓名..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                {([['all', '全部'], ['normal', '正常'], ['attention', '需關注']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredClients.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">{search || statusFilter !== 'all' ? '沒有符合條件的學員' : '還沒有學員資料'}</p>
              {!search && statusFilter === 'all' && (
                <Link href="/admin/clients/new" className="inline-block mt-4 text-blue-600 hover:text-blue-800 text-sm">
                  新增第一個學員
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th onClick={() => handleSort('name')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">
                      學員 <SortIcon column="name" />
                    </th>
                    <th onClick={() => handleSort('status')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">
                      狀態 <SortIcon column="status" />
                    </th>
                    <th onClick={() => handleSort('compliance')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">
                      本週服從率 <SortIcon column="compliance" />
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase select-none">
                      今日進度
                    </th>
                    <th onClick={() => handleSort('lastActivity')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">
                      最後活動 <SortIcon column="lastActivity" />
                    </th>
                    <th onClick={() => handleSort('nextCheckup')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">
                      下次回檢 <SortIcon column="nextCheckup" />
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredClients.map((client) => {
                    const stat = clientStats[client.id]
                    const activity = getActivityLabel(client.id)
                    const checkup = getCheckupLabel(client)
                    return (
                      <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <Link href={`/admin/clients/${client.id}/overview`} className="hover:text-blue-600">
                            <div className="text-sm font-medium text-gray-900">
                              {client.name}
                              {client.training_enabled && todayTrainingMap[client.id] && (
                                <span className="ml-1.5" title={`今日訓練：${todayTrainingMap[client.id]}`}>
                                  {getTrainingEmoji(todayTrainingMap[client.id])}
                                </span>
                              )}
                              {client.nutrition_enabled && todayNutritionMap[client.id] !== undefined && (
                                <span className="ml-1" title={`今日飲食：${todayNutritionMap[client.id] ? '合規' : '未合規'}`}>
                                  {todayNutritionMap[client.id] ? '🥗' : '🍔'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {client.age}歲 · {client.gender}
                              <span className="ml-1.5 inline-flex gap-0.5">
                                {client.body_composition_enabled && <span title="體重/體態">⚖️</span>}
                                {client.wellness_enabled && <span title="每日感受">😊</span>}
                                {client.nutrition_enabled && <span title="飲食">🥗</span>}
                                {client.training_enabled && <span title="訓練">🏋️</span>}
                                {client.supplement_enabled && <span title="補品">💊</span>}
                                {client.lab_enabled && <span title="血檢">🩸</span>}
                              </span>
                            </div>
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                            client.status === 'normal'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {client.status === 'normal' ? '正常' : '需要關注'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {stat?.supplementCount > 0 ? (
                            <span className={`text-sm font-medium ${getComplianceColor(stat.weekRate)}`}>
                              {stat.weekRate}%
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">--</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1">
                            {client.body_composition_enabled && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${todayBodyIds.has(client.id) ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-300'}`} title="體重">⚖️</span>
                            )}
                            {client.wellness_enabled && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${todayWellnessIds.has(client.id) ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-300'}`} title="感受">😊</span>
                            )}
                            {client.nutrition_enabled && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${todayNutritionMap[client.id] !== undefined ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-300'}`} title="飲食">🥗</span>
                            )}
                            {client.training_enabled && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${todayTrainingMap[client.id] ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-300'}`} title="訓練">🏋️</span>
                            )}
                            {client.supplement_enabled && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${todayLogIds.has(client.id) ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-300'}`} title="補品">💊</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-sm ${activity.color}`}>{activity.text}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-sm ${checkup.color}`}>{checkup.text}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => copyClientUrl(client.unique_code)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="複製學員連結">
                              <Copy size={15} />
                            </button>
                            <Link href={`/admin/clients/${client.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編輯">
                              <ExternalLink size={15} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
