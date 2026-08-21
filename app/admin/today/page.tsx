'use client'

import { useState, useEffect, useCallback } from 'react'
import type { StudentCard } from '@/lib/coach-roster'

/**
 * 教練的「今天」—— 打開手機就知道每個學生該做什麼。
 *
 * ⚠️ 這頁的設計前提，是我前面做錯的地方（2026-08-21 Howard 一連串回饋）：
 *
 * 先前做的三個工具（體測報告、複測比對、出席分流）都是
 * **先要教練記錄、才給他分析** —— 順序反了。一天六堂課的人不會為了
 * 「以後能分析」而現在多花時間。他說「真的很麻煩」就是這個意思。
 *
 * 正確順序：**先給價值，資料當副產品。**
 * 教練每天真正缺的是「上課前三十秒，知道這堂該做什麼」——
 * 那件事他本來就要想（或本來該想但沒想，所以變成只教動作）。
 *
 * 對應的痛點（Howard 原話）：
 * ・「只有第一堂體驗課會很紮實地評估…其餘課程就只是教他怎麼做動作」
 *   → 標的每天都在眼前，評估結果不會用完就丟
 * ・「第幾堂很麻煩，有些學生就是會一直上課的啊」
 *   → 堂數整個拿掉，改用時間驅動（練了幾週、每 8 週回頭對標的）
 * ・「一個教練那麼多學生是在哭」
 *   → 建檔只要兩個欄位、每堂只要按一下、標的可以留空
 */

export default function CoachTodayPage() {
  const [cards, setCards] = useState<StudentCard[] | null>(null)
  const [openNote, setOpenNote] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/coach/students')
      const j = await r.json()
      if (j?.success) setCards(j.cards ?? [])
      else setCards([])
    } catch { setCards([]) }
  }, [])
  useEffect(() => { load() }, [load])

  const addStudents = async () => {
    if (!raw.trim()) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/coach/students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      })
      const j = await r.json()
      if (!r.ok) { setMsg(j?.error ?? '建立失敗'); return }
      setMsg(`加了 ${j.added} 個${j.updated ? `、更新 ${j.updated} 個` : ''}`)
      setRaw(''); setShowAdd(false)
      await load()
    } finally { setBusy(false) }
  }

  const markDone = async (id: string, undo = false, note?: string) => {
    // 樂觀更新 —— 一天六堂課的人不該等 loading
    setCards(prev => prev?.map(c => c.id === id ? { ...c, doneToday: !undo } : c) ?? null)
    await fetch('/api/coach/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: id, undo, note }),
    })
    if (note) await load()
  }

  const saveNote = async (id: string) => {
    await markDone(id, false, noteDraft)
    setOpenNote(null); setNoteDraft('')
  }

  const doneCount = cards?.filter(c => c.doneToday).length ?? 0

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">今天</h1>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}
              {cards && cards.length > 0 && ` · ${cards.length} 位學生`}
            </p>
          </div>
          {cards && cards.length > 0 && (
            <span className="text-xs text-slate-400 tabular-nums">{doneCount} 堂已記</span>
          )}
        </div>

        {msg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <p className="text-xs text-emerald-800">{msg}</p>
          </div>
        )}

        {/* 建檔：貼上就好 */}
        {(showAdd || cards?.length === 0) && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-sm font-medium text-gray-800 mb-1">加學生</p>
            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
              一行一個：名字 + 他這期要達成什麼。標的想不出來就只寫名字，之後再補。
            </p>
            <textarea
              value={raw} onChange={e => setRaw(e.target.value)}
              rows={6}
              placeholder={'王小明 胸椎太直，要把肩胛推得出去\n李小華 學會四個基本動作，能自己練\n陳大文 減脂，體脂 26 掉到 21\n林先生'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button" onClick={addStudents} disabled={busy || !raw.trim()}
                className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >{busy ? '存檔中…' : '加進去'}</button>
              {cards && cards.length > 0 && (
                <button type="button" onClick={() => { setShowAdd(false); setRaw('') }}
                  className="px-3 py-2 text-sm text-slate-500">取消</button>
              )}
            </div>
          </div>
        )}

        {cards === null && <p className="text-sm text-slate-400 py-4">載入中…</p>}

        {cards?.map(c => (
          <div key={c.id} className={`bg-white border rounded-2xl p-4 transition-opacity ${
            c.doneToday ? 'border-slate-200 opacity-50' : 'border-slate-200'
          }`}>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-sm font-bold text-gray-900">{c.name}</span>
              {c.weeksTogether != null && c.weeksTogether > 0 && (
                <span className="text-[11px] text-slate-400 tabular-nums">練了 {c.weeksTogether} 週</span>
              )}
              <span className="ml-auto text-[11px] text-slate-400 tabular-nums">
                近 30 天 {c.sessionsLast30} 堂
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-1.5">
              目標：{c.goal
                ? <span className="text-gray-800">{c.goal}</span>
                : <span className="text-amber-700">還沒設</span>}
            </p>

            {c.lastNote ? (
              <div className="bg-slate-50 rounded-lg px-3 py-2 mb-2">
                <p className="text-[11px] text-slate-400 mb-0.5 tabular-nums">上次（{c.lastDate}）</p>
                <p className="text-xs text-slate-700 leading-snug">{c.lastNote}</p>
              </div>
            ) : c.lastDate ? (
              <p className="text-[11px] text-slate-400 mb-2 tabular-nums">上次 {c.lastDate}（沒記重點）</p>
            ) : (
              <p className="text-[11px] text-slate-400 mb-2">還沒有上課紀錄</p>
            )}

            {c.cue && (
              <p className="text-xs text-primary-700 bg-primary-50 rounded-lg px-3 py-2 leading-snug mb-2">
                📍 {c.cue}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button" onClick={() => markDone(c.id, c.doneToday)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  c.doneToday ? 'bg-slate-100 text-slate-500' : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >{c.doneToday ? '已記 ✓' : '上完了'}</button>
              <button
                type="button"
                onClick={() => { setOpenNote(openNote === c.id ? null : c.id); setNoteDraft('') }}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >記一句</button>
            </div>

            {openNote === c.id && (
              <div className="mt-2">
                <input
                  type="text" value={noteDraft} autoFocus
                  onChange={e => setNoteDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveNote(c.id) }}
                  placeholder="今天的重點（下次會出現在上面）"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button type="button" onClick={() => saveNote(c.id)}
                    className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg">存</button>
                  <span className="text-[10px] text-slate-400">選填。不寫就沿用上一次的。</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {cards && cards.length > 0 && !showAdd && (
          <button type="button" onClick={() => setShowAdd(true)}
            className="w-full py-3 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            + 加學生
          </button>
        )}
      </div>
    </main>
  )
}
