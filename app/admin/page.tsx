'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronUp, ChevronDown, Search, Copy, ExternalLink, MessageSquare, X, Send, Trophy, Bell, RefreshCw, Trash2, Clock } from 'lucide-react'
import { daysUntilDateTW, DAY_MS, getLocalDateStr } from '@/lib/date-utils'
import { projectWeightVerdict, metricSlopePerWeek } from '@/lib/comp-projection'
import { reconcileIntake, isGapSignificant } from '@/lib/implied-intake'
import { isCompetitionMode, PHASE_LABELS } from '@/lib/client-mode'
import { buildWinbackMessage, type WinbackContext } from '@/lib/winback'
import FeatureAnnounce from '@/components/admin/FeatureAnnounce'

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
  client_mode: string
  goal_type: string | null
  diet_start_date: string | null
  competition_date: string | null
  prep_phase: string | null
  coach_weekly_note: string | null
  target_weight: number | null
  calories_target?: number | null
  target_date: string | null
  is_active: boolean
  onboarding_notes_rendered?: { sections?: unknown[] } | null
  health_screening?: { screened_at?: string } | null
  subscription_tier: 'free' | 'self_managed' | 'coached'
  line_user_id: string | null
  last_line_activity: string | null
  coach_last_viewed_at: string | null
}

interface TrainingLogRecord { client_id: string; training_type: string }
interface SupplementLog { client_id: string; supplement_id: string; date: string; completed: boolean }
interface SupplementRecord { id: string; client_id: string }
interface BodyRecord { client_id: string; date: string; weight: number }
interface ProposalItem {
  id: string
  client_id: string
  proposed_at: string
  expires_at: string | null
  proposal_type: string
  current_state: Record<string, number | null> | null
  proposed_changes: Record<string, number | null> | null
  reasoning: string | null
  clients?: { name?: string } | null
}

interface NutritionRecord { client_id: string; date: string; compliant: boolean | null; calories?: number | null }
interface WellnessRecord { client_id: string; date: string; energy_level: number }
interface RPERecord { client_id: string; date: string; rpe: number }

interface CoachNotification {
  id: string
  date: string
  title: string
  content: string | null
  read: boolean
}

type SortKey = 'name' | 'status' | 'compliance' | 'lastActivity' | 'nextCheckup'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'normal' | 'attention' | 'competition' | 'coached' | 'self_managed' | 'free' | 'inactive'

// ── 進度判定：用近 14 天體重趨勢 vs 目標方向，算出「有沒有效果」──
type ProgressLevel = 'on_track' | 'slow' | 'reverse' | 'insufficient' | 'offline'
interface ProgressVerdict { level: ProgressLevel; dot: string; label: string; detail: string; rank: number; pill: string }

/**
 * 掉線判定 —— rank -1，排在所有體重判定之前。
 *
 * ⚠️ 2026-08-23：戰情室原本只收「近 7 天有在動」的人，等於**最需要出手的人整個看不到**。
 * Howard 說「想更直覺知道學員狀況」，但畫面上排前面的是還在乖乖記錄的那幾個，
 * 掉線 9 天的萬哲鴻、17 天的張承鈞被推到最下面的表格裡。
 *
 * 一個人 3 天沒動，他的體重趨勢就已經是舊聞了 —— 這時候該講的不是「他減脂中」
 * 而是「他不見了」。所以掉線直接覆蓋體重判定，但把最後已知的趨勢留在 detail 裡，
 * 教練還是看得出他消失前是往哪個方向走。
 *
 * >30 天的不進來（跟行動佇列同一條線）：那是叫不回來的鬼魂，歸留存數字不歸戰情室。
 */
const OFFLINE_MIN_DAYS = 3
function offlineVerdict(daysIdle: number, base: ProgressVerdict): ProgressVerdict {
  const severe = daysIdle >= 7
  return {
    level: 'offline',
    dot: severe ? 'bg-rose-500' : 'bg-amber-500',
    label: `掉線 ${daysIdle} 天`,
    detail: base.level === 'insufficient' ? base.detail : `消失前：${base.label}．${base.detail}`,
    rank: severe ? -2 : -1,
    pill: severe ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700',
  }
}

const FLAT_KG_PER_WEEK = 0.12 // 每週變化 < 此值視為「持平」

function computeProgress(
  goalType: string | null,
  prepPhase: string | null,
  targetWeight: number | null,
  weights: { date: string; weight: number }[], // 已按日期升冪
): ProgressVerdict {
  const insufficient = (detail: string): ProgressVerdict => ({ level: 'insufficient', dot: 'bg-slate-300', label: '資料不足', detail, rank: 2, pill: 'bg-slate-100 text-slate-500' })
  if (!weights || weights.length === 0) return insufficient('14 天沒量體重')
  if (weights.length < 3) return insufficient(`14 天只量 ${weights.length} 次`)
  const first = weights[0], last = weights[weights.length - 1]
  const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / DAY_MS
  if (days < 5) return insufficient('量測天數太短')

  const deltaKg = last.weight - first.weight
  const perWeek = deltaKg / (days / 7)
  const gt = (goalType || '').toLowerCase()
  const isCut = gt.includes('loss') || gt === 'cut' || gt.includes('fat') || (goalType || '').includes('減') || prepPhase === 'cut'
  const isBulk = gt === 'bulk' || gt.includes('gain') || (goalType || '').includes('增') || prepPhase === 'bulk'
  const mag = `${deltaKg > 0 ? '+' : ''}${deltaKg.toFixed(1)}kg / ${Math.round(days)}天`
  const toGoal = targetWeight != null ? `　距目標 ${(targetWeight - last.weight) > 0 ? '+' : ''}${(targetWeight - last.weight).toFixed(1)}kg` : ''

  if (isCut) {
    if (perWeek <= -FLAT_KG_PER_WEEK) return { level: 'on_track', dot: 'bg-emerald-500', label: '減脂中', detail: `${mag}（${perWeek.toFixed(1)}kg/週）${toGoal}`, rank: 3, pill: 'bg-emerald-100 text-emerald-700' }
    if (perWeek >= FLAT_KG_PER_WEEK) return { level: 'reverse', dot: 'bg-rose-500', label: '不減反增', detail: `${mag}${toGoal}`, rank: 0, pill: 'bg-rose-100 text-rose-700' }
    return { level: 'slow', dot: 'bg-amber-500', label: '停滯', detail: `${mag} 幾乎沒動${toGoal}`, rank: 1, pill: 'bg-amber-100 text-amber-700' }
  }
  if (isBulk) {
    if (perWeek >= FLAT_KG_PER_WEEK) return { level: 'on_track', dot: 'bg-emerald-500', label: '增重中', detail: `${mag}（+${perWeek.toFixed(1)}kg/週）${toGoal}`, rank: 3, pill: 'bg-emerald-100 text-emerald-700' }
    if (perWeek <= -FLAT_KG_PER_WEEK) return { level: 'reverse', dot: 'bg-rose-500', label: '不增反掉', detail: `${mag}${toGoal}`, rank: 0, pill: 'bg-rose-100 text-rose-700' }
    return { level: 'slow', dot: 'bg-amber-500', label: '沒長', detail: `${mag} 幾乎沒動${toGoal}`, rank: 1, pill: 'bg-amber-100 text-amber-700' }
  }
  // 維持 / 健康
  if (Math.abs(perWeek) < FLAT_KG_PER_WEEK) return { level: 'on_track', dot: 'bg-emerald-500', label: '維持穩定', detail: `${mag}${toGoal}`, rank: 3, pill: 'bg-emerald-100 text-emerald-700' }
  return { level: 'slow', dot: 'bg-amber-500', label: '體重漂移', detail: `${mag}${toGoal}`, rank: 1, pill: 'bg-amber-100 text-amber-700' }
}

// ── 連續記錄天數：和學員端同定義（任一紀錄都算），結算到今天或昨天 ──
function computeStreak(activeDates: Set<string>): number {
  if (activeDates.size === 0) return 0
  const sorted = [...activeDates].sort().reverse()
  const now = new Date()
  const todayStr = getLocalDateStr(now)
  const startOffset = sorted[0] === todayStr ? 0 : 1
  let streak = 0
  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(now)
    expected.setDate(expected.getDate() - (i + startOffset))
    if (sorted[i] === getLocalDateStr(expected)) streak++
    else break
  }
  return streak
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: 'red' | 'orange' | 'rose' | 'green' }) {
  const color = tone === 'red' ? 'text-rose-600' : tone === 'orange' ? 'text-amber-600' : tone === 'rose' ? 'text-rose-600' : tone === 'green' ? 'text-emerald-600' : 'text-gray-900'
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const { showToast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingDraftCount, setPendingDraftCount] = useState(0)
  // 引擎的 macro 提案（coached tier 走「提案 → 教練核准」）。
  // ⚠️ 2026-08-16：這個機制一直在跑，但**後台從來沒有地方顯示** —— 6 筆從 6-7 月
  //    躺到過期沒人處理，Howard 以為「系統沒在自動調整」，其實是提案掉進黑洞。
  const [proposals, setProposals] = useState<ProposalItem[]>([])
  const [actingProposal, setActingProposal] = useState<string | null>(null)
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
  const [lastActivityMap, setLastActivityMap] = useState<Record<string, string>>({})
  const [pushClientIds, setPushClientIds] = useState<Set<string>>(new Set())
  // 從 URL 讀取初始篩選狀態
  const [search, setSearch] = useState(() => { if (typeof window === 'undefined') return ''; return new URLSearchParams(window.location.search).get('q') || '' })
  const [sortKey, setSortKey] = useState<SortKey>(() => { if (typeof window === 'undefined') return 'lastActivity'; return (new URLSearchParams(window.location.search).get('sort') as SortKey) || 'lastActivity' })
  const [sortDir, setSortDir] = useState<SortDir>(() => { if (typeof window === 'undefined') return 'desc'; return (new URLSearchParams(window.location.search).get('dir') as SortDir) || 'desc' })
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => { if (typeof window === 'undefined') return 'all'; return (new URLSearchParams(window.location.search).get('status') as StatusFilter) || 'all' })

  // 分頁
  const PAGE_SIZE = 20
  const [currentPage, setCurrentPage] = useState(1)

  // 通知系統
  const [notifications, setNotifications] = useState<CoachNotification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [runningCron, setRunningCron] = useState(false)

  // 快速回饋 modal
  const [feedbackClient, setFeedbackClient] = useState<Client | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const [feedbackOriginal, setFeedbackOriginal] = useState('')
  // 流失出手：關心草稿 modal
  const [winbackItem, setWinbackItem] = useState<QueueItem | null>(null)
  const [winbackMsg, setWinbackMsg] = useState('')
  const [winbackSending, setWinbackSending] = useState(false)
  const [winbackCopied, setWinbackCopied] = useState(false)
  const [winbackError, setWinbackError] = useState<string | null>(null)
  const feedbackRef = useRef<HTMLTextAreaElement>(null)

  // 錯誤處理 & 最後更新時間
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Poll pending AI draft count
  useEffect(() => {
    let cancelled = false
    async function fetchPending() {
      try {
        const res = await fetch('/api/admin/ai-audit/pending')
        const json = await res.json()
        if (!cancelled && json?.success) setPendingDraftCount(json.data.count ?? 0)
      } catch { /* ignore */ }
    }
    fetchPending()
    const t = setInterval(fetchPending, 30_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  // 引擎的 macro 提案
  const loadProposals = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/proposals?status=pending')
      const json = await res.json()
      if (json?.success) setProposals((json.data ?? []) as ProposalItem[])
    } catch { /* ignore */ }
  }, [])
  useEffect(() => { loadProposals() }, [loadProposals])

  const actOnProposal = useCallback(async (id: string, action: 'approve' | 'reject') => {
    setActingProposal(id)
    try {
      const res = await fetch('/api/admin/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: id, action }),
      })
      if (!res.ok) throw new Error()
      await loadProposals()
      await fetchData()
    } catch {
      alert('操作失敗，請重試')
    } finally {
      setActingProposal(null)
    }
  }, [loadProposals])

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
      setTodayWellnessIds(new Set((data.todayWellness || []).map((r: { client_id: string }) => r.client_id)))
      setTodayLogIds(new Set((data.todayLogs || []).map((r: { client_id: string }) => r.client_id)))
      const tMap: Record<string, string> = {}
      for (const r of (data.todayTraining || []) as TrainingLogRecord[]) tMap[r.client_id] = r.training_type
      setTodayTrainingMap(tMap)
      const nMap: Record<string, boolean> = {}
      for (const r of (data.todayNutrition || []) as { client_id: string; compliant: boolean }[]) nMap[r.client_id] = r.compliant
      setTodayNutritionMap(nMap)
      setTodayBodyIds(new Set((data.todayBody || []).map((r: { client_id: string }) => r.client_id)))
      setRecentBody(data.recentBody || [])
      setRecentNutrition(data.recentNutrition || [])
      setRecentWellness(data.recentWellness || [])
      setRecentRPE(data.recentTrainingRPE || [])
      // 從所有活動類型計算最後活動日期
      const actMap: Record<string, string> = {}
      const updateAct = (cid: string, date: string) => { if (!actMap[cid] || date > actMap[cid]) actMap[cid] = date }
      for (const r of (data.activityBody || []) as { client_id: string; date: string }[]) updateAct(r.client_id, r.date)
      for (const r of (data.activityNutrition || []) as { client_id: string; date: string }[]) updateAct(r.client_id, r.date)
      for (const r of (data.activityWellness || []) as { client_id: string; date: string }[]) updateAct(r.client_id, r.date)
      for (const r of (data.activityTraining || []) as { client_id: string; date: string }[]) updateAct(r.client_id, r.date)
      for (const r of (data.supplementLogs || []) as { client_id: string; date: string }[]) updateAct(r.client_id, r.date)
      setLastActivityMap(actMap)
      setPushClientIds(new Set((data.pushClientIds || []) as string[]))
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      setError('資料載入失敗，請檢查網路後重試')
      console.error('[Dashboard] fetchData error:', err)
    } finally { setLoading(false) }
  }

  const clientStats = useMemo(() => {
    // 預先建立索引，避免 O(n²) 的 filter
    const logsByClient: Record<string, SupplementLog[]> = {}
    for (const log of allLogs) {
      if (!logsByClient[log.client_id]) logsByClient[log.client_id] = []
      logsByClient[log.client_id].push(log)
    }
    const supCountByClient: Record<string, number> = {}
    const supIdsByClient: Record<string, Set<string>> = {}
    for (const s of allSupplements) {
      supCountByClient[s.client_id] = (supCountByClient[s.client_id] || 0) + 1
      if (!supIdsByClient[s.client_id]) supIdsByClient[s.client_id] = new Set()
      supIdsByClient[s.client_id].add(s.id)
    }

    const stats: Record<string, { weekRate: number; lastActivity: string | null; supplementCount: number }> = {}
    for (const client of clients) {
      const clientLogs = logsByClient[client.id] || []
      const supplementCount = supCountByClient[client.id] || 0
      let weekRate = 0
      if (supplementCount > 0) {
        // 只算「目前清單上」補品的打卡（已刪補品的殘留 log 會把分子灌爆），
        // 同一補品同一天去重，最後夾在 0–100（曾出現 114% 的來源就是這裡）
        const curIds = supIdsByClient[client.id] || new Set()
        const done = new Set<string>()
        for (const l of clientLogs) {
          if (l.completed && curIds.has(l.supplement_id)) done.add(`${l.supplement_id}|${l.date}`)
        }
        weekRate = Math.min(100, Math.round((done.size / (supplementCount * 7)) * 100))
      }
      const lastActivity = lastActivityMap[client.id] || null
      stats[client.id] = { weekRate, lastActivity, supplementCount }
    }
    return stats
  }, [clients, allLogs, allSupplements, lastActivityMap])

  const summaryStats = useMemo(() => {
    // 停用帳號一律不進統計——「學員 27 / 免費 17」那種數字是假的規模，會讓人誤判要顧幾個人
    const live = clients.filter(c => c.is_active)
    const totalClients = live.length
    const todayActive = live.filter(c => todayLogIds.has(c.id) || todayWellnessIds.has(c.id) || !!todayTrainingMap[c.id] || todayNutritionMap[c.id] !== undefined || todayBodyIds.has(c.id)).length
    const needAttention = live.filter(c => c.status !== 'normal').length
    const rates = Object.values(clientStats).filter(s => s.supplementCount > 0).map(s => s.weekRate)
    const avgCompliance = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0
    const competitionCount = live.filter(c => isCompetitionMode(c.client_mode)).length
    const coachedCount = live.filter(c => c.subscription_tier === 'coached').length
    const selfManagedCount = live.filter(c => c.subscription_tier === 'self_managed').length
    const freeCount = live.filter(c => c.subscription_tier === 'free').length
    const expiringCount = live.filter(c => { if (!c.expires_at) return false; const d = Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / DAY_MS); return d <= 7 && d >= 0 }).length
    const expiredCount = live.filter(c => { if (!c.expires_at) return false; return new Date(c.expires_at).getTime() < Date.now() }).length
    return { totalClients, todayActive, needAttention, avgCompliance, competitionCount, coachedCount, selfManagedCount, freeCount, expiringCount, expiredCount }
  }, [clients, clientStats, todayLogIds, todayWellnessIds, todayTrainingMap, todayNutritionMap, todayBodyIds])

  // === 備賽倒數（距比賽最近的排最前） ===
  const competitionClients = useMemo(() => {
    return clients
      .filter(c => c.is_active && isCompetitionMode(c.client_mode) && c.competition_date)
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
        if (stat.lastActivity) daysSince = Math.floor((today.getTime() - new Date(stat.lastActivity).getTime()) / DAY_MS)
        if (daysSince >= 5 && stat.supplementCount > 0) struggling.push({ id: client.id, name: client.name, reason: daysSince === Infinity ? '從未打卡' : `${daysSince} 天未活動` })
        else if (stat.weekRate < 50 && stat.supplementCount > 0) struggling.push({ id: client.id, name: client.name, reason: `服從率 ${stat.weekRate}%` })
      }
    }
    return { stars: stars.slice(0, 3), struggling: struggling.slice(0, 5) }
  }, [clients, clientStats, todayLogIds, todayWellnessIds, todayTrainingMap, todayNutritionMap, todayBodyIds])

  // === 戰情室：近 7 天有在動的學員，每人一句「到底有沒有效果」===
  const progressBoard = useMemo(() => {
    const now = Date.now()
    const byClient: Record<string, { date: string; weight: number }[]> = {}
    for (const b of recentBody) (byClient[b.client_id] ||= []).push({ date: b.date, weight: b.weight })
    // 每位學員的活動日期集合（任一紀錄都算）→ 算連續天數
    const datesByClient: Record<string, Set<string>> = {}
    const addDate = (cid: string, d: string) => { (datesByClient[cid] ||= new Set()).add(d) }
    for (const b of recentBody) addDate(b.client_id, b.date)
    for (const n of recentNutrition) if (n.compliant != null) addDate(n.client_id, n.date)
    for (const w of recentWellness) addDate(w.client_id, w.date)
    for (const r of recentRPE) addDate(r.client_id, r.date)
    return clients
      .filter(c => c.is_active)
      .map(c => {
        const last = lastActivityMap[c.id]
        const daysIdle = last ? Math.floor((now - new Date(last).getTime()) / DAY_MS) : Infinity
        return { c, daysIdle }
      })
      // 收到 30 天（原本只收 7 天 → 掉線的人整個不在畫面上，見 offlineVerdict 的說明）
      .filter(r => r.daysIdle <= 30)
      .map(r => {
        const base = computeProgress(r.c.goal_type, r.c.prep_phase, r.c.target_weight, byClient[r.c.id] || [])
        return {
          ...r,
          verdict: r.daysIdle >= OFFLINE_MIN_DAYS ? offlineVerdict(r.daysIdle, base) : base,
          streak: computeStreak(datesByClient[r.c.id] || new Set()),
        }
      })
      .sort((a, b) => a.verdict.rank - b.verdict.rank || b.daysIdle - a.daysIdle || a.c.name.localeCompare(b.c.name))
  }, [clients, recentBody, recentNutrition, recentWellness, recentRPE, lastActivityMap])

  /**
   * 今日主線 —— 一句話講完「今天這攤長怎樣」。
   *
   * ⚠️ 2026-08-23 Howard：「可以更直覺讓我知道學員狀況嗎」。
   * 問題不是資訊不夠，是要知道狀況得先展開收合的佇列、再掃九個數字，
   * 而那九個數字裡「今日活躍 / 需關注 / 流失風險」是同一件事的三種定義，
   * 加起來對不上，人腦要現場換算。
   *
   * 這裡只做一件事：把戰情室已經算好的判定 groupBy 成一句人話。
   * **不新增任何資料來源**，所以它跟下面的卡片永遠講同一套話。
   */
  const todayLine = useMemo(() => {
    const offline = progressBoard.filter(r => r.verdict.level === 'offline')
    const reverse = progressBoard.filter(r => r.verdict.level === 'reverse')
    const slow = progressBoard.filter(r => r.verdict.level === 'slow')
    const onTrack = progressBoard.filter(r => r.verdict.level === 'on_track')
    const thin = progressBoard.filter(r => r.verdict.level === 'insufficient')
    // 需要出手 = 掉線 + 反向。停滯先觀察，不催教練動手。
    const needAction = [...offline, ...reverse]
    const parts: string[] = []
    if (offline.length) parts.push(`掉線 ${offline.length}`)
    if (reverse.length) parts.push(`反向 ${reverse.length}`)
    if (slow.length) parts.push(`停滯 ${slow.length}`)
    if (onTrack.length) parts.push(`上軌道 ${onTrack.length}`)
    if (thin.length) parts.push(`資料不足 ${thin.length}`)
    const headline = needAction.length === 0
      ? (progressBoard.length === 0 ? '目前沒有在追蹤的學員' : `沒人卡住，${progressBoard.length} 個人都在跑`)
      : `${needAction.length} 個人需要你出手`
    return { headline, breakdown: parts.join('　·　'), needAction, allGood: needAction.length === 0 }
  }, [progressBoard])

  const alerts = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const items: { clientId: string; name: string; uniqueCode: string; text: string; color: string; priority: number }[] = []
    for (const client of clients) {
      const stat = clientStats[client.id]
      // 深度流失過濾：已停用、或 >30 天沒動（從未記錄者用加入天數）→ 叫不回來的鬼魂不進行動佇列，歸留存數字
      let idleDays = Infinity
      if (stat?.lastActivity) idleDays = Math.floor((today.getTime() - new Date(stat.lastActivity).getTime()) / DAY_MS)
      else if (client.created_at) idleDays = Math.floor((today.getTime() - new Date(client.created_at).getTime()) / DAY_MS)
      if (!client.is_active || idleDays > 30) continue
      if (stat) {
        let daysSince = Infinity
        if (stat.lastActivity) daysSince = Math.floor((today.getTime() - new Date(stat.lastActivity).getTime()) / DAY_MS)
        if (daysSince >= 5 && stat.supplementCount > 0) items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: daysSince === Infinity ? '從未打卡' : `${daysSince}天未活動`, color: 'text-rose-600 bg-rose-50', priority: 0 })
        if (stat.weekRate < 50 && stat.supplementCount > 0) items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: `本週服從率 ${stat.weekRate}%`, color: 'text-amber-700 bg-amber-50', priority: 2 })
      }
      if (client.next_checkup_date) {
        const checkup = new Date(client.next_checkup_date); checkup.setHours(0, 0, 0, 0)
        const diff = Math.floor((checkup.getTime() - today.getTime()) / DAY_MS)
        if (diff < 0) items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: `回檢已逾期 ${Math.abs(diff)}天`, color: 'text-rose-600 bg-rose-50', priority: 0 })
        else if (diff <= 7) items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: `回檢日 ${client.next_checkup_date}`, color: 'text-amber-600 bg-amber-50', priority: 1 })
      }

      // ── 體重停滯偵測（近 14 天，啟用體組成的學員）──
      if (client.body_composition_enabled) {
        const bodyLogs = recentBody.filter(b => b.client_id === client.id)
        if (bodyLogs.length >= 4) {
          const weights = bodyLogs.map(b => b.weight)
          const maxW = Math.max(...weights); const minW = Math.min(...weights)
          if (maxW - minW < 0.5) {
            items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: '體重近 14 天停滯（< 0.5kg 波動）', color: 'text-amber-700 bg-amber-50', priority: 2 })
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
            items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: `飲食合規率僅 ${rate}%（近 14 天）`, color: 'text-rose-600 bg-rose-50', priority: 1 })
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
          items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: '連續 3 天能量指數 ≤ 2，需關注', color: 'text-amber-600 bg-amber-50', priority: 1 })
        }
      }

      // ── 訓練 RPE 連續 3 天 > 8.5（啟用訓練的學員）──
      if (client.training_enabled) {
        const rpeLogs = recentRPE
          .filter(r => r.client_id === client.id)
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 3)
        if (rpeLogs.length >= 3 && rpeLogs.every(r => r.rpe > 8.5)) {
          items.push({ clientId: client.id, name: client.name, uniqueCode: client.unique_code, text: `訓練 RPE 連續偏高（${rpeLogs.map(r => r.rpe).join('/')}），建議 Deload`, color: 'text-amber-600 bg-amber-50', priority: 1 })
        }
      }
    }
    return items.sort((a, b) => a.priority - b.priority)
  }, [clients, clientStats, recentBody, recentNutrition, recentWellness, recentRPE])

  // === A1：今日行動佇列（待審草稿 + alerts + 訂閱到期，排序成一條待辦）===
  type QueueItem = {
    key: string
    clientId: string | null
    name: string
    text: string
    tone: 'red' | 'orange' | 'yellow' | 'blue'
    priority: number
    href?: string
    canNote: boolean
    winback?: WinbackContext
    proposalId?: string
    proposalReason?: string | null
  }
  const actionQueue = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = []
    // 關心草稿要用的體重脈絡：斷聯前最後一次體重 + 週速率（近 14 天資料，和戰情室同源）
    const weightCtx = (cid: string): { lastWeight: number | null; trendPerWeek: number | null } => {
      const ws = recentBody
        .filter(b => b.client_id === cid && b.weight != null)
        .map(b => ({ d: b.date, v: b.weight }))
        .sort((a, b) => a.d.localeCompare(b.d))
      if (ws.length === 0) return { lastWeight: null, trendPerWeek: null }
      const lastWeight = ws[ws.length - 1].v
      if (ws.length < 3) return { lastWeight, trendPerWeek: null }
      const spanDays = Math.max(1, Math.round((new Date(ws[ws.length - 1].d).getTime() - new Date(ws[0].d).getTime()) / DAY_MS))
      return { lastWeight, trendPerWeek: ((ws[ws.length - 1].v - ws[0].v) / spanDays) * 7 }
    }
    // 引擎的 macro 提案 —— 排最前面：這是唯一「點一下就完成」的待辦，
    // 而且拖著不處理等於自動化沒發生（提案有 expires_at，過期就作廢）。
    for (const p of proposals) {
      const cal = p.proposed_changes?.calories_target
      const oldCal = p.current_state?.calories_target
      const delta = cal != null && oldCal != null ? cal - oldCal : null
      const txt = cal != null
        ? `引擎建議熱量 ${oldCal ?? '?'} → ${cal}${delta != null ? `（${delta > 0 ? '+' : ''}${delta}）` : ''}`
        : '引擎有調整建議'
      items.push({
        key: `proposal-${p.id}`,
        clientId: p.client_id,
        name: p.clients?.name ?? '學員',
        text: txt,
        tone: 'blue',
        priority: 0,
        canNote: false,
        proposalId: p.id,
        proposalReason: p.reasoning,
      })
    }

    // 待審 AI 血檢草稿
    if (pendingDraftCount > 0) {
      items.push({ key: 'drafts', clientId: null, name: 'AI 血檢草稿', text: `${pendingDraftCount} 份待審`, tone: 'blue', priority: 1, href: '/admin/ai-audit', canNote: false })
    }
    // 既有 alerts → 行動項（依文字選 icon）
    for (const a of alerts) {
      const tone: QueueItem['tone'] = a.priority === 0 ? 'red' : a.priority === 1 ? 'orange' : 'yellow'
      // 未活動類 alert → 附上關心草稿脈絡（一般 idle 情境）
      let winback: WinbackContext | undefined
      if (a.text.includes('未活動')) {
        const la = lastActivityMap[a.clientId]
        if (la) {
          const daysSilent = Math.floor((Date.now() - new Date(la).getTime()) / DAY_MS)
          winback = { name: a.name, situation: 'idle', daysSilent, ...weightCtx(a.clientId) }
        }
      }
      items.push({ key: `alert-${a.clientId}-${a.text}`, clientId: a.clientId, name: a.name, text: a.text, tone, priority: a.priority, href: `/admin/clients/${a.clientId}/overview`, canNote: true, winback })
    }
    // 訂閱到期 / 已過期（深度流失者不列：歸留存數字，不佔今日待辦）
    for (const c of clients) {
      if (!c.expires_at) continue
      const la = lastActivityMap[c.id]
      const idle = la ? Math.floor((Date.now() - new Date(la).getTime()) / DAY_MS) : Math.floor((Date.now() - new Date(c.created_at).getTime()) / DAY_MS)
      if (!c.is_active || idle > 30) continue
      const d = Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / DAY_MS)
      if (d < 0) items.push({ key: `exp-${c.id}`, clientId: c.id, name: c.name, text: `方案已過期 ${-d} 天`, tone: 'red', priority: 0, href: `/admin/clients/${c.id}`, canNote: true })
      else if (d <= 7) items.push({ key: `exp-${c.id}`, clientId: c.id, name: c.name, text: `方案 ${d} 天後到期`, tone: 'orange', priority: 1, href: `/admin/clients/${c.id}`, canNote: true })
    }
    // 新加入但從未打卡（加入 3–30 天、有開通追蹤、零活動）→ 啟動沒接住，最該主動關懷
    for (const c of clients) {
      if (!c.is_active) continue
      if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) continue
      const tracks = c.body_composition_enabled || c.nutrition_enabled || c.wellness_enabled || c.training_enabled
      if (!tracks) continue
      if (lastActivityMap[c.id]) continue // 曾經有活動 → 不算「未啟動」
      const daysSinceJoin = Math.floor((Date.now() - new Date(c.created_at).getTime()) / DAY_MS)
      if (daysSinceJoin >= 3 && daysSinceJoin <= 30) {
        items.push({ key: `noact-${c.id}`, clientId: c.id, name: c.name, text: `加入 ${daysSinceJoin} 天從未打卡 — 該主動關懷`, tone: 'orange', priority: 1, href: `/admin/clients/${c.id}/overview`, canNote: true, winback: { name: c.name, situation: 'never_started', daysSilent: daysSinceJoin } })
      }
    }
    // 減脂中斷聯絡：正在減脂（diet_start_date 已設）但近期沒記錄 → 最高價值的流失訊號
    const cutSilentIds = new Set<string>()
    for (const c of clients) {
      if (!c.is_active) continue
      if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) continue
      const gt = (c.goal_type || '').toLowerCase()
      const isFatLoss = gt.includes('loss') || gt === 'cut' || gt.includes('fat') || (c.goal_type || '').includes('減')
      if (!isFatLoss || !c.diet_start_date) continue
      const la = lastActivityMap[c.id]
      if (!la) continue // 從未記錄者由上面「未啟動」區塊處理
      const daysSince = Math.floor((Date.now() - new Date(la).getTime()) / DAY_MS)
      if (daysSince < 4 || daysSince > 30) continue // 4–30 天=還救得回；>30 天已流失（歸入留存數字，不佔行動佇列）
      const weeks = Math.max(1, Math.floor((Date.now() - new Date(c.diet_start_date).getTime()) / (7 * DAY_MS)))
      cutSilentIds.add(c.id)
      items.push({ key: `cutsilent-${c.id}`, clientId: c.id, name: c.name, text: `減脂第 ${weeks} 週但 ${daysSince} 天沒記錄 — 可能脫離`, tone: daysSince >= 7 ? 'red' : 'orange', priority: daysSince >= 7 ? 0 : 1, href: `/admin/clients/${c.id}/overview`, canNote: true, winback: { name: c.name, situation: 'cut_silent', daysSilent: daysSince, weeksIntoCut: weeks, ...weightCtx(c.id) } })
    }
    // 去重：被「減脂中斷」涵蓋的人，移除泛用的「未活動」alert（同人不重複兩列）
    const deduped = items.filter(it => !(cutSilentIds.has(it.clientId || '') && it.key.startsWith('alert-') && it.text.includes('未活動')))
    // 排序：先緊急度，再依人名聚在一起（同一個人的待辦不會散落各處），最後依文字
    return deduped.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name) || a.text.localeCompare(b.text))
  }, [alerts, pendingDraftCount, clients, lastActivityMap, recentBody, proposals])

  // === A2：自教練上次查看後的新紀錄筆數（用已載入的近期 logs；未曾查看者不標）===
  const newSinceViewMap = useMemo<Record<string, number>>(() => {
    const viewed: Record<string, string> = {}
    for (const c of clients) viewed[c.id] = c.coach_last_viewed_at ? c.coach_last_viewed_at.slice(0, 10) : ''
    const map: Record<string, number> = {}
    const bump = (cid: string, date: string) => {
      const v = viewed[cid]
      if (!v || !date) return        // 從未查看過 → 不標，避免全部亮燈
      if (date > v) map[cid] = (map[cid] ?? 0) + 1
    }
    for (const b of recentBody) bump(b.client_id, b.date)
    for (const n of recentNutrition) bump(n.client_id, n.date)
    for (const w of recentWellness) bump(w.client_id, w.date)
    for (const r of recentRPE) bump(r.client_id, r.date)
    for (const l of allLogs) if (l.completed) bump(l.client_id, l.date)
    return map
  }, [clients, recentBody, recentNutrition, recentWellness, recentRPE, allLogs])

  // === C：商業 / 留存數字（付費數、本月新增、流失風險）===
  const retentionStats = useMemo(() => {
    const now = Date.now()
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const paying = clients.filter(c => c.is_active && (c.subscription_tier === 'coached' || c.subscription_tier === 'self_managed')).length
    const newThisMonth = clients.filter(c => c.is_active && new Date(c.created_at).getTime() >= monthStart.getTime()).length
    const churnRisk = clients
      .filter(c => {
        if (!c.is_active) return false
        if (c.expires_at && new Date(c.expires_at).getTime() < now) return false  // 已過期另計
        const la = clientStats[c.id]?.lastActivity
        if (!la) return false
        return Math.floor((now - new Date(la).getTime()) / DAY_MS) >= 10
      })
      .map(c => ({ id: c.id, name: c.name, days: Math.floor((now - new Date(clientStats[c.id]!.lastActivity!).getTime()) / DAY_MS), paying: c.subscription_tier !== 'free' }))
      .sort((a, b) => b.days - a.days)
    const activeCount = clients.filter(c => c.is_active).length
    const pushOn = clients.filter(c => c.is_active && pushClientIds.has(c.id)).length
    return { paying, newThisMonth, churnRisk, activeCount, pushOn }
  }, [clients, clientStats, pushClientIds])

  // === D：本週摘要（規則式彙整，可複製；LINE 配額爆掉期間走 copy）===
  const weeklyDigest = useMemo(() => {
    const d = new Date()
    const lines: string[] = []
    lines.push(`【本週教練摘要 ${d.getMonth() + 1}/${d.getDate()}】`)
    lines.push(`學員 ${summaryStats.totalClients} 人（付費 ${retentionStats.paying}）· 今日活躍 ${summaryStats.todayActive} · 平均服從率 ${summaryStats.avgCompliance}%`)
    if (pendingDraftCount > 0) lines.push(`🤖 ${pendingDraftCount} 份血檢草稿待審`)
    if (alerts.length > 0) {
      lines.push(`⚠️ 需關注 ${alerts.length} 項：`)
      for (const a of alerts.slice(0, 8)) lines.push(`  · ${a.name} — ${a.text}`)
      if (alerts.length > 8) lines.push(`  · …其餘 ${alerts.length - 8} 項`)
    }
    if (spotlightClients.stars.length > 0) lines.push(`🌟 表現好：${spotlightClients.stars.map(s => s.name).join('、')}`)
    if (retentionStats.churnRisk.length > 0) lines.push(`📉 流失風險 ${retentionStats.churnRisk.length} 人：${retentionStats.churnRisk.slice(0, 6).map(c => `${c.name}(${c.days}天)`).join('、')}`)
    if (competitionClients.length > 0) lines.push(`🏆 備賽：${competitionClients.slice(0, 5).map(c => `${c.name} 剩${c.daysLeft}天`).join('、')}`)
    const expiry = summaryStats.expiringCount + summaryStats.expiredCount
    if (expiry > 0) lines.push(`⏰ 到期/逾期 ${expiry} 人`)
    lines.push(`（血檢進步/警示明細見「🩸 血檢總覽」）`)
    return lines.join('\n')
  }, [summaryStats, retentionStats, pendingDraftCount, alerts, spotlightClients, competitionClients])

  const handleSort = (key: SortKey) => { if (sortKey === key) setSortDir(p => p === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc') } }

  const filteredClients = useMemo(() => {
    // 預設不列停用帳號（要看時用 status=inactive 篩選）——列表塞滿一年沒動的人，真正要顧的那幾個就被埋掉了
    let list = statusFilter === 'inactive' ? clients.filter(c => !c.is_active) : clients.filter(c => c.is_active)
    if (search.trim()) { const q = search.trim().toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(q)) }
    if (statusFilter === 'normal') list = list.filter(c => c.status === 'normal')
    else if (statusFilter === 'attention') list = list.filter(c => c.status !== 'normal')
    else if (statusFilter === 'competition') list = list.filter(c => isCompetitionMode(c.client_mode))
    else if (statusFilter === 'coached') list = list.filter(c => c.subscription_tier === 'coached')
    else if (statusFilter === 'self_managed') list = list.filter(c => c.subscription_tier === 'self_managed')
    else if (statusFilter === 'free') list = list.filter(c => c.subscription_tier === 'free')

    list.sort((a, b) => {
      // 備賽選手永遠排最前（按比賽日期近的排前面）
      const aComp = isCompetitionMode(a.client_mode) && a.competition_date ? new Date(a.competition_date).getTime() : Infinity
      const bComp = isCompetitionMode(b.client_mode) && b.competition_date ? new Date(b.competition_date).getTime() : Infinity
      const aIsComp = isCompetitionMode(a.client_mode) ? 0 : 1
      const bIsComp = isCompetitionMode(b.client_mode) ? 0 : 1
      if (aIsComp !== bIsComp) return aIsComp - bIsComp
      if (isCompetitionMode(a.client_mode) && isCompetitionMode(b.client_mode) && aComp !== bComp) return aComp - bComp

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

  // 搜尋/篩選/排序變更時重設分頁 + 同步 URL
  useEffect(() => {
    setCurrentPage(1)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (sortKey !== 'lastActivity') params.set('sort', sortKey)
    if (sortDir !== 'desc') params.set('dir', sortDir)
    const qs = params.toString()
    window.history.replaceState({}, '', qs ? `?${qs}` : window.location.pathname)
  }, [search, statusFilter, sortKey, sortDir])

  const paginatedClients = filteredClients.slice(0, currentPage * PAGE_SIZE)

  const copyClientUrl = (code: string) => { navigator.clipboard.writeText(`${window.location.origin}/c/${code}`).then(() => showToast('已複製學員網址', 'success')) }
  const handleLogout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); router.push('/admin/login') }
  const SortIcon = ({ column }: { column: SortKey }) => sortKey !== column ? <ChevronUp size={14} className="text-gray-300 ml-1 inline" /> : sortDir === 'asc' ? <ChevronUp size={14} className="text-primary-600 ml-1 inline" /> : <ChevronDown size={14} className="text-primary-600 ml-1 inline" />
  const getActivityLabel = (id: string) => { const s = clientStats[id]; if (!s?.lastActivity) return { text: '無記錄', color: 'text-gray-400' }; const d = Math.floor((Date.now() - new Date(s.lastActivity).getTime()) / DAY_MS); if (d >= 5) return { text: `${d}天未活動`, color: 'text-rose-600 font-medium' }; if (d >= 3) return { text: `${d}天前`, color: 'text-amber-600' }; if (d === 0) return { text: '今天', color: 'text-emerald-600' }; return { text: `${d}天前`, color: 'text-gray-600' } }
  const getCheckupLabel = (c: Client) => { if (!c.next_checkup_date) return { text: '未設定', color: 'text-gray-400' }; const t = new Date(); t.setHours(0,0,0,0); const ck = new Date(c.next_checkup_date); ck.setHours(0,0,0,0); const d = Math.floor((ck.getTime()-t.getTime())/DAY_MS); if (d<0) return { text: `逾期 ${Math.abs(d)}天`, color: 'text-rose-600 font-medium' }; if (d<=7) return { text: c.next_checkup_date, color: 'text-amber-600 font-medium' }; return { text: c.next_checkup_date, color: 'text-gray-600' } }
  const getTrainingLabel = (t: string) => ({ push:'推',pull:'拉',legs:'腿',full_body:'全身',cardio:'有氧',rest:'休',chest:'胸',shoulder:'肩',arms:'手' }[t] || '')
  const getComplianceColor = (r: number) => r >= 80 ? 'text-emerald-600' : r >= 50 ? 'text-amber-600' : 'text-rose-600'
  // 一眼判斷「誰要顧」：融合 血檢狀態 + 多久沒打卡 + 服從率 + 回檢逾期 → 取最該注意的 1-2 條。
  // 紅=要立刻處理、黃=該關注、綠=正常。學員列表左緣的色條 + 原因標籤就是這個。
  const getAttention = (c: Client) => {
    if (!c.is_active) return { level: 'off', reason: '', accent: '', chip: '' }
    const s = clientStats[c.id]
    const idle = s?.lastActivity ? Math.floor((Date.now() - new Date(s.lastActivity).getTime()) / DAY_MS) : null
    const reasons: { sev: number; text: string }[] = []
    if (idle == null) reasons.push({ sev: 2, text: '從未打卡' })
    else if (idle >= 7) reasons.push({ sev: 3, text: `${idle}天沒打卡` })
    else if (idle >= 5) reasons.push({ sev: 2, text: `${idle}天沒打卡` })
    if (c.status === 'alert') reasons.push({ sev: 3, text: '血檢警示' })
    else if (c.status === 'attention') reasons.push({ sev: 2, text: '血檢關注' })
    if (s && s.supplementCount > 0 && s.weekRate < 50) reasons.push({ sev: 2, text: `服從率 ${s.weekRate}%` })
    if (c.next_checkup_date) { const t = new Date(); t.setHours(0, 0, 0, 0); const ck = new Date(c.next_checkup_date); ck.setHours(0, 0, 0, 0); const d = Math.floor((ck.getTime() - t.getTime()) / DAY_MS); if (d < 0) reasons.push({ sev: 2, text: `回檢逾期${Math.abs(d)}天` }) }
    // ⚠️ 完全收不到通知 —— 系統對他等於不存在：每日提醒、教練訊息、週報全部送不到。
    // 這比「幾天沒打卡」更根本（他可能是想用但沒被叫醒），所以吃 sev 2 進學員問題那一格。
    if (!c.line_user_id && !pushClientIds.has(c.id)) reasons.push({ sev: 2, text: '收不到通知' })

    // 紀錄與體重對不上 —— 學員照著記，但身體顯示的不是那個數字。
    // 兩種可能都要留著：①紀錄漏了 ②熱量設定本身錯了（張承鈞就是後者）。見 lib/implied-intake。
    const recon = reconcileIntake(
      recentBody.filter(b => b.client_id === c.id).map(b => ({ date: b.date, weight: b.weight })),
      recentNutrition.filter(n => n.client_id === c.id).map(n => ({ date: n.date, calories: n.calories ?? null })),
      c.calories_target ?? 0,
      c.goal_type,
      14, // dashboard 只抓近 14 天
    )
    if (isGapSignificant(recon)) {
      reasons.push({ sev: 2, text: `紀錄差 ${recon!.gap > 0 ? '+' : ''}${recon!.gap}kcal` })
    }

    // 教練自己的待辦（不是學員的問題）—— 這兩件事以前要一個一個點進去才發現：
    // 2026-08-14 查下來 William/張承鈞/陳胤豪 都是 0 段計畫頁，學員打開系統看不到「我該幹嘛」。
    if (!(c.onboarding_notes_rendered?.sections?.length)) reasons.push({ sev: 1, text: '無計畫頁' })
    if (!c.health_screening?.screened_at) reasons.push({ sev: 1, text: '未健康篩檢' })
    if (reasons.length === 0) return { level: 'ok', reason: '', accent: '', chip: '' }
    reasons.sort((a, b) => b.sev - a.sev)
    // 學員問題（sev>=2）最多兩條，教練自己的設定待辦（sev 1）另外附一條 ——
    // 否則「無計畫頁」永遠被「N 天沒打卡」擠掉，等於沒做。
    const issues = reasons.filter(r => r.sev >= 2).slice(0, 2)
    const todos = reasons.filter(r => r.sev === 1).slice(0, 1)
    const reason = [...issues, ...todos].map(r => r.text).join(' · ')
    if (reasons[0].sev >= 3) return { level: 'alert', reason, accent: 'border-l-4 border-rose-400', chip: 'bg-rose-50 text-rose-700' }
    if (reasons[0].sev >= 2) return { level: 'watch', reason, accent: 'border-l-4 border-amber-400', chip: 'bg-amber-50 text-amber-700' }
    // sev 1 = 教練的設定待辦，不是學員出事 → 中性灰，不佔用紅黃（DESIGN.md：顏色只做語意）
    return { level: 'todo', reason, accent: 'border-l-4 border-slate-300', chip: 'bg-slate-100 text-slate-600' }
  }
  const getPrepPhaseLabel = (p: string | null) => PHASE_LABELS[p || ''] || p || ''
  const getLineStatus = (c: Client) => { if (!c.line_user_id) return { label: '', color: '' }; if (!c.last_line_activity) return { label: 'LINE 已綁定', color: 'text-gray-400' }; const mins = Math.floor((Date.now() - new Date(c.last_line_activity).getTime()) / 60000); if (mins < 5) return { label: '在線', color: 'text-emerald-500' }; if (mins < 60) return { label: `${mins}分鐘前`, color: 'text-emerald-400' }; const hrs = Math.floor(mins / 60); if (hrs < 24) return { label: `${hrs}小時前`, color: 'text-gray-400' }; return { label: `${Math.floor(hrs/24)}天前`, color: 'text-gray-400' } }
  const getTierBadge = (tier: string) => {
    if (tier === 'coached') return { label: '2999', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-500' }
    if (tier === 'self_managed') return { label: '499', color: 'bg-primary-100 text-primary-700', dot: 'bg-primary-500' }
    return { label: '免費', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' }
  }
  const getExpiryWarning = (c: Client) => {
    if (!c.expires_at) return null
    const days = Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / DAY_MS)
    if (days < 0) return { text: `已過期 ${Math.abs(days)} 天`, color: 'text-rose-600' }
    if (days <= 7) return { text: `${days} 天到期`, color: 'text-rose-500' }
    if (days <= 14) return { text: `${days} 天到期`, color: 'text-amber-500' }
    return null
  }

  // 快速回饋功能
  const openFeedback = (client: Client) => {
    const original = client.coach_weekly_note || ''
    setFeedbackClient(client)
    setFeedbackText(original)
    setFeedbackOriginal(original)
    setTimeout(() => feedbackRef.current?.focus(), 100)
  }

  const closeFeedback = () => {
    if (feedbackText !== feedbackOriginal) {
      if (!confirm('回饋內容尚未儲存，確定要關閉嗎？')) return
    }
    setFeedbackClient(null)
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
        showToast(`${feedbackClient.name} 的回饋已更新`, 'success')
        setFeedbackClient(null)
      } else {
        showToast('儲存失敗，請重試', 'error')
      }
    } catch { showToast('儲存失敗', 'error') } finally { setFeedbackSaving(false) }
  }

  // 流失出手：開草稿 → 教練過目可改 → 複製（個人 LINE 貼，免 OA 額度）或發送（走既有 send route）
  const openWinback = (item: QueueItem) => {
    if (!item.winback) return
    setWinbackMsg(buildWinbackMessage(item.winback))
    setWinbackCopied(false)
    setWinbackError(null)
    setWinbackItem(item)
  }

  const copyWinback = async () => {
    try {
      await navigator.clipboard.writeText(winbackMsg)
      setWinbackCopied(true)
      setTimeout(() => setWinbackCopied(false), 2000)
    } catch { showToast('複製失敗', 'error') }
  }

  const sendWinback = async () => {
    if (!winbackItem?.clientId || !winbackMsg.trim()) return
    setWinbackSending(true)
    setWinbackError(null)
    try {
      const res = await fetch('/api/admin/weekly-coaching/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: winbackItem.clientId, message: winbackMsg, mode: 'accountability' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const via = data.method === 'web_push' ? '已推播到學員裝置'
          : data.method === 'line_push' ? '已透過 LINE 送出'
          : '已存進學員儀表板（沒開推播，他下次打開會看到）'
        showToast(`${winbackItem.name}：${via}`, 'success')
        setWinbackItem(null)
      } else if (res.status === 422 && Array.isArray(data.compliance)) {
        setWinbackError(`合規守門擋下：${data.compliance.map((h: { term: string }) => h.term).join('、')} — 改寫後再送`)
      } else {
        setWinbackError(data.error || '發送失敗，請重試')
      }
    } catch { setWinbackError('發送失敗，請重試') } finally { setWinbackSending(false) }
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

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-slate-200"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center"><div className="h-5 w-32 bg-gray-200 rounded animate-pulse" /></div></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* KPI 骨架 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse">
              <div className="flex items-center justify-between mb-3"><div className="h-3 w-16 bg-gray-200 rounded" /><div className="h-5 w-5 bg-gray-200 rounded" /></div>
              <div className="h-8 w-20 bg-gray-200 rounded mb-2" />
              <div className="h-2 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
        {/* 學員列表骨架 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="space-y-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-4 w-12 bg-gray-100 rounded" />
                <div className="h-4 w-16 bg-gray-200 rounded" />
                <div className="flex-1" />
                <div className="h-4 w-10 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ⚠️ 2026-08-23：原本 header 是單行 flex + h-16 固定高，手機上七個導覽鍵擠不下，
          「教練儀表板」被折成兩行、按鈕變成直排單字。改成小螢幕直向堆疊、
          導覽列自己橫向捲動（各項 shrink-0 + whitespace-nowrap），大螢幕維持原本單行。 */}
      <div className="bg-white border-b border-slate-200"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:h-16 sm:py-0"><div className="shrink-0"><h1 className="text-xl font-bold text-gray-900 whitespace-nowrap">教練儀表板</h1><p className="text-sm text-gray-500 whitespace-nowrap">Howard 健康管理系統</p></div><div className="flex items-center gap-3 overflow-x-auto -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0 sm:overflow-visible [&>*]:shrink-0 [&_a]:whitespace-nowrap [&_button]:whitespace-nowrap">
                <button onClick={runWeeklyCron} disabled={runningCron} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm disabled:opacity-50" title="手動執行每週分析">
                  <RefreshCw size={15} className={runningCron ? 'animate-spin' : ''} /> {runningCron ? '分析中...' : '每週分析'}
                </button>
                <div className="relative">
                  <button onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markNotificationsRead() }} className="p-2 text-gray-500 hover:text-gray-700 relative">
                    <Bell size={18} />
                    {notifications.filter(n => !n.read).length > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">{notifications.filter(n => !n.read).length}</span>}
                  </button>
                  {showNotifications && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-96 overflow-y-auto">
                      <div className="p-3 border-b border-slate-200 flex items-center justify-between"><span className="text-sm font-semibold text-gray-900">通知</span><button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button></div>
                      {notifications.length === 0 ? <p className="p-4 text-sm text-gray-400 text-center">暫無通知</p> : notifications.map((n) => (
                        <div key={n.id} className={`p-3 border-b border-slate-100 ${n.read ? '' : 'bg-primary-50/50'}`}>
                          <div className="text-xs text-gray-400 mb-1">{n.date}</div>
                          <div className="text-sm font-medium text-gray-900 mb-1">{n.title}</div>
                          {n.content && (() => { try { const items = JSON.parse(n.content); return Array.isArray(items) ? <ul className="text-xs text-gray-600 space-y-0.5">{items.slice(0, 5).map((item: string, i: number) => <li key={i}>• {item}</li>)}{items.length > 5 && <li className="text-gray-400">...還有 {items.length - 5} 項</li>}</ul> : null } catch { return <p className="text-xs text-gray-600">{n.content}</p> } })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {lastUpdated && <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock size={10} />{lastUpdated.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} 更新</span>}
                <Link href="/admin/ai-audit" className="relative bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm transition-colors">
                  AI Audit
                  {pendingDraftCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[11px] font-bold rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center px-1">
                      {pendingDraftCount > 99 ? '99+' : pendingDraftCount}
                    </span>
                  )}
                </Link><Link href="/admin/coaching" className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm transition-colors">本週教練佇列</Link><Link href="/admin/labs" className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm transition-colors">血檢總覽</Link><Link href="/admin/agent-playground" className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm transition-colors">AI Agent</Link><Link href="/admin/blog" className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm transition-colors">文章管理</Link><Link href="/admin/clients/new" className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 transition-colors">新增學員</Link><button onClick={handleLogout} className="text-gray-500 hover:text-gray-700 text-sm">登出</button></div></div></div></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ===== 錯誤提示 ===== */}
        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-rose-700">{error}</span>
            <button onClick={() => { setError(null); setLoading(true); fetchData() }} className="text-sm font-medium text-rose-600 hover:text-rose-800 px-3 py-1 bg-rose-100 rounded-lg hover:bg-rose-200 transition-colors">重試</button>
          </div>
        )}

        {/* ===== 今日主線：打開後第一眼要答的問題是「今天誰需要我」 ===== */}
        {!loading && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
            <p className="text-[11px] text-slate-400 tabular-nums mb-1">
              {new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
            <p className={`text-xl font-bold ${todayLine.allGood ? 'text-gray-900' : 'text-rose-700'}`}>
              {todayLine.headline}
            </p>
            {todayLine.breakdown && (
              <p className="text-xs text-slate-500 mt-1 tabular-nums">{todayLine.breakdown}</p>
            )}

            {/* 需要出手的人直接列在這裡、不收合 —— 收起來就等於沒有 */}
            {todayLine.needAction.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {todayLine.needAction.map(({ c, verdict }) => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${verdict.dot}`} />
                    <Link href={`/admin/clients/${c.id}/overview`} className="text-sm font-semibold text-gray-900 shrink-0 hover:text-primary-700 transition-colors">
                      {c.name}
                    </Link>
                    <span className="text-xs text-slate-500 truncate">{verdict.label}</span>
                    <button
                      onClick={() => openFeedback(c)}
                      className="ml-auto shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      <MessageSquare size={12} /> 出手
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== 今日行動佇列（預設收合，只留還活著、真能動的）===== */}
        <details className="bg-white border border-slate-200 rounded-2xl mb-4">
          <summary className="cursor-pointer select-none px-5 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">今日行動佇列</h2>
            <span className="text-xs text-gray-400">
              {actionQueue.length === 0 ? '無待辦' : (() => { const urgent = actionQueue.filter(i => i.priority === 0).length; return `${actionQueue.length} 件${urgent > 0 ? ` · ${urgent} 緊急` : ''} · 展開 ▾` })()}
            </span>
          </summary>
          <div className="px-5 pb-5">
          {actionQueue.length === 0 ? (
            <p className="text-sm text-gray-400 py-1">今天沒有待辦，一切正常</p>
          ) : (
            <div className="space-y-2">
              {actionQueue.map(item => {
                const toneBox = { red: 'bg-rose-50', orange: 'bg-amber-50', yellow: 'bg-amber-50', blue: 'bg-primary-50' }[item.tone]
                const toneText = { red: 'text-rose-700', orange: 'text-amber-700', yellow: 'text-amber-800', blue: 'text-primary-700' }[item.tone]
                return (
                  <div key={item.key} className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl ${toneBox}`}>
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={`text-sm font-medium ${toneText} ${item.proposalId ? '' : 'truncate'}`}>
                        {item.name} — {item.text}
                        {/* 提案要看得到「為什麼」才敢按批准 */}
                        {item.proposalReason && (
                          <span className="block mt-1 text-[11px] font-normal text-slate-500 leading-snug line-clamp-3">
                            {item.proposalReason}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.proposalId && (
                        <>
                          <button
                            onClick={() => actOnProposal(item.proposalId!, 'approve')}
                            disabled={actingProposal === item.proposalId}
                            className="px-2.5 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {actingProposal === item.proposalId ? '…' : '套用'}
                          </button>
                          <button
                            onClick={() => actOnProposal(item.proposalId!, 'reject')}
                            disabled={actingProposal === item.proposalId}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            不要
                          </button>
                        </>
                      )}
                      {item.winback && item.clientId && (
                        <button onClick={() => openWinback(item)} className="p-1.5 text-primary-600 hover:bg-primary-100 rounded-lg transition-colors" title="產生關心草稿" aria-label={`產生給 ${item.name} 的關心草稿`}><Send size={15} /></button>
                      )}
                      {item.canNote && item.clientId && (
                        <button onClick={() => { const c = clients.find(x => x.id === item.clientId); if (c) openFeedback(c) }} className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors" title="寫筆記" aria-label={`寫筆記給 ${item.name}`}><MessageSquare size={15} /></button>
                      )}
                      {item.href && (<Link href={item.href} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-white rounded-lg transition-colors" title="前往" aria-label={`前往 ${item.name}`}><ExternalLink size={15} /></Link>)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </details>

        {/* ===== Compact 數字條（取代原本 8 張大卡）===== */}
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 mb-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <MiniStat label="學員" value={summaryStats.totalClients} />
            <MiniStat label="付費" value={retentionStats.paying} />
            <MiniStat label="今日活躍" value={summaryStats.todayActive} />
            <MiniStat label="需關注" value={summaryStats.needAttention} tone={summaryStats.needAttention > 0 ? 'red' : undefined} />
            <MiniStat label="服從率" value={`${summaryStats.avgCompliance}%`} />
            <MiniStat label="本月新增" value={`+${retentionStats.newThisMonth}`} tone="green" />
            <MiniStat label="流失風險" value={retentionStats.churnRisk.length} tone={retentionStats.churnRisk.length > 0 ? 'orange' : undefined} />
            <MiniStat label="推播開通" value={`${retentionStats.pushOn}/${retentionStats.activeCount}`} tone={retentionStats.pushOn === 0 ? 'orange' : 'green'} />
            <MiniStat label="到期/逾期" value={summaryStats.expiringCount + summaryStats.expiredCount} tone={(summaryStats.expiringCount + summaryStats.expiredCount) > 0 ? 'rose' : undefined} />
          </div>
        </div>

        {/* ===== 功能公告廣播（推播給學員）===== */}
        <FeatureAnnounce />

        {/* ===== 戰情室：近 7 天有在動的學員，一眼看誰有效果 ===== */}
        {progressBoard.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-gray-900">戰情室</span>
                <span className="text-xs text-gray-400">掉線的排最前面 · 30 天以上不列</span>
              </div>
              <span className="text-xs text-gray-400 tabular-nums">{progressBoard.length} 人</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {progressBoard.map(({ c, daysIdle, verdict, streak }) => {
                const tier = getTierBadge(c.subscription_tier)
                const idleText = daysIdle === 0 ? '今天' : `${daysIdle}天前`
                return (
                  <div key={c.id} className={`rounded-xl border p-3.5 ${verdict.level === 'reverse' ? 'border-rose-200 bg-rose-50/40' : verdict.level === 'slow' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
                    <Link href={`/admin/clients/${c.id}/overview`} className="block hover:opacity-80 transition-opacity">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-semibold text-gray-900 truncate">{c.name}</span>
                          <span className={`px-1.5 py-0.5 text-[11px] font-bold rounded-full shrink-0 ${tier.color}`}>{tier.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {streak >= 2 && <span className="text-[11px] font-medium text-amber-600" title={`連續記錄 ${streak} 天`}>連{streak}天</span>}
                          <span className="text-[11px] text-gray-400">{idleText}</span>
                        </div>
                      </div>
                      <div className="mb-1">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${verdict.pill}`}><span className={`inline-block w-2 h-2 rounded-full ${verdict.dot}`} />{verdict.label}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-snug min-h-[2.2em]">{verdict.detail}</p>
                    </Link>
                    {!pushClientIds.has(c.id) && (
                      <div className="mt-1.5 -mb-0.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700" title="沒開推播提醒＝沒人提醒他每天記，最該優先帶他開通知">沒開提醒</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        {c.body_composition_enabled && <span className={`text-xs ${todayBodyIds.has(c.id) ? 'text-emerald-600 font-medium' : 'text-slate-300'}`} title="體重">重</span>}
                        {c.nutrition_enabled && <span className={`text-xs ${todayNutritionMap[c.id] !== undefined ? 'text-emerald-600 font-medium' : 'text-slate-300'}`} title="飲食">食</span>}
                        {c.training_enabled && <span className={`text-xs ${todayTrainingMap[c.id] ? 'text-emerald-600 font-medium' : 'text-slate-300'}`} title="訓練">訓</span>}
                        {c.wellness_enabled && <span className={`text-xs ${todayWellnessIds.has(c.id) ? 'text-emerald-600 font-medium' : 'text-slate-300'}`} title="感受">感</span>}
                        {c.supplement_enabled && <span className={`text-xs ${todayLogIds.has(c.id) ? 'text-emerald-600 font-medium' : 'text-slate-300'}`} title="補品">補</span>}
                      </div>
                      <button onClick={() => openFeedback(c)} className="flex items-center gap-1 px-2 py-1 text-[11px] text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors" title="寫回饋">
                        <MessageSquare size={12} /> {c.coach_weekly_note ? '改回饋' : '回饋'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ===== 備賽倒數區塊 ===== */}
        {competitionClients.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={18} className="text-amber-600" />
              <h3 className="text-base font-semibold text-gray-900">備賽倒數</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {competitionClients.map(c => {
                const stat = clientStats[c.id]
                const urgencyColor = c.daysLeft <= 7 ? 'text-rose-600' : c.daysLeft <= 14 ? 'text-amber-600' : c.daysLeft <= 30 ? 'text-amber-600' : 'text-gray-700'
                // 會不會準時上台（體重主導；體脂量測後期失真，不用來判定）
                const bodyPts = recentBody.filter(b => b.client_id === c.id).map(b => ({ date: b.date, value: b.weight }))
                const wv = c.competition_date
                  ? projectWeightVerdict(bodyPts, c.competition_date, c.target_weight)
                  : null
                // 距賽太遠時 wv 是 null（外推不可信，見 comp-projection 的 MAX_HORIZON_DAYS）——
                // 那個階段要看的不是「比賽日會幾公斤」，是「現在長多快」。
                const slope = wv ? null : metricSlopePerWeek(bodyPts)
                return (
                  <Link key={c.id} href={`/admin/clients/${c.id}/overview`}
                    className={`bg-slate-50 rounded-xl p-4 transition-colors block ${c.daysLeft <= 3 ? 'ring-2 ring-rose-400 animate-pulse' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                      <span className={`text-2xl font-bold ${urgencyColor}`}>{c.daysLeft}<span className="text-xs font-normal ml-0.5">天</span></span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{getPrepPhaseLabel(c.prep_phase)} {c.target_weight ? `· 目標 ${c.target_weight}kg` : ''}</span>
                      {stat?.supplementCount ? <span className={`font-medium ${getComplianceColor(stat.weekRate)}`}>{stat.weekRate}%</span> : null}
                    </div>
                    {wv ? (
                      <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-medium ${wv.onTrack ? 'text-emerald-600' : 'text-amber-600'}`}>
                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${wv.onTrack ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span>體重{wv.onTrack ? '會準時' : `落後 ${wv.gap.toFixed(1)}kg`}（預測 {wv.projected.toFixed(1)}kg）</span>
                      </div>
                    ) : slope != null ? (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 tabular-nums">
                        <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-slate-300" />
                        <span>近 3 週 {slope > 0 ? '+' : ''}{slope.toFixed(2)} kg/週</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1.5 mt-2">
                      {c.body_composition_enabled && <span className={`text-xs ${todayBodyIds.has(c.id) ? 'text-emerald-600 font-medium' : 'text-slate-300'}`} title="體重">重</span>}
                      {c.nutrition_enabled && <span className={`text-xs ${todayNutritionMap[c.id] !== undefined ? 'text-emerald-600 font-medium' : 'text-slate-300'}`} title="飲食">食</span>}
                      {c.training_enabled && <span className={`text-xs ${todayTrainingMap[c.id] ? 'text-emerald-600 font-medium' : 'text-slate-300'}`} title="訓練">訓</span>}
                      {c.supplement_enabled && <span className={`text-xs ${todayLogIds.has(c.id) ? 'text-emerald-600 font-medium' : 'text-slate-300'}`} title="補品">補</span>}
                      {c.wellness_enabled && <span className={`text-xs ${todayWellnessIds.has(c.id) ? 'text-emerald-600 font-medium' : 'text-slate-300'}`} title="感受">感</span>}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ===== 更多洞察（收合，預設不展開）===== */}
        <details className="bg-white border border-slate-200 rounded-2xl mb-4">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-gray-700 select-none">更多洞察 — 表現好 / 流失風險 / 本週摘要</summary>
          <div className="px-5 pb-5 space-y-4">
            {(spotlightClients.stars.length > 0 || spotlightClients.struggling.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {spotlightClients.stars.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    <p className="text-sm font-semibold text-emerald-800 mb-2">今日表現好</p>
                    <div className="space-y-1.5">{spotlightClients.stars.map(s => (
                      <Link key={s.id} href={`/admin/clients/${s.id}/overview`} className="flex items-center justify-between px-3 py-2 bg-white/60 rounded-lg hover:bg-white/80 transition-colors">
                        <span className="text-sm font-medium text-emerald-700">{s.name}</span>
                        <span className="text-xs text-emerald-600">{s.reason}</span>
                      </Link>
                    ))}</div>
                  </div>
                )}
                {spotlightClients.struggling.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                    <p className="text-sm font-semibold text-rose-800 mb-2">需要關注</p>
                    <div className="space-y-1.5">{spotlightClients.struggling.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-white/60 rounded-lg">
                        <Link href={`/admin/clients/${s.id}/overview`} className="text-sm font-medium text-rose-700 hover:underline">{s.name}</Link>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-rose-600">{s.reason}</span>
                          <button onClick={() => { const c = clients.find(c => c.id === s.id); if (c) openFeedback(c) }} className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors" title="快速回饋"><MessageSquare size={14} /></button>
                        </div>
                      </div>
                    ))}</div>
                  </div>
                )}
              </div>
            )}
            {retentionStats.churnRisk.length > 0 && (
              <div>
                <p className="text-[11px] text-gray-400 mb-1.5">久未活動（≥10 天）— 退訂前先接觸</p>
                <div className="flex flex-wrap gap-1.5">
                  {retentionStats.churnRisk.slice(0, 12).map(c => (
                    <Link key={c.id} href={`/admin/clients/${c.id}/overview`} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">{c.name} · {c.days}天{c.paying ? ' · 付費' : ''}</Link>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] text-gray-400">本週摘要（可複製）</p>
                <button onClick={() => { navigator.clipboard?.writeText(weeklyDigest); showToast('已複製本週摘要', 'success') }} className="text-[11px] bg-gray-800 text-white px-2.5 py-1 rounded-lg hover:bg-gray-700 transition-colors">複製</button>
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-3 leading-relaxed">{weeklyDigest}</pre>
            </div>
          </div>
        </details>

        {/* ===== 學員列表 ===== */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-200"><div className="flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋學員姓名..." className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" /></div><div className="flex gap-2 flex-wrap">
                  {([['all','全部'],['competition','備賽'],['coached','2999'],['self_managed','499'],['free','免費'],['attention','需關注'],['inactive','已停用']] as [StatusFilter, string][]).map(([k,l]) => (
                    <button key={k} onClick={() => setStatusFilter(k)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter===k?'bg-primary-600 text-white': k === 'coached' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : k === 'self_managed' ? 'bg-primary-50 text-primary-700 hover:bg-primary-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {l}
                      {k === 'coached' && summaryStats.coachedCount > 0 ? ` (${summaryStats.coachedCount})` : ''}
                      {k === 'self_managed' && summaryStats.selfManagedCount > 0 ? ` (${summaryStats.selfManagedCount})` : ''}
                      {k === 'free' && summaryStats.freeCount > 0 ? ` (${summaryStats.freeCount})` : ''}
                    </button>
                  ))}
                </div></div></div>
          {filteredClients.length === 0 ? <div className="p-8 text-center"><p className="text-gray-500">{search||statusFilter!=='all'?'沒有符合條件的學員':'還沒有學員資料'}</p>{!search&&statusFilter==='all'&&<Link href="/admin/clients/new" className="inline-block mt-4 text-primary-600 hover:text-primary-800 text-sm">新增第一個學員</Link>}</div> : (
            <>
            {/* 手機版卡片 */}
            <div className="sm:hidden divide-y divide-gray-100">
              {paginatedClients.map(client => { const stat = clientStats[client.id]; const act = getActivityLabel(client.id); const ckup = getCheckupLabel(client); const lineStatus = getLineStatus(client); const daysToComp = isCompetitionMode(client.client_mode) && client.competition_date ? daysUntilDateTW(client.competition_date) : null; const tier = getTierBadge(client.subscription_tier); const expiry = getExpiryWarning(client); const att = getAttention(client); return (
                <div key={client.id} className={`px-4 py-4 ${att.accent}`}>
                  <Link href={`/admin/clients/${client.id}/overview`} className="block hover:bg-gray-50 active:bg-gray-100 transition-colors rounded-lg -mx-2 px-2 py-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-gray-900">{client.name}</span>
                        <span className={`px-1.5 py-0.5 text-[11px] font-bold rounded-full ${tier.color}`}>{tier.label}</span>
                        {client.line_user_id && <span className={`text-[11px] ${lineStatus.color}`} title={`LINE ${lineStatus.label}`}>{lineStatus.label === '在線' ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> : <MessageSquare size={12} className="inline text-slate-400" />}</span>}
                        {isCompetitionMode(client.client_mode) && daysToComp && daysToComp > 0 && (
                          <span className={`text-xs rounded-full px-1.5 border ${daysToComp <= 14 ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-slate-500 border-slate-200'}`}>
                            備賽{daysToComp}d
                          </span>
                        )}
                        {expiry && <span className={`text-[11px] font-medium ${expiry.color}`}>{expiry.text}</span>}
                        <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${!client.is_active ? 'bg-gray-200 text-gray-500' : client.status==='normal'?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>{!client.is_active ? '已停用' : client.status==='normal'?'正常':'關注'}</span>
                        {att.reason && <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${att.chip}`}>{att.reason}</span>}
                      </div>
                      {stat?.supplementCount>0?<span className={`text-lg font-bold ${getComplianceColor(stat.weekRate)}`}>{stat.weekRate}%</span>:<span className="text-sm text-gray-300">--</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {client.body_composition_enabled&&<span className={`text-xs ${todayBodyIds.has(client.id)?'text-emerald-600 font-medium':'text-slate-300'}`} title="體重">重</span>}
                        {client.wellness_enabled&&<span className={`text-xs ${todayWellnessIds.has(client.id)?'text-emerald-600 font-medium':'text-slate-300'}`} title="感受">感</span>}
                        {client.nutrition_enabled&&<span className={`text-xs ${todayNutritionMap[client.id]!==undefined?'text-emerald-600 font-medium':'text-slate-300'}`} title="飲食">食</span>}
                        {client.training_enabled&&<span className={`text-xs ${todayTrainingMap[client.id]?'text-emerald-600 font-medium':'text-slate-300'}`} title="訓練">訓</span>}
                        {client.supplement_enabled&&<span className={`text-xs ${todayLogIds.has(client.id)?'text-emerald-600 font-medium':'text-slate-300'}`} title="補品">補</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className={act.color}>{act.text}</span>
                        <span className="text-gray-300">·</span>
                        <span className={ckup.color}>{ckup.text}</span>
                      </div>
                    </div>
                  </Link>
                  {/* 手機版快速回饋按鈕 */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                    <button onClick={() => openFeedback(client)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
                      <MessageSquare size={12} /> {client.coach_weekly_note ? '修改回饋' : '寫回饋'}
                    </button>
                    {client.coach_weekly_note && <span className="text-xs text-gray-400 truncate flex-1">{client.coach_weekly_note}</span>}
                    <button onClick={() => deleteClient(client)} className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors">
                      <Trash2 size={12} /> 刪除
                    </button>
                  </div>
                </div>
              ) })}
            </div>
            {/* 桌面版表格 */}
            <div className="hidden sm:block overflow-x-auto"><table className="min-w-full"><thead><tr className="border-b border-slate-200"><th onClick={() => handleSort('name')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">學員 <SortIcon column="name" /></th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase select-none">方案</th><th onClick={() => handleSort('status')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">狀態 <SortIcon column="status" /></th><th onClick={() => handleSort('compliance')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">本週服從率 <SortIcon column="compliance" /></th><th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase select-none">今日進度</th><th onClick={() => handleSort('lastActivity')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">最後活動 <SortIcon column="lastActivity" /></th><th onClick={() => handleSort('nextCheckup')} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50 select-none">下次回檢 <SortIcon column="nextCheckup" /></th><th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{paginatedClients.map(client => { const stat = clientStats[client.id]; const act = getActivityLabel(client.id); const ckup = getCheckupLabel(client); const lineStatus = getLineStatus(client); const daysToComp = isCompetitionMode(client.client_mode) && client.competition_date ? daysUntilDateTW(client.competition_date) : null; const tier = getTierBadge(client.subscription_tier); const expiry = getExpiryWarning(client); const att = getAttention(client); return (
              <tr key={client.id} className={`hover:bg-gray-50 transition-colors ${att.accent}`}>
                <td className="px-5 py-4"><Link href={`/admin/clients/${client.id}/overview`} className="hover:text-primary-600"><div className="text-sm font-medium text-gray-900">{client.name}{newSinceViewMap[client.id] > 0 && <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium" title={`自你上次查看後新增 ${newSinceViewMap[client.id]} 筆紀錄`}>新 {newSinceViewMap[client.id]}</span>}{client.line_user_id && <span className={`ml-1 text-[11px] ${lineStatus.color}`} title={`LINE ${lineStatus.label}`}>{lineStatus.label === '在線' ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> : <MessageSquare size={12} className="inline text-slate-400" />}</span>}{isCompetitionMode(client.client_mode) && daysToComp && daysToComp > 0 && <span className={`ml-1.5 text-xs rounded-full px-1.5 border ${daysToComp <= 14 ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-slate-500 border-slate-200'}`}>備賽{daysToComp}d</span>}{client.training_enabled&&todayTrainingMap[client.id]&&<span className="ml-1.5 text-xs text-slate-500 border border-slate-200 rounded-full px-1.5" title={`今日訓練：${todayTrainingMap[client.id]}`}>{getTrainingLabel(todayTrainingMap[client.id])}</span>}{client.nutrition_enabled&&todayNutritionMap[client.id]!==undefined&&<span className={`ml-1 text-xs font-medium ${todayNutritionMap[client.id]?'text-emerald-600':'text-amber-600'}`} title={`今日飲食：${todayNutritionMap[client.id]?'合規':'未合規'}`}>{todayNutritionMap[client.id]?'合規':'未合規'}</span>}</div><div className="text-xs text-gray-400 mt-0.5">{client.age}歲 · {client.gender}{isCompetitionMode(client.client_mode) && ` · ${getPrepPhaseLabel(client.prep_phase)}`}</div></Link></td>
                <td className="px-4 py-4"><div><span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${tier.color}`}>{tier.label}</span>{expiry && <p className={`text-[11px] mt-1 ${expiry.color}`}>{expiry.text}</p>}</div></td>
                <td className="px-5 py-4"><span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${!client.is_active ? 'bg-gray-200 text-gray-500' : client.status==='normal'?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>{!client.is_active ? '已停用' : client.status==='normal'?'正常':'需要關注'}</span>{att.reason && <span className={`ml-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full ${att.chip}`}>{att.reason}</span>}</td>
                <td className="px-5 py-4">{stat?.supplementCount>0?<span className={`text-sm font-medium ${getComplianceColor(stat.weekRate)}`}>{stat.weekRate}%</span>:<span className="text-sm text-gray-500" title="此學員未設定補品">N/A</span>}</td>
                <td className="px-5 py-4"><div className="flex flex-wrap gap-1.5">{client.body_composition_enabled&&<span className={`text-xs ${todayBodyIds.has(client.id)?'text-emerald-600 font-medium':'text-slate-300'}`} title="體重">重</span>}{client.wellness_enabled&&<span className={`text-xs ${todayWellnessIds.has(client.id)?'text-emerald-600 font-medium':'text-slate-300'}`} title="感受">感</span>}{client.nutrition_enabled&&<span className={`text-xs ${todayNutritionMap[client.id]!==undefined?'text-emerald-600 font-medium':'text-slate-300'}`} title="飲食">食</span>}{client.training_enabled&&<span className={`text-xs ${todayTrainingMap[client.id]?'text-emerald-600 font-medium':'text-slate-300'}`} title="訓練">訓</span>}{client.supplement_enabled&&<span className={`text-xs ${todayLogIds.has(client.id)?'text-emerald-600 font-medium':'text-slate-300'}`} title="補品">補</span>}{client.lab_enabled&&<span className="text-xs text-slate-300" title="血檢追蹤已啟用">血</span>}</div></td>
                <td className="px-5 py-4"><span className={`text-sm ${act.color}`}>{act.text}</span></td>
                <td className="px-5 py-4"><span className={`text-sm ${ckup.color}`}>{ckup.text}</span></td>
                <td className="px-5 py-4"><div className="flex items-center gap-1.5"><button onClick={() => openFeedback(client)} className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors" title="快速回饋" aria-label={`寫回饋給 ${client.name}`}><MessageSquare size={15} /></button><button onClick={(e) => { e.preventDefault(); copyClientUrl(client.unique_code) }} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="複製學員連結" aria-label={`複製 ${client.name} 的連結`}><Copy size={15} /></button><Link href={`/admin/clients/${client.id}`} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="編輯" aria-label={`編輯 ${client.name}`}><ExternalLink size={15} /></Link><button onClick={() => deleteClient(client)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="刪除學員" aria-label={`刪除 ${client.name}`}><Trash2 size={15} /></button></div></td>
              </tr>) })}</tbody></table></div>
            {currentPage * PAGE_SIZE < filteredClients.length && (
              <div className="px-5 py-3 border-t border-slate-200">
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  顯示更多（已顯示 {paginatedClients.length} / {filteredClients.length}）
                </button>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {/* ===== 快速回饋 Modal ===== */}
      {feedbackClient && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={closeFeedback} onKeyDown={e => { if (e.key === 'Escape') closeFeedback() }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">快速回饋</h3>
                <p className="text-sm text-gray-500">{feedbackClient.name}</p>
              </div>
              <button onClick={closeFeedback} className="p-1 text-gray-400 hover:text-gray-600" aria-label="關閉回饋"><X size={20} /></button>
            </div>
            <textarea
              ref={feedbackRef}
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              rows={3}
              placeholder="這週體重控制得不錯，繼續保持！碳水可以再多吃一點。"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50 text-sm mb-2"
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
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 font-medium"
            >
              <Send size={16} /> {feedbackSaving ? '儲存中...' : '送出回饋'}
            </button>
          </div>
        </div>
      )}

      {/* ===== 流失出手：關心草稿 modal ===== */}
      {winbackItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setWinbackItem(null)} onKeyDown={e => { if (e.key === 'Escape') setWinbackItem(null) }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-gray-900">關心草稿</h3>
              <button onClick={() => setWinbackItem(null)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="關閉關心草稿"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-3">{winbackItem.name} — {winbackItem.text}</p>
            <textarea
              value={winbackMsg}
              onChange={e => setWinbackMsg(e.target.value)}
              rows={7}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50 text-sm mb-2"
            />
            <p className="text-xs text-gray-400 mb-3">草稿可直接改。「發送」＝App 推播優先、退 LINE，並存進學員儀表板；「複製」＝用你自己的 LINE 貼，不吃官方帳號額度。</p>
            {winbackError && <p className="text-xs text-rose-600 mb-3">{winbackError}</p>}
            <div className="flex gap-2">
              <button onClick={copyWinback} className="flex-1 px-4 py-2.5 border border-slate-300 text-gray-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm">{winbackCopied ? '已複製 ✓' : '複製（自己貼）'}</button>
              <button onClick={sendWinback} disabled={winbackSending || !winbackMsg.trim()} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 font-medium text-sm"><Send size={15} /> {winbackSending ? '發送中…' : '發送'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
