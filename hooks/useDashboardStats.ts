import { useMemo } from 'react'

/**
 * 從 clientData 計算儀表板所需的各種統計數據
 * 抽離自 page.tsx，減少主組件複雜度
 */
export function useDashboardStats(clientData: any, selectedDate: string, today: string) {
  // 選擇日的感受
  const todayWellness = useMemo(() => {
    return clientData?.wellness?.find((w: any) => w.date === selectedDate) || null
  }, [clientData?.wellness, selectedDate])

  // 選擇日的訓練
  const todayTraining = useMemo(() => {
    return clientData?.trainingLogs?.find((t: any) => t.date === selectedDate) || null
  }, [clientData?.trainingLogs, selectedDate])

  // 選擇日的飲食
  const todayNutrition = useMemo(() => {
    return clientData?.nutritionLogs?.find((n: any) => n.date === selectedDate) || null
  }, [clientData?.nutritionLogs, selectedDate])

  // 選擇日的補品打卡（從 recentLogs 篩選）
  const selectedDateLogs = useMemo(() => {
    if (!clientData?.recentLogs) return clientData?.todayLogs || []
    if (selectedDate === today) return clientData?.todayLogs || []
    return clientData.recentLogs.filter((l: any) => l.date === selectedDate)
  }, [clientData?.recentLogs, clientData?.todayLogs, selectedDate, today])

  // 身體數據 — 每個欄位各自找最新有值的那筆
  const sortedBodyData = useMemo(() => {
    if (!clientData?.bodyData?.length) return []
    return [...clientData.bodyData].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [clientData?.bodyData])

  const latestByField = useMemo(() => {
    const find = (field: string) => sortedBodyData.find((r: any) => r[field] != null)
    return {
      weight: find('weight'),
      body_fat: find('body_fat'),
      muscle_mass: find('muscle_mass'),
      height: find('height'),
    }
  }, [sortedBodyData])

  const latestBodyData = useMemo(() => {
    if (!sortedBodyData.length) return null
    return {
      ...sortedBodyData[0],
      weight: latestByField.weight?.weight ?? null,
      body_fat: latestByField.body_fat?.body_fat ?? null,
      muscle_mass: latestByField.muscle_mass?.muscle_mass ?? null,
      height: latestByField.height?.height ?? null,
    }
  }, [sortedBodyData, latestByField])

  const prevBodyData = useMemo(() => {
    const findPrev = (field: string) => {
      const items = sortedBodyData.filter((r: any) => r[field] != null)
      return items.length >= 2 ? items[1] : null
    }
    return {
      weight: findPrev('weight')?.weight ?? null,
      body_fat: findPrev('body_fat')?.body_fat ?? null,
      muscle_mass: findPrev('muscle_mass')?.muscle_mass ?? null,
    }
  }, [sortedBodyData])

  const bmi = useMemo(() => {
    const w = latestByField.weight?.weight
    const h = latestByField.height?.height
    if (!w || !h) return null
    return (w / ((h / 100) ** 2)).toFixed(1)
  }, [latestByField])

  // 血檢統計
  const labStats = useMemo(() => {
    if (!clientData?.client?.lab_results?.length) return { normal: 0, total: 0 }
    const latestByName = new Map<string, any>()
    for (const r of clientData.client.lab_results) {
      const existing = latestByName.get(r.test_name)
      if (!existing || new Date(r.date) > new Date(existing.date)) {
        latestByName.set(r.test_name, r)
      }
    }
    let normal = 0
    for (const r of latestByName.values()) {
      if (r.status === 'normal') normal++
    }
    return { normal, total: latestByName.size }
  }, [clientData?.client?.lab_results])

  // 補品統計
  const todaySupplementStats = useMemo(() => {
    if (!selectedDateLogs || !clientData?.client?.supplements) return { completed: 0, total: 0, rate: 0 }
    const completed = selectedDateLogs.filter((log: any) => log.completed).length
    const total = clientData.client.supplements.length
    return { completed, total, rate: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [selectedDateLogs, clientData?.client?.supplements])

  const supplementComplianceStats = useMemo(() => {
    const totalSupplements = clientData?.client?.supplements?.length || 0
    if (!totalSupplements || !clientData?.recentLogs) return { weekRate: 0, monthRate: 0, weekDelta: null as number | null }
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const daysAgo = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }
    const logs = clientData.recentLogs as any[]
    const weekStart = daysAgo(6)
    const weekCompleted = logs.filter((l: any) => l.date >= weekStart && l.date <= todayStr && l.completed).length
    const weekRate = Math.round((weekCompleted / (7 * totalSupplements)) * 100)
    const monthStart = daysAgo(29)
    const monthCompleted = logs.filter((l: any) => l.date >= monthStart && l.date <= todayStr && l.completed).length
    const monthRate = Math.round((monthCompleted / (30 * totalSupplements)) * 100)
    const lastWeekStart = daysAgo(13)
    const lastWeekEnd = daysAgo(7)
    const lastWeekCompleted = logs.filter((l: any) => l.date >= lastWeekStart && l.date <= lastWeekEnd && l.completed).length
    const lastWeekRate = Math.round((lastWeekCompleted / (7 * totalSupplements)) * 100)
    return { weekRate, monthRate, weekDelta: weekRate - lastWeekRate }
  }, [clientData?.recentLogs, clientData?.client?.supplements])

  // 體脂趨勢
  const bodyFatTrend = useMemo(() => {
    const latest = latestByField.body_fat?.body_fat
    const prev = prevBodyData?.body_fat
    if (latest == null || prev == null) return null
    const diff = latest - prev
    return { diff: Math.abs(diff).toFixed(1), direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same' }
  }, [latestByField, prevBodyData])

  // 補品連續天數（原邏輯）
  const streakDays = useMemo(() => {
    if (!clientData?.recentLogs?.length) return 0
    const completedLogs = (clientData.recentLogs as any[]).filter((l: any) => l.completed)
    if (!completedLogs.length) return 0
    const datesWithCompleted = [...new Set(completedLogs.map((l: any) => l.date))].sort().reverse()
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const startOffset = datesWithCompleted[0] === todayStr ? 0 : 1
    let streak = 0
    for (let i = 0; i < datesWithCompleted.length; i++) {
      const expected = new Date(now)
      expected.setDate(expected.getDate() - (i + startOffset))
      if (datesWithCompleted[i] === expected.toISOString().split('T')[0]) { streak++ } else { break }
    }
    return streak
  }, [clientData?.recentLogs])

  const streakMessage = useMemo(() => {
    if (streakDays >= 30) return '健康達人！'
    if (streakDays >= 14) return '超棒的習慣！'
    if (streakDays >= 7) return '一週達成！'
    if (streakDays >= 3) return '保持下去！'
    if (streakDays >= 1) return '好的開始！'
    return '今天開始吧！'
  }, [streakDays])

  // 綜合連續記錄天數（任何一項有記錄就算）
  const overallStreak = useMemo(() => {
    const activeDates = new Set<string>()

    // 補品打卡
    if (clientData?.recentLogs?.length) {
      for (const l of clientData.recentLogs as any[]) {
        if (l.completed) activeDates.add(l.date)
      }
    }
    // 飲食紀錄
    if (clientData?.nutritionLogs?.length) {
      for (const n of clientData.nutritionLogs as any[]) {
        if (n.compliant != null) activeDates.add(n.date)
      }
    }
    // 感受紀錄
    if (clientData?.wellness?.length) {
      for (const w of clientData.wellness as any[]) {
        activeDates.add(w.date)
      }
    }
    // 身體數據
    if (clientData?.bodyData?.length) {
      for (const b of clientData.bodyData as any[]) {
        activeDates.add(b.date)
      }
    }
    // 訓練紀錄
    if (clientData?.trainingLogs?.length) {
      for (const t of clientData.trainingLogs as any[]) {
        activeDates.add(t.date)
      }
    }

    if (activeDates.size === 0) return 0

    const sortedDates = [...activeDates].sort().reverse()
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const startOffset = sortedDates[0] === todayStr ? 0 : 1
    let streak = 0
    for (let i = 0; i < sortedDates.length; i++) {
      const expected = new Date(now)
      expected.setDate(expected.getDate() - (i + startOffset))
      if (sortedDates[i] === expected.toISOString().split('T')[0]) { streak++ } else { break }
    }
    return streak
  }, [clientData?.recentLogs, clientData?.nutritionLogs, clientData?.wellness, clientData?.bodyData, clientData?.trainingLogs])

  // 今日已完成的項目（用於今日概覽卡片）
  const todayCompletedItems = useMemo(() => {
    const items: { icon: string; label: string }[] = []
    if (todayWellness) items.push({ icon: '😊', label: '感受' })
    if (todayTraining) items.push({ icon: '🏋️', label: '訓練' })
    if (todayNutrition?.compliant != null) items.push({ icon: '🥗', label: '飲食' })
    // 今天有量體重
    const todayBody = clientData?.bodyData?.find((b: any) => b.date === today)
    if (todayBody) items.push({ icon: '⚖️', label: '體重' })
    // 今天有打補品卡
    const todaySupLogs = clientData?.todayLogs || []
    if (todaySupLogs.some((l: any) => l.completed)) items.push({ icon: '💊', label: '補品' })
    return items
  }, [todayWellness, todayTraining, todayNutrition, clientData?.bodyData, clientData?.todayLogs, today])

  // 趨勢圖
  const trendData = useMemo(() => {
    const trends: Record<string, any[]> = {}
    if (clientData?.bodyData?.length) {
      for (const key of ['weight', 'body_fat'] as const) {
        const data = clientData.bodyData
          .filter((r: any) => r[key] != null)
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((r: any) => ({ date: new Date(r.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }), value: r[key] }))
        if (data.length > 0) trends[key] = data
      }
    }
    return trends
  }, [clientData?.bodyData])

  // Top supplements
  const topSupplements = useMemo(() => {
    return clientData?.client?.supplements?.slice().sort((a: any, b: any) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity)).slice(0, 3)
  }, [clientData?.client?.supplements])

  return {
    todayWellness, todayTraining, todayNutrition,
    selectedDateLogs,
    latestBodyData, prevBodyData, latestByField, bmi,
    labStats, todaySupplementStats, supplementComplianceStats,
    bodyFatTrend, streakDays, streakMessage,
    overallStreak, todayCompletedItems,
    trendData, topSupplements,
  }
}
