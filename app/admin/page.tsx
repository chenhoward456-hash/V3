'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronUp, ChevronDown, Search, Users, Activity, AlertTriangle, TrendingUp, Copy, ExternalLink, MessageSquare, X, Send, Trophy } from 'lucide-react'

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
  competition_enabled: boolean
  competition_date: string | null
  prep_phase: string | null
  coach_weekly_note: string | null
  target_weight: number | null
  is_active: boolean
}

interface TrainingLogRecord { client_id: string; training_type: string }
interface SupplementLog { client_id: string; supplement_id: string; date: string; completed: boolean }
interface SupplementRecord { client_id: string }

type SortKey = 'name' | 'status' | 'compliance' | 'lastActivity' | 'nextCheckup'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'normal' | 'attention' | 'competition'

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
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('lastActivity')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // 快速回饋 modal
  const [feedbackClient, setFeedbackClient] = useState<Client | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const feedbackRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/admin/verify')
      .then(res => { if (!res.ok) { router.push('/admin/login'); return }; fetchData() })
      .catch(() => router.push('/admin/login'))

    // 從編輯頁返回時重新載入
    const handleFocus = () => { fetchData() }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/dashboard')
      if (!res.ok) { if (res.status === 401) { router.push('/admin/login'); return }; throw new Error('載入失敗') }
      const data = await res.json()
      setClients(data.clients || [])
      setAllLogs(data.supplementLogs || [])
      setAllSupplements(data.supplements || [])
      setTodayWellnessIds(new Set((data.todayWellness || []).map((r: any) => r.client_id)))
      setTodayLogIds(new Set((data.todayLogs || []).map((r: any) => r.client_id)))
      const tMap: Record<string, string> = {}
      for (const r of (data.todayTraining || []) as TrainingLogRecord[]) tMap[r.client_id] = r.training_type
      setTodayTrainingMap(tMap)
      const nMap: Record<string, boolean> = {}
      for (const r of (data.todayNutrition || []) as any[]) nMap[r.client_id] = r.compliant
      setTodayNutritionMap(nMap)
      setTodayBodyIds(new Set((data.todayBody || []).map((r: any) => r.client_id)))
    } catch { /* silent */ } finally { setLoading(false) }
  }

  const clientStats = useMemo(() => {
    const stats: Record<string, { weekRate: number; lastActivity: string | null; supplementCount: number }> = {}
    for (const client of clients) {
      const clientLogs = allLogs.filter(l => l.client_id === client.id)
      const supplementCount = allSupplements.filter(s => s.client_id === client.id).length
      let weekRate = 0
      if (supplementCount > 0) { weekRate = Math.round((clientLogs.filter(l => l.completed).length / (supplementCount * 7)) * 100) }
      const completedLogs = clientLogs.filter(l => l.completed)
      const lastActivity = completedLogs.length > 0 ? completedLogs.sort((a, b) => b.date.localeCompare(a.date))[0].date : null
      stats[client.id] = { weekRate, lastActivity, supplementCount }
    }
    return stats
  }, [clients, allLogs, allSupplements])

  const summaryStats = useMemo(() => {
    const totalClients = clients.length
    const todayActive = clients.filter(c => todayLogIds.has(c.id) || todayWellnessIds.has(c.id) || !!todayTrainingMap[c.id] || todayNutritionMap[c.id] !== undefined || todayBodyIds.has(c.id)).length
    const needAttention = clients.filter(c => c.status !== 'normal').length
    const rates = Object.values(clientStats).filter(s => s.supplementCount > 0).map(s => s.weekRate)
    const avgCompliance = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0
    const competitionCount = clients.filter(c => c.competition_enabled).length
    return { totalClients, todayActive, needAttention, avgCompliance, competitionCount }
  }, [clients, clientStats, todayLogIds, todayWellnessIds, todayTrainingMap, todayNutritionMap, todayBodyIds])

  // === 備賽倒數（距比賽最近的排最前） ===
  const competitionClients = useMemo(() => {
    return clients
      .filter(c => c.competition_enabled && c.competition_date)
      .map(c => {
        const daysLeft = Math.ceil((new Date(c.competition_date!).getTime() - Date.now()) / 86400000)
        return { ...c, daysLeft }
      })
      .filter(c => c.daysLeft > 0)
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [clients])

  // === 今日表現最好 / 需要關注 ===
  const spotlightClients = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const stars: { id: string; name: string; reason: string }[] = []
    const struggling: { id: string; name: string; reason: string }[] = []

    for (const client of clients) {
      const stat = clientStats[client.id]
      // 表現好：今天完成多項
      let todayCount = 0
      if (todayLogIds.has(client.id)) todayCount++
      if (todayWellnessIds.has(client.id)) todayCount++
      if (todayTrainingMap[client.id]) todayCount++
      if (todayNutritionMap[client.id] !== undefined) todayCount++
      if (todayBodyIds.has(client.id)) todayCount++
      if (todayCount >= 3) stars.push({ id: client.id, name: client.name, reason: `今日完成 ${todayCount} 項` })

      // 需要關注
      if (stat) {
        let daysSince = Infinity
        if (stat.lastActivity) daysSince = Math.floor((today.getTime() - new Date(stat.lastActivity).getTime()) / 86400000)
        if (daysSince >= 5 && stat.supplementCount > 0) struggling.push({ id: client.id, name: client.name, reason: daysSince === Infinity ? '從未打卡' : `${daysSince} 天未活動` })
        else if (stat.weekRate < 50 && stat.supplementCount > 0) struggling.push({ id: client.id, name: client.name, reason: `服從率 ${stat.weekRate}%` })
      }
    }
    return { stars: stars.slice(0, 3), struggling: struggling.slice(0, 5) }
  }, [clients, clientStats, todayLogIds, todayWellnessIds, todayTrainingMap, todayNutritionMap, todayBodyIds])

  const alerts = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const items: { clientId: string; name: string; uniqueCode: string; text: string; color: string; priority: number }[] = []
    for (const client of clients) {
      const stat = clientStats[client.id]
      if (stat) {
        let daysSince = Infinity
        if (stat.lastActivity) daysSince = Math.floor((today.getTime() - new Date(stat.lastActivity).getTime()) / 86400000)
        if (daysSince >= 5 && stat.supplementCount > 0) items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: daysSince === Infinity ? '從未打卡' : `${daysSince}天未活動`, color: 'text-red-600 bg-red-50', priority: 0 })
        if (stat.weekRate < 50 && stat.supplementCount > 0) items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: `本週服從率 ${stat.weekRate}%`, color: 'text-yellow-700 bg-yellow-50', priority: 2 })
      }
      if (client.next_checkup_date) {
        const checkup = new Date(client.next_checkup_date); checkup.setHours(0, 0, 0, 0)
        const diff = Math.floor((checkup.getTime() - today.getTime()) / 86400000)
        if (diff < 0) items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: `回檢已逾期 ${Math.abs(diff)}天`, color: 'text-red-600 bg-red-50', priority: 0 })
        else if (diff <= 7) items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: `回檢日 ${client.next_checkup_date}`, color: 'text-orange-600 bg-orange-50', priority: 1 })
      }
    }
    return items.sort((a, b) => a.priority - b.priority)
  }, [clients, clientStats])

  const handleSort = (key: SortKey) => { if (sortKey === key) setSortDir(p => p === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc') } }

  const filteredClients = useMemo(() => {
    let list = [...clients]
    if (search.trim()) { const q = search.trim().toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(q)) }
    if (statusFilter === 'normal') list = list.filter(c => c.status === 'normal')
    else if (statusFilter === 'attention') list = list.filter(c => c.status !== 'normal')
    else if (statusFilter === 'competition') list = list.filter(c => c.competition_enabled)

    list.sort((a, b) => {
      // 備賽選手永遠排最前（按比賽日期近的排前面）
      const aComp = a.competition_enabled && a.competition_date ? new Date(a.competition_date).getTime() : Infinity
      const bComp = b.competition_enabled && b.competition_date ? new Date(b.competition_date).getTime() : Infinity
      const aIsComp = a.competition_enabled ? 0 : 1
      const bIsComp = b.competition_enabled ? 0 : 1
      if (aIsComp !== bIsComp) return aIsComp - bIsComp
      if (a.competition_enabled && b.competition_enabled && aComp !== bComp) return aComp - bComp

      let cmp = 0; const sA = clientStats[a.id]; const sB = clientStats[b.id]
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name, 'zh-TW')
      else if (sortKey === 'status') cmp = ({ normal: 0, attention: 1, alert: 2 }[a.status]) - ({ normal: 0, attention: 1, alert: 2 }[b.status])
      else if (sortKey === 'compliance') cmp = (sA?.weekRate ?? 0) - (sB?.weekRate ?? 0)
      else if (sortKey === 'lastActivity') cmp = (sA?.lastActivity ? new Date(sA.lastActivity).getTime() : 0) - (sB?.lastActivity ? new Date(sB.lastActivity).getTime() : 0)
      else if (sortKey === 'nextCheckup') cmp = (a.next_checkup_date ? new Date(a.next_checkup_date).getTime() : Infinity) - (b.next_checkup_date ? new Date(b.next_checkup_date).getTime() : Infinity)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [clients, search, statusFilter, sortKey, sortDir, clientStats])

  const copyClientUrl = (code: string) => { navigator.clipboard.writeText(`${window.location.origin}/c/${code}`).then(() => alert('學員網址已複製到剪貼簿')) }
  const handleLogout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); router.push('/admin/login') }
  const SortIcon = ({ column }: { column: SortKey }) => sortKey !== column ? <ChevronUp size={14} className="text-gray-300 ml-1 inline" /> : sortDir === 'asc' ? <ChevronUp size={14} className="text-blue-600 ml-1 inline" /> : <ChevronDown size={14} className="text-blue-600 ml-1 inline" />
  const getActivityLabel = (id: string) => { const s = clientStats[id]; if (!s?.lastActivity) return { text: '無記錄', color: 'text-gray-400' }; const d = Math.floor((Date.now() - new Date(s.lastActivity).getTime()) / 86400000); if (d >= 5) return { text: `${d}天未活動`, color: 'text-red-600 font-medium' }; if (d >= 3) return { text: `${d}天前`, color: 'text-yellow-600' }; if (d === 0) return { text: '今天', color: 'text-green-600' }; return { text: `${d}天前`, color: 'text-gray-600' } }
  const getCheckupLabel = (c: Client) => { if (!c.next_checkup_date) return { text: '未設定', color: 'text-gray-400' }; const t = new Date(); t.setHours(0,0,0,0); const ck = new Date(c.next_checkup_date); ck.setHours(0,0,0,0); const d = Math.floor((ck.getTime()-t.getTime())/86400000); if (d<0) return { text: `逾期 ${Math.abs(d)}天`, color: 'text-red-600 font-medium' }; if (d<=7) return { text: c.next_checkup_date, color: 'text-orange-600 font-medium' }; return { text: c.next_checkup_date, color: 'text-gray-600' } }
  const getTrainingEmoji = (t: string) => ({ push:'🫸',pull:'🫷',legs:'🦵',full_body:'🏋️',cardio:'🏃',rest:'😴',chest:'💪',shoulder:'🏔️',arms:'💪🏼' }[t] || '')
  const getComplianceColor = (r: number) => r >= 80 ? 'text-green-600' : r >= 50 ? 'text-yellow-600' : 'text-red-600'
  const getPrepPhaseLabel = (p: string | null) => ({ off_season: '非賽季', bulk: '增肌期', cut: '減脂期', peak_week: 'Peak Week', competition: '比賽日', recovery: '賽後恢復' }[p || ''] || p || '')

  // 快速回饋功能
  const openFeedback = (client: Client) => {
    setFeedbackClient(client)
    setFeedbackText(client.coach_weekly_note || '')
    setTimeout(() => feedbackRef.current?.focus(), 100)
  }

  const saveFeedback = async () => {
    if (!feedbackClient) return
    setFeedbackSaving(true)
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: feedbackClient.id,
          clientData: { coach_weekly_note: feedbackText || null },
        }),
      })
      if (res.ok) {
        setClients(prev => prev.map(c => c.id === feedbackClient.id ? { ...c, coach_weekly_note: feedbackText || null } : c))
        setFeedbackClient(null)
      }
    } catch { /* silent */ } finally { setFeedbackSaving(false) }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" /><p className="text-gray-600">載入中...</p></div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex items-center justify-between h-16"><div><h1 className="text-xl font-bold text-gray-900">教練儀表板</h1><p className="text-sm text-gray-500">Howard 健康管理系統</p></div><div className="flex items-center gap-3"><Link href="/admin/clients/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">新增學員</Link><button onClick={handleLogout} className="text-gray-500 hover:text-gray-700 text-sm">登出</button></div></div></div></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ===== 頂部：一眼看重點 ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm p-5"><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">總學員數</span><Users size={18} className="text-blue-500" /></div><p className="text-3xl font-bold text-gray-900">{summaryStats.totalClients}</p></div>
          <div className="bg-white rounded-2xl shadow-sm p-5"><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">今日活躍</span><Activity size={18} className="text-green-500" /></div><p className="text-3xl font-bold text-gray-900">{summaryStats.todayActive}</p><p className="text-xs text-gray-400 mt-1">{summaryStats.totalClients > 0 ? Math.round((summaryStats.todayActive / summaryStats.totalClients) * 100) : 0}% 的學員</p></div>
          <div className="bg-white rounded-2xl shadow-sm p-5"><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">需要關注</span><AlertTriangle size={18} className="text-red-500" /></div><p className={`text-3xl font-bold ${summaryStats.needAttention > 0 ? 'text-red-600' : 'text-gray-900'}`}>{summaryStats.needAttention}</p></div>
          <div className="bg-white rounded-2xl shadow-sm p-5"><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">平均服從率</span><TrendingUp size={18} className="text-purple-500" /></div><p className={`text-3xl font-bold ${getComplianceColor(summaryStats.avgCompliance)}`}>{summaryStats.avgCompliance}%</p><p className="text-xs text-gray-400 mt-1">本週平均</p></div>
        </div>

        {/* ===== 備賽倒數區塊 ===== */}
        {competitionClients.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={18} className="text-amber-600" />
              <h3 className="text-base font-semibold text-amber-900">備賽倒數</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {competitionClients.map(c => {
                const stat = clientStats[c.id]
                const urgencyColor = c.daysLeft <= 7 ? 'text-red-600' : c.daysLeft <= 14 ? 'text-orange-600' : c.daysLeft <= 30 ? 'text-amber-600' : 'text-gray-700'
                return (
                  <Link key={c.id} href={`/admin/clients/${c.id}/overview`}
                    className="bg-white rounded-xl p-4 hover:shadow-md transition-shadow block">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                      <span className={`text-2xl font-bold ${urgencyColor}`}>{c.daysLeft}<span className="text-xs font-normal ml-0.5">天</span></span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{getPrepPhaseLabel(c.prep_phase)} {c.target_weight ? `· 目標 ${c.target_weight}kg` : ''}</span>
                      {stat?.supplementCount ? <span className={`font-medium ${getComplianceColor(stat.weekRate)}`}>{stat.weekRate}%</span> : null}
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      {c.body_composition_enabled && <span className={`text-xs ${todayBodyIds.has(c.id) ? 'opacity-100' : 'opacity-30'}`}>⚖️</span>}
                      {c.nutrition_enabled && <span className={`text-xs ${todayNutritionMap[c.id] !== undefined ? 'opacity-100' : 'opacity-30'}`}>🥗</span>}
                      {c.training_enabled && <span className={`text-xs ${todayTrainingMap[c.id] ? 'opacity-100' : 'opacity-30'}`}>🏋️</span>}
                      {c.supplement_enabled && <span className={`text-xs ${todayLogIds.has(c.id) ? 'opacity-100' : 'opacity-30'}`}>💊</span>}
                      {c.wellness_enabled && <span className={`text-xs ${todayWellnessIds.has(c.id) ? 'opacity-100' : 'opacity-30'}`}>😊</span>}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ===== 表現好 + 需要關注 雙欄 ===== */}
        {(spotlightClients.stars.length > 0 || spotlightClients.struggling.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {spotlightClients.stars.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-green-800 mb-2">🌟 今日表現好</p>
                <div className="space-y-1.5">{spotlightClients.stars.map(s => (
                  <Link key={s.id} href={`/admin/clients/${s.id}/overview`} className="flex items-center justify-between px-3 py-2 bg-white/60 rounded-lg hover:bg-white/80 transition-colors">
                    <span className="text-sm font-medium text-green-700">{s.name}</span>
                    <span className="text-xs text-green-600">{s.reason}</span>
                  </Link>
                ))}</div>
              </div>
            )}
            {spotlightClients.struggling.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-red-800 mb-2">⚠️ 需要關注</p>
                <div className="space-y-1.5">{spotlightClients.struggling.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-white/60 rounded-lg">
                    <Link href={`/admin/clients/${s.id}/overview`} className="text-sm font-medium text-red-700 hover:underline">{s.name}</Link>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600">{s.reason}</span>
                      <button onClick={() => openFeedback(clients.find(c => c.id === s.id)!)} className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors" title="快速回饋">
                        <MessageSquare size={14} />
                      </button>
                    </div>
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        )}

        {/* ===== 原有的警報區塊（回檢逾期等） ===== */}
        {alerts.filter(a => a.text.includes('回檢')).length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">需要你注意</h3>
            <div className="space-y-2">{alerts.filter(a => a.text.includes('回檢')).map((a, i) => <Link key={`${a.clientId}-${i}`} href={`/admin/clients/${a.clientId}`} className={`flex items-center justify-between px-4 py-3 rounded-xl ${a.color.split(' ')[1]} hover:opacity-80 transition-opacity`}><span className={`text-sm font-medium ${a.color.split(' ')[0]}`}>{a.name} — {a.text}</span><ExternalLink size={14} className="text-gray-400" /></Link>)}</div>
          </div>
        )}

        {/* ===== 學員列表 ===== */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100"><div className="flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋學員姓名..." className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div><div className="flex gap-2 flex-wrap">{([['all','全部'],['competition','備賽'],['normal','正常'],['attention','需關注']] as const).map(([k,l]) => <button key={k} onClick={() => setStatusFilter(k)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter===k?'bg-blue-600 text-white':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{k === 'competition' ? `🏆 ${l}` : l}</button>)}</div></div></div>
          {filteredClients.length === 0 ? <div className="p-8 text-center"><p className="text-gray-500">{search||statusFilter!=='all'?'沒有符合條件的學員':'還沒有學員資料'}</p>{!search&&statusFilter==='all'&&<Link href="/admin/clients/new" className="inline-block mt-4 text-blue-600 hover:text-blue-800 text-sm">新增第一個學員</Link>}</div> : (
            <>
            {/* 手機版卡片 */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filteredClients.map(client => { const stat = clientStats[client.id]; const act = getActivityLabel(client.id); const ckup = getCheckupLabel(client); const daysToComp = client.competition_enabled && client.competition_date ? Math.ceil((new Date(client.competition_date).getTime() - Date.now()) / 86400000) : null; return (
                <div key={client.id} className="px-4 py-4">
                  <Link href={`/admin/clients/${client.id}/overview`} className="block hover:bg-gray-50 active:bg-gray-100 transition-colors rounded-lg -mx-2 px-2 py-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-gray-900">{client.name}</span>
                        {client.competition_enabled && daysToComp && daysToComp > 0 && (
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${daysToComp <= 14 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            🏆 {daysToComp}天
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${!client.is_active ? 'bg-gray-200 text-gray-500' : client.status==='normal'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{!client.is_active ? '已停用' : client.status==='normal'?'正常':'關注'}</span>
                      </div>
                      {stat?.supplementCount>0?<span className={`text-lg font-bold ${getComplianceColor(stat.weekRate)}`}>{stat.weekRate}%</span>:<span className="text-sm text-gray-300">--</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {client.body_composition_enabled&&<span className={`text-sm ${todayBodyIds.has(client.id)?'opacity-100':'opacity-30'}`}>⚖️</span>}
                        {client.wellness_enabled&&<span className={`text-sm ${todayWellnessIds.has(client.id)?'opacity-100':'opacity-30'}`}>😊</span>}
                        {client.nutrition_enabled&&<span className={`text-sm ${todayNutritionMap[client.id]!==undefined?'opacity-100':'opacity-30'}`}>🥗</span>}
                        {client.training_enabled&&<span className={`text-sm ${todayTrainingMap[client.id]?'opacity-100':'opacity-30'}`}>🏋️</span>}
                        {client.supplement_enabled&&<span className={`text-sm ${todayLogIds.has(client.id)?'opacity-100':'opacity-30'}`}>💊</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className={act.color}>{act.text}</span>
                        <span className="text-gray-300">·</span>
                        <span className={ckup.color}>{ckup.text}</span>
                      </div>
                    </div>
                  </Link>
                  {/* 手機版快速回饋按鈕 */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50">
                    <button onClick={() => openFeedback(client)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
                      <MessageSquare size={12} /> {client.coach_weekly_note ? '修改回饋' : '寫回饋'}
                    </button>
                    {client.coach_weekly_note && <span className="text-xs text-gray-400 truncate flex-1">{client.coach_weekly_note}</span>}
                  </div>
                </div>
              ) })}
            </div>
            {/* 桌面版表格 */}
            <div className="hidden sm:block overflow-x-auto"><table className="min-w-full"><thead><tr className="border-b border-gray-100"><th onClick={() => handleSort('name')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">學員 <SortIcon column="name" /></th><th onClick={() => handleSort('status')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">狀態 <SortIcon column="status" /></th><th onClick={() => handleSort('compliance')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">本週服從率 <SortIcon column="compliance" /></th><th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase select-none">今日進度</th><th onClick={() => handleSort('lastActivity')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">最後活動 <SortIcon column="lastActivity" /></th><th onClick={() => handleSort('nextCheckup')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">下次回檢 <SortIcon column="nextCheckup" /></th><th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{filteredClients.map(client => { const stat = clientStats[client.id]; const act = getActivityLabel(client.id); const ckup = getCheckupLabel(client); const daysToComp = client.competition_enabled && client.competition_date ? Math.ceil((new Date(client.competition_date).getTime() - Date.now()) / 86400000) : null; return (
              <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4"><Link href={`/admin/clients/${client.id}/overview`} className="hover:text-blue-600"><div className="text-sm font-medium text-gray-900">{client.name}{client.competition_enabled && daysToComp && daysToComp > 0 && <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${daysToComp <= 14 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>🏆 {daysToComp}d</span>}{client.training_enabled&&todayTrainingMap[client.id]&&<span className="ml-1.5" title={`今日訓練：${todayTrainingMap[client.id]}`}>{getTrainingEmoji(todayTrainingMap[client.id])}</span>}{client.nutrition_enabled&&todayNutritionMap[client.id]!==undefined&&<span className="ml-1" title={`今日飲食：${todayNutritionMap[client.id]?'合規':'未合規'}`}>{todayNutritionMap[client.id]?'🥗':'🍔'}</span>}</div><div className="text-xs text-gray-400 mt-0.5">{client.age}歲 · {client.gender}{client.competition_enabled && ` · ${getPrepPhaseLabel(client.prep_phase)}`}<span className="ml-1.5 inline-flex gap-0.5">{client.body_composition_enabled&&<span title="體重/體態">⚖️</span>}{client.wellness_enabled&&<span title="每日感受">😊</span>}{client.nutrition_enabled&&<span title="飲食">🥗</span>}{client.training_enabled&&<span title="訓練">🏋️</span>}{client.supplement_enabled&&<span title="補品">💊</span>}{client.lab_enabled&&<span title="血檢">🩸</span>}</span></div></Link></td>
                <td className="px-5 py-4"><span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${!client.is_active ? 'bg-gray-200 text-gray-500' : client.status==='normal'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{!client.is_active ? '已停用' : client.status==='normal'?'正常':'需要關注'}</span></td>
                <td className="px-5 py-4">{stat?.supplementCount>0?<span className={`text-sm font-medium ${getComplianceColor(stat.weekRate)}`}>{stat.weekRate}%</span>:<span className="text-sm text-gray-400">--</span>}</td>
                <td className="px-5 py-4"><div className="flex flex-wrap gap-1">{client.body_composition_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayBodyIds.has(client.id)?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="體重">⚖️</span>}{client.wellness_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayWellnessIds.has(client.id)?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="感受">😊</span>}{client.nutrition_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayNutritionMap[client.id]!==undefined?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="飲食">🥗</span>}{client.training_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayTrainingMap[client.id]?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="訓練">🏋️</span>}{client.supplement_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayLogIds.has(client.id)?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="補品">💊</span>}</div></td>
                <td className="px-5 py-4"><span className={`text-sm ${act.color}`}>{act.text}</span></td>
                <td className="px-5 py-4"><span className={`text-sm ${ckup.color}`}>{ckup.text}</span></td>
                <td className="px-5 py-4"><div className="flex items-center gap-1.5"><button onClick={() => openFeedback(client)} className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors" title="快速回饋"><MessageSquare size={15} /></button><button onClick={(e) => { e.preventDefault(); copyClientUrl(client.unique_code) }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="複製學員連結"><Copy size={15} /></button><Link href={`/admin/clients/${client.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編輯"><ExternalLink size={15} /></Link></div></td>
              </tr>) })}</tbody></table></div>
            </>
          )}
        </div>
      </div>

      {/* ===== 快速回饋 Modal ===== */}
      {feedbackClient && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setFeedbackClient(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">快速回饋</h3>
                <p className="text-sm text-gray-500">{feedbackClient.name}</p>
              </div>
              <button onClick={() => setFeedbackClient(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <textarea
              ref={feedbackRef}
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              rows={3}
              placeholder="這週體重控制得不錯，繼續保持！碳水可以再多吃一點。"
              className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50 text-sm mb-2"
            />
            <p className="text-xs text-gray-400 mb-4">學員打開 app 第一眼就會看到這段話</p>
            {/* 快速短語 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {['做得很好，繼續保持！', '這週要注意飲食控制', '記得每天量體重', '睡眠要再改善'].map(phrase => (
                <button key={phrase} onClick={() => setFeedbackText(prev => prev ? prev + phrase : phrase)} className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors">{phrase}</button>
              ))}
            </div>
            <button
              onClick={saveFeedback}
              disabled={feedbackSaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 font-medium"
            >
              <Send size={16} /> {feedbackSaving ? '儲存中...' : '送出回饋'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
