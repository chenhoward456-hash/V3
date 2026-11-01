'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getLocalDateStr } from '@/lib/date-utils'

/**
 * 進度照片 —— 備賽的裁判是照片，不是 InBody。
 * 每週同光線、同姿勢四張；同姿勢並排比「這週 vs 之前某週」。
 */

const POSES = [
  { key: 'front', label: '正面放鬆' },
  { key: 'back_lat', label: '展背' },
  { key: 'side', label: '側面' },
  { key: 'back', label: '背面' },
] as const
type Pose = typeof POSES[number]['key']

interface PhotoSet {
  date: string
  photos: Partial<Record<Pose, { id: string; url: string }>>
}

/** 手機原圖動輒 4–8MB：上傳前縮到長邊 1600px JPEG，夠看線條又不吃流量 */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('壓縮失敗'))), 'image/jpeg', 0.85),
  )
}

const fmt = (d: string) => {
  const [, m, dd] = d.split('-')
  return `${parseInt(m)}/${parseInt(dd)}`
}

export default function ProgressPhotosCard({ code, readOnly = false }: { code: string; readOnly?: boolean }) {
  const [sets, setSets] = useState<PhotoSet[] | null>(null)
  const [pose, setPose] = useState<Pose>('front')
  const [compareDate, setCompareDate] = useState<string | null>(null)
  const [uploading, setUploading] = useState<Pose | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingPose = useRef<Pose>('front')
  const today = getLocalDateStr()

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/progress-photos?code=${encodeURIComponent(code)}`)
      const json = await res.json()
      if (res.ok) setSets(json.data.sets as PhotoSet[])
      else setSets([])
    } catch {
      setSets([])
    }
  }, [code])

  useEffect(() => { load() }, [load])

  const latest = sets?.[0] ?? null
  const earlier = useMemo(() => (sets ?? []).filter(s => s.date !== latest?.date), [sets, latest])
  // 預設對照：最早那一組（看全程進步）；學員可改成任何一週
  const compare = earlier.find(s => s.date === compareDate) ?? earlier[earlier.length - 1] ?? null
  const todaySet = sets?.find(s => s.date === today)
  const todayCount = todaySet ? POSES.filter(p => todaySet.photos[p.key]).length : 0

  const pick = (p: Pose) => {
    pendingPose.current = p
    setError('')
    fileRef.current?.click()
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const p = pendingPose.current
    setUploading(p)
    try {
      const blob = await compressImage(file)
      const fd = new FormData()
      fd.append('code', code)
      fd.append('pose', p)
      fd.append('date', today)
      fd.append('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
      const res = await fetch('/api/progress-photos', { method: 'POST', body: fd })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setError(j?.error || '上傳失敗')
      } else {
        setPose(p)
        await load()
      }
    } catch {
      setError('這張照片讀不到，換一張試試')
    } finally {
      setUploading(null)
    }
  }

  if (sets === null) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <div className="animate-pulse h-5 bg-slate-100 rounded w-32" />
      </div>
    )
  }

  const latestPhoto = latest?.photos[pose]
  const comparePhoto = compare?.photos[pose]

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-base font-semibold text-slate-900">進度照片</h3>
        {sets.length > 0 && <span className="text-xs text-slate-400 tabular-nums">{sets.length} 次</span>}
      </div>
      <p className="text-xs text-slate-500 mb-4">每週同一個時間、同一盞燈、同一個角度拍。比賽看的是照片，不是體脂機。</p>

      {/* 今天拍：四個姿勢 */}
      {!readOnly && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-600 mb-2">
            今天{todayCount > 0 ? `（${todayCount}/4）` : ''}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {POSES.map(p => {
              const done = todaySet?.photos[p.key]
              return (
                <button
                  key={p.key}
                  onClick={() => pick(p.key)}
                  disabled={uploading !== null}
                  className={`aspect-[3/4] rounded-xl border text-[11px] flex flex-col items-center justify-center gap-1 overflow-hidden relative transition-colors disabled:opacity-60 ${
                    done ? 'border-slate-200' : 'border-dashed border-slate-300 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {done ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={done.url} alt={p.label} className="absolute inset-0 w-full h-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 bg-white/85 text-slate-700 py-0.5">{p.label}</span>
                    </>
                  ) : uploading === p.key ? (
                    <span>上傳中…</span>
                  ) : (
                    <>
                      <span className="text-lg leading-none text-slate-400">+</span>
                      <span>{p.label}</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
        </div>
      )}

      {/* 並排比較 */}
      {latest && (
        <div>
          {compare && <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-3">
            {POSES.map(p => (
              <button
                key={p.key}
                onClick={() => setPose(p.key)}
                className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                  pose === p.key ? 'bg-white text-slate-900 font-medium shadow-sm' : 'text-slate-500'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>}

          {compare ? (
            <div className="grid grid-cols-2 gap-2">
              {[{ set: compare, photo: comparePhoto, isCompare: true }, { set: latest, photo: latestPhoto, isCompare: false }].map(col => (
                <div key={col.set.date}>
                  {col.isCompare ? (
                    <select
                      value={compare.date}
                      onChange={e => setCompareDate(e.target.value)}
                      className="w-full h-8 mb-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2 tabular-nums"
                    >
                      {earlier.map(s => <option key={s.date} value={s.date}>{fmt(s.date)}</option>)}
                    </select>
                  ) : (
                    <p className="h-8 mb-1.5 flex items-center text-xs text-slate-900 font-medium px-2 tabular-nums">{fmt(latest.date)}（最新）</p>
                  )}
                  <div className="aspect-[3/4] rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center">
                    {col.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={col.photo.url} alt={`${fmt(col.set.date)} ${POSES.find(p => p.key === pose)?.label}`} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400">這天沒拍這個姿勢</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">再拍一次就能並排比較。</p>
          )}
        </div>
      )}

      {sets.length === 0 && readOnly && <p className="text-xs text-slate-400">還沒有照片。</p>}
    </div>
  )
}
