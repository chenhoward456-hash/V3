'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui/Toast'

interface WearableImportProps {
  clientId: string
  onImported: () => void
}

type Format = 'garmin' | 'apple' | 'json'
type ImportMode = 'direct' | 'csv'

const FORMAT_OPTIONS: { value: Format; label: string; desc: string; accept: string }[] = [
  { value: 'garmin', label: '⌚ Garmin Connect', desc: 'CSV 匯出檔', accept: '.csv' },
  { value: 'apple', label: '🍎 Apple 健康', desc: 'CSV 匯出（需第三方 app）', accept: '.csv' },
  { value: 'json', label: '📋 JSON 格式', desc: '通用 JSON 陣列', accept: '.json' },
]

interface GarminStatus {
  configured: boolean
  connected: boolean
  lastSyncAt: string | null
  connectedAt: string | null
}

export default function WearableImport({ clientId, onImported }: WearableImportProps) {
  const [open, setOpen] = useState(false)
  const [importMode, setImportMode] = useState<ImportMode>('direct')
  const [format, setFormat] = useState<Format>('garmin')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  // Garmin direct connect state
  const [garminStatus, setGarminStatus] = useState<GarminStatus | null>(null)
  const [garminLoading, setGarminLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncDays, setSyncDays] = useState(30)

  const selectedFormat = FORMAT_OPTIONS.find(f => f.value === format)!

  // 檢查 Garmin 連線狀態
  const checkGarminStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/garmin/status?clientId=${clientId}`)
      if (res.ok) {
        const data = await res.json()
        setGarminStatus(data)
        // 如果 Garmin API 有設定，預設使用直接連線模式
        if (data.configured) {
          setImportMode('direct')
        } else {
          setImportMode('csv')
        }
      }
    } catch {
      // 靜默失敗，fallback 到 CSV 模式
      setImportMode('csv')
    }
  }, [clientId])

  useEffect(() => {
    if (open) {
      checkGarminStatus()
    }
  }, [open, checkGarminStatus])

  // 處理 Garmin callback 的 URL 參數
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const garminStatusParam = params.get('garmin_status')
    const garminMessage = params.get('garmin_message')

    if (garminStatusParam && garminMessage) {
      if (garminStatusParam === 'success') {
        showToast(garminMessage, 'success')
        setOpen(true)
        checkGarminStatus()
      } else {
        showToast(garminMessage, 'error')
      }
      // 清除 URL 參數
      const url = new URL(window.location.href)
      url.searchParams.delete('garmin_status')
      url.searchParams.delete('garmin_message')
      window.history.replaceState({}, '', url.toString())
    }
  }, [showToast, checkGarminStatus])

  // Garmin 直接連線
  const handleGarminConnect = async () => {
    setGarminLoading(true)
    try {
      const res = await fetch('/api/garmin/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || '連線失敗', 'error')
        return
      }

      // 導向 Garmin 授權頁面
      window.location.href = data.authorizeUrl
    } catch {
      showToast('連線 Garmin 失敗，請稍後再試', 'error')
    } finally {
      setGarminLoading(false)
    }
  }

  // Garmin 同步數據
  const handleGarminSync = async () => {
    setSyncing(true)
    setResult(null)
    try {
      const res = await fetch('/api/garmin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, days: syncDays }),
      })
      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || '同步失敗', 'error')
        if (data.needReconnect) {
          setGarminStatus(prev => prev ? { ...prev, connected: false } : null)
        }
        return
      }

      setResult({ imported: data.imported, skipped: 0 })
      if (data.imported > 0) {
        showToast(`成功同步 ${data.imported} 天 Garmin 數據`, 'success')
        onImported()
      } else {
        showToast('沒有找到新的數據', 'info')
      }
      checkGarminStatus() // 更新 lastSyncAt
    } catch {
      showToast('同步失敗，請稍後再試', 'error')
    } finally {
      setSyncing(false)
    }
  }

  // 解除 Garmin 連線
  const handleGarminDisconnect = async () => {
    try {
      const res = await fetch('/api/garmin/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })

      if (res.ok) {
        showToast('已解除 Garmin 連線', 'success')
        setGarminStatus(prev => prev ? { ...prev, connected: false, lastSyncAt: null } : null)
        setResult(null)
      }
    } catch {
      showToast('操作失敗', 'error')
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)

    // 讀取並預覽
    try {
      const text = await f.text()

      if (format === 'json') {
        const parsed = JSON.parse(text)
        const arr = Array.isArray(parsed) ? parsed : parsed.data || parsed.rows || []
        setPreview(arr.slice(0, 5))
      } else {
        // CSV 預覽前 5 行
        const lines = text.split('\n').filter((l: string) => l.trim())
        const headers = lines[0]?.split(',').map((h: string) => h.trim()) || []
        const previewRows = lines.slice(1, 6).map((line: string) => {
          const vals = line.split(',').map((v: string) => v.trim())
          const row: Record<string, string> = {}
          headers.forEach((h: string, i: number) => { row[h] = vals[i] || '' })
          return row
        })
        setPreview(previewRows)
      }
    } catch {
      setPreview(null)
    }
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    setResult(null)

    try {
      const text = await file.text()
      const res = await fetch('/api/wearable-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, format, data: text }),
      })

      const json = await res.json()

      if (!res.ok) {
        showToast(json.error || '匯入失敗', 'error')
        if (json.detail) {
          showToast(json.detail, 'error')
        }
        return
      }

      setResult({ imported: json.imported, skipped: json.skipped })
      showToast(`成功匯入 ${json.imported} 天數據`, 'success')
      onImported()
    } catch {
      showToast('匯入失敗，請重試', 'error')
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const formatLastSync = (isoStr: string | null) => {
    if (!isoStr) return null
    const d = new Date(isoStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return '剛剛'
    if (diffMin < 60) return `${diffMin} 分鐘前`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr} 小時前`
    const diffDay = Math.floor(diffHr / 24)
    return `${diffDay} 天前`
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2.5 text-sm text-purple-600 font-medium bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors"
      >
        📥 匯入穿戴裝置歷史數據 <span className="text-gray-400 text-xs">（Garmin / Apple Health）</span>
      </button>
    )
  }

  return (
    <div className="border-2 border-purple-200 rounded-2xl p-4 bg-purple-50/30 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-purple-800">📥 匯入穿戴裝置數據</h3>
        <button
          onClick={() => { setOpen(false); reset() }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          ✕ 關閉
        </button>
      </div>

      {/* 匯入模式選擇 */}
      {garminStatus?.configured && (
        <div className="flex gap-2">
          <button
            onClick={() => setImportMode('direct')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              importMode === 'direct'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-purple-50'
            }`}
          >
            🔗 直接連線
          </button>
          <button
            onClick={() => setImportMode('csv')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              importMode === 'csv'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-purple-50'
            }`}
          >
            📄 上傳檔案
          </button>
        </div>
      )}

      {/* ===== 直接連線模式 ===== */}
      {importMode === 'direct' && garminStatus?.configured && (
        <div className="space-y-3">
          {garminStatus.connected ? (
            <>
              {/* 已連線狀態 */}
              <div className="bg-green-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-green-700">Garmin 已連線</span>
                  </div>
                  <button
                    onClick={handleGarminDisconnect}
                    className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                  >
                    解除連線
                  </button>
                </div>
                {garminStatus.lastSyncAt && (
                  <p className="text-[10px] text-green-600">
                    上次同步：{formatLastSync(garminStatus.lastSyncAt)}
                  </p>
                )}
              </div>

              {/* 同步選項 */}
              <div className="bg-white rounded-xl p-3 space-y-3">
                <p className="text-xs font-medium text-gray-600">同步範圍：</p>
                <div className="flex gap-2">
                  {[7, 30, 90].map(d => (
                    <button
                      key={d}
                      onClick={() => setSyncDays(d)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        syncDays === d
                          ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {d} 天
                    </button>
                  ))}
                </div>
              </div>

              {/* 同步結果 */}
              {result && (
                <div className="bg-green-50 rounded-xl p-3 text-sm">
                  <p className="text-green-700 font-medium">
                    ✅ 成功同步 {result.imported} 天的數據
                  </p>
                </div>
              )}

              {/* 同步按鈕 */}
              <button
                onClick={handleGarminSync}
                disabled={syncing}
                className="w-full bg-purple-600 text-white py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {syncing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    同步中...
                  </>
                ) : (
                  <>🔄 一鍵同步 Garmin 數據</>
                )}
              </button>
            </>
          ) : (
            <>
              {/* 未連線 — 引導授權 */}
              <div className="bg-white rounded-xl p-4 space-y-3 text-center">
                <div className="text-3xl">⌚</div>
                <p className="text-sm font-medium text-gray-700">連線你的 Garmin 帳號</p>
                <p className="text-xs text-gray-400">
                  授權後即可一鍵同步數據，不需要手動匯出 CSV
                </p>
                <button
                  onClick={handleGarminConnect}
                  disabled={garminLoading}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {garminLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      連線中...
                    </>
                  ) : (
                    <>🔗 連線 Garmin Connect</>
                  )}
                </button>
                <p className="text-[10px] text-gray-400">
                  將會導向 Garmin 授權頁面，完成後自動返回
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== CSV 上傳模式 ===== */}
      {(importMode === 'csv' || !garminStatus?.configured) && (
        <>
          {/* 格式選擇 */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">選擇數據來源：</p>
            <div className="flex gap-2">
              {FORMAT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setFormat(opt.value); reset() }}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-center transition-all ${
                    format === opt.value
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-purple-100 border border-gray-200'
                  }`}
                >
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className={`block text-[10px] mt-0.5 ${format === opt.value ? 'text-purple-200' : 'text-gray-400'}`}>
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 操作說明 */}
          <div className="bg-white rounded-xl p-3 text-xs text-gray-500 space-y-1">
            {format === 'garmin' && (
              <>
                <p className="font-medium text-gray-700">如何匯出 Garmin 數據：</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>登入 <span className="font-medium">connect.garmin.com</span></li>
                  <li>進入「健康統計」或「報告」頁面</li>
                  <li>選擇日期範圍，點擊「匯出」→ CSV</li>
                  <li>上傳匯出的 CSV 檔案到這裡</li>
                </ol>
              </>
            )}
            {format === 'apple' && (
              <>
                <p className="font-medium text-gray-700">如何匯出 Apple 健康數據：</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>安裝「Health Auto Export」或「QS Access」app</li>
                  <li>選擇要匯出的指標（心率、HRV、睡眠、呼吸）</li>
                  <li>匯出為 CSV 格式</li>
                  <li>上傳到這裡</li>
                </ol>
              </>
            )}
            {format === 'json' && (
              <>
                <p className="font-medium text-gray-700">JSON 格式範例：</p>
                <pre className="bg-gray-50 rounded p-2 text-[10px] overflow-x-auto">
{`[
  {
    "date": "2024-03-01",
    "body_battery": 75,
    "resting_hr": 52,
    "hrv": 85,
    "sleep_score": 82,
    "respiratory_rate": 14.5
  }
]`}
                </pre>
              </>
            )}
          </div>

          {/* 檔案上傳 */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept={selectedFormat.accept}
              onChange={handleFileChange}
              className="hidden"
              id="wearable-file"
            />
            <label
              htmlFor="wearable-file"
              className="block w-full py-4 border-2 border-dashed border-purple-300 rounded-xl text-center cursor-pointer hover:bg-purple-50 transition-colors"
            >
              {file ? (
                <span className="text-sm text-purple-700 font-medium">
                  📄 {file.name} <span className="text-gray-400 font-normal">({(file.size / 1024).toFixed(1)} KB)</span>
                </span>
              ) : (
                <span className="text-sm text-gray-400">
                  點擊選擇 {selectedFormat.accept.toUpperCase().replace('.', '')} 檔案
                </span>
              )}
            </label>
          </div>

          {/* 預覽 */}
          {preview && preview.length > 0 && (
            <div className="bg-white rounded-xl p-3 overflow-x-auto">
              <p className="text-xs font-medium text-gray-600 mb-2">數據預覽（前 {preview.length} 筆）：</p>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {Object.keys(preview[0]).slice(0, 6).map(key => (
                      <th key={key} className="text-left py-1 px-1 text-gray-500 font-medium">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Object.values(row).slice(0, 6).map((val, j) => (
                        <td key={j} className="py-1 px-1 text-gray-700">{String(val ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 匯入結果 */}
          {result && (
            <div className="bg-green-50 rounded-xl p-3 text-sm">
              <p className="text-green-700 font-medium">
                ✅ 成功匯入 {result.imported} 天的數據
              </p>
              {result.skipped > 0 && (
                <p className="text-amber-600 text-xs mt-1">
                  ⚠️ {result.skipped} 筆跳過（格式錯誤或範圍外）
                </p>
              )}
            </div>
          )}

          {/* 匯入按鈕 */}
          {file && !result && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-purple-600 text-white py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-40"
            >
              {importing ? '匯入中...' : '確認匯入'}
            </button>
          )}

          {result && (
            <button
              onClick={reset}
              className="w-full bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              匯入另一個檔案
            </button>
          )}
        </>
      )}

      <p className="text-[10px] text-gray-400 text-center">
        匯入只會更新穿戴裝置數據，不會覆蓋你手動填寫的每日感受
      </p>
    </div>
  )
}
