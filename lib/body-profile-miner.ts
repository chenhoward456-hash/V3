/**
 * 身體說明書自動挖條目 —— 讓護城河自己長，教練只花核准一次的時間。
 *
 * ## 為什麼有這支（2026-09-30）
 *
 * body_profile（「你」的身體使用指南）是 V3 月費真正賣的東西：公式誰都算得出來，
 * 「**你**吃 2600 才平衡」「**你**睡不好那天精力少 1 分」只有時間買得到。
 * 但到今天為止只有陳胤豪一個人有，而且 8 條全是 Claude 手寫的 —— 不會自己長。
 *
 * 這支每週一從每個人的數據裡挖「只屬於這個人」的規律，**不直接寫進說明書**，
 * 而是丟成 pending_proposals（proposal_type='body_profile_entry'）進晨報，
 * 教練回「套用 X」才寫入。理由同 [[project_v3_body_profile]]：每條都要帶
 * evidence＋sample＋confidence，自動挖的最高只給 medium —— high 留給教練交叉驗證過的。
 *
 * 刻意保守：樣本不夠、差距沒大過日常波動（Welch t < 2）就不提。寧可少提一條，也不要提一條錯的。
 */

export type ProfileConfidence = 'high' | 'medium' | 'low'

export type ProfileEntry = {
  key: string
  label: string
  value: string
  detail?: string
  evidence: string
  sample: string
  confidence: ProfileConfidence
  caveat?: string
  measured_on: string
}

type NutRow = { date: string; calories: number | null }
type WeightRow = { date: string; weight: number | null }
type WellRow = { date: string; sleep_quality?: number | null; energy_level?: number | null; training_drive?: number | null }
type TrainRow = { date: string; training_type: string | null }

const DAY = 86400000
/** t 值轉人話：兩組零波動時 t 是 Infinity，不能直接印 */
// 學員在說明書上看得到 evidence —— 不印統計值（t=16.0 他看不懂），講人話
const tText = (t: number) => (Number.isFinite(t) ? '差距遠大過你平常的上下起伏' : '兩組分數完全沒重疊')
const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10)
const dayIndex = (d: string) => Math.round(new Date(`${d}T00:00:00Z`).getTime() / DAY)

function meanSd(v: number[]) {
  const n = v.length
  const mean = v.reduce((s, x) => s + x, 0) / n
  const sd = n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0
  return { n, mean, sd }
}

/** Welch t；兩邊都零波動時有差即視為明顯 */
export function welchT(a: number[], b: number[]): number {
  const A = meanSd(a), B = meanSd(b)
  const se = Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n)
  const d = B.mean - A.mean
  if (se === 0) return d === 0 ? 0 : Math.sign(d) * Infinity
  return d / se
}

/** 最小平方法斜率（y 對 day index），單位：每天 */
export function slopePerDay(points: { date: string; value: number }[]): number | null {
  if (points.length < 2) return null
  const xs = points.map(p => dayIndex(p.date)), ys = points.map(p => p.value)
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
  if (sxx === 0) return null
  return xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / sxx
}

export const TDEE_WINDOW = 42
export const KCAL_PER_KG = 7700

/** ① 實測 TDEE：近 6 週「平均吃多少」減掉「體重趨勢換算的熱量」 */
export function mineMeasuredTdee(nut: NutRow[], weights: WeightRow[], today: string): ProfileEntry | null {
  const from = addDays(today, -TDEE_WINDOW)
  const cal = nut.filter(n => n.date >= from && n.date < today && n.calories != null && n.calories > 500).map(n => Number(n.calories))
  const w = weights.filter(x => x.date >= from && x.date < today && x.weight != null).map(x => ({ date: x.date, value: Number(x.weight) }))
  if (cal.length < 21 || w.length < 14) return null
  const slope = slopePerDay(w)
  if (slope == null) return null
  const avg = cal.reduce((s, x) => s + x, 0) / cal.length
  const balance = slope * KCAL_PER_KG            // 每天多（+）或少（−）吃了多少
  const tdee = Math.round((avg - balance) / 10) * 10
  if (tdee < 1200 || tdee > 5000) return null
  const perWeek = slope * 7
  return {
    key: 'measured_tdee',
    label: '你的實測 TDEE',
    value: `≈ ${tdee} kcal`,
    detail: `照你自己的記錄口徑，每天吃 ${tdee} 左右體重會持平。設熱量時用這把尺，不要用公式。`,
    evidence: `近 ${TDEE_WINDOW} 天日均攝取 ${Math.round(avg)} 大卡；體重趨勢 ${perWeek >= 0 ? '+' : ''}${perWeek.toFixed(2)} kg/週，換算每天約${balance < 0 ? '少' : '多'}吃 ${Math.abs(Math.round(balance))} 大卡`,
    sample: `${TDEE_WINDOW} 天 / ${w.length} 筆體重 / ${cal.length} 筆飲食紀錄`,
    confidence: cal.length >= 35 && w.length >= 28 ? 'medium' : 'low',
    caveat: '建立在「你記的熱量是準的」之上；漏記或低報，實際 TDEE 會比這個低。',
    measured_on: today,
  }
}

export const PATTERN_WINDOW = 90

/** ② 睡不好那天，精力差多少 */
export function mineSleepEnergy(well: WellRow[], today: string): ProfileEntry | null {
  const from = addDays(today, -PATTERN_WINDOW)
  const pairs = well.filter(w => w.date >= from && w.sleep_quality != null && w.energy_level != null)
  const good = pairs.filter(p => p.sleep_quality! >= 4).map(p => Number(p.energy_level))
  let poor = pairs.filter(p => p.sleep_quality! <= 2).map(p => Number(p.energy_level))
  let poorLabel = '睡眠 ≤2 分'
  if (poor.length < 5) { poor = pairs.filter(p => p.sleep_quality! <= 3).map(p => Number(p.energy_level)); poorLabel = '睡眠 ≤3 分' }
  if (good.length < 5 || poor.length < 5) return null
  const t = welchT(poor, good)
  const G = meanSd(good), P = meanSd(poor)
  const diff = G.mean - P.mean
  if (!(t >= 2) || diff < 0.5) return null
  return {
    key: 'sleep_energy',
    label: '睡眠對你精力的影響',
    value: `睡不好那天精力少 ${diff.toFixed(1)} 分`,
    detail: `睡得好（≥4 分）的日子精力平均 ${G.mean.toFixed(1)}/5，${poorLabel}的日子 ${P.mean.toFixed(1)}/5。精力低的那天先回頭看睡眠，不一定是吃不夠。`,
    evidence: `近 ${PATTERN_WINDOW} 天同一天的睡眠與精力分數比較，${tText(t)}`,
    sample: `${good.length} 天睡得好 / ${poor.length} 天睡不好`,
    confidence: good.length >= 10 && poor.length >= 10 ? 'medium' : 'low',
    caveat: '都是主觀分數，而且同一天填 —— 心情差可能兩個都填低。看的是「一起動」，不是「誰造成誰」。',
    measured_on: today,
  }
}

/** ③ 休息一天後，隔天想練的程度差多少（只看訓練有認真記的人，不然「沒記」會被當成休息） */
export function mineRestDayEffect(train: TrainRow[], well: WellRow[], today: string): ProfileEntry | null {
  const from = addDays(today, -PATTERN_WINDOW)
  const trained = new Set(train.filter(t => t.date >= addDays(from, -1) && t.training_type && t.training_type !== 'rest').map(t => t.date))
  if ([...trained].filter(d => d >= from).length < 24) return null
  const afterRest: number[] = [], afterTrain: number[] = []
  for (const w of well) {
    if (w.date < from || w.training_drive == null) continue
    ;(trained.has(addDays(w.date, -1)) ? afterTrain : afterRest).push(Number(w.training_drive))
  }
  if (afterRest.length < 5 || afterTrain.length < 5) return null
  const t = welchT(afterTrain, afterRest)
  const R = meanSd(afterRest), T = meanSd(afterTrain)
  const diff = R.mean - T.mean
  if (!(t >= 2) || diff < 0.4) return null
  return {
    key: 'rest_day_effect',
    label: '休息日對你的效果',
    value: `休一天，隔天想練的程度多 ${diff.toFixed(1)} 分`,
    detail: `前一天有練：想練程度平均 ${T.mean.toFixed(1)}/5；前一天休息：${R.mean.toFixed(1)}/5。連練幾天開始沒勁時，排一天休息比硬撐划算。`,
    evidence: `近 ${PATTERN_WINDOW} 天，隔天的「想練程度」依前一天有沒有練分兩組比較，${tText(t)}`,
    sample: `${afterTrain.length} 天練完隔天 / ${afterRest.length} 天休息隔天`,
    confidence: afterRest.length >= 10 && afterTrain.length >= 10 ? 'medium' : 'low',
    caveat: '「沒記訓練」會被當成休息；這條只在訓練有認真記（近 90 天 ≥24 次）的人身上才算。',
    measured_on: today,
  }
}

/** 已有同 key 條目時，數字差不多就不再提（TDEE 差 <100 大卡視為同一件事） */
export function isMaterialChange(next: ProfileEntry, existing: { key: string; value: string } | undefined): boolean {
  if (!existing) return true
  if (next.key === 'measured_tdee') {
    const a = Number(String(existing.value).replace(/[^\d.]/g, '')), b = Number(next.value.replace(/[^\d.]/g, ''))
    return !(Number.isFinite(a) && Math.abs(a - b) < 100)
  }
  return existing.value !== next.value && Math.abs(
    Number(existing.value.match(/[\d.]+/)?.[0] ?? NaN) - Number(next.value.match(/[\d.]+/)?.[0] ?? NaN),
  ) >= 0.3
}

export function mineAll(input: { nut: NutRow[]; weights: WeightRow[]; well: WellRow[]; train: TrainRow[] }, today: string): ProfileEntry[] {
  return [
    mineMeasuredTdee(input.nut, input.weights, today),
    mineSleepEnergy(input.well, today),
    mineRestDayEffect(input.train, input.well, today),
  ].filter((e): e is ProfileEntry => e != null)
}

/** 套用：同 key 取代、沒有就加在最後 */
export function mergeEntry(profile: { entries?: ProfileEntry[]; gaps?: unknown[] } | null, entry: ProfileEntry, today: string) {
  const entries = [...(profile?.entries ?? [])]
  const i = entries.findIndex(e => e.key === entry.key)
  if (i >= 0) entries[i] = entry
  else entries.push(entry)
  return { ...(profile ?? {}), updated_at: today, entries, gaps: profile?.gaps ?? [] }
}

type QueryLike = { from: (t: string) => any }

/**
 * 每週一早上：挖每個活躍學員 → 有新條目就丟提案。
 * 去重：同 key 已有 pending，或 60 天內被退過，就不再丟。
 */
export async function proposeBodyProfileEntries(supabase: QueryLike, today: string): Promise<{ proposed: number; errors: string[] }> {
  const errors: string[] = []
  let proposed = 0
  const since = addDays(today, -PATTERN_WINDOW - 1)
  const { data: clients } = await supabase.from('clients').select('id, name, body_profile').eq('is_active', true)
  for (const c of (clients ?? []) as { id: string; name: string; body_profile: { entries?: ProfileEntry[] } | null }[]) {
    try {
      const [nut, weights, well, train, props] = await Promise.all([
        supabase.from('nutrition_logs').select('date, calories').eq('client_id', c.id).gte('date', since),
        supabase.from('body_composition').select('date, weight').eq('client_id', c.id).gte('date', since),
        supabase.from('daily_wellness').select('date, sleep_quality, energy_level, training_drive').eq('client_id', c.id).gte('date', since),
        supabase.from('training_logs').select('date, training_type').eq('client_id', c.id).gte('date', since),
        supabase.from('pending_proposals').select('status, proposed_at, proposed_changes').eq('client_id', c.id).eq('proposal_type', 'body_profile_entry'),
      ])
      const found = mineAll({ nut: nut.data ?? [], weights: weights.data ?? [], well: well.data ?? [], train: train.data ?? [] }, today)
      const blocked = new Set(
        ((props.data ?? []) as { status: string; proposed_at: string; proposed_changes: { entry?: ProfileEntry } | null }[])
          .filter(p => p.status === 'pending' || (p.status === 'rejected' && p.proposed_at.slice(0, 10) >= addDays(today, -60)))
          .map(p => p.proposed_changes?.entry?.key)
          .filter(Boolean),
      )
      for (const e of found) {
        if (blocked.has(e.key)) continue
        const existing = c.body_profile?.entries?.find(x => x.key === e.key)
        if (!isMaterialChange(e, existing)) continue
        const { error } = await supabase.from('pending_proposals').insert({
          client_id: c.id,
          proposed_by: 'system_engine',
          proposal_type: 'body_profile_entry',
          status: 'pending',
          current_state: existing ? { entry: existing } : {},
          proposed_changes: { entry: e },
          reasoning: `${e.label}：${e.value}（${e.evidence}）`,
          expires_at: new Date(Date.now() + 7 * DAY).toISOString(),
        })
        if (error) errors.push(`${c.name} ${e.key}: ${error.message}`)
        else proposed++
      }
    } catch (err) {
      errors.push(`${c.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return { proposed, errors }
}
