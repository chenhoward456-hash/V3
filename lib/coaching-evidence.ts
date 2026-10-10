/** Facts about the same 14-day analysis window used by weekly-coaching (both ends included). */
export type EvidenceSource = { key: string; label: string; records: number; days: number; latestDate: string | null; from: string; to: string }
export type CoachingEvidence = { from: string; to: string; sources: EvidenceSource[] }
export function coachingEvidence(today: string, rows: Record<string, Array<{ date?: string | null; applied_at?: string | null }>>): CoachingEvidence {
  const from = new Date(Date.parse(today) - 14 * 86400000).toISOString().slice(0, 10)
  const labels: Record<string, string> = { weight: '體重', nutrition: '飲食', training: '訓練打卡', wellness: '感受（本週）', wellnessPrevious: '感受（前週）', labs: '血檢', trainingSets: '逐組訓練', macroChanges: '營養設定變更' }
  return { from, to: today, sources: Object.entries(labels).map(([key, label]) => {
    const sourceFrom = new Date(Date.parse(today) - (key === 'macroChanges' ? 60 : key === 'wellness' ? 7 : 14) * 86400000).toISOString().slice(0, 10)
    const sourceTo = key === 'wellnessPrevious' ? new Date(Date.parse(today) - 8 * 86400000).toISOString().slice(0, 10) : today
    const dates = (rows[key === 'wellnessPrevious' ? 'wellness' : key] ?? []).map(row => row.date ?? (row.applied_at ? new Date(row.applied_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }) : null))
      .filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= sourceFrom && d <= sourceTo)
    return { key, label, from: sourceFrom, to: sourceTo, records: dates.length, days: new Set(dates).size, latestDate: dates.sort().at(-1) ?? null }
  }) }
}
