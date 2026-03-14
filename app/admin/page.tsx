'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronUp, ChevronDown, Search, Users, Activity, AlertTriangle, TrendingUp, Copy, ExternalLink, MessageSquare, X, Send, Trophy, Bell, RefreshCw, Trash2 } from 'lucide-react'
import { daysUntilDateTW } from '@/lib/date-utils'

interface Client {
  id: string
  unique_code: string
  name: string
  age: number
  gender: string
  status: 'normal' | 'attention' | 'alert'
  created_at: string
  expires_at: string | null
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
  subscription_tier: 'free' | 'self_managed' | 'coached'
  line_user_id: string | null
  last_line_activity: string | null
}

interface TrainingLogRecord { client_id: string; training_type: string }
interface SupplementLog { client_id: string; supplement_id: string; date: string; completed: boolean }
interface SupplementRecord { client_id: string }
interface BodyRecord { client_id: string; date: string; weight: number }
interface NutritionRecord { client_id: string; date: string; compliant: boolean | null }
interface WellnessRecord { client_id: string; date: string; energy_level: number }
interface RPERecord { client_id: string; date: string; rpe: number }

type SortKey = 'name' | 'status' | 'compliance' | 'lastActivity' | 'nextCheckup'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'normal' | 'attention' | 'competition' | 'coached' | 'self_managed' | 'free'

export default function AdminDashboard() {
  const router = useRouter()
  const { showToast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [allLogs, setAllLogs] = useState<SupplementLog[]>([])
  const [allSupplements, setAllSupplements] = useState<SupplementRecord[]>([])
  const [todayWellnessIds, setTodayWellnessIds] = useState<Set<string>>(new Set())
  const [todayLogIds, setTodayLogIds] = useState<Set<string>>(new Set())
  const [todayBodyIds, setTodayBodyIds] = useState<Set<string>>(new Set())
  const [todayTrainingMap, setTodayTrainingMap] = useState<Record<string, string>>({})
  const [todayNutritionMap, setTodayNutritionMap] = useState<Record<string, boolean>>({})
  const [recentBody, setRecentBody] = useState<BodyRecord[]>([])
  const [recentNutrition, setRecentNutrition] = useState<NutritionRecord[]>([])
  const [recentWellness, setRecentWellness] = useState<WellnessRecord[]>([])
  const [recentRPE, setRecentRPE] = useState<RPERecord[]>([])
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('lastActivity')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // 通知系統
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [runningCron, setRunningCron] = useState(false)

  // 快速回饋 modal
  const [feedbackClient, setFeedbackClient] = useState<Client | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const feedbackRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/admin/verify')
      .then(res => { if (!res.ok) { router.push('/admin/login'); return }; fetchData(); fetchNotifications() })
      .catch(() => router.push('/admin/login'))

    // 從編輯頁返回時重新載入
    const handleFocus = () => { fetchData() }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
      }
    } catch { /* silent */ }
  }

  const markNotificationsRead = async () => {
    await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: 'all' }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const runWeeklyCron = async () => {
    setRunningCron(true)
    try {
      const res = await fetch('/api/cron/weekly')
      if (res.ok) {
        const data = await res.json()
        showToast(`每週分析完成！季度重置：${data.results.quarterlyResets} 人，分析生成：${data.results.analysisGenerated} 人，通知：${data.results.alertsGenerated} 項`, 'success')
        fetchNotifications()
      } else {
        showToast('執行失敗，請檢查 console', 'error')
      }
    } catch { showToast('執行失敗', 'error') } finally { setRunningCron(false) }
  }

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/dashboard?_t=' + Date.now(), { cache: 'no-store' })
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
      setRecentBody(data.recentBody || [])
      setRecentNutrition(data.recentNutrition || [])
      setRecentWellness(data.recentWellness || [])
      setRecentRPE(data.recentTrainingRPE || [])
    } catch { /* silent */ } finally { setLoading(false) }
  }

  const clientStats = useMemo(() => {
    // 預先建立索引，避免 O(n²) 的 filter
    const logsByClient: Record<string, SupplementLog[]> = {}
    for (const log of allLogs) {
      if (!logsByClient[log.client_id]) logsByClient[log.client_id] = []
      logsByClient[log.client_id].push(log)
    }
    const supCountByClient: Record<string, number> = {}
    for (const s of allSupplements) {
      supCountByClient[s.client_id] = (supCountByClient[s.client_id] || 0) + 1
    }

    const stats: Record<string, { weekRate: number; lastActivity: string | null; supplementCount: number }> = {}
    for (const client of clients) {
      const clientLogs = logsByClient[client.id] || []
      const supplementCount = supCountByClient[client.id] || 0
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
    const coachedCount = clients.filter(c => c.subscription_tier === 'coached').length
    const selfManagedCount = clients.filter(c => c.subscription_tier === 'self_managed').length
    const freeCount = clients.filter(c => c.subscription_tier === 'free').length
    const expiringCount = clients.filter(c => { if (!c.expires_at) return false; const d = Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / 86400000); return d <= 7 && d >= 0 }).length
    const expiredCount = clients.filter(c => { if (!c.expires_at) return false; return new Date(c.expires_at).getTime() < Date.now() }).length
    return { totalClients, todayActive, needAttention, avgCompliance, competitionCount, coachedCount, selfManagedCount, freeCount, expiringCount, expiredCount }
  }, [clients, clientStats, todayLogIds, todayWellnessIds, todayTrainingMap, todayNutritionMap, todayBodyIds])

  // === 備賽倒數（距比賽最近的排最前） ===
  const competitionClients = useMemo(() => {
    return clients
      .filter(c => c.competition_enabled && c.competition_date)
      .map(c => {
        const daysLeft = daysUntilDateTW(c.competition_date!)
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

      // ── 體重停滯偵測（近 14 天，啟用體組成的學員）──
      if (client.body_composition_enabled) {
        const bodyLogs = recentBody.filter(b => b.client_id === client.id)
        if (bodyLogs.length >= 4) {
          const weights = bodyLogs.map(b => b.weight)
          const maxW = Math.max(...weights); const minW = Math.min(...weights)
          if (maxW - minW < 0.5) {
            items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: '體重近 14 天停滯（< 0.5kg 波動）', color: 'text-yellow-700 bg-yellow-50', priority: 2 })
          }
        }
      }

      // ── 飲食合規率 < 60%（近 14 天，啟用飲食的學員）──
      if (client.nutrition_enabled) {
        const nutLogs = recentNutrition.filter(n => n.client_id === client.id)
        const validNutLogs = nutLogs.filter(n => n.compliant !== null)
        if (validNutLogs.length >= 5) {
          const compliantCount = validNutLogs.filter(n => n.compliant).length
          const rate = Math.round((compliantCount / validNutLogs.length) * 100)
          if (rate < 60) {
            items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: `飲食合規率僅 ${rate}%（近 14 天）`, color: 'text-red-600 bg-red-50', priority: 1 })
          }
        }
      }

      // ── Wellness 連續 3 天能量 ≤ 2（啟用 Wellness 的學員）──
      if (client.wellness_enabled) {
        const wLogs = recentWellness
          .filter(w => w.client_id === client.id)
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 3)
        if (wLogs.length >= 3 && wLogs.every(w => w.energy_level <= 2)) {
          items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: '連續 3 天能量指數 ≤ 2，需關注', color: 'text-orange-600 bg-orange-50', priority: 1 })
        }
      }

      // ── 訓練 RPE 連續 3 天 > 8.5（啟用訓練的學員）──
      if (client.training_enabled) {
        const rpeLogs = recentRPE
          .filter(r => r.client_id === client.id)
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 3)
        if (rpeLogs.length >= 3 && rpeLogs.every(r => r.rpe > 8.5)) {
          items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: `訓練 RPE 連續偏高（${rpeLogs.map(r => r.rpe).join('/')}），建議 Deload`, color: 'text-orange-600 bg-orange-50', priority: 1 })
        }
      }
    }
    return items.sort((a, b) => a.priority - b.priority)
  }, [clients, clientStats, recentBody, recentNutrition, recentWellness, recentRPE])

  const handleSort = (key: SortKey) => { if (sortKey === key) setSortDir(p => p === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc') } }

  const filteredClients = useMemo(() => {
    let list = [...clients]
    if (search.trim()) { const q = search.trim().toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(q)) }
    if (statusFilter === 'normal') list = list.filter(c => c.status === 'normal')
    else if (statusFilter === 'attention') list = list.filter(c => c.status !== 'normal')
    else if (statusFilter === 'competition') list = list.filter(c => c.competition_enabled)
    else if (statusFilter === 'coached') list = list.filter(c => c.subscription_tier === 'coached')
    else if (statusFilter === 'self_managed') list = list.filter(c => c.subscription_tier === 'self_managed')
    else if (statusFilter === 'free') list = list.filter(c => c.subscription_tier === 'free')

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

  const copyClientUrl = (code: string) => { navigator.clipboard.writeText(`${window.location.origin}/c/${code}`).then(() => showToast('已複製學員網址', 'success')) }
  const handleLogout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); router.push('/admin/login') }
  const SortIcon = ({ column }: { column: SortKey }) => sortKey !== column ? <ChevronUp size={14} className="text-gray-300 ml-1 inline" /> : sortDir === 'asc' ? <ChevronUp size={14} className="text-blue-600 ml-1 inline" /> : <ChevronDown size={14} className="text-blue-600 ml-1 inline" />
  const getActivityLabel = (id: string) => { const s = clientStats[id]; if (!s?.lastActivity) return { text: '無記錄', color: 'text-gray-400' }; const d = Math.floor((Date.now() - new Date(s.lastActivity).getTime()) / 86400000); if (d >= 5) return { text: `${d}天未活動`, color: 'text-red-600 font-medium' }; if (d >= 3) return { text: `${d}天前`, color: 'text-yellow-600' }; if (d === 0) return { text: '今天', color: 'text-green-600' }; return { text: `${d}天前`, color: 'text-gray-600' } }
  const getCheckupLabel = (c: Client) => { if (!c.next_checkup_date) return { text: '未設定', color: 'text-gray-400' }; const t = new Date(); t.setHours(0,0,0,0); const ck = new Date(c.next_checkup_date); ck.setHours(0,0,0,0); const d = Math.floor((ck.getTime()-t.getTime())/86400000); if (d<0) return { text: `逾期 ${Math.abs(d)}天`, color: 'text-red-600 font-medium' }; if (d<=7) return { text: c.next_checkup_date, color: 'text-orange-600 font-medium' }; return { text: c.next_checkup_date, color: 'text-gray-600' } }
  const getTrainingEmoji = (t: string) => ({ push:'🫸',pull:'🫷',legs:'🦵',full_body:'🏋️',cardio:'🏃',rest:'😴',chest:'💪',shoulder:'🏔️',arms:'💪🏼' }[t] || '')
  const getComplianceColor = (r: number) => r >= 80 ? 'text-green-600' : r >= 50 ? 'text-yellow-600' : 'text-red-600'
  const getPrepPhaseLabel = (p: string | null) => ({ off_season: '非賽季', bulk: '增肌期', cut: '減脂期', peak_week: 'Peak Week', competition: '比賽日', recovery: '賽後恢復' }[p || ''] || p || '')
  const getLineStatus = (c: Client) => { if (!c.line_user_id) return { label: '', color: '' }; if (!c.last_line_activity) return { label: 'LINE 已綁定', color: 'text-gray-400' }; const mins = Math.floor((Date.now() - new Date(c.last_line_activity).getTime()) / 60000); if (mins < 5) return { label: '在線', color: 'text-green-500' }; if (mins < 60) return { label: `${mins}分鐘前`, color: 'text-green-400' }; const hrs = Math.floor(mins / 60); if (hrs < 24) return { label: `${hrs}小時前`, color: 'text-gray-400' }; return { label: `${Math.floor(hrs/24)}天前`, color: 'text-gray-400' } }
  const getTierBadge = (tier: string) => {
    if (tier === 'coached') return { label: '2999', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' }
    if (tier === 'self_managed') return { label: '499', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' }
    return { label: '免費', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' }
  }
  const getExpiryWarning = (c: Client) => {
    if (!c.expires_at) return null
    const days = Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / 86400000)
    if (days < 0) return { text: `已過期 ${Math.abs(days)} 天`, color: 'text-red-600' }
    if (days <= 7) return { text: `${days} 天到期`, color: 'text-red-500' }
    if (days <= 14) return { text: `${days} 天到期`, color: 'text-orange-500' }
    return null
  }

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

  const deleteClient = async (client: Client) => {
    if (!confirm(`確定要刪除「${client.name}」嗎？此操作無法復原，所有相關資料都會被刪除。`)) return
    try {
      const res = await fetch(`/api/admin/clients?id=${client.id}`, { method: 'DELETE' })
      if (res.ok) {
        setClients(prev => prev.filter(c => c.id !== client.id))
      } else {
        const data = await res.json()
        showToast(`刪除失敗：${data.error || '未知錯誤'}`, 'error')
      }
    } catch { showToast('刪除失敗，請稍後再試', 'error') }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" /><p className="text-gray-600">載入中...</p></div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex items-center justify-between h-16"><div><h1 className="text-xl font-bold text-gray-900">教練儀表板</h1><p className="text-sm text-gray-500">Howard 健康管理系統</p></div><div className="flex items-center gap-3">
                <button onClick={runWeeklyCron} disabled={runningCron} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm disabled:opacity-50" title="手動執行每週分析">
                  <RefreshCw size={15} className={runningCron ? 'animate-spin' : ''} /> {runningCron ? '分析中...' : '每週分析'}
                </button>
                <div className="relative">
                  <button onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markNotificationsRead() }} className="p-2 text-gray-500 hover:text-gray-700 relative">
                    <Bell size={18} />
                    {notifications.filter(n => !n.read).length > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{notifications.filter(n => !n.read).length}</span>}
                  </button>
                  {showNotifications && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
                      <div className="p-3 border-b border-gray-100 flex items-center justify-between"><span className="text-sm font-semibold text-gray-900">通知</span><button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button></div>
                      {notifications.length === 0 ? <p className="p-4 text-sm text-gray-400 text-center">暫無通知</p> : notifications.map((n: any) => (
                        <div key={n.id} className={`p-3 border-b border-gray-50 ${n.read ? '' : 'bg-blue-50/50'}`}>
                          <div className="text-xs text-gray-400 mb-1">{n.date}</div>
                          <div className="text-sm font-medium text-gray-900 mb-1">{n.title}</div>
                          {n.content && (() => { try { const items = JSON.parse(n.content); return Array.isArray(items) ? <ul className="text-xs text-gray-600 space-y-0.5">{items.slice(0, 5).map((item: string, i: number) => <li key={i}>• {item}</li>)}{items.length > 5 && <li className="text-gray-400">...還有 {items.length - 5} 項</li>}</ul> : null } catch { return <p className="text-xs text-gray-600">{n.content}</p> } })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Link href="/admin/blog" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors">文章管理</Link><Link href="/admin/clients/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">新增學員</Link><button onClick={handleLogout} className="text-gray-500 hover:text-gray-700 text-sm">登出</button></div></div></div></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ===== 頂部：一眼看重點 ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">總學員數</span><Users size={18} className="text-blue-500" /></div>
            <p className="text-3xl font-bold text-gray-900">{summaryStats.totalClients}</p>
            <div className="flex items-center gap-2 mt-2">
              {summaryStats.coachedCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">{summaryStats.coachedCount} 教練指導</span>}
              {summaryStats.selfManagedCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{summaryStats.selfManagedCount} 自主管理</span>}
              {summaryStats.freeCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{summaryStats.freeCount} 免費</span>}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5"><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">今日活躍</span><Activity size={18} className="text-green-500" /></div><p className="text-3xl font-bold text-gray-900">{summaryStats.todayActive}</p><p className="text-xs text-gray-400 mt-1">{summaryStats.totalClients > 0 ? Math.round((summaryStats.todayActive / summaryStats.totalClients) * 100) : 0}% 的學員</p></div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">需要關注</span><AlertTriangle size={18} className="text-red-500" /></div>
            <p className={`text-3xl font-bold ${summaryStats.needAttention > 0 ? 'text-red-600' : 'text-gray-900'}`}>{summaryStats.needAttention}</p>
            {(summaryStats.expiredCount > 0 || summaryStats.expiringCount > 0) && (
              <div className="flex items-center gap-2 mt-2">
                {summaryStats.expiredCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{summaryStats.expiredCount} 已過期</span>}
                {summaryStats.expiringCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">{summaryStats.expiringCount} 即將到期</span>}
              </div>
            )}
          </div>
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
                      <button onClick={() => { const c = clients.find(c => c.id === s.id); if (c) openFeedback(c) }} className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors" title="快速回饋">
                        <MessageSquare size={14} />
                      </button>
                    </div>
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        )}

        {/* ===== 警報區塊（回檢 + 體重停滯 + 飲食 + Wellness + RPE）===== */}
        {alerts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">需要你注意</h3>
            <div className="space-y-2">{alerts.map((a, i) => <Link key={`${a.clientId}-${i}`} href={`/admin/clients/${a.clientId}/overview`} className={`flex items-center justify-between px-4 py-3 rounded-xl ${a.color.split(' ')[1]} hover:opacity-80 transition-opacity`}><span className={`text-sm font-medium ${a.color.split(' ')[0]}`}>{a.name} — {a.text}</span><ExternalLink size={14} className="text-gray-400" /></Link>)}</div>
          </div>
        )}

        {/* ===== 學員列表 ===== */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100"><div className="flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋學員姓名..." className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div><div className="flex gap-2 flex-wrap">
                  {([['all','全部'],['competition','備賽'],['coached','2999'],['self_managed','499'],['free','免費'],['attention','需關注']] as [StatusFilter, string][]).map(([k,l]) => (
                    <button key={k} onClick={() => setStatusFilter(k)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter===k?'bg-blue-600 text-white': k === 'coached' ? 'bg-purple-50 text-purple-700 hover:bg-purple-100' : k === 'self_managed' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {k === 'competition' ? '🏆 ' : k === 'coached' ? '💎 ' : k === 'self_managed' ? '📊 ' : ''}{l}
                      {k === 'coached' && summaryStats.coachedCount > 0 ? ` (${summaryStats.coachedCount})` : ''}
                      {k === 'self_managed' && summaryStats.selfManagedCount > 0 ? ` (${summaryStats.selfManagedCount})` : ''}
                      {k === 'free' && summaryStats.freeCount > 0 ? ` (${summaryStats.freeCount})` : ''}
                    </button>
                  ))}
                </div></div></div>
          {filteredClients.length === 0 ? <div className="p-8 text-center"><p className="text-gray-500">{search||statusFilter!=='all'?'沒有符合條件的學員':'還沒有學員資料'}</p>{!search&&statusFilter==='all'&&<Link href="/admin/clients/new" className="inline-block mt-4 text-blue-600 hover:text-blue-800 text-sm">新增第一個學員</Link>}</div> : (
            <>
            {/* 手機版卡片 */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filteredClients.map(client => { const stat = clientStats[client.id]; const act = getActivityLabel(client.id); const ckup = getCheckupLabel(client); const lineStatus = getLineStatus(client); const daysToComp = client.competition_enabled && client.competition_date ? daysUntilDateTW(client.competition_date) : null; const tier = getTierBadge(client.subscription_tier); const expiry = getExpiryWarning(client); return (
                <div key={client.id} className="px-4 py-4">
                  <Link href={`/admin/clients/${client.id}/overview`} className="block hover:bg-gray-50 active:bg-gray-100 transition-colors rounded-lg -mx-2 px-2 py-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-gray-900">{client.name}</span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${tier.color}`}>{tier.label}</span>
                        {client.line_user_id && <span className={`text-[10px] ${lineStatus.color}`} title={`LINE ${lineStatus.label}`}>{lineStatus.label === '在線' ? '🟢' : '💬'}</span>}
                        {client.competition_enabled && daysToComp && daysToComp > 0 && (
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${daysToComp <= 14 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            🏆 {daysToComp}天
                          </span>
                        )}
                        {expiry && <span className={`text-[10px] font-medium ${expiry.color}`}>{expiry.text}</span>}
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
                    <button onClick={() => deleteClient(client)} className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                      <Trash2 size={12} /> 刪除
                    </button>
                  </div>
                </div>
              ) })}
            </div>
            {/* 桌面版表格 */}
            <div className="hidden sm:block overflow-x-auto"><table className="min-w-full"><thead><tr className="border-b border-gray-100"><th onClick={() => handleSort('name')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">學員 <SortIcon column="name" /></th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase select-none">方案</th><th onClick={() => handleSort('status')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">狀態 <SortIcon column="status" /></th><th onClick={() => handleSort('compliance')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">本週服從率 <SortIcon column="compliance" /></th><th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase select-none">今日進度</th><th onClick={() => handleSort('lastActivity')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">最後活動 <SortIcon column="lastActivity" /></th><th onClick={() => handleSort('nextCheckup')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">下次回檢 <SortIcon column="nextCheckup" /></th><th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{filteredClients.map(client => { const stat = clientStats[client.id]; const act = getActivityLabel(client.id); const ckup = getCheckupLabel(client); const lineStatus = getLineStatus(client); const daysToComp = client.competition_enabled && client.competition_date ? daysUntilDateTW(client.competition_date) : null; const tier = getTierBadge(client.subscription_tier); const expiry = getExpiryWarning(client); return (
              <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4"><Link href={`/admin/clients/${client.id}/overview`} className="hover:text-blue-600"><div className="text-sm font-medium text-gray-900">{client.name}{client.line_user_id && <span className={`ml-1 text-[10px] ${lineStatus.color}`} title={`LINE ${lineStatus.label}`}>{lineStatus.label === '在線' ? '🟢' : '💬'}</span>}{client.competition_enabled && daysToComp && daysToComp > 0 && <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${daysToComp <= 14 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>🏆 {daysToComp}d</span>}{client.training_enabled&&todayTrainingMap[client.id]&&<span className="ml-1.5" title={`今日訓練：${todayTrainingMap[client.id]}`}>{getTrainingEmoji(todayTrainingMap[client.id])}</span>}{client.nutrition_enabled&&todayNutritionMap[client.id]!==undefined&&<span className="ml-1" title={`今日飲食：${todayNutritionMap[client.id]?'合規':'未合規'}`}>{todayNutritionMap[client.id]?'🥗':'🍔'}</span>}</div><div className="text-xs text-gray-400 mt-0.5">{client.age}歲 · {client.gender}{client.competition_enabled && ` · ${getPrepPhaseLabel(client.prep_phase)}`}<span className="ml-1.5 inline-flex gap-0.5">{client.body_composition_enabled&&<span title="體重/體態">⚖️</span>}{client.wellness_enabled&&<span title="每日感受">😊</span>}{client.nutrition_enabled&&<span title="飲食">🥗</span>}{client.training_enabled&&<span title="訓練">🏋️</span>}{client.supplement_enabled&&<span title="補品">💊</span>}{client.lab_enabled&&<span title="血檢">🩸</span>}</span></div></Link></td>
                <td className="px-4 py-4"><div><span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${tier.color}`}>{tier.label}</span>{expiry && <p className={`text-[10px] mt-1 ${expiry.color}`}>{expiry.text}</p>}</div></td>
                <td className="px-5 py-4"><span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${!client.is_active ? 'bg-gray-200 text-gray-500' : client.status==='normal'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{!client.is_active ? '已停用' : client.status==='normal'?'正常':'需要關注'}</span></td>
                <td className="px-5 py-4">{stat?.supplementCount>0?<span className={`text-sm font-medium ${getComplianceColor(stat.weekRate)}`}>{stat.weekRate}%</span>:<span className="text-sm text-gray-400">--</span>}</td>
                <td className="px-5 py-4"><div className="flex flex-wrap gap-1">{client.body_composition_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayBodyIds.has(client.id)?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="體重">⚖️</span>}{client.wellness_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayWellnessIds.has(client.id)?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="感受">😊</span>}{client.nutrition_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayNutritionMap[client.id]!==undefined?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="飲食">🥗</span>}{client.training_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayTrainingMap[client.id]?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="訓練">🏋️</span>}{client.supplement_enabled&&<span className={`text-xs px-1.5 py-0.5 rounded ${todayLogIds.has(client.id)?'bg-green-50 text-green-600':'bg-gray-50 text-gray-300'}`} title="補品">💊</span>}</div></td>
                <td className="px-5 py-4"><span className={`text-sm ${act.color}`}>{act.text}</span></td>
                <td className="px-5 py-4"><span className={`text-sm ${ckup.color}`}>{ckup.text}</span></td>
                <td className="px-5 py-4"><div className="flex items-center gap-1.5"><button onClick={() => openFeedback(client)} className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors" title="快速回饋"><MessageSquare size={15} /></button><button onClick={(e) => { e.preventDefault(); copyClientUrl(client.unique_code) }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="複製學員連結"><Copy size={15} /></button><Link href={`/admin/clients/${client.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編輯"><ExternalLink size={15} /></Link><button onClick={() => deleteClient(client)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="刪除學員"><Trash2 size={15} /></button></div></td>
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
