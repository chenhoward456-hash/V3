'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Trash2, Plus, Upload, FileText, Camera, Pencil } from 'lucide-react'
import { LAB_THRESHOLDS } from '@/utils/labStatus'

const KNOWN_TEST_NAMES = Object.keys(LAB_THRESHOLDS).filter(k => !k.endsWith('_female'))

interface DraftRow {
  id: string  // local-only uuid
  test_name: string
  value: string  // keep as string for input UX; parse on submit
  unit: string
  reference_range: string
  date: string
  source: 'manual' | 'csv' | 'ocr'
  isKnown?: boolean
}

function newId() { return Math.random().toString(36).slice(2, 10) }

function todayStr() { return new Date().toISOString().slice(0, 10) }

function parseCsv(text: string): Omit<DraftRow, 'id' | 'source'>[] {
  // 簡易 CSV/TSV parser：支援逗號或 tab，第一行是 header
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const delim = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(delim).map(h => h.trim().toLowerCase())
  const idx = {
    test_name: headers.findIndex(h => ['test_name', '項目', 'name', '檢測項目'].includes(h)),
    value: headers.findIndex(h => ['value', '數值', 'result'].includes(h)),
    unit: headers.findIndex(h => ['unit', '單位'].includes(h)),
    reference_range: headers.findIndex(h => ['reference_range', 'reference', '參考範圍', 'range'].includes(h)),
    date: headers.findIndex(h => ['date', '日期', '檢測日'].includes(h)),
  }
  if (idx.test_name < 0 || idx.value < 0) {
    throw new Error('CSV 第一行必須包含 test_name 和 value 欄位（或中文「項目」「數值」）')
  }
  const out: Omit<DraftRow, 'id' | 'source'>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(c => c.trim())
    const tn = cells[idx.test_name]
    const v = cells[idx.value]
    if (!tn || !v) continue
    out.push({
      test_name: tn,
      value: v,
      unit: idx.unit >= 0 ? cells[idx.unit] || '' : '',
      reference_range: idx.reference_range >= 0 ? cells[idx.reference_range] || '' : '',
      date: idx.date >= 0 ? cells[idx.date] || todayStr() : todayStr(),
      isKnown: KNOWN_TEST_NAMES.includes(tn),
    })
  }
  return out
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // 拿掉 data:xxx;base64, 前綴
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function UploadLabsPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = (params?.clientId as string) ?? ''
  const [tab, setTab] = useState<'manual' | 'csv' | 'ocr'>('manual')
  const [rows, setRows] = useState<DraftRow[]>([])
  const [saving, setSaving] = useState(false)
  const [resultMsg, setResultMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<{
    inserted: number
    skipped: number
    queuedDates: string[]
  } | null>(null)
  const [countdown, setCountdown] = useState(0)
  // 既有血檢的「每個指標最新數值」— 用於確認 OCR / 手打資料時對比
  const [previousValues, setPreviousValues] = useState<Map<string, { value: number; unit: string; date: string }>>(new Map())

  // --- manual ---
  const [m, setM] = useState({ test_name: '', value: '', unit: '', reference_range: '', date: todayStr() })

  function addManual() {
    if (!m.test_name || !m.value) {
      setResultMsg({ kind: 'err', text: '請填項目名稱與數值' })
      return
    }
    setRows(prev => [...prev, {
      id: newId(),
      test_name: m.test_name,
      value: m.value,
      unit: m.unit,
      reference_range: m.reference_range,
      date: m.date,
      source: 'manual',
      isKnown: KNOWN_TEST_NAMES.includes(m.test_name),
    }])
    setM({ test_name: '', value: '', unit: '', reference_range: '', date: m.date })
    setResultMsg(null)
  }

  // --- csv ---
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [csvLoading, setCsvLoading] = useState(false)

  async function handleCsvFile(file: File) {
    setCsvLoading(true)
    setResultMsg(null)
    try {
      const text = await file.text()
      const parsed = parseCsv(text)
      if (parsed.length === 0) {
        setResultMsg({ kind: 'err', text: '沒解析到任何資料' })
        return
      }
      setRows(prev => [...prev, ...parsed.map(p => ({ ...p, id: newId(), source: 'csv' as const }))])
      setResultMsg({ kind: 'ok', text: `從 CSV 載入 ${parsed.length} 筆，請在下方確認後儲存` })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'CSV 解析失敗'
      setResultMsg({ kind: 'err', text: msg })
    } finally {
      setCsvLoading(false)
    }
  }

  // --- ocr ---
  const ocrInputRef = useRef<HTMLInputElement>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrElapsedSec, setOcrElapsedSec] = useState(0)
  const [ocrFileCount, setOcrFileCount] = useState(0)
  const [ocrDragActive, setOcrDragActive] = useState(false)

  // OCR 計時器
  useEffect(() => {
    if (!ocrLoading) { setOcrElapsedSec(0); return }
    const start = Date.now()
    const t = setInterval(() => setOcrElapsedSec(Math.floor((Date.now() - start) / 1000)), 500)
    return () => clearInterval(t)
  }, [ocrLoading])

  // 載入既有血檢的「每個指標最新數值」— 供 preview 對比
  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/lab-results?clientId=${encodeURIComponent(clientId)}`)
        const json = await res.json()
        if (cancelled) return
        if (json?.success && Array.isArray(json.data)) {
          const map = new Map<string, { value: number; unit: string; date: string }>()
          for (const r of json.data as Array<{ test_name: string; value: string | number; unit: string | null; date: string }>) {
            const v = typeof r.value === 'string' ? parseFloat(r.value) : r.value
            if (!Number.isFinite(v)) continue
            const existing = map.get(r.test_name)
            if (!existing || r.date > existing.date) {
              map.set(r.test_name, { value: v, unit: r.unit || '', date: r.date })
            }
          }
          setPreviousValues(map)
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [clientId])

  // 儲存成功後倒數 → 跳到 timeline
  useEffect(() => {
    if (countdown <= 0) return
    if (countdown === 1) {
      // 最後一秒到 → 跳轉
      const t = setTimeout(() => router.push(`/c/${clientId}/health/timeline`), 1000)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, router, clientId])

  async function handleOcrFiles(fileList: FileList) {
    if (fileList.length === 0) return
    if (fileList.length > 5) {
      setResultMsg({ kind: 'err', text: '一次最多 5 個檔案' })
      return
    }
    setOcrFileCount(fileList.length)
    setOcrLoading(true)
    setResultMsg(null)
    try {
      const files = await Promise.all(Array.from(fileList).map(async f => {
        // 限制 size：圖檔 5MB、PDF 10MB
        const isPdf = f.type === 'application/pdf'
        const limit = isPdf ? 10 * 1024 * 1024 : 5 * 1024 * 1024
        if (f.size > limit) {
          throw new Error(`${f.name} 超過大小上限（${isPdf ? '10MB' : '5MB'}）`)
        }
        return { mediaType: f.type, data: await fileToBase64(f) }
      }))
      const res = await fetch('/api/lab-results/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, files }),
      })
      const json = await res.json()
      if (!json.success) {
        setResultMsg({ kind: 'err', text: json.error || 'OCR 失敗' })
        return
      }
      const ocrRows = (json.data.rows as { test_name: string; value: number; unit?: string; reference_range?: string; date?: string; isKnown?: boolean }[])
        .map(r => ({
          id: newId(),
          test_name: r.test_name,
          value: String(r.value),
          unit: r.unit || '',
          reference_range: r.reference_range || '',
          date: r.date || todayStr(),
          source: 'ocr' as const,
          isKnown: r.isKnown,
        }))
      if (ocrRows.length === 0) {
        setResultMsg({ kind: 'err', text: 'AI 沒能從檔案中萃取出可辨識的血檢數值' })
        return
      }
      setRows(prev => [...prev, ...ocrRows])
      setResultMsg({ kind: 'ok', text: `AI 萃取出 ${ocrRows.length} 筆，請在下方確認後儲存` })
    } catch (e: unknown) {
      setResultMsg({ kind: 'err', text: e instanceof Error ? e.message : 'OCR 失敗' })
    } finally {
      setOcrLoading(false)
    }
  }

  function updateRow(id: string, field: keyof DraftRow, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value, ...(field === 'test_name' ? { isKnown: KNOWN_TEST_NAMES.includes(value) } : {}) } : r))
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  async function saveAll() {
    if (rows.length === 0) return
    setSaving(true)
    setResultMsg(null)
    try {
      const payload = rows.map(r => ({
        test_name: r.test_name,
        value: parseFloat(r.value),
        unit: r.unit,
        reference_range: r.reference_range,
        date: r.date,
      }))
      const res = await fetch('/api/lab-results/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, rows: payload, selfEntry: true }),
      })
      const json = await res.json()
      if (json.success) {
        const n = json.data?.inserted ?? 0
        const skipped = json.data?.skipped ?? []
        const queuedDates = (json.data?.autoDraftQueued ?? []) as string[]
        setRows([])
        setSaveSuccess({ inserted: n, skipped: skipped.length, queuedDates })
        setResultMsg(null)
        setCountdown(15)  // 15 秒倒數，給人時間讀
      } else {
        setResultMsg({ kind: 'err', text: json.error || '寫入失敗' })
      }
    } catch (e: unknown) {
      setResultMsg({ kind: 'err', text: e instanceof Error ? e.message : '寫入失敗' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Link href={`/c/${clientId}/health/timeline`} className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">上傳血檢資料</h1>
          </div>
          <p className="text-xs text-gray-500 ml-7">
            手打、上傳 CSV 或健檢報告 PDF/照片 — AI 萃取後你可確認再儲存
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tab 切換 */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          {([
            { key: 'manual', label: '✏️ 手打', icon: Pencil },
            { key: 'csv',    label: '📊 CSV 上傳', icon: FileText },
            { key: 'ocr',    label: '📷 PDF / 照片', icon: Camera },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 手打 */}
        {tab === 'manual' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">項目名稱</label>
                <input
                  type="text"
                  value={m.test_name}
                  onChange={e => setM(s => ({ ...s, test_name: e.target.value }))}
                  list="lab-name-list"
                  placeholder="例：ApoB"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <datalist id="lab-name-list">
                  {KNOWN_TEST_NAMES.map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">數值</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={m.value}
                  onChange={e => setM(s => ({ ...s, value: e.target.value }))}
                  placeholder="例：42"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">單位</label>
                <input
                  type="text"
                  value={m.unit}
                  onChange={e => setM(s => ({ ...s, unit: e.target.value }))}
                  placeholder="例：mg/dL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">日期</label>
                <input
                  type="date"
                  value={m.date}
                  onChange={e => setM(s => ({ ...s, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">參考範圍（可選）</label>
                <input
                  type="text"
                  value={m.reference_range}
                  onChange={e => setM(s => ({ ...s, reference_range: e.target.value }))}
                  placeholder="例：< 130 或 70-120"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
            <button
              onClick={addManual}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> 加入下方清單
            </button>
          </div>
        )}

        {/* CSV */}
        {tab === 'csv' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <div className="text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-4">
                上傳 CSV 檔案（第一行欄位需包含 <code className="bg-gray-100 px-1 rounded">test_name</code> 與 <code className="bg-gray-100 px-1 rounded">value</code>）
              </p>
              <p className="text-xs text-gray-500 mb-4">
                支援欄位：test_name / value / unit / reference_range / date<br />
                中文也可：項目 / 數值 / 單位 / 參考範圍 / 日期
              </p>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
                onChange={async e => {
                  const f = e.target.files?.[0]
                  if (f) await handleCsvFile(f)
                  if (e.target) e.target.value = ''
                }}
                className="hidden"
              />
              <button
                onClick={() => csvInputRef.current?.click()}
                disabled={csvLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" /> {csvLoading ? '解析中...' : '選擇 CSV 檔案'}
              </button>
            </div>
          </div>
        )}

        {/* OCR */}
        {tab === 'ocr' && (
          <div
            className={`rounded-xl border border-dashed p-6 mb-6 transition-colors ${
              ocrDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
            }`}
            onDragEnter={e => { e.preventDefault(); setOcrDragActive(true) }}
            onDragOver={e => { e.preventDefault(); setOcrDragActive(true) }}
            onDragLeave={e => { e.preventDefault(); setOcrDragActive(false) }}
            onDrop={async e => {
              e.preventDefault()
              setOcrDragActive(false)
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                await handleOcrFiles(e.dataTransfer.files)
              }
            }}
          >
            {ocrLoading ? (
              <div className="text-center py-4">
                {/* Animated progress */}
                <div className="relative inline-flex items-center justify-center w-16 h-16 mb-3">
                  <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                  <span className="relative text-xs font-medium text-blue-700 tabular-nums">{ocrElapsedSec}s</span>
                </div>
                <p className="text-sm font-medium text-gray-800">
                  AI 正在辨識 {ocrFileCount} 個檔案...
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  通常 15-30 秒完成，請勿關閉頁面
                </p>
                {ocrElapsedSec > 30 && (
                  <p className="text-xs text-amber-600 mt-2">
                    比較大的 PDF 可能需要 40-60 秒，再等等...
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center">
                <Camera className={`w-12 h-12 mx-auto mb-3 ${ocrDragActive ? 'text-blue-600' : 'text-gray-400'}`} />
                <p className="text-sm font-medium text-gray-800 mb-1">
                  {ocrDragActive ? '放開即可上傳' : '拖曳檔案到這裡 或點下方按鈕'}
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  PDF / JPG / PNG · 最多 5 個檔案 · 圖檔 5MB / PDF 10MB 上限
                </p>
                <input
                  ref={ocrInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  multiple
                  onChange={async e => {
                    const fs = e.target.files
                    if (fs && fs.length > 0) await handleOcrFiles(fs)
                    if (e.target) e.target.value = ''
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => ocrInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded inline-flex items-center gap-1"
                >
                  <Upload className="w-4 h-4" /> 選擇檔案
                </button>
                <p className="mt-3 text-[11px] text-amber-700">
                  ⚠️ AI 辨識可能有誤差，請務必在下方確認每一筆數值後再儲存
                </p>
              </div>
            )}
          </div>
        )}

        {/* 訊息 */}
        {/* 儲存成功 — 大 success card + 自動跳轉倒數 */}
        {saveSuccess && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">✅</div>
              <div className="text-lg font-bold text-emerald-900 mb-1">
                已寫入 {saveSuccess.inserted} 筆血檢資料
              </div>
              {saveSuccess.skipped > 0 && (
                <div className="text-xs text-amber-700">
                  （{saveSuccess.skipped} 筆未通過驗證）
                </div>
              )}
            </div>

            {saveSuccess.queuedDates.length > 0 && (
              <div className="bg-white rounded-xl p-3 mb-4 border border-emerald-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-emerald-800">
                    🤖 AI 教練筆記生成中（約 15-30 秒）
                  </span>
                </div>
                <div className="text-[11px] text-gray-600">
                  系統正在為以下日期生成個人化觀察筆記：
                  <span className="font-mono ml-1">
                    {saveSuccess.queuedDates.join(', ')}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => router.push(`/c/${clientId}/health/timeline`)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-3 rounded-lg"
              >
                📊 立刻看健康趨勢儀表板
              </button>
              <button
                onClick={() => {
                  setSaveSuccess(null)
                  setCountdown(0)
                }}
                className="px-4 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-sm text-gray-700 rounded-lg"
              >
                繼續上傳
              </button>
            </div>

            {countdown > 0 && (
              <div className="text-center mt-3 text-[11px] text-gray-500">
                ⏱ {countdown} 秒後自動跳到儀表板
              </div>
            )}
          </div>
        )}

        {resultMsg && (
          <div className={`mb-4 p-3 rounded text-sm ${
            resultMsg.kind === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {resultMsg.text}
          </div>
        )}

        {/* 待確認清單 */}
        {rows.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">待確認資料（{rows.length} 筆）</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  項目名稱務必與系統對照表一致（綠色標記者已對到），否則趨勢引擎無法分析
                </div>
              </div>
              <button
                onClick={saveAll}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded disabled:opacity-50"
              >
                {saving ? '儲存中...' : `✅ 全部確認儲存（${rows.length}）`}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-600">
                  <tr>
                    <th className="px-2 py-2 text-left">來源</th>
                    <th className="px-2 py-2 text-left min-w-[140px]">項目</th>
                    <th className="px-2 py-2 text-left min-w-[80px]">數值</th>
                    <th className="px-2 py-2 text-left min-w-[80px]">單位</th>
                    <th className="px-2 py-2 text-left min-w-[100px]">參考範圍</th>
                    <th className="px-2 py-2 text-left min-w-[120px]">日期</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t border-slate-200">
                      <td className="px-2 py-1 text-xs text-gray-500">
                        {r.source === 'manual' ? '✏️' : r.source === 'csv' ? '📊' : '📷'}
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={r.test_name}
                          onChange={e => updateRow(r.id, 'test_name', e.target.value)}
                          list="lab-name-list-table"
                          className={`w-full px-2 py-1 border rounded text-sm ${
                            r.isKnown
                              ? 'border-emerald-300 bg-emerald-50'
                              : 'border-amber-300 bg-amber-50'
                          }`}
                          title={r.isKnown ? '已對到系統指標' : '不在系統指標清單中，趨勢引擎不會分析'}
                        />
                      </td>
                      <td className="px-2 py-1">
                        {(() => {
                          const prev = previousValues.get(r.test_name)
                          const currentNum = parseFloat(r.value)
                          // 計算變化百分比（若兩者都有效）
                          let diffBadge: { color: string; text: string } | null = null
                          if (prev && Number.isFinite(currentNum) && prev.value !== 0) {
                            const pct = ((currentNum - prev.value) / prev.value) * 100
                            const absPct = Math.abs(pct)
                            if (absPct >= 50) {
                              diffBadge = { color: 'bg-rose-100 text-rose-700', text: `⚠️ ${pct > 0 ? '+' : ''}${pct.toFixed(0)}%` }
                            } else if (absPct >= 15) {
                              diffBadge = { color: 'bg-amber-100 text-amber-700', text: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%` }
                            } else if (absPct > 0) {
                              diffBadge = { color: 'bg-emerald-50 text-emerald-700', text: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%` }
                            }
                          }
                          return (
                            <>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.value}
                                onChange={e => updateRow(r.id, 'value', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                              {prev && (
                                <div className="text-[11px] mt-0.5 flex items-center gap-1">
                                  <span className="text-gray-500">上次: {prev.value}</span>
                                  {diffBadge && (
                                    <span className={`px-1 rounded ${diffBadge.color} font-medium`}>
                                      {diffBadge.text}
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={r.unit}
                          onChange={e => updateRow(r.id, 'unit', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={r.reference_range}
                          onChange={e => updateRow(r.id, 'reference_range', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="date"
                          value={r.date}
                          onChange={e => updateRow(r.id, 'date', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <button
                          onClick={() => removeRow(r.id)}
                          className="text-rose-600 hover:text-rose-800"
                          title="刪除這筆"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="lab-name-list-table">
                {KNOWN_TEST_NAMES.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>
          </div>
        )}

        {rows.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <div className="text-4xl mb-2 opacity-50">📋</div>
            <div className="text-sm text-gray-600 font-medium mb-1">待確認清單是空的</div>
            <div className="text-xs text-gray-400">
              從上方選一個方式（{tab === 'manual' ? '手打' : tab === 'csv' ? 'CSV 上傳' : '照片 / PDF'}）新增資料
            </div>
          </div>
        )}

        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 leading-relaxed">
          <strong>免責提醒：</strong>本上傳功能僅為將你的健檢數據加入系統追蹤，所有原始檢驗報告應由你的醫師專業判讀。系統的趨勢觀察與教練筆記不構成醫療診斷或處方建議。
        </div>
      </div>
    </div>
  )
}
