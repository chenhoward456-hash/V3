'use client'

import { useState, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'

interface WearableImportProps {
  clientId: string
  onImported: () => void
}

type Format = 'garmin' | 'apple' | 'json'

const FORMAT_OPTIONS: { value: Format; label: string; desc: string; accept: string }[] = [
  { value: 'garmin', label: '⌚ Garmin Connect', desc: 'CSV 匯出檔', accept: '.csv' },
  { value: 'apple', label: '🍎 Apple 健康', desc: 'CSV 匯出（需第三方 app）', accept: '.csv' },
  { value: 'json', label: '📋 JSON 格式', desc: '通用 JSON 陣列', accept: '.json' },
]

export default function WearableImport({ clientId, onImported }: WearableImportProps) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<Format>('garmin')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const selectedFormat = FORMAT_OPTIONS.find(f => f.value === format)!

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)

    // 讀取並預覽
    try {
      const text = await f.text()
      const res = await fetch('/api/wearable-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, format, data: text, preview: true }),
      })

      // 即使是錯誤也需要解析來做預覽
      // 我們先自行做簡單預覽
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

      <p className="text-[10px] text-gray-400 text-center">
        匯入只會更新穿戴裝置數據，不會覆蓋你手動填寫的每日感受
      </p>
    </div>
  )
}
