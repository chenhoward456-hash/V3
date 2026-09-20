import { describe, it, expect } from 'vitest'
import {
  resolveExercise, lookupExercise, normalizeExerciseName,
  planVolume, actualVolume, auditVolume, pushPullRatio, flagOf,
  EXERCISE_MUSCLE_MAP,
} from '@/lib/volume-audit'

describe('normalizeExerciseName', () => {
  it('全形括號要轉半形——第一版就是敗在這，15 個動作全部對不到', () => {
    expect(normalizeExerciseName('腿彎舉（坐姿）')).toBe('腿彎舉(坐姿)')
    expect(lookupExercise('腿彎舉（坐姿）')?.muscle).toBe('hamstrings')
    expect(lookupExercise('真空 Vacuum（古典細腰）')?.volume).toBe(false)
  })
  it('去空白、轉小寫', () => {
    expect(lookupExercise('Cable 三頭')?.muscle).toBe('triceps')
    expect(lookupExercise('Lat pull down')?.muscle).toBe('back')
  })
})

describe('resolveExercise 模糊解析', () => {
  it('去掉括號內容', () => {
    const r = resolveExercise('坐姿纜繩划船（窄握）')
    expect(r?.how).toBe('stripped')
    expect(r?.entry.muscle).toBe('back')
  })
  it('「A 或 B」取第一個選項', () => {
    const r = resolveExercise('繩索夾胸 或 蝴蝶機')
    expect(r?.entry.muscle).toBe('chest')
    expect(r?.entry.pattern).toBe('iso')
  })
  it('括號＋斜線混合：深蹲（或哈克蹲 / Smith 蹲）', () => {
    expect(resolveExercise('深蹲（或哈克蹲 / Smith 蹲）')?.entry.muscle).toBe('quads')
  })
  it('長的 key 要贏過短的——上斜啞鈴臥推 不可以被「臥推」吃掉', () => {
    const r = resolveExercise('上斜啞鈴臥推')
    expect(r?.entry.also).toContain('delts_front')
  })
})

describe('⭐ 直臂下壓算過頭位', () => {
  it('起始位是肩屈曲，所以 overhead=true（2026-09-20 Temu 案例踩過）', () => {
    expect(lookupExercise('直臂下壓')?.overhead).toBe(true)
    expect(lookupExercise('直臂下壓')?.muscle).toBe('back')
  })
})

describe('planVolume', () => {
  const sean = {
    name: 'Sean · 減脂期 5 天版',
    days: [
      { exercises: [
        { name: '槓鈴臥推（或 Smith 機）', sets: 4 }, { name: '上斜啞鈴臥推', sets: 3 },
        { name: '繩索夾胸 或 蝴蝶機', sets: 2 }, { name: '繩索側平舉', sets: 3 },
        { name: '繩索三頭下壓', sets: 2 }, { name: '懸吊舉腿', sets: 3 } ] },
      { exercises: [
        { name: '槓鈴划船 或 T-Bar 划船', sets: 4 }, { name: '坐姿纜繩划船（窄握）', sets: 3 },
        { name: '單臂啞鈴划船', sets: 3 }, { name: '面拉 Face Pull', sets: 2 },
        { name: 'EZ 槓彎舉', sets: 3 }, { name: '錘式彎舉', sets: 2 } ] },
      { exercises: [
        { name: '深蹲（或哈克蹲 / Smith 蹲）', sets: 4 }, { name: '腿推', sets: 3 },
        { name: '羅馬尼亞硬舉 RDL', sets: 3 }, { name: '坐姿腿彎舉', sets: 3 },
        { name: '站姿提踵', sets: 3 }, { name: '反向捲腹', sets: 3 } ] },
      { exercises: [
        { name: '坐姿啞鈴肩推 或 肩推機', sets: 4 }, { name: '繩索側平舉', sets: 4 },
        { name: '反式蝴蝶機（後三角）', sets: 3 }, { name: '繩索三頭下壓', sets: 3 },
        { name: '啞鈴過頭三頭伸展', sets: 2 }, { name: '上斜啞鈴彎舉', sets: 3 },
        { name: '錘式彎舉', sets: 2 } ] },
      { exercises: [
        { name: '引體向上（或高滑輪下拉，寬握）', sets: 4 }, { name: '反握窄握滑輪下拉', sets: 3 },
        { name: '直臂下壓', sets: 2 }, { name: '繩索捲腹（跪姿）', sets: 3 },
        { name: '腹輪 或 棒式', sets: 2 }, { name: '⚠️ 累了先砍這天', sets: null } ] },
    ],
  }

  it('⭐ 背算出 19 組 —— Howard 自己在 phaseNote 手寫「背約 19 組是上緣」，對得上', () => {
    expect(planVolume(sean).byMuscle.back).toBe(19)
  })
  it('整份課表沒有解析不出來的動作', () => {
    expect(planVolume(sean).unresolved).toEqual([])
  })
  it('sets=null 的備註列要跳過，不能算成 0 或炸掉', () => {
    expect(planVolume(sean).total).toBe(88)
  })
  it('sets 是字串也要吃（不同課表兩種型別都有）', () => {
    const p = planVolume({ days: [{ exercises: [{ name: '槓鈴深蹲', sets: '4' }] }] })
    expect(p.byMuscle.quads).toBe(4)
  })
  it('"3-4" 這種區間取下限，寧可低估不要高估', () => {
    const p = planVolume({ days: [{ exercises: [{ name: '槓鈴深蹲', sets: '3-4' }] }] })
    expect(p.byMuscle.quads).toBe(3)
  })
})

describe('actualVolume', () => {
  it('每一筆 training_sets ＝ 1 組', () => {
    const r = actualVolume([
      { exercise_name: '胸推' }, { exercise_name: '胸推' }, { exercise_name: '側平舉' },
    ])
    expect(r.byMuscle.chest).toBe(2)
    expect(r.byMuscle.delts_side).toBe(1)
  })
  it('⭐ 暖身/呼吸/Posing/有氧不計入，但要單獨記在 excluded', () => {
    const r = actualVolume([
      { exercise_name: '熊趴' }, { exercise_name: '四足' },
      { exercise_name: '有氧' }, { exercise_name: '胸推' },
    ])
    expect(r.total).toBe(1)
    expect(r.excluded).toBe(3)
  })
  it('0kg 徒手的單腳系列四種打法都歸同一類、都不計入', () => {
    const r = actualVolume(['單腳', '單腳提', '單腳站', '單腳蹄'].map((n) => ({ exercise_name: n })))
    expect(r.total).toBe(0)
    expect(r.excluded).toBe(4)
  })
})

describe('auditVolume 計畫 vs 實做', () => {
  it('算出落差，而且計畫端沒做到的部位也要出現在表上', () => {
    const plan = planVolume({ days: [{ exercises: [
      { name: '槓鈴划船', sets: 11 }, { name: '槓鈴深蹲', sets: 4 } ] }] })
    const actual = actualVolume(Array(7).fill({ exercise_name: '划船' }))
    const rows = auditVolume(plan, actual)
    const back = rows.find((r) => r.muscle === 'back')!
    expect(back.plan).toBe(11)
    expect(back.actual).toBe(7)
    expect(back.gap).toBe(-4)
    expect(rows.find((r) => r.muscle === 'quads')!.actual).toBe(0)
  })
})

describe('flagOf 用 L1 P14 的 10–20 組口徑', () => {
  it.each([[9, 'under'], [10, 'ok'], [20, 'ok'], [21, 'over']] as const)(
    '%i 組 → %s', (n, f) => expect(flagOf(n)).toBe(f))
})

describe('pushPullRatio 只算複合動作', () => {
  it('單關節（側平舉、彎舉）不進推拉比', () => {
    const r = planVolume({ days: [{ exercises: [
      { name: '槓鈴臥推', sets: 4 }, { name: '槓鈴划船', sets: 4 }, { name: '繩索側平舉', sets: 5 } ] }] })
    expect(pushPullRatio(r)).toEqual({ push: 4, pull: 4 })
  })
})

describe('map 本身的健康檢查', () => {
  it('每個 entry 都要有 muscle 跟 pattern', () => {
    for (const [k, v] of Object.entries(EXERCISE_MUSCLE_MAP)) {
      expect(v.muscle, k).toBeTruthy()
      expect(v.pattern, k).toBeTruthy()
    }
  })
  it('⚠️ 還沒判乾淨的動作不要越來越多——目前只剩 2 個', () => {
    const unsure = Object.entries(EXERCISE_MUSCLE_MAP).filter(([, v]) => v.unsure)
    expect(unsure.length).toBeLessThanOrEqual(2)
  })
})
