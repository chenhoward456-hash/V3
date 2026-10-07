/** Shared read-only coach work queue. Signals use existing thresholds; review dates are never invented. */
import { readSignals, type CoachSignal, type SignalInput } from './coach-signals'

export type CoachWorkReason = {
  kind: 'signal' | 'offline' | 'lab' | 'proposal' | 'result'
  priority: number
  reason: string
  action: string
  review: { date: string | null; label: string }
}
export type CoachWorkItem = {
  clientId: string
  name: string
  priority: number
  reason: string
  action: string
  review: CoachWorkReason['review']
  href: string
  reasons: CoachWorkReason[]
  signals: CoachSignal[]
  latestMessage: { sentAt: string; readAt: string | null } | null
}
export type CoachWorkflowClient = {
  id: string
  name: string
  lastActive: string | null
  signalInput?: SignalInput
  reasons?: CoachWorkReason[]
  latestMessage?: CoachWorkItem['latestMessage']
}

export function signalWorkReason(signal: CoachSignal): CoachWorkReason | null {
  if (signal.sev < 2) return null
  const actions: Record<CoachSignal['kind'], string> = {
    student_note: '打開訓練筆記，先回覆他提出的問題或不舒服的地方',
    water_spike: '先回覆這次體重跳升的背景，再看後續體重',
    binge_compensate: '先跟他確認大餐後的補償飲食，討論下一步',
    log_gap: '先確認空窗期間發生什麼，再接回記錄',
    protein_low: '確認飲食記錄與蛋白質來源',
  }
  const priority = signal.kind === 'student_note' ? (signal.sev === 3 ? 100 : 80)
    : signal.kind === 'binge_compensate' ? 60 : signal.kind === 'log_gap' ? 65 : 50
  return {
    kind: 'signal', priority, reason: signal.text, action: actions[signal.kind],
    review: { date: null, label: '回覆後約定複核日；目前未設定' },
  }
}

export function buildCoachWorkflow(clients: CoachWorkflowClient[], today: string): CoachWorkItem[] {
  const queue: CoachWorkItem[] = []
  for (const c of clients) {
    const signals = c.signalInput ? readSignals(c.signalInput) : []
    const reasons = [...(c.reasons ?? []), ...signals.map(signalWorkReason).filter((r): r is CoachWorkReason => r !== null)]
    const idle = c.lastActive ? Math.round((Date.parse(today) - Date.parse(c.lastActive)) / 86400000) : null
    // Keep the morning digest's existing 3–30 day scope. Long-silent names remain in its Monday detail.
    if (idle != null && idle >= 3 && idle <= 30) reasons.push({
      kind: 'offline', priority: 70, reason: `${idle} 天沒有任何紀錄`,
      action: '先確認近況，請他回報一筆目前的記錄',
      review: { date: null, label: '收到回覆後約定複核日；目前未設定' },
    })
    reasons.sort((a, b) => b.priority - a.priority || (a.review.date ?? '9999').localeCompare(b.review.date ?? '9999') || a.reason.localeCompare(b.reason, 'zh-Hant'))
    if (!reasons.length) continue
    const top = reasons[0]
    queue.push({ clientId: c.id, name: c.name, priority: top.priority, reason: top.reason, action: top.action,
      review: top.review, reasons, signals, href: `/admin/clients/${encodeURIComponent(c.id)}/overview?workflow=1`, latestMessage: c.latestMessage ?? null })
  }
  return queue.sort((a, b) => b.priority - a.priority || (a.review.date ?? '9999').localeCompare(b.review.date ?? '9999') || a.clientId.localeCompare(b.clientId))
}
