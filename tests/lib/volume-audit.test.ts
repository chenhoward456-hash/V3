import { describe, it, expect } from 'vitest'
import {
  resolveExercise, lookupExercise, normalizeExerciseName, indirectVolume,
  planVolume, actualVolume, auditVolume, pushPullRatio, flagOf, findGaps, findImbalances,
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
  // ⚠️ 2026-09-21 改成具名白名單。原本是「不超過 2 個」，但一個純數字的上限
  //    只會逼下一個人去放寬它。改成點名——要加新的 unsure，就得同時把它寫進這裡，
  //    等於強迫它出現在 Howard 看得到的地方。
  it('⚠️ 待裁決的動作必須具名登記，不能默默變多', () => {
    const PENDING = [
      '窄握',  // 窄握臥推（胸/三頭）vs 窄握下拉（背）——還沒裁決
    ].sort()
    const unsure = Object.entries(EXERCISE_MUSCLE_MAP).filter(([, v]) => v.unsure).map(([k]) => k).sort()
    expect(unsure).toEqual(PENDING)
  })
})

describe('⚠️ 2026-09-21 稽核修掉的三件', () => {
  it('反向北歐＝股直肌離心，不是膕繩（Howard 確認「練股直的」）', () => {
    expect(lookupExercise('反向北歐')?.muscle).toBe('quads')
  })
  it('⭐ overheadPull 只算背的過頭位，肩推跟過頭三頭不能混進來', () => {
    const r = planVolume({ days: [{ exercises: [
      { name: '引體向上', sets: 4 },        // 背・過頭 → 兩邊都算
      { name: '槓鈴肩推', sets: 3 },        // 肩前束・過頭 → 只進 overhead
      { name: '過頭三頭伸展', sets: 2 },     // 三頭・過頭 → 只進 overhead
    ] }] })
    expect(r.overhead).toBe(9)
    expect(r.overheadPull).toBe(4)
  })
  it('間接量單獨算，不會混進直接組數', () => {
    const items = [{ name: '槓鈴臥推', sets: 4 }]
    expect(planVolume({ days: [{ exercises: items }] }).byMuscle.delts_front).toBeUndefined()
    expect(indirectVolume(items).delts_front).toBe(4)
  })
})

describe('⚠️ 修飾語優先於動作名', () => {
  it('「空槓過頭深蹲」不是一組深蹲——空槓要贏過深蹲（兩者都 2 個字，靠長度排序會隨機）', () => {
    const e = resolveExercise('空槓過頭深蹲（全蹲版的體檢）')!.entry
    expect(e.volume).toBe(false)
  })
  it('「空槓抓舉第一拉 或 過頭深蹲」也一樣不計入', () => {
    expect(resolveExercise('空槓抓舉第一拉 或 過頭深蹲（技術偷塞）')!.entry.volume).toBe(false)
  })
  it('但真的有負重的前蹲照算', () => {
    expect(resolveExercise('前蹲 Front Squat')!.entry.muscle).toBe('quads')
    expect(resolveExercise('前蹲 Front Squat')!.entry.volume).toBeUndefined()
  })
  it('⭐ 奧林匹克舉重不計入肌肥大量（跟 Howard 自己的算法一致）', () => {
    expect(resolveExercise('抓舉（全蹲接 · 起手從膝上懸垂）')!.entry.volume).toBe(false)
    expect(resolveExercise('翻（全蹲接 squat clean）')!.entry.pattern).toBe('olympic')
  })
})

// ⭐ 2026-09-21 Howard 的三項裁決。鎖起來，免得之後有人「覺得怪」就改回去。
describe('Howard 2026-09-21 裁決', () => {
  it('撐體算胸，不是三頭', () => {
    for (const n of ['雙槓撐體', '下胸撐體', 'dips']) {
      expect(resolveExercise(n)?.entry.muscle, n).toBe('chest')
    }
  })
  it('單寫「飛鳥」算肩中束；有方向詞的走自己的 entry', () => {
    expect(resolveExercise('飛鳥')?.entry.muscle).toBe('delts_side')
    expect(resolveExercise('器械飛鳥')?.entry.muscle).toBe('delts_side')
    expect(resolveExercise('機械飛鳥')?.entry.muscle).toBe('delts_side')
    // 方向詞優先，別被裁決誤傷
    expect(resolveExercise('反向飛鳥')?.entry.muscle).toBe('delts_rear')
    expect(resolveExercise('後飛鳥')?.entry.muscle).toBe('delts_rear')
    expect(resolveExercise('上斜飛鳥')?.entry.muscle).toBe('chest')
    expect(resolveExercise('坐姿夾胸')?.entry.muscle).toBe('chest')
    expect(resolveExercise('滑輪下夾胸')?.entry.muscle).toBe('chest')
  })
  it('相撲硬舉算臀，但 also 要留著股四（排腿後日時膕繩量會被高估）', () => {
    const e = resolveExercise('相撲硬舉')?.entry
    expect(e?.muscle).toBe('glutes')
    expect(e?.also).toContain('quads')
    expect(e?.unsure).toBeUndefined()
  })
})

describe('findGaps / findImbalances', () => {
  const mk = (pairs: Array<[string, number]>) =>
    actualVolume(pairs.flatMap(([n, k]) => Array.from({ length: k }, () => ({ exercise_name: n }))))

  it('掛零的部位要被報出來——那正是「每肌群週組數」那張圖畫不出來的', () => {
    const r = mk([['平板臥推', 4], ['引體向上', 4], ['深蹲', 4]])
    const g = findGaps(r)
    expect(g.find((x) => x.muscle === 'calves')?.severity).toBe('zero')
    expect(g.find((x) => x.muscle === 'delts_side')?.severity).toBe('zero')
  })

  it('⚠️ 間接量餵飽的不算缺口——不然「肩前束只有 3 組」會變成永遠在響的假警報', () => {
    // 臥推的 also 含 delts_front / triceps
    const r = mk([['平板臥推', 8], ['上斜臥推', 6]])
    const g = findGaps(r)
    expect(g.find((x) => x.muscle === 'delts_front')).toBeUndefined()
    expect(g.find((x) => x.muscle === 'triceps')).toBeUndefined()
  })

  it('⚠️ 門檻是「幾乎沒碰」(≤2)，不是「偏低」——非健美學員的量本來就比較小', () => {
    const r = mk([['平板臥推', 4], ['引體向上', 4]])
    // 胸 4、背 4 都低於 10–20 區間，但那是目標問題，不該報成缺口
    expect(findGaps(r).find((x) => x.muscle === 'chest')).toBeUndefined()
    expect(findGaps(r).find((x) => x.muscle === 'back')).toBeUndefined()
  })

  it('肩中束 17 : 肩後束 2 要被抓出來（實例：一份健體課表）', () => {
    const r = mk([['啞鈴側平舉', 15], ['繩索提拉', 2], ['反向飛鳥', 2]])
    const im = findImbalances(r)
    expect(im[0].high).toBe('delts_side')
    expect(im[0].low).toBe('delts_rear')
    expect(im[0].ratio).toBeGreaterThanOrEqual(2.5)
  })

  it('⚠️ 兩邊都沒練不算失衡（2:0 是兩個都沒做，交給 findGaps 報）', () => {
    const r = mk([['啞鈴側平舉', 2], ['深蹲', 10]])
    expect(findImbalances(r).find((x) => x.high === 'delts_side')).toBeUndefined()
  })

  it('⚠️ 失衡的說明必須中性——哪一邊多是跑出來才知道的', () => {
    const r = mk([['引體向上', 9], ['平板臥推', 3]])
    const im = findImbalances(r).find((x) => x.high === 'back')
    expect(im).toBeDefined()
    // 第一版寫死「胸長期壓過背」，碰到背壓過胸的學員文案就跟數字反了
    expect(im!.why).not.toContain('胸長期壓過背')
  })
})

/**
 * ⭐ 英文速記。2026-09-21 拿這支去解析一份教練手寫的課表，
 *    57 組裡 30 組對不到，全敗在縮寫（SA / DB / BB / BP / SP / RDL）。
 *    逐個加 entry 沒用——組合是乘法，展開才是解法。
 */
describe('英文速記展開', () => {
  const m = (n: string) => resolveExercise(n)?.entry.muscle
  it('器材縮寫', () => {
    expect(m('DB BP')).toBe('chest')          // 啞鈴臥推
    expect(m('BB RDL')).toBe('hamstrings')    // 槓鈴羅馬尼亞硬舉
    expect(m('器 SP')).toBe('delts_front')    // 器械肩推
  })
  it('單邊 + 器材 + 動作的組合', () => {
    expect(m('SA DB Row')).toBe('back')       // 單臂啞鈴划船
    expect(m('SA DB RDL')).toBe('hamstrings')
    expect(m('SA Lunge')).toBe('quads')
  })
  it('⚠️ 展開要在去空白之前——"sa db rdl" 去掉空白就切不出縮寫了', () => {
    expect(normalizeExerciseName('SA DB RDL')).toBe('sadbrdl')
    expect(m('SA DB RDL')).toBe('hamstrings')  // 仍然要對得到
  })
  it('⚠️ 詞邊界：sa/bb/dl 不能咬進別的名字裡', () => {
    expect(m('sissy squat')).toBe('quads')     // 不能被 /\bsa\b/ 或 /\bdl\b/ 影響
    expect(m('深蹲')).toBe('quads')
  })
  it('⚠️ 羅馬椅是髖伸不是脊椎伸——主部位臀，不是豎脊肌', () => {
    const e = resolveExercise('羅馬椅')?.entry
    expect(e?.muscle).toBe('glutes')
    expect(e?.pattern).toBe('hinge')
  })
})
