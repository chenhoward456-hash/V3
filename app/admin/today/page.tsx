'use client'

import { useState } from 'react'

/**
 * 教練的「今天」—— 打開手機就知道今天六堂課各要做什麼。
 *
 * ⚠️ 這頁的設計前提，是我前面做錯的地方（2026-08-21 Howard 一連串回饋）：
 *
 * 我先前做的三個工具（體測報告、複測比對、出席分流）都是
 * **先要教練記錄、才給他分析** —— 順序反了。一天六堂課的人不會為了
 * 「以後能分析」而現在多花時間。他說「真的很麻煩」就是這個意思。
 *
 * 正確的順序：**先給價值，資料當副產品。**
 * 教練每天真正缺的是「上課前三十秒，知道這堂該做什麼」——
 * 那件事他本來就要想（或本來該想但沒想，所以變成只教動作）。
 * 系統幫他想好 → 他省時間 → 他會用 → 用了之後點一下「完成」，
 * 記錄就自己長出來了。
 *
 * 對應的痛點（Howard 原話）：
 * ・「只有第一堂體驗課會很紮實地評估…其餘課程就只是教他怎麼做動作」
 *   → 每一堂都把「標的」放在他眼前，評估結果不會用完就丟
 * ・「買五十堂上可能不到一半就消失」
 *   → 進度條讓學員與教練都看得到「還剩幾堂、到哪了」
 *
 * ⚠️ 目前是**原型，全部假資料**，給 Howard 判斷形狀對不對用的。
 */

type Session = {
  time: string
  name: string
  no: number
  total: number
  /** 這期課程的標的 —— 體驗課評估出來的結論，不是「今天練什麼」 */
  goal: string
  goalKind: '結構' | '體組成' | '動作' | '習慣' | '表現'
  /** 上一堂的重點，教練不用回想 */
  lastNote: string
  lastDate: string
  /** 系統依標的與進度給的提示 */
  cue: string | null
  done?: boolean
}

const TODAY: Session[] = [
  {
    time: '10:00', name: '王小明', no: 12, total: 50,
    goalKind: '結構', goal: '胸椎活動度 + 肩胛前推',
    lastNote: '四足跪姿呼吸做得比較穩了，熊爬還會塌腰', lastDate: '8/18',
    cue: null,
  },
  {
    time: '11:00', name: '李小華', no: 8, total: 30,
    goalKind: '動作', goal: '學會四個基本動作，能自己完成一次全身',
    lastNote: '深蹲下去膝蓋還是內夾，用彈力帶提示有改善', lastDate: '8/19',
    cue: '📍 第 8 堂 — 回頭檢查：深蹲不用提醒能做對了嗎？',
  },
  {
    time: '13:00', name: '陳大文', no: 24, total: 50,
    goalKind: '體組成', goal: '體脂 26% → 21%，腹圍破 90',
    lastNote: '說最近應酬多，晚餐很難控', lastDate: '8/14',
    cue: '📍 第 24 堂 — 距上次上課 7 天（平常 3.5 天）。順口問一下最近狀況。',
  },
  {
    time: '15:00', name: '林先生', no: 3, total: 20,
    goalKind: '習慣', goal: '建立一週兩次的規律',
    lastNote: '第一次自己來練（沒教練那天），有拍照傳給我', lastDate: '8/20',
    cue: '📍 他上週自己來了一次 —— 這是習慣在長出來，值得當面講一句。',
  },
  {
    time: '17:00', name: '張太太', no: 40, total: 50,
    goalKind: '體組成', goal: '減脂 6 公斤',
    lastNote: '體重卡住三週了，飲食紀錄空白', lastDate: '8/19',
    cue: '📍 剩 10 堂。體重卡住不一定是她沒做 —— 先確認熱量設定對不對。',
  },
  {
    time: '18:00', name: '吳先生', no: 16, total: 40,
    goalKind: '表現', goal: '打球第四節不掉速',
    lastNote: '單腳穩定度進步，農夫走路加到 24kg', lastDate: '8/18',
    cue: '📍 第 16 堂 — 回頭檢查：打球的實際感受有變嗎？',
  },
]

const KIND_STYLE: Record<Session['goalKind'], string> = {
  結構: 'bg-slate-100 text-slate-600',
  體組成: 'bg-slate-100 text-slate-600',
  動作: 'bg-slate-100 text-slate-600',
  習慣: 'bg-slate-100 text-slate-600',
  表現: 'bg-slate-100 text-slate-600',
}

export default function CoachTodayPage() {
  const [sessions, setSessions] = useState(TODAY)
  const [openNote, setOpenNote] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})

  const doneCount = sessions.filter(s => s.done).length

  const complete = (i: number) => {
    setSessions(prev => prev.map((s, idx) => idx === i ? { ...s, done: !s.done } : s))
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">今天</h1>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">8 月 21 日 · 六堂</p>
          </div>
          <span className="text-xs text-slate-400 tabular-nums">{doneCount}/{sessions.length} 完成</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <p className="text-[11px] text-amber-900 leading-relaxed">
            這是原型，資料是假的。要看的是「打開手機三十秒能不能知道這堂該做什麼」。
          </p>
        </div>

        {sessions.map((s, i) => (
          <div
            key={s.time}
            className={`border rounded-2xl p-4 transition-opacity ${
              s.done ? 'bg-white border-slate-200 opacity-50' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-sm font-bold text-gray-900 tabular-nums">{s.time}</span>
              <span className="text-sm font-medium text-gray-800">{s.name}</span>
              <span className="text-[11px] text-slate-400 tabular-nums">第 {s.no}/{s.total} 堂</span>
              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${KIND_STYLE[s.goalKind]}`}>
                {s.goalKind}
              </span>
            </div>

            {/* 標的 —— 這是體驗課評估出來的結論，每堂都放在眼前 */}
            <p className="text-xs text-slate-500 mb-1.5">
              目標：<span className="text-gray-800">{s.goal}</span>
            </p>

            {/* 上一堂的重點 —— 教練不用回想 */}
            <div className="bg-slate-50 rounded-lg px-3 py-2 mb-2">
              <p className="text-[11px] text-slate-400 mb-0.5">上次（{s.lastDate}）</p>
              <p className="text-xs text-slate-700 leading-snug">{s.lastNote}</p>
            </div>

            {/* 系統提示 —— 只在該講的時候出現 */}
            {s.cue && (
              <p className="text-xs text-primary-700 bg-primary-50 rounded-lg px-3 py-2 leading-snug mb-2">
                {s.cue}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button" onClick={() => complete(i)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  s.done
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {s.done ? '已完成 ✓' : '上完了'}
              </button>
              <button
                type="button" onClick={() => setOpenNote(openNote === i ? null : i)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                {notes[i] ? '已記一句' : '記一句'}
              </button>
            </div>

            {openNote === i && (
              <div className="mt-2">
                <input
                  type="text" value={notes[i] ?? ''}
                  onChange={e => setNotes(p => ({ ...p, [i]: e.target.value }))}
                  placeholder="今天的重點（下次會出現在這裡）"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 mt-1">選填。不寫也沒關係，下次就沿用上一次的。</p>
              </div>
            )}
          </div>
        ))}

        <p className="text-[11px] text-slate-400 leading-relaxed pt-2 pb-6">
          設計上教練每堂只需要按一下「上完了」。「記一句」是選填 ——
          寫了下次會出現在「上次」那一欄，不寫就沿用舊的。
          <br />
          資料是這樣長出來的，不是要你另外去記。
        </p>
      </div>
    </main>
  )
}
