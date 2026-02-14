'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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

interface TrainingLogRecord { client_id: string; training_type: string }
interface SupplementLog { client_id: string; supplement_id: string; date: string; completed: boolean }
interface SupplementRecord { client_id: string }

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
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('lastActivity')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    fetch('/api/admin/verify')
      .then(res => { if (!res.ok) { router.push('/admin/login'); return }; fetchData() })
      .catch(() => router.push('/admin/login'))
  }, [router])

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
    const todayActive = clients.filter(c => todayLogIds.has(c.id) || todayWellnessIds.has(c.id)).length
    const needAttention = clients.filter(c => c.status !== 'normal').length
    const rates = Object.values(clientStats).filter(s => s.supplementCount > 0).map(s => s.weekRate)
    const avgCompliance = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0
    return { totalClients, todayActive, needAttention, avgCompliance }
  }, [clients, clientStats, todayLogIds, todayWellnessIds])

  const alerts = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const items: { clientId: string; name: string; uniqueCode: string; text: string; color: string; priority: number }[] = []
    for (const client of clients) {
      const stat = clientStats[client.id]
      if (stat) {
        let daysSince = Infinity
        if (stat.lastActivity) daysSince = Math.floor((today.getTime() - new Date(stat.lastActivity).getTime()) / 86400000)
        if (daysSince >= 3 && stat.supplementCount > 0) items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: daysSince === Infinity ? '從未打卡' : `${daysSince}天未活動`, color: 'text-red-600 bg-red-50', priority: 0 })
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
    list.sort((a, b) => {
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
  const getActivityLabel = (id: string) => { const s = clientStats[id]; if (!s?.lastActivity) return { text: '無記錄', color: 'text-gray-400' }; const d = Math.floor((Date.now() - new Date(s.lastActivity).getTime()) / 86400000); if (d >= 3) return { text: `${d}天未活動`, color: 'text-red-600 font-medium' }; if (d === 0) return { text: '今天', color: 'text-green-600' }; return { text: `${d}天前`, color: 'text-gray-600' } }
  const getCheckupLabel = (c: Client) => { if (!c.next_checkup_date) return { text: '未設定', color: 'text-gray-400' }; const t = new Date(); t.setHours(0,0,0,0); const ck = new Date(c.next_checkup_date); ck.setHours(0,0,0,0); const d = Math.floor((ck.getTime()-t.getTime())/86400000); if (d<0) return { text: `逾期 ${Math.abs(d)}天`, color: 'text-red-600 font-medium' }; if (d<=7) return { text: c.next_checkup_date, color: 'text-orange-600 font-medium' }; return { text: c.next_checkup_date, color: 'text-gray-600' } }
  const getTrainingEmoji = (t: string) => ({ push:'🫸',pull:'🫷',legs:'🦵',full_body:'🏋️',cardio:'🏃',rest:'😴',chest:'💪',shoulder:'🏔️',arms:'💪🏼' }[t] || '')
  const getComplianceColor = (r: number) => r >= 80 ? 'text-green-600' : r >= 50 ? 'text-yellow-600' : 'text-red-600'

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" /><p className="text-gray-600">載入中...</p></div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex items-center justify-between h-16"><div><h1 className="text-xl font-bold text-gray-900">教練儀表板</h1><p className="text-sm text-gray-500">Howard 健康管理系統</p></div><div className="flex items-center gap-3"><Link href="/admin/clients/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">新增學員</Link><button onClick={handleLogout} className="text-gray-500 hover:text-gray-700 text-sm">登出</button></div></div></div></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm p-5"><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">總學員數</span><Users size={18} className="text-blue-500" /></div><p className="text-3xl font-bold text-gray-900">{summaryStats.totalClients}</p></div>
          <div className="bg-white rounded-2xl shadow-sm p-5"><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">今日活躍</span><Activity size={18} className="text-green-500" /></div><p className="text-3xl font-bold text-gray-900">{summaryStats.todayActive}</p><p className="text-xs text-gray-400 mt-1">{summaryStats.totalClients > 0 ? Math.round((summaryStats.todayActive / summaryStats.totalClients) * 100) : 0}% 的學員</p></div>
          <div className="bg-white rounded-2xl shadow-sm p-5"><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">需要關注</span><AlertTriangle size={18} className="text-red-500" /></div><p className={`text-3xl font-bold ${summaryStats.needAttention > 0 ? 'text-red-600' : 'text-gray-900'}`}>{summaryStats.needAttention}</p></div>
          <div className="bg-white rounded-2xl shadow-sm p-5"><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">平均服從率</span><TrendingUp size={18} className="text-purple-500" /></div><p className={`text-3xl font-bold ${getComplianceColor(summaryStats.avgCompliance)}`}>{summaryStats.avgCompliance}%</p><p className="text-xs text-gray-400 mt-1">本週平均</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">需要你注意</h3>
          {alerts.length > 0 ? <div className="space-y-2">{alerts.map((a, i) => <Link key={`${a.clientId}-${i}`} href={`/admin/clients/${a.clientId}`} className={`flex items-center justify-between px-4 py-3 rounded-xl ${a.color.split(' ')[1]} hover:opacity-80 transition-opacity`}><span className={`text-sm font-medium ${a.color.split(' ')[0]}`}>{a.name} — {a.text}</span><ExternalLink size={14} className="text-gray-400" /></Link>)}</div> : <p className="text-gray-500 py-2">所有學員狀態正常</p>}
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100"><div className="flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋學員姓名..." className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div><div className="flex gap-2">{([['all','全部'],['normal','正常'],['attention','需關注']] as const).map(([k,l]) => <button key={k} onClick={() => setStatusFilter(k)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter===k?'bg-blue-600 text-white':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{l}</button>)}</div></div></div>
          {filteredClients.length === 0 ? <div className="p-8 text-center"><p className="text-gray-500">{search||statusFilter!=='all'?'沒有符合條件的學員':'還沒有學員資料'}</p>{!search&&statusFilter==='all'&&<Link href="/admin/clients/new" className="inline-block mt-4 text-blue-600 hover:text-blue-800 text-sm">新增第一個學員</Link>}</div> : (
            <div className="overflow-x-auto"><table className="min-w-full"><thead><tr className="border-b border-gray-100"><th onClick={() => handleSort('name')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">學員 <SortIcon column="name" /></th><th onClick={() => handleSort('status')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">狀態 <SortIcon column="status" /></th><th onClick={() => handleSort('compliance')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">本週服從率 <SortIcon column="compliance" /></th><th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase select-none">今日進度</th><th onClick={() => handleSort('lastActivity')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">最後活動 <SortIcon column="lastActivity" /></th><th onClick={() => handleSort('nextCheckup')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">下次回檢 <SortIcon column="nextCheckup" /></th><th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{filteredClients.map(client => { const stat = clientStats[client.id]; const act = getActivityLabel(client.id); const ckup = getCheckupLabel(client); return (
              <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4"><Link href={`/admin/clients/${client.id}/overview`} className="hover:text-blue-600"><div className="text-sm font-medium text-gray-900">{client.name}{client.training_enabled&&todayTrainingMap[client.id]&&<span className="ml-1.5" title={`今日訓練：${todayTrainingMap[client.id]}`}>{getTrainingEmoji(todayTrainingMap[client.id])}</span>}{client.nutrition_enabled&&todayNutritionMap[client.id]!==undefined&&<span className="ml-1" title={`今日飲食：${todayNutritionMap[client.id]?'合規':'未合規'}`}>{todayNutritionMap[client.id]?'🥗':'🍔'}</span>}</div><div className="text-xs text-gray-400 mt-0.5">{client.age}歲 · {client.gender}<span className="ml-1.5 inline-flex gap-0.5">{client.body_composition_enabled&&<span title="體重/體態">⚖️</span>}{client.wellness_enabled&&<span title="每日感受">😊</span>}{client.nutrition_enabled&&<span title="飲食">🥗</span>}{client.training_enabled&&<span title="訓練">🏋️</span>}{client.supplement_enabled&&<span title="補品">💊</span>}{client.lab_enabled&&<span title="血檢">🩸</span>}</span></div></Link></td>
                <td className="px-5 py-4"><span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${client.status==='normal'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{client.status==='normal'?'正常':'需要關注'}</span></td>
                <td className="px-5 py-4">{stat?.supplementCount>0?<span className={`text-sm font-medium ${getComplianceColor(stat.weekRate)}`}>{stat.weekRate}%</span>:<span className="text-sm text-gray-400">--</span>}</td>
                <td className="px-5 py-4"><div className="flex flex-wrap gap-1">{client.body_composition_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayBodyIds.has(client.id)?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="體重">⚖️</span>}{client.wellness_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayWellnessIds.has(client.id)?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="感受">😊</span>}{client.nutrition_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayNutritionMap[client.id]!==undefined?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="飲食">🥗</span>}{client.training_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayTrainingMap[client.id]?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="訓練">🏋️</span>}{client.supplement_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayLogIds.has(client.id)?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="補品">💊</span>}</div></td>
                <td className="px-5 py-4"><span className={`text-sm ${act.color}`}>{act.text}</span></td>
                <td className="px-5 py-4"><span className={`text-sm ${ckup.color}`}>{ckup.text}</span></td>
                <td className="px-5 py-4"><div className="flex items-center gap-2"><button onClick={() => copyClientUrl(client.unique_code)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="複製學員連結"><Copy size={15} /></button><Link href={`/admin/clients/${client.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編輯"><ExternalLink size={15} /></Link></div></td>
              </tr>) })}</tbody></table></div>
          )}
        </div>
      </div>
    </div>
  )
}
