'use client'

import type { Client } from '@/hooks/useClientData'
import { Lock, Unlock, ChevronLeft, ChevronRight, ChevronDown, Settings } from 'lucide-react'
import { isCompetitionMode, BODYBUILDING_PHASE_OPTIONS, ATHLETIC_PHASE_OPTIONS, PHASE_LABELS as ALL_PHASE_LABELS } from '@/lib/client-mode'
import { getLocalDateStr, daysUntilDateTW } from '@/lib/date-utils'
import { trackEvent } from '@/lib/analytics'

const PHASE_LABELS = ALL_PHASE_LABELS

interface ClientHeaderProps {
  client: Client
  isCoachMode: boolean
  selectedDate: string
  isToday: boolean
  today: string
  tomorrow: string
  isCompetition: boolean
  isFree: boolean
  showSettings: boolean
  setShowSettings: (v: boolean) => void
  showPinPopover: boolean
  pinInput: string
  pinError: boolean
  setPinInput: (v: string) => void
  handlePinSubmit: () => void
  onDateChange: (offset: number) => void
  onDateSelect: (date: string) => void
  onToggleCoachMode: () => void
  onToggleFeature: (key: string) => void
  showPhaseSelector: boolean
  setShowPhaseSelector: (v: boolean) => void
  updatingPhase: boolean
  onPrepPhaseChange: (phase: string) => void
  showCancelConfirm: boolean
  setShowCancelConfirm: (v: boolean) => void
  cancellingSubscription: boolean
  onCancelSubscription: () => void
}

export default function ClientHeader({
  client: c,
  isCoachMode,
  selectedDate,
  isToday,
  today,
  tomorrow,
  isCompetition,
  isFree,
  showSettings,
  setShowSettings,
  showPinPopover,
  pinInput,
  pinError,
  setPinInput,
  handlePinSubmit,
  onDateChange,
  onDateSelect,
  onToggleCoachMode,
  onToggleFeature,
  showPhaseSelector,
  setShowPhaseSelector,
  updatingPhase,
  onPrepPhaseChange,
  showCancelConfirm,
  setShowCancelConfirm,
  cancellingSubscription,
  onCancelSubscription,
}: ClientHeaderProps) {
  const formatSelectedDate = (dateStr: string) => {
    if (dateStr === today) return '今天'
    if (dateStr === tomorrow) return '明天'
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (dateStr === getLocalDateStr(yesterday)) return '昨天'
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })
  }

  return (
    <>
      {/* 標題 + 頭像 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {c.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{c.name}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              c.status === 'normal' ? 'bg-green-100 text-green-700'
              : c.status === 'attention' ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
            }`}>
              {c.status === 'normal' ? '● 狀態良好' : '● 需要關注'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-full transition-colors text-gray-400 hover:bg-gray-100"
            >
              <Settings size={18} />
            </button>
            {showSettings && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border p-4 z-50 w-64 max-h-[70vh] overflow-y-auto">
                <p className="text-xs font-semibold text-gray-500 mb-3">功能設定</p>

                {/* 簡單模式 */}
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">簡單模式</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">只顯示核心欄位</p>
                  </div>
                  <button
                    onClick={() => !isFree && onToggleFeature('simple_mode')}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                      c.simple_mode ? 'bg-blue-500' : 'bg-gray-300'
                    } ${isFree ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      c.simple_mode ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="border-t border-gray-100 my-3" />
                <p className="text-[10px] text-gray-400 mb-2">{isFree ? '免費版預設功能' : '不需要的功能可以關掉'}</p>

                {/* 功能開關 */}
                {([
                  { key: 'body_composition_enabled', label: '體重/體態', icon: '⚖️' },
                  { key: 'nutrition_enabled', label: '飲食追蹤', icon: '🥗' },
                  { key: 'wellness_enabled', label: '每日感受', icon: '😊' },
                  { key: 'training_enabled', label: '訓練追蹤', icon: '🏋️' },
                  { key: 'supplement_enabled', label: '補品管理', icon: '💊' },
                  { key: 'lab_enabled', label: '血檢追蹤', icon: '🩸' },
                  { key: 'ai_chat_enabled', label: 'AI 顧問', icon: '🤖' },
                ] as const).map(({ key, label, icon }) => {
                  const FREE_LOCKED_ON = ['body_composition_enabled', 'nutrition_enabled'] as const
                  const isLockedOn = isFree && (FREE_LOCKED_ON as readonly string[]).includes(key)
                  const isLockedOff = isFree && !(FREE_LOCKED_ON as readonly string[]).includes(key)

                  return (
                    <div key={key} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-700">
                        {icon} {label}
                        {isLockedOn && <span className="text-[10px] text-gray-400 ml-1">預設</span>}
                        {isLockedOff && <span className="text-[10px] text-gray-400 ml-1">🔒</span>}
                      </span>
                      <button
                        onClick={() => {
                          if (isLockedOn) return
                          if (isLockedOff) {
                            trackEvent('upgrade_cta_clicked', { feature: label, source: 'feature_toggle' })
                            window.location.href = `/upgrade?from=free&feature=${encodeURIComponent(label)}`
                            return
                          }
                          onToggleFeature(key)
                        }}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                          !!(c as Record<string, unknown>)[key] ? 'bg-blue-500' : 'bg-gray-300'
                        } ${isLockedOn ? 'opacity-50 cursor-not-allowed' : ''} ${isLockedOff ? 'opacity-40 cursor-pointer' : ''}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          !!(c as Record<string, unknown>)[key] ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  )
                })}

                {/* 電子報訂閱 */}
                <div className="border-t border-gray-100 my-3" />
                <div className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-sm text-gray-700">📬 每週電子報</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">每週收到最新訓練與營養文章</p>
                  </div>
                  <button
                    onClick={() => onToggleFeature('email_newsletter_opt_in')}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                      c.email_newsletter_opt_in ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      c.email_newsletter_opt_in ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* 取消訂閱 */}
                {c.subscription_tier !== 'free' && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {!showCancelConfirm ? (
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        取消定期定額
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-red-600 font-medium">確定要取消嗎？</p>
                        <p className="text-[10px] text-gray-500">
                          取消後不再自動扣款{c.expires_at ? `，帳號可使用至 ${new Date(c.expires_at).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}。所有數據會保留。
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={onCancelSubscription}
                            disabled={cancellingSubscription}
                            className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            {cancellingSubscription ? '處理中...' : '確認取消'}
                          </button>
                          <button
                            onClick={() => setShowCancelConfirm(false)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            返回
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={onToggleCoachMode}
              className={`p-2 rounded-full transition-colors ${isCoachMode ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:bg-gray-100'}`}
            >
              {isCoachMode ? <Unlock size={18} /> : <Lock size={18} />}
            </button>
            {showPinPopover && !isCoachMode && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border p-3 z-50 w-48">
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                  placeholder="輸入教練密碼"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${pinError ? 'border-red-400' : 'border-gray-300'}`}
                  autoFocus
                />
                {pinError && <p className="text-xs text-red-500 mt-1">密碼錯誤</p>}
                <button onClick={handlePinSubmit} className="w-full mt-2 bg-blue-600 text-white py-1.5 rounded-lg text-sm hover:bg-blue-700">解鎖</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 日期導航 */}
      <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-3 py-2 mb-3">
        <button onClick={() => onDateChange(-1)} className="p-1.5 rounded-full hover:bg-gray-200 transition-colors text-gray-500">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center relative">
          <button
            onClick={() => {
              const picker = document.getElementById('date-picker') as HTMLInputElement
              if (picker) { picker.showPicker?.(); picker.focus() }
            }}
            className={`text-sm font-semibold px-3 py-1 rounded-full transition-colors ${isToday ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
          >
            {formatSelectedDate(selectedDate)}
          </button>
          {(() => {
            const isPeakWeekNav = isCompetition && (c.prep_phase === 'peak_week' || c.prep_phase === 'competition')
            const maxDate = isPeakWeekNav ? tomorrow : today
            return (
              <input
                id="date-picker"
                type="date"
                value={selectedDate}
                max={maxDate}
                onChange={(e) => {
                  if (e.target.value && e.target.value <= maxDate) onDateSelect(e.target.value)
                }}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
            )
          })()}
          {!isToday && (
            <p className="text-xs text-gray-400 pointer-events-none">{new Date(selectedDate).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}</p>
          )}
        </div>
        <button
          onClick={() => onDateChange(1)}
          disabled={isCompetition && (c.prep_phase === 'peak_week' || c.prep_phase === 'competition') ? selectedDate >= tomorrow : isToday}
          className="p-1.5 rounded-full hover:bg-gray-200 transition-colors text-gray-500 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* 明日預覽 Banner */}
      {selectedDate > today && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 mb-3 flex items-center gap-2">
          <span className="text-base">🔮</span>
          <p className="text-sm font-semibold text-indigo-700">明日預覽模式</p>
          <p className="text-xs text-indigo-500 ml-auto">查看明天的 Peak Week 計畫</p>
        </div>
      )}

      {/* 備賽倒數 Banner */}
      {isCompetition && c.competition_date && (() => {
        const daysLeft = daysUntilDateTW(c.competition_date)
        const phase = c.prep_phase || 'off_season'
        const urgencyColor = daysLeft <= 7 ? 'from-red-500 to-red-600' : daysLeft <= 14 ? 'from-amber-500 to-orange-500' : daysLeft <= 30 ? 'from-amber-400 to-yellow-500' : 'from-blue-500 to-blue-600'
        const urgencyBg = daysLeft <= 7 ? 'bg-red-50 border-red-200' : daysLeft <= 14 ? 'bg-amber-50 border-amber-200' : daysLeft <= 30 ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'
        return (
          <div className={`${urgencyBg} border rounded-2xl p-4 mb-3`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🏆</span>
                  <button
                    onClick={() => setShowPhaseSelector(!showPhaseSelector)}
                    className={`px-2 py-0.5 text-xs font-bold rounded-full text-white bg-gradient-to-r ${urgencyColor} flex items-center gap-1 transition-all active:scale-95`}
                  >
                    {PHASE_LABELS[phase] || phase}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showPhaseSelector ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(c.competition_date).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-gray-900">{Math.max(0, daysLeft)}</p>
                <p className="text-xs text-gray-500 font-medium">{daysLeft > 0 ? '天後比賽' : daysLeft === 0 ? '今天比賽！' : '已結束'}</p>
              </div>
            </div>
            {/* 階段選擇器 */}
            {showPhaseSelector && (
              <div className="mt-3 pt-3 border-t border-gray-200/60">
                <p className="text-xs text-gray-500 mb-2 font-medium">切換備賽階段</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(c.client_mode === 'athletic' ? ATHLETIC_PHASE_OPTIONS : BODYBUILDING_PHASE_OPTIONS).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => onPrepPhaseChange(opt.value)}
                      disabled={updatingPhase || opt.value === phase}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                        opt.value === phase
                          ? 'bg-gray-900 text-white shadow-sm'
                          : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-sm active:scale-95'
                      } ${updatingPhase ? 'opacity-50' : ''}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}
    </>
  )
}
