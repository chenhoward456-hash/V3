'use client'

import { useState, useEffect, useRef } from 'react'
import { degradeToSafe } from '@/lib/compliance-scrub'

interface GoalDrivenStatusProps {
  clientId: string
  code?: string
  isTrainingDay?: boolean
  onMutate?: (appliedTargets?: Record<string, number | undefined>) => void
  initialData?: any
  // DB 教練設定值 — 有的話優先顯示（跟 NutritionLog 一致）
  dbTargets?: {
    calories?: number | null
    protein?: number | null
    fat?: number | null
    carbsTrainingDay?: number | null
    carbsRestDay?: number | null
  } | null
  /**
   * 分頁歸屬（IA 拆分）：
   * - 'progress'：進度分頁只顯示「上台推算 / Peak Week / 代謝壓力」等進度卡
   * - 'plan'：計畫分頁只顯示「今日飲食目標 / 分餐蛋白 / 血檢建議」等處方卡
   * - 'all'（預設）：全部一起（向後相容的保底）
   */
  section?: 'plan' | 'progress' | 'all'
  /** 目標體重（clients.target_weight）——有 initialData 時元件不自己 fetch，meta.targetWeight 拿不到，靠這個 prop 補 */
  targetWeight?: number | string | null
}

export default function GoalDrivenStatus({ clientId, code, isTrainingDay, onMutate, initialData, dbTargets, section = 'all', targetWeight }: GoalDrivenStatusProps) {
  const showPlan = section !== 'progress'
  const showProgress = section !== 'plan'
  const [data, setData] = useState<any>(initialData || null)
  const [targetWeightValue, setTargetWeightValue] = useState<number | null>(
    targetWeight != null && Number.isFinite(Number(targetWeight)) ? Number(targetWeight) : null
  )
  const [loading, setLoading] = useState(!initialData)
  const [overriding, setOverriding] = useState(false)
  const onMutateRef = useRef(onMutate)
  onMutateRef.current = onMutate
  const fetchedRef = useRef(!!initialData)

  // 如果 initialData 從 parent 更新了，同步
  useEffect(() => {
    if (initialData && !data) {
      setData(initialData)
      setLoading(false)
      fetchedRef.current = true
    }
  }, [initialData, data])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    const fetchSuggestion = async () => {
      try {
        const lookupId = code || clientId
        // 計畫分頁的 plan 實例只是鏡像顯示，不該再觸發引擎套用寫入（避免同一天在兩個分頁各寫一次 macros）；
        // 套用由進度分頁的 progress 實例 / 頁層 runEngine 負責。
        const applyParam = section === 'plan' ? '' : '&autoApply=true'
        const res = await fetch(`/api/nutrition-suggestions?clientId=${lookupId}${applyParam}${code ? `&code=${code}` : ''}`)
        if (!res.ok) {
          console.error('[GoalDrivenStatus] API 失敗:', res.status, res.statusText, 'lookupId:', lookupId)
          return
        }
        const json = await res.json()
        if (json.suggestion) {
          setData(json.suggestion)
          if (json.meta?.targetWeight) setTargetWeightValue(json.meta.targetWeight)
          if (onMutateRef.current) {
            if (json.applied) {
              const s = json.suggestion
              onMutateRef.current({
                calories_target: s.suggestedCalories,
                protein_target: s.suggestedProtein,
                carbs_target: s.suggestedCarbs,
                fat_target: s.suggestedFat,
                carbs_training_day: s.suggestedCarbsTrainingDay,
                carbs_rest_day: s.suggestedCarbsRestDay,
              })
            } else {
              onMutateRef.current()
            }
          }
        }
      } catch (err) {
        console.error('[GoalDrivenStatus] fetch 錯誤:', err)
      } finally { setLoading(false) }
    }
    fetchSuggestion()
  }, [clientId, code])

  const handleGateOverride = async () => {
    if (overriding) return
    setOverriding(true)
    try {
      const lookupId = code || clientId
      const res = await fetch('/api/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: lookupId, cutting_gate_override: true }),
      })
      if (res.ok) {
        // 重新載入營養建議
        fetchedRef.current = false
        setLoading(true)
        const sugRes = await fetch(`/api/nutrition-suggestions?clientId=${lookupId}&autoApply=true${code ? `&code=${code}` : ''}`)
        if (sugRes.ok) {
          const json = await sugRes.json()
          setData(json.data || json)
        }
      }
    } catch (e) {
      console.error('[GoalDrivenStatus] override failed:', e)
    } finally {
      setOverriding(false)
      setLoading(false)
    }
  }

  if (loading || !data) return null

  const dl = data.deadlineInfo
  const isGoalDriven = dl?.isGoalDriven
  const gate = data.cuttingReadinessGate

  // 血檢警告橫幅（不擋住正常建議，只顯示提醒）
  const gateWarningBanner = gate?.blocked ? (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-amber-800">血檢指標異常</p>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
          就緒 {gate.readinessScore}/100
        </span>
      </div>
      {(gate.labFlags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {gate.labFlags.map((flag: string, i: number) => (
            <span key={i} className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
              {flag}
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-amber-700 leading-relaxed">{gate.recommendation}</p>
    </div>
  ) : null

  // 舊的強制恢復 UI 已移除 — 閘門改為純警告模式

  // 穿戴裝置恢復狀態回饋 — 已停用：恢復/訓練建議統一由 RecoveryDashboard（今天的恢復）一個聲音講，
  // 避免同畫面出現兩個恢復分數(61 vs 100)、互相矛盾的訓練建議(挑戰PR vs 減量)。
  const wearableInsightCard = null

  // 非 goal-driven 時顯示基本引擎狀態（屬「進度」狀態卡；計畫分頁沒有處方可給，直接不顯示）
  if (!isGoalDriven) {
    if (!showProgress) return null
    // 如果有 deadlineInfo 但沒進入 goal-driven（例如已達標、數據不足等），顯示簡易卡片
    if (data.status === 'insufficient_data') {
      return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">目標體重計畫</h2>
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-gray-500">
            需要至少 2 週的體重數據，系統才能啟動自動調整。請持續記錄體重！
          </div>
        </div>
      )
    }
    // 其他非 goal-driven 狀態（on_track 等）顯示引擎狀態
    if (data.status && data.statusEmoji) {
      return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">目標體重計畫</h2>
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
            data.status === 'on_track' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            : data.status === 'plateau' ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-rose-50 text-rose-600 border border-rose-200'
          }`}>
            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
              data.status === 'on_track' ? 'bg-emerald-500' : data.status === 'plateau' ? 'bg-amber-500' : 'bg-rose-500'
            }`} />
            {data.statusLabel} — {data.message}
          </div>
          {dl && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-[11px] text-gray-400">還需減</p>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{dl.weightToLose}</p>
                <p className="text-[11px] text-gray-400">kg</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-[11px] text-gray-400">剩餘</p>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{dl.daysLeft}</p>
                <p className="text-[11px] text-gray-400">天</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-[11px] text-gray-400">TDEE</p>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{data.estimatedTDEE || '--'}</p>
                <p className="text-[11px] text-gray-400">kcal</p>
              </div>
            </div>
          )}
          {data.refeedSuggested && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-amber-700 mb-1">
                系統偵測：可考慮安排 {data.refeedDays} 天 Refeed
              </p>
              <p className="text-xs text-amber-700">{data.refeedReason}</p>
              <p className="text-[11px] text-amber-600 mt-1">
                今日碳水提升至維持熱量（4-6g/kg），脂肪降低，蛋白質維持。
              </p>
            </div>
          )}
          {wearableInsightCard}
          {data.menstrualCycleNote && (
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <p className="text-xs text-slate-600 leading-relaxed">{data.menstrualCycleNote}</p>
            </div>
          )}
        </div>
      )
    }
    return null
  }

  const safetyColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    normal: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600' },
    aggressive: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-700' },
    extreme: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', badge: 'bg-rose-50 text-rose-600' },
  }
  const colors = safetyColors[dl.safetyLevel || 'normal'] || safetyColors.normal
  const isAheadOfSchedule = data.statusLabel === '進度超前'
  const safetyLabels: Record<string, string> = { normal: '安全範圍', aggressive: '積極模式', extreme: '極限模式' }

  // 碳循環：根據訓練日/休息日顯示不同碳水
  // 優先用 DB 教練設定值（跟 NutritionLog slider 一致），沒有才 fallback 到 engine 建議
  const dbCarbCycling = dbTargets?.carbsTrainingDay != null && dbTargets?.carbsRestDay != null
  const hasCarbCycling = dbCarbCycling || (data.suggestedCarbsTrainingDay != null && data.suggestedCarbsRestDay != null)
  const todayCarbs = dbCarbCycling
    ? (isTrainingDay ? dbTargets!.carbsTrainingDay! : dbTargets!.carbsRestDay!)
    : hasCarbCycling
      ? (isTrainingDay ? data.suggestedCarbsTrainingDay : data.suggestedCarbsRestDay)
      : data.suggestedCarbs
  const todayCalories = dbTargets?.calories ?? data.suggestedCalories

  return (
    <>
    {/* ══ 進度分頁：上台推算 / Peak Week / 代謝壓力（減脂狀態）══ */}
    {showProgress && (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
      {/* 標題 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">目標體重計畫</h2>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
          isAheadOfSchedule ? 'bg-blue-100 text-blue-700' : colors.badge
        }`}>
          {isAheadOfSchedule ? '進度超前' : safetyLabels[dl.safetyLevel || 'normal']}
        </span>
      </div>

      {/* 核心數據 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-[11px] text-gray-400">{dl.prePeakEntryWeight ? '飲食需減' : '還需減'}</p>
          <p className="text-xl font-bold text-gray-900 tabular-nums">{dl.dietWeightToLose ?? dl.weightToLose}</p>
          <p className="text-[11px] text-gray-400">kg</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-[11px] text-gray-400">剩餘天數</p>
          <p className="text-xl font-bold text-gray-900 tabular-nums">{dl.daysLeft}</p>
          <p className="text-[11px] text-gray-400">天</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-[11px] text-gray-400">每日赤字</p>
          <p className={`text-xl font-bold tabular-nums ${dl.requiredDailyDeficit > 750 ? 'text-rose-600' : dl.requiredDailyDeficit > 500 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {dl.requiredDailyDeficit}
          </p>
          <p className="text-[11px] text-gray-400">kcal</p>
        </div>
      </div>

      {/* Peak Week 體重拆分（備賽專用） */}
      {dl.prePeakEntryWeight && dl.peakWeekExpectedLoss && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
          <p className="text-[11px] font-semibold text-slate-600 mb-1.5">Peak Week 體重拆分</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-[11px] text-gray-400">PW 入場目標</p>
              <p className="font-bold text-slate-900 tabular-nums">{dl.prePeakEntryWeight} kg</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">PW 預估可脫</p>
              <p className="font-bold text-slate-900 tabular-nums">-{dl.peakWeekExpectedLoss} kg</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">上台目標</p>
              <p className="font-bold text-gray-900 tabular-nums">{targetWeightValue ? `${targetWeightValue} kg` : '—'}</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 text-center">
            水分操作預估（{Math.round((dl.peakWeekWaterCutPct || 0.02) * 100)}% BW），實際依個人反應調整
          </p>
        </div>
      )}

      {/* 代謝壓力分數 — 減脂跑道（永遠顯示，含「翻牌條件」讓人看得到何時該回碳）*/}
      {data.metabolicStress && (() => {
        const ms = data.metabolicStress
        const isLow = ms.level === 'low'
        const toRefeed = Math.max(0, 45 - ms.score)
        const box = ms.level === 'high' ? 'bg-rose-50 border border-rose-200'
          : ms.level === 'elevated' ? 'bg-amber-50 border border-amber-200'
          : ms.level === 'moderate' ? 'bg-amber-50 border border-amber-200'
          : 'bg-emerald-50 border border-emerald-200'
        const titleColor = ms.level === 'high' ? 'text-rose-600'
          : ms.level === 'elevated' ? 'text-amber-700'
          : ms.level === 'moderate' ? 'text-amber-700'
          : 'text-emerald-600'
        const badge = ms.level === 'high' ? 'bg-rose-50 text-rose-600'
          : ms.level === 'elevated' ? 'bg-amber-50 text-amber-700'
          : ms.level === 'moderate' ? 'bg-amber-50 text-amber-700'
          : 'bg-emerald-50 text-emerald-600'
        const badgeText = ms.level === 'high' ? '偏高'
          : ms.level === 'elevated' ? '中高'
          : ms.level === 'moderate' ? '監控中'
          : '穩定'
        return (
        <div className={`rounded-xl p-3 mb-3 ${box}`}>
          <div className="flex items-center justify-between mb-1">
            <p className={`text-xs font-bold ${titleColor}`}>
              <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${ms.level === 'high' ? 'bg-rose-500' : isLow ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              代謝壓力：<span className="tabular-nums">{ms.score}</span>/100
            </p>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badge}`}>
              {badgeText}
            </span>
          </div>
          {/* 五維度 bar */}
          <div className="grid grid-cols-5 gap-1 mb-2">
            {[
              { label: '飲食', value: ms.breakdown.dietDuration, max: 25 },
              { label: '恢復', value: ms.breakdown.recovery, max: 30 },
              { label: '停滯', value: ms.breakdown.plateau, max: 20 },
              { label: '低碳', value: ms.breakdown.lowCarb, max: 15 },
              { label: '狀態', value: ms.breakdown.wellnessTrend, max: 10 },
            ].map(({ label, value, max }) => (
              <div key={label} className="text-center">
                <div className="w-full bg-slate-100 rounded-full h-1 mb-0.5">
                  <div className={`h-1 rounded-full ${value / max >= 0.7 ? 'bg-rose-400' : value / max >= 0.4 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.round(value / max * 100)}%` }} />
                </div>
                <p className="text-[11px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>
          {/* 建議句：continue / monitor 也明確說出來，不再讓人「不知道壓到何時」*/}
          <p className="text-[11px] text-gray-600 leading-relaxed">
            {ms.recommendation === 'continue' && '目前維持即可 — 壓力低、減脂節奏健康，安心繼續。'}
            {ms.recommendation === 'monitor' && '持續監控中 — 壓力中等但尚未到回碳門檻。'}
            {ms.recommendation === 'refeed_1day' && `建議安排 1 天 strategic refeed（碳水 ${ms.refeedCarbGPerKg}g/kg，脂肪壓低，蛋白質維持）`}
            {ms.recommendation === 'refeed_2day' && `建議安排 2 天 full refeed（碳水 ${ms.refeedCarbGPerKg}g/kg，恢復 leptin 與甲狀腺）`}
            {ms.recommendation === 'diet_break' && '建議安排 3-5 天 diet break（維持熱量，高碳水，恢復荷爾蒙和代謝率）'}
          </p>
          {/* 翻牌條件：還沒到回碳時，收進 details，點開才看細節 */}
          {(ms.recommendation === 'continue' || ms.recommendation === 'monitor') && (
            <details className="mt-2 pt-2 border-t border-slate-200">
              <summary className="text-[11px] text-gray-500 cursor-pointer select-none">
                距離建議回碳還差 <span className="font-bold text-gray-700">{toRefeed}</span> 分 · 觸發條件
              </summary>
              <p className="text-[11px] text-gray-500 leading-relaxed mt-1.5">
                會在以下任一情況觸發：連續停滯 ≥2 週、近 7 天能量平均 ≤2.5、連續低碳(&lt;150g) ≥5 天、或減脂滿 12 週。
              </p>
            </details>
          )}
        </div>
        )
      })()}

      {/* 預測結果 */}
      {dl.predictedCompWeight && (() => {
        const compareTarget = dl.prePeakEntryWeight || targetWeightValue || 0
        const canReach = dl.predictedCompWeight <= compareTarget + 0.5
        const hasPeakSplit = !!dl.prePeakEntryWeight
        return (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
            canReach ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {canReach
              ? `預測${hasPeakSplit ? ' PW 入場' : '比賽日'} ${dl.predictedCompWeight}kg${hasPeakSplit && targetWeightValue ? `（PW 後 → ${targetWeightValue}kg）` : ''} — 可以達標！`
              : `預測${hasPeakSplit ? ' PW 入場' : '比賽日'} ${dl.predictedCompWeight}kg — 與${hasPeakSplit ? '入場目標' : '目標'}還差 ${(dl.predictedCompWeight - compareTarget).toFixed(1)}kg`
            }
          </div>
        )
      })()}

      {/* Refeed 建議 */}
      {data.refeedSuggested && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-amber-700 mb-1">
            系統偵測：可考慮安排 {data.refeedDays} 天 Refeed
          </p>
          <p className="text-xs text-amber-700">{data.refeedReason}</p>
          <p className="text-[11px] text-amber-600 mt-1">
            今日碳水提升至維持熱量（4-6g/kg），脂肪降低，蛋白質維持。
          </p>
        </div>
      )}

      {/* 穿戴裝置恢復回饋 */}
      {wearableInsightCard}

      {/* Energy Availability (RED-S) 警告 */}
      {data.energyAvailability && data.energyAvailability.level !== 'adequate' && (
        <div className={`mt-3 rounded-2xl p-4 ${
          data.energyAvailability.level === 'critical'
            ? 'bg-rose-50 border border-rose-200'
            : 'bg-amber-50 border border-amber-200'
        }`}>
          <p className={`text-xs font-medium mb-1 ${
            data.energyAvailability.level === 'critical' ? 'text-rose-600' : 'text-amber-700'
          }`}>
            能量可用性：{data.energyAvailability.eaKcalPerKgFFM} kcal/kg FFM/day
          </p>
          <p className={`text-[11px] leading-relaxed ${
            data.energyAvailability.level === 'critical' ? 'text-rose-600' : 'text-amber-600'
          }`}>{data.energyAvailability.warning}</p>
        </div>
      )}

      {/* 月經週期提示 */}
      {data.menstrualCycleNote && (
        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-600 leading-relaxed">{data.menstrualCycleNote}</p>
        </div>
      )}

      {/* 警告 — 過合規 backstop（命中診斷/疾病名的逐條降級成安全句，備賽學員不再看到越界字）
          長句小字牆收進 details：summary 一行講重點，預設收合；逐行 emoji 前綴（🔄💡🧪💊🔧ℹ️⚠️）render 端剝掉
          （字串來源 lib/nutrition-engine 也供週訊/其他端使用，不動 lib 本文） */}
      {data.warnings && data.warnings.length > 0 && (
        <details className="mt-3">
          <summary className="text-[11px] text-gray-500 cursor-pointer select-none">
            系統提醒 · {Math.min(data.warnings.length, 5)} 項
          </summary>
          <div className="mt-2 space-y-2">
            {data.warnings.slice(0, 5).map((w: string, i: number) => (
              <p key={i} className="text-[11px] text-gray-500 leading-relaxed">
                {degradeToSafe(w).text.replace(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\s]+/u, '')}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
    )}

    {/* ══ 計畫分頁：今日飲食處方 / 分餐蛋白 / 活動量 / 血檢建議 ══ */}
    {showPlan && (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
      {/* 標題 */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">今日營養處方</h2>

      {/* 血檢就緒警告橫幅（血檢異常時提醒，不擋建議） */}
      {gateWarningBanner}

      {/* 飲食目標 */}
      <div className={`${colors.bg} ${colors.border} border rounded-2xl p-4 mb-3`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-700">今日飲食目標</p>
          {hasCarbCycling && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              isTrainingDay ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {isTrainingDay ? '訓練日' : '休息日'}
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '熱量', value: todayCalories, unit: 'kcal' },
            { label: '蛋白質', value: dbTargets?.protein ?? data.suggestedProtein, unit: 'g' },
            { label: '碳水', value: todayCarbs, unit: 'g' },
            { label: '脂肪', value: dbTargets?.fat ?? data.suggestedFat, unit: 'g' },
          ].map(({ label, value, unit }) => (
            <div key={label} className="text-center bg-slate-50 rounded-xl py-2 px-1">
              <p className="text-[11px] text-gray-500">{label}</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums">{value || '--'}</p>
              <p className="text-[11px] text-gray-400">{unit}</p>
            </div>
          ))}
        </div>
        {hasCarbCycling && (
          <p className="text-[11px] text-gray-400 mt-2 text-center">
            {(() => {
              const tDay = dbCarbCycling ? dbTargets!.carbsTrainingDay! : data.suggestedCarbsTrainingDay
              const rDay = dbCarbCycling ? dbTargets!.carbsRestDay! : data.suggestedCarbsRestDay
              return tDay === rDay
                ? `碳水 ${tDay}g（碳水偏低，暫停碳循環）`
                : `碳水循環：訓練日 ${tDay}g ／ 休息日 ${rDay}g`
            })()}
          </p>
        )}
      </div>

      {/* 分餐蛋白質指引 */}
      {data.perMealProteinGuide && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
          <p className="text-xs font-semibold text-amber-700">分餐蛋白質指引</p>
          <p className="text-sm text-amber-900 mt-1">
            每餐 {data.perMealProteinGuide.perMealGrams.min}-{data.perMealProteinGuide.perMealGrams.max}g，
            分 {data.perMealProteinGuide.mealsPerDay.min}-{data.perMealProteinGuide.mealsPerDay.max} 餐
          </p>
          <p className="text-[11px] text-amber-600 mt-1">{data.perMealProteinGuide.periWorkoutNote}</p>
        </div>
      )}

      {/* 有氧 / 步數參考 */}
      {(dl.suggestedCardioMinutes > 0 || dl.suggestedDailySteps > 0) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
          <p className="text-xs font-semibold text-slate-600 mb-2">活動量參考</p>
          <div className="grid grid-cols-2 gap-3">
            {dl.suggestedCardioMinutes > 0 && (
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-[11px] text-gray-500">有氧</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{dl.suggestedCardioMinutes}</p>
                <p className="text-[11px] text-gray-400">分鐘/天</p>
                <p className="text-[11px] text-gray-400 mt-0.5">中等強度</p>
              </div>
            )}
            {dl.suggestedDailySteps > 0 && (
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-[11px] text-gray-500">步數</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{dl.suggestedDailySteps?.toLocaleString()}</p>
                <p className="text-[11px] text-gray-400">步/天</p>
                <p className="text-[11px] text-gray-400 mt-0.5">含日常活動</p>
              </div>
            )}
          </div>
          {dl.extraCardioNeeded && dl.extraBurnPerDay > 0 && (
            <p className="text-[11px] text-slate-500 mt-2 text-center">
              飲食面不足，需透過活動額外消耗 {dl.extraBurnPerDay} kcal/天
            </p>
          )}
          {dl.cardioNote && (
            <p className="text-[11px] text-gray-500 mt-1 text-center">{dl.cardioNote}</p>
          )}
        </div>
      )}

      {/* 血檢驅動的營養調整 */}
      {data.labMacroModifiers && data.labMacroModifiers.length > 0 && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-xs font-medium text-blue-700 mb-2">血檢指標建議</p>
          <div className="space-y-1">
            {data.labMacroModifiers.map((mod: any, i: number) => (
              <p key={i} className="text-[11px] text-blue-600 leading-relaxed">
                {mod.reason}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 血檢複檢提醒 */}
      {data.cuttingReadinessGate?.labRetestReminder && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-2xl p-3">
          <p className="text-xs text-blue-700 leading-relaxed">{data.cuttingReadinessGate.labRetestReminder}</p>
        </div>
      )}
    </div>
    )}
    </>
  )
}
