/**
 * volume-audit.ts —— 動作名 → 部位／動作型態 的單一真相來源
 *
 * 【為什麼需要這支】
 * 2026-09-21 查 production：`training_sets` 有 919 組、143 個不同動作名、半年資料，
 * 但 `muscle_group` 欄位填寫率 **0.0%**（919 筆全空）。
 * 所以 `app/admin/clients/[clientId]/overview/page.tsx` 那張「本週各部位組數」圖
 * 從上線到現在永遠是空的——它靠 `s.muscle_group` 加總。
 *
 * 動作名本身是有的而且很具體。補上這張對應表，那 919 組立刻全部有部位，
 * **學員不用回頭補填任何東西**。
 *
 * 【⚠️ 紅線 6：單一真相來源】
 * 動作 → 部位的對應**只能存在這裡**。前端、cron、API 一律 import，
 * 不要在別的地方再寫一份 labelMap / 分類邏輯。
 * （overview/page.tsx 的 labelMap 之後要改成從這裡拿。）
 *
 * 【為什麼要分這麼細】
 * 只給「肩 19 組」沒有用。實際帶人時要看的是：
 *   · 前束 7 ／ 中束 8 ／ 後束 4  ← 決定 V-taper 的是中束，而前束早被胸推餵飽了
 *   · 水平拉 7 ／ 過頭位 4        ← 背闊在「手臂過頭」那個範圍吃不夠是常見的洞
 *   · 推 : 拉 比例
 * 所以 muscle 拆到三角肌三束，另外用 `overhead` 標「手臂過頭」的動作。
 */

export type Muscle =
  | 'chest' | 'back' | 'traps'
  | 'delts_front' | 'delts_side' | 'delts_rear'
  | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'adductors' | 'abductors' | 'calves'
  | 'core'

/** 動作型態。h=水平 v=垂直 */
export type Pattern =
  | 'h_push' | 'v_push' | 'h_pull' | 'v_pull'
  | 'squat' | 'hinge' | 'lunge'
  | 'iso' | 'carry'
  | 'cardio' | 'prep' | 'posing'
  /** 奧林匹克舉重的技術動作 */
  | 'olympic'

export interface ExerciseEntry {
  /** 主要部位（算組數時計 1 組） */
  muscle: Muscle
  /**
   * 次要部位。
   * ⚠️ **預設不計入組數**——「10–20 組／肌群／週」講的是直接組數，把間接量加進去會灌水。
   *    要用的時候走 `indirectVolume()`，例如想說明「前束已經被胸推餵飽了」那種論點。
   */
  also?: Muscle[]
  pattern: Pattern
  /**
   * 手臂過頭的動作。
   * ⚠️ 2026-09-21 修：這個旗標同時標到三類——背（引體/下拉 15 個）、肩前束（肩推 10 個）、
   *    三頭（過頭伸展 9 個）。但我當初建它的**唯一理由**是「背闊在手臂過頭那個範圍吃不夠」，
   *    把肩推跟過頭三頭一起算進去會把那個數字灌水。
   *    → 總數用 `overhead`，要談背闊覆蓋一律用 `overheadPull`。
   */
  overhead?: true
  /** false = 不計入肌肥大組數（暖身、呼吸、posing、有氧） */
  volume?: false
  /** 我分不出來、要 Howard 判的 */
  unsure?: true
  note?: string
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: '胸', back: '背', traps: '斜方',
  delts_front: '肩前束', delts_side: '肩中束', delts_rear: '肩後束',
  biceps: '二頭', triceps: '三頭', forearms: '前臂',
  quads: '股四頭', hamstrings: '腿後', glutes: '臀',
  adductors: '內收肌', abductors: '外展肌', calves: '小腿',
  core: '核心',
}

export const PATTERN_LABEL: Record<Pattern, string> = {
  h_push: '水平推', v_push: '垂直推', h_pull: '水平拉', v_pull: '垂直拉',
  squat: '蹲系', hinge: '髖鉸鏈', lunge: '單腳',
  iso: '單關節', carry: '負重行走',
  cardio: '有氧', prep: '暖身／呼吸', posing: 'Posing', olympic: '舉重技術',
}

/**
 * ⚠️ key 要用 normalizeExerciseName() 正規化後的形式（小寫、去空白、全形轉半形）。
 *    下面寫的是原始中文，查表時兩邊都會過同一支正規化。
 */
export const EXERCISE_MUSCLE_MAP: Record<string, ExerciseEntry> = {
  // ── 胸 ──────────────────────────────────────────────
  '胸推': { muscle: 'chest', also: ['delts_front', 'triceps'], pattern: 'h_push' },
  '胸推機': { muscle: 'chest', also: ['delts_front', 'triceps'], pattern: 'h_push' },
  '器械胸推': { muscle: 'chest', also: ['delts_front', 'triceps'], pattern: 'h_push' },
  '史密斯胸推': { muscle: 'chest', also: ['delts_front', 'triceps'], pattern: 'h_push' },
  '槓鈴臥推': { muscle: 'chest', also: ['delts_front', 'triceps'], pattern: 'h_push' },
  '啞鈴臥推': { muscle: 'chest', also: ['delts_front', 'triceps'], pattern: 'h_push' },
  '啞鈴胸推': { muscle: 'chest', also: ['delts_front', 'triceps'], pattern: 'h_push' },
  '平胸推（機械/槓鈴）': { muscle: 'chest', also: ['delts_front', 'triceps'], pattern: 'h_push' },
  '上斜臥推': { muscle: 'chest', also: ['delts_front'], pattern: 'h_push' },
  '上斜啞鈴臥推': { muscle: 'chest', also: ['delts_front'], pattern: 'h_push' },
  '上斜史密斯臥推': { muscle: 'chest', also: ['delts_front'], pattern: 'h_push' },
  '上斜hammer臥推': { muscle: 'chest', also: ['delts_front'], pattern: 'h_push' },
  '史密斯上胸': { muscle: 'chest', also: ['delts_front'], pattern: 'h_push' },
  '機械上胸': { muscle: 'chest', also: ['delts_front'], pattern: 'h_push' },
  'dips': { muscle: 'chest', also: ['triceps'], pattern: 'h_push' },
  '雙槓撐體': { muscle: 'chest', also: ['triceps'], pattern: 'h_push' },
  '機械夾胸': { muscle: 'chest', pattern: 'iso' },
  '機械飛鳥': { muscle: 'delts_side', pattern: 'iso', note: '同「飛鳥」裁決。⚠️「機械」「器械」是同義詞，不能一個判胸一個判肩' },
  'machinefly': { muscle: 'chest', pattern: 'iso' },
  '反向飛鳥夾胸超級組（胸）': { muscle: 'chest', pattern: 'iso' },

  // ── 背 ──────────────────────────────────────────────
  // 水平拉
  '划船': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  '坐姿划船': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  '坐姿划船機': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  '器械划船': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  '繩索划船': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  '坐姿繩索划船': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  '坐姿纜繩划船（窄握v-bar）': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  '槓鈴划船': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  '啞鈴划船': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  '啞鈴單臂划船': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  '單臂啞鈴划船': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  '啞鈴板凳划船': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  'hammer划船': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  'hammerrow': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  'upperbackcablerow': { muscle: 'back', also: ['delts_rear', 'traps'], pattern: 'h_pull' },

  // 垂直拉（過頭位）
  '引體向上': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  'assistedpullup': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  '加重引體或滑輪下拉': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  '器械下拉or輔助引體向上': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  '滑輪下拉': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  'latpulldown': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  '寬把滑輪下拉': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  '對握下拉': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  '反握窄握滑輪下拉（下闊背）': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  '單邊器械下拉正手': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  '單邊器械下拉反手': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  '單邊機械下拉正手': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  '單邊器械反手': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  // ⭐ 直臂下壓：起始位就是肩屈曲（手臂在前上方），所以算過頭位。
  //    2026-09-20 Temu 案例踩過——把它算成水平拉會低估過頭位的覆蓋。
  '直臂下壓': { muscle: 'back', pattern: 'iso', overhead: true, note: '單關節但起始位是肩屈曲，計入過頭位' },
  '剪刀下拉': { muscle: 'back', pattern: 'v_pull', overhead: true, note: '雙繩索交叉的下拉，軌道是垂直拉' },

  // ── 肩 ──────────────────────────────────────────────
  '肩推': { muscle: 'delts_front', also: ['triceps'], pattern: 'v_push', overhead: true },
  '機械肩推': { muscle: 'delts_front', also: ['triceps'], pattern: 'v_push', overhead: true },
  '坐姿器械肩推': { muscle: 'delts_front', also: ['triceps'], pattern: 'v_push', overhead: true },
  '史密斯肩推': { muscle: 'delts_front', also: ['triceps'], pattern: 'v_push', overhead: true },
  '槓鈴肩推': { muscle: 'delts_front', also: ['triceps'], pattern: 'v_push', overhead: true },
  '坐姿槓鈴肩推': { muscle: 'delts_front', also: ['triceps'], pattern: 'v_push', overhead: true },
  '側平舉': { muscle: 'delts_side', pattern: 'iso' },
  '側飛鳥': { muscle: 'delts_side', pattern: 'iso' },
  '反向飛鳥': { muscle: 'delts_rear', pattern: 'iso' },
  '後飛鳥': { muscle: 'delts_rear', pattern: 'iso' },
  '上斜飛鳥': { muscle: 'chest', pattern: 'iso', note: '躺姿有角度＝胸，不吃「飛鳥＝肩」的預設' },
  '平板飛鳥': { muscle: 'chest', pattern: 'iso' },
  '啞鈴飛鳥': { muscle: 'chest', pattern: 'iso', note: '慣例指躺姿胸飛鳥' },
  '啞鈴側平舉': { muscle: 'delts_side', pattern: 'iso' },
  '啞鈴坐姿側平舉': { muscle: 'delts_side', pattern: 'iso' },
  '繩索側平舉': { muscle: 'delts_side', pattern: 'iso' },
  '超級組啞鈴坐姿側平舉往前': { muscle: 'delts_side', also: ['delts_front'], pattern: 'iso' },
  '後三角飛鳥': { muscle: 'delts_rear', pattern: 'iso' },
  '反向飛鳥夾胸超級組（後三角）': { muscle: 'delts_rear', pattern: 'iso' },
  '面拉': { muscle: 'delts_rear', also: ['traps'], pattern: 'iso' },
  '啞鈴面拉': { muscle: 'delts_rear', also: ['traps'], pattern: 'iso' },

  // ── 手臂 ────────────────────────────────────────────
  '二頭彎舉': { muscle: 'biceps', pattern: 'iso' },
  'biceps': { muscle: 'biceps', pattern: 'iso' },
  '啞鈴彎舉': { muscle: 'biceps', pattern: 'iso' },
  '啞鈴二頭彎舉': { muscle: 'biceps', pattern: 'iso' },
  '槓鈴彎舉': { muscle: 'biceps', pattern: 'iso' },
  'ez槓彎舉': { muscle: 'biceps', pattern: 'iso' },
  'w把2頭': { muscle: 'biceps', pattern: 'iso' },
  '錘式彎舉': { muscle: 'biceps', also: ['forearms'], pattern: 'iso' },
  '槌式二頭': { muscle: 'biceps', also: ['forearms'], pattern: 'iso' },
  '三頭下壓': { muscle: 'triceps', pattern: 'iso' },
  '三頭下壓（直桿）': { muscle: 'triceps', pattern: 'iso' },
  '三頭下壓（繩索）': { muscle: 'triceps', pattern: 'iso' },
  '繩索三頭下壓': { muscle: 'triceps', pattern: 'iso' },
  'cable三頭': { muscle: 'triceps', pattern: 'iso' },
  'longtriceps': { muscle: 'triceps', pattern: 'iso', overhead: true, note: '長頭＝過頭位' },
  '過頭三頭': { muscle: 'triceps', pattern: 'iso', overhead: true },
  '過頭三頭伸展': { muscle: 'triceps', pattern: 'iso', overhead: true },
  '過頭三頭下壓（繩索）': { muscle: 'triceps', pattern: 'iso', overhead: true },
  '繩索過頭伸展': { muscle: 'triceps', pattern: 'iso', overhead: true },

  // ── 腿 ──────────────────────────────────────────────
  '鐘擺蹲': { muscle: 'quads', also: ['glutes'], pattern: 'squat' },
  '深蹲或哈克蹲': { muscle: 'quads', also: ['glutes'], pattern: 'squat' },
  '腿推': { muscle: 'quads', also: ['glutes'], pattern: 'squat' },
  '腿推器械': { muscle: 'quads', also: ['glutes'], pattern: 'squat' },
  '腿推深蹲': { muscle: 'quads', also: ['glutes'], pattern: 'squat' },
  'legpress': { muscle: 'quads', also: ['glutes'], pattern: 'squat' },
  'legextension': { muscle: 'quads', pattern: 'iso' },
  '分腿蹲': { muscle: 'quads', also: ['glutes'], pattern: 'lunge' },
  '弓步': { muscle: 'quads', also: ['glutes'], pattern: 'lunge' },
  '弓步蹲': { muscle: 'quads', also: ['glutes'], pattern: 'lunge' },
  // ⚠️ 羅馬椅（45 度背伸展）主部位是臀＋腿後，不是豎脊肌——
  //    脊椎保持中立、動作發生在髖，是髖伸不是脊椎伸。
  '羅馬椅': { muscle: 'glutes', also: ['hamstrings', 'back'], pattern: 'hinge' },
  '背伸展': { muscle: 'glutes', also: ['hamstrings', 'back'], pattern: 'hinge' },
  '鳥狗划船': { muscle: 'back', also: ['core'], pattern: 'h_pull', note: '四足跪姿單臂划船，抗旋轉' },
  '水平外展划船': { muscle: 'back', also: ['delts_rear'], pattern: 'h_pull' },
  '下拉': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  '分動下拉': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  '保加利亞': { muscle: 'quads', also: ['glutes'], pattern: 'lunge' },
  '保加利亞蹲': { muscle: 'quads', also: ['glutes'], pattern: 'lunge' },
  '保加利亞分腿蹲（左側focus）': { muscle: 'quads', also: ['glutes'], pattern: 'lunge' },
  '弓箭步走': { muscle: 'quads', also: ['glutes'], pattern: 'lunge' },
  '羅馬尼亞硬舉': { muscle: 'hamstrings', also: ['glutes', 'back'], pattern: 'hinge' },
  '羅馬尼亞硬舉rdl': { muscle: 'hamstrings', also: ['glutes', 'back'], pattern: 'hinge' },
  'deadlift': { muscle: 'hamstrings', also: ['glutes', 'back', 'traps'], pattern: 'hinge' },
  '單腳硬舉': { muscle: 'hamstrings', also: ['glutes'], pattern: 'hinge' },
  '臀推': { muscle: 'glutes', also: ['hamstrings'], pattern: 'hinge' },
  '腿彎舉': { muscle: 'hamstrings', pattern: 'iso' },
  '腿彎舉（坐姿）': { muscle: 'hamstrings', pattern: 'iso' },
  '坐姿腿彎舉': { muscle: 'hamstrings', pattern: 'iso' },
  '坐姿腿後勾': { muscle: 'hamstrings', pattern: 'iso' },
  'lyinglegcurl': { muscle: 'hamstrings', pattern: 'iso' },
  '小腿提踵': { muscle: 'calves', pattern: 'iso' },
  '站姿小腿提踵': { muscle: 'calves', pattern: 'iso' },
  '大腿內側': { muscle: 'adductors', pattern: 'iso' },
  '夾內側': { muscle: 'adductors', pattern: 'iso' },
  '夾腿': { muscle: 'adductors', pattern: 'iso' },
  'hipabd': { muscle: 'abductors', pattern: 'iso' },

  // ── 核心 ────────────────────────────────────────────
  '捲腹': { muscle: 'core', pattern: 'iso' },
  '反向捲腹': { muscle: 'core', pattern: 'iso' },
  '滑輪捲腹': { muscle: 'core', pattern: 'iso' },
  '跪姿纜繩捲腹': { muscle: 'core', pattern: 'iso' },
  '加重懸垂舉腿': { muscle: 'core', pattern: 'iso' },
  '腹輪或棒式': { muscle: 'core', pattern: 'iso' },
  '壺鈴扭轉': { muscle: 'core', pattern: 'iso' },

  // ── 負重行走 ────────────────────────────────────────
  // ⚠️ 負重行走計入組數，但 pattern 標 'carry' 讓下游可以濾掉。
  //    12 組農夫走路會顯示成「斜方 12 組」，看起來像直接練斜方——它不是，
  //    要談「這個部位的肌肥大刺激夠不夠」時要把 carry 拿掉再看。
  '農夫': { muscle: 'traps', also: ['forearms', 'core'], pattern: 'carry' },
  '農夫走': { muscle: 'traps', also: ['forearms', 'core'], pattern: 'carry' },
  '農夫走路': { muscle: 'traps', also: ['forearms', 'core'], pattern: 'carry' },

  // ── 不計入肌肥大組數 ────────────────────────────────
  '有氧': { muscle: 'core', pattern: 'cardio', volume: false },
  '中強度有氧（跑步機快走/騎車/划船機）': { muscle: 'core', pattern: 'cardio', volume: false },
  '90/90呼吸+左側承重（leftaic暖身）': { muscle: 'core', pattern: 'prep', volume: false },
  '90/90呼吸+左髖內旋啟動（leftaic暖身）': { muscle: 'core', pattern: 'prep', volume: false },
  '熊趴': { muscle: 'core', pattern: 'prep', volume: false },
  '熊呼吸': { muscle: 'core', pattern: 'prep', volume: false },
  '真空vacuum（古典細腰）': { muscle: 'core', pattern: 'posing', volume: false },
  'posing練習（古典）': { muscle: 'core', pattern: 'posing', volume: false },


  // ── 課表端的寫法（教練寫的，比學員打的囉嗦）──────────
  // ⚠️ training_plan 裡的動作名跟 training_sets 裡的是兩套用字習慣。
  //    例：學員打「胸推」，課表寫「槓鈴臥推（或 Smith 機）」。
  //    下面補的是課表那一側，模糊解析再兜剩下的。
  '槓鈴深蹲': { muscle: 'quads', also: ['glutes'], pattern: 'squat' },
  '深蹲': { muscle: 'quads', also: ['glutes'], pattern: 'squat' },
  '哈克蹲': { muscle: 'quads', also: ['glutes'], pattern: 'squat' },
  '腿推機': { muscle: 'quads', also: ['glutes'], pattern: 'squat' },
  '提踵': { muscle: 'calves', pattern: 'iso' },
  '站姿提踵': { muscle: 'calves', pattern: 'iso' },
  '上斜槓鈴臥推': { muscle: 'chest', also: ['delts_front'], pattern: 'h_push' },
  '繩索夾胸': { muscle: 'chest', pattern: 'iso' },
  '夾胸': { muscle: 'chest', pattern: 'iso' },
  // ⚠️ Pullover 的主部位有爭議：背闊與胸大肌的活化都高，兩派都說得通。
  //    這裡記 back（它走拉的軌道、慣例排在拉日），also 掛 chest 讓間接量看得到。
  '臥姿屈臂上拉': { muscle: 'back', also: ['chest'], pattern: 'v_pull', overhead: true },
  '屈臂上拉': { muscle: 'back', also: ['chest'], pattern: 'v_pull', overhead: true },
  '髖外展': { muscle: 'abductors', pattern: 'iso' },
  '髖內收': { muscle: 'adductors', pattern: 'iso' },
  '蝴蝶機': { muscle: 'chest', pattern: 'iso' },
  '反式蝴蝶機': { muscle: 'delts_rear', pattern: 'iso' },
  '坐姿啞鈴肩推': { muscle: 'delts_front', also: ['triceps'], pattern: 'v_push', overhead: true },
  '啞鈴肩推': { muscle: 'delts_front', also: ['triceps'], pattern: 'v_push', overhead: true },
  '肩推機': { muscle: 'delts_front', also: ['triceps'], pattern: 'v_push', overhead: true },
  't-bar划船': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  '坐姿纜繩划船': { muscle: 'back', also: ['biceps'], pattern: 'h_pull' },
  '高滑輪下拉': { muscle: 'back', also: ['biceps'], pattern: 'v_pull', overhead: true },
  '面拉facepull': { muscle: 'delts_rear', also: ['traps'], pattern: 'iso' },
  '上斜啞鈴彎舉': { muscle: 'biceps', pattern: 'iso' },
  '啞鈴過頭三頭伸展': { muscle: 'triceps', pattern: 'iso', overhead: true },
  '啞鈴過頭伸展': { muscle: 'triceps', pattern: 'iso', overhead: true },
  '懸吊舉腿': { muscle: 'core', pattern: 'iso' },
  '繩索捲腹': { muscle: 'core', pattern: 'iso' },
  '棒式': { muscle: 'core', pattern: 'iso' },
  '腹輪': { muscle: 'core', pattern: 'iso' },


  // ── 內訓／教練手寫的第三套用字（2026-09-21 補）────────
  // ⚠️ 到目前為止 map 是從 V3 的 training_sets ＋ training_plan 長出來的，
  //    但健美內訓那邊教練手寫的課表又是另一套寫法（平板臥推、下胸撐體、六角槓硬舉、反向北歐…）。
  //    這批是拿 Temu 跟內訓案例的課表實際跑過、對不到才補上的。
  //    ⭐ 通則：新的用字一律補在這支，不要在別的地方另開一張表。
  '平板臥推': { muscle: 'chest', also: ['delts_front', 'triceps'], pattern: 'h_push' },
  '器械水平胸推': { muscle: 'chest', also: ['delts_front', 'triceps'], pattern: 'h_push' },
  '下胸撐體': { muscle: 'chest', also: ['triceps'], pattern: 'h_push' },
  '器械上胸': { muscle: 'chest', pattern: 'h_push', note: '上斜器械推，上胸角度' },
  // ⭐ Sissy squat：膝往前、髖保持伸展，所以股直肌（唯一跨髖的股四頭）在拉長端被練到。
  //    跟腿屈伸不同——腿屈伸是屈髖位，股直肌已經縮短，吃不到那一段。
  'sissy squat': { muscle: 'quads', pattern: 'iso', note: '髖伸展位的股四，股直肌拉長端' },
  '西西深蹲': { muscle: 'quads', pattern: 'iso', note: '同 sissy squat' },
  // ⭐ Howard 2026-09-21 裁決：主部位＝臀。
  // ⚠️ Escamilla 2000/2002 測出相撲的膝伸力矩比傳統硬舉大、髖伸力矩小，內收肌活化也高——
  //    所以它的股四參與比傳統硬舉高。排在「腿後日」時，那天的膕繩量會比標題看起來少。
  '相撲硬舉': { muscle: 'glutes', also: ['quads', 'adductors', 'hamstrings', 'back'], pattern: 'hinge',
    note: '裁決＝臀。股四參與比傳統硬舉高（Escamilla），排腿後日要注意膕繩量被高估' },
  '坐姿夾胸': { muscle: 'chest', pattern: 'iso' },
  '滑輪下夾胸': { muscle: 'chest', pattern: 'iso' },
  '三頭臥姿過頭伸': { muscle: 'triceps', pattern: 'iso', overhead: true },
  '繩索三頭過頭伸': { muscle: 'triceps', pattern: 'iso', overhead: true },
  '下腹抬腿': { muscle: 'core', pattern: 'iso' },
  '躺姿捲腹': { muscle: 'core', pattern: 'iso' },
  '側棒式': { muscle: 'core', pattern: 'iso' },
  '啞鈴斜板二頭': { muscle: 'biceps', pattern: 'iso' },
  '繩索錘式二頭': { muscle: 'biceps', also: ['forearms'], pattern: 'iso' },
  // ⚠️ 繩索提拉（upright row）主要是中束＋斜方上束，不是前束
  '繩索提拉': { muscle: 'delts_side', also: ['traps'], pattern: 'iso' },
  '滑輪前平舉': { muscle: 'delts_front', pattern: 'iso' },
  '史密斯硬舉': { muscle: 'hamstrings', also: ['glutes', 'back'], pattern: 'hinge' },
  // ⭐ 2026-09-21 稽核修正：六角槓硬舉**不是髖主導**，主要部位從腿後改成股四頭。
  //    Stahl 2024, J Strength Cond Res 38(5):815-824（doi 10.1519/JSC.0000000000004729）
  //    16 人 3D 動作捕捉＋測力板，六角槓硬舉 vs 背蹲舉：
  //      · 膝伸力矩 **兩者無顯著差異**
  //      · 髖伸力矩 **背蹲舉還比較大**
  //      · 結論：六角槓的握把位置讓**髖與膝的力臂是平衡的**，反而是背蹲舉才偏髖主導
  //    ⚠️ 但六角槓的膝屈曲角度比背蹲舉小（ROM 較短），所以不是深蹲的完全替代品。
  //    ⛔ 原本記成 hamstrings 會讓「這個人有沒有膝主導主項」整個判錯。
  '六角槓硬舉': { muscle: 'quads', also: ['glutes', 'hamstrings', 'traps', 'back'], pattern: 'hinge', note: 'Stahl 2024：膝伸力矩與背蹲舉無差異、髖伸力矩比背蹲舉小 → 髖膝平衡，不是純髖主導' },
  '腿伸': { muscle: 'quads', pattern: 'iso' },
  '腿勾': { muscle: 'hamstrings', pattern: 'iso' },
  '深蹲機': { muscle: 'quads', also: ['glutes'], pattern: 'squat' },
  // ⭐ 2026-09-21 Howard 確認：「練股直的」。
  //    Reverse Nordic（跪姿往後躺）＝髖伸 ＋ 膝屈，**股直肌是唯一跨髖的股四頭**，
  //    這個姿勢把它拉到最長，所以練的是股直不是膕繩。
  // ⛔ 不要跟 Nordic curl（膕繩離心）搞混，也不要把它當腿彎舉的替代——兩個練不同肌肉。
  '反向北歐': { muscle: 'quads', pattern: 'iso', note: 'Reverse Nordic＝股直肌離心（Howard 2026-09-21 確認）。⛔ 不是膕繩，不可與腿彎舉互換' },
  '後腳抬高蹲': { muscle: 'quads', also: ['glutes'], pattern: 'lunge' },
  '滾筒放鬆': { muscle: 'core', pattern: 'prep', volume: false },
  '90-90呼吸': { muscle: 'core', pattern: 'prep', volume: false },
  '90-90 呼吸': { muscle: 'core', pattern: 'prep', volume: false },

  // 壺鈴擺盪：B 教練課表裡兩天都有，原本整個對不到
  'swing': { muscle: 'glutes', also: ['hamstrings', 'back'], pattern: 'hinge' },
  '壺鈴擺盪': { muscle: 'glutes', also: ['hamstrings', 'back'], pattern: 'hinge' },
  'kettlebellswing': { muscle: 'glutes', also: ['hamstrings', 'back'], pattern: 'hinge' },
  'kbdl': { muscle: 'hamstrings', also: ['glutes', 'back'], pattern: 'hinge' },
  'kb硬舉': { muscle: 'hamstrings', also: ['glutes', 'back'], pattern: 'hinge' },
  // 「六角槓」單寫（後面接重量時名字會被切到只剩這兩個字）
  '六角槓': { muscle: 'quads', also: ['glutes', 'hamstrings', 'traps', 'back'], pattern: 'hinge' },

  // ── 奧林匹克舉重（Howard 自己的舉重日）────────────────
  // ⚠️ 抓舉／翻／挺標 volume:false，**跟 Howard 自己的算法一致**——
  //    他在 Block3-WL 把股四算 6 組（＝前蹲 3 ＋ D5 哈克蹲 3），沒有把抓舉翻的 10 組算進去。
  //    理由：5×2 跑 65-75% 是技術與爆發訓練，不是肌肥大刺激。
  //    但它們**確實吃恢復**，所以 pattern 標 'olympic' 讓下游看得到它存在。
  '抓舉': { muscle: 'quads', also: ['back', 'traps', 'delts_side'], pattern: 'olympic', volume: false },
  'snatch': { muscle: 'quads', also: ['back', 'traps'], pattern: 'olympic', volume: false },
  '翻': { muscle: 'quads', also: ['back', 'traps'], pattern: 'olympic', volume: false },
  'squatclean': { muscle: 'quads', also: ['back', 'traps'], pattern: 'olympic', volume: false },
  '分腿挺': { muscle: 'delts_front', also: ['triceps', 'quads'], pattern: 'olympic', volume: false },
  'jerk': { muscle: 'delts_front', also: ['triceps', 'quads'], pattern: 'olympic', volume: false },
  '挺舉': { muscle: 'delts_front', also: ['triceps', 'quads'], pattern: 'olympic', volume: false },
  '空槓': { muscle: 'core', pattern: 'prep', volume: false, note: '空槓技術複習，不吃恢復也不算量' },
  '徒手': { muscle: 'core', pattern: 'prep', volume: false },
  'pvc': { muscle: 'core', pattern: 'prep', volume: false },
  // 這兩個是真的輔助訓練，照常計入
  '前蹲': { muscle: 'quads', also: ['core'], pattern: 'squat' },
  'frontsquat': { muscle: 'quads', also: ['core'], pattern: 'squat' },
  '抓舉握距rdl': { muscle: 'hamstrings', also: ['glutes', 'back'], pattern: 'hinge' },
  'snatch-griprdl': { muscle: 'hamstrings', also: ['glutes', 'back'], pattern: 'hinge' },
  '後三角孤立': { muscle: 'delts_rear', pattern: 'iso' },
  '俯身側平舉': { muscle: 'delts_rear', pattern: 'iso' },
  '纜繩單臂側平舉': { muscle: 'delts_side', pattern: 'iso' },

  // ── 靠資料反推判定的（2026-09-21）────────────────────
  //
  // 這幾個動作名是學員自己打的，光看名字分不出來。
  // 改用三個線索反推：**重量 × 次數 × 同一天還練了什麼**。下面每一條都寫了依據。
  //
  // ⭐ 方法本身值得留著：以後遇到看不懂的動作名，不要用猜的，跑這個查詢——
  //    SELECT 重量/次數 + 同日其他動作，答案幾乎都在裡面。

  // 30kg 機器 × 12 下，而且同一個學員另外會打「大腿內側」「夾內側」「夾腿」→ 內收肌機
  '腿內': { muscle: 'adductors', pattern: 'iso', note: '30kg×12 機器，同學員另有大腿內側/夾腿等同義名' },

  // 15kg×8。⭐ 同一天已經有「啞鈴坐姿側平舉」和「超級組啞鈴坐姿側平舉往前」兩個中束動作，
  //    所以這個「機械肩膀」不會又是中束 → 判為機械肩推。「26」是器材編號。
  '26機械肩膀': { muscle: 'delts_front', also: ['triceps'], pattern: 'v_push', overhead: true, note: '15kg×8；同日已有兩個側平舉，判為機械肩推。26＝器材編號' },

  // 15kg 壺鈴 × 10。⭐ 同一天全是背＋二頭（划船、下拉、彎舉）而且有「壺鈴扭轉」
  //    → 跟扭轉同屬壺鈴核心動作，不是肩推。
  '壺鈴對角 上抬': { muscle: 'core', also: ['delts_front'], pattern: 'iso', note: '15kg×10；同日為拉日＋壺鈴扭轉，判為核心旋轉類' },

  // ⭐ 徒手 × 6「下」＝ 6 次呼吸。這就是課表裡的四足跪姿呼吸。
  '四足': { muscle: 'core', pattern: 'prep', volume: false, note: '徒手×6，6「下」＝6 次呼吸 → 四足跪姿呼吸' },

  // 0kg 而且連 reps 都沒填 → 不是組數型動作
  '跪姿': { muscle: 'core', pattern: 'prep', volume: false, note: '0kg 且無 reps，非組數型動作' },

  // ⭐ 單腳系列四個名字（單腳／單腳提／單腳站／單腳蹄）全部是 **0kg 徒手 × 12**、
  //    同一個學員、都出現在有分腿蹲＋划船＋農夫走路的功能日。
  //    「單腳」和「單腳提」甚至是同一天的兩筆——是同一個動作的不同打法。
  //    ⚠️ 判定依據是重量：這個學員鐘擺蹲做到 20 組，0kg 徒手 12 下不可能是主要肌肥大刺激
  //    → 一律歸功能／平衡，不計入肌肥大組數。四個加起來 21 組，判錯的代價很小，
  //      而且它們本來就不該影響「這個部位練夠了沒」的判讀。
  '單腳': { muscle: 'core', pattern: 'prep', volume: false, note: '0kg×12 徒手・功能日・單腳支撐類' },
  '單腳提': { muscle: 'core', pattern: 'prep', volume: false, note: '同上，與「單腳」同一天的另一筆' },
  '單腳站': { muscle: 'core', pattern: 'prep', volume: false, note: '同上' },
  '單腳蹄': { muscle: 'core', pattern: 'prep', volume: false, note: '同上，「蹄」為錯字' },

  // ── ⚠️ 資料也判不乾淨的，只剩這兩個（各 3 組）──────────
  // 25kg×12，同一天是「胸推＋鐘擺蹲＋坐姿腿彎舉＋四足」——**那天沒有任何背部動作**，
  // 所以比較可能是窄握臥推（補三頭）而不是窄握下拉。
  '窄握': { muscle: 'chest', also: ['triceps'], pattern: 'h_push', unsure: true, note: '25kg×12；同日無背部動作 → 判窄握臥推。若其實是窄握下拉要改成 back/v_pull' },
  // 7.5kg×15，同一天有啞鈴胸推＋器械胸推＋槓鈴肩推＋三頭。
  // ⭐ 2026-09-21 Howard 裁決：單寫「飛鳥」一律算肩（中束）。
  //    原本判胸（那個學員 7.5kg×15、同日已有兩個胸推）。改過來之後，
  //    ⚠️ 既有資料的胸組數會降、肩中束會升——這是修正，不是漂移。
  //    有方向限定詞的走自己的 entry：夾胸→胸、上斜/平板飛鳥→胸、反向/後飛鳥→肩後。
  '飛鳥': { muscle: 'delts_side', pattern: 'iso', note: 'Howard 2026-09-21 裁決：單寫飛鳥＝肩' },
}

/** 正規化：全形→半形、去空白、小寫。查表兩邊都要過這支。 */
export function normalizeExerciseName(raw: string): string {
  return raw
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, '')
    .toLowerCase()
    .trim()
}

/**
 * ⚠️ 索引在載入時從 EXERCISE_MUSCLE_MAP 推導，**兩邊都過同一支正規化**。
 *    第一版把 key 直接當查表鍵，結果 15 個帶全形括號的動作（真空 Vacuum（古典細腰）、
 *    腿彎舉（坐姿）⋯⋯）全部對不到——因為 map 的 key 沒被正規化。
 *    上面那個 Record 維持原始中文（好讀、好維護），查表一律走這個索引。
 */
const NORMALIZED_INDEX: Record<string, ExerciseEntry> = Object.fromEntries(
  Object.entries(EXERCISE_MUSCLE_MAP).map(([k, v]) => [normalizeExerciseName(k), v])
)

export function lookupExercise(raw: string): ExerciseEntry | null {
  return NORMALIZED_INDEX[normalizeExerciseName(raw)] ?? null
}

/** 這個動作算不算一組肌肥大訓練量 */
export function countsAsVolume(e: ExerciseEntry): boolean {
  return e.volume !== false
}

// ═══════════════════════════════════════════════════════════
// 模糊解析
// ⚠️ 為什麼需要：training_plan（教練寫）跟 training_sets（學員打）是兩套用字。
//    課表寫「槓鈴臥推（或 Smith 機）」「深蹲（或哈克蹲 / Smith 蹲）」，
//    學員打「胸推」「鐘擺蹲」。硬比對會漏掉一半以上。
// ═══════════════════════════════════════════════════════════

/** 依 key 長度排序，長的先比 —— 「上斜啞鈴臥推」要贏過「臥推」 */
const KEYS_BY_LEN = Object.keys(NORMALIZED_INDEX).sort((a, b) => b.length - a.length)

export interface Resolved { entry: ExerciseEntry; how: 'exact' | 'stripped' | 'alt' | 'substring' }

/**
 * 會「否定整個動作」的修飾語——出現就代表那不是一組負重訓練量。
 * ⚠️ 必須在子字串比對**之前**檢查，見 resolveExercise 的註解。
 */
const VOLUME_NEGATING = ['空槓', '徒手', 'pvc', '滾筒放鬆']


/**
 * 健身圈的英文速記 → 中文。
 *
 * ⚠️ 2026-09-21 加的。拿這支去解析一份教練手寫的課表，57 組裡 **30 組對不到**，
 *    全部敗在縮寫：`SA DB RDL`、`BB RDL`、`DB BP`、`器 SP`、`SA DB Row`。
 *    逐個加 entry 沒用——組合是乘法（SA × DB × RDL），展開才是解法。
 *
 * ⚠️ 必須在 normalizeExerciseName **之前**跑：那支會把空白去掉，
 *    去掉之後 "sa db rdl" 變成 "sadbrdl"，就切不出縮寫了。
 * ⚠️ 用 \b 詞邊界，不然 "sa" 會咬進別的英文動作名裡。
 */
const ABBREV: [RegExp, string][] = [
  // ⛔ 2026-09-22 修：這個陣列是**依序**套用的，所以「多字詞組一定要排在單字之前」。
  //    第一版把 leg press / leg curl / calf raise 放在最後，結果 `leg curl` 先被
  //    /\bcurl\b/ 改成「leg 彎舉」，再也對不到 /\bleg\s*curl\b/ → 整組解析失敗。
  //    （原註解已經寫著「長的先展開」，但只想到 rdl vs dl，沒想到多字詞組。）
  // ── 多字詞組（一定放最前面）──
  [/\bleg\s*press\b/gi, '腿推'], [/\bleg\s*curl\b/gi, '腿彎舉'],
  [/\bleg\s*ext(?:ension)?\b/gi, '腿伸'], [/\bleg\s*raise\b/gi, '抬腿'],
  [/\bcalf\s*raise\b/gi, '提踵'], [/\bhip\s*thrust\b/gi, '臀推'],
  [/\bhip\s*ab(?:duction)?\b/gi, '髖外展'], [/\bhip\s*ad(?:duction)?\b/gi, '髖內收'],
  [/\bface\s*pull\b/gi, '面拉'], [/\bpull\s*over\b/gi, '臥姿屈臂上拉'],
  [/\bpull\s*up\b/gi, '引體向上'], [/\bchin\s*up\b/gi, '引體向上'],
  [/\blat\s*pull\s*down\b/gi, '滑輪下拉'],
  // ── 單字：器材 ──
  [/\bbb\b/gi, '槓鈴'], [/\bdb\b/gi, '啞鈴'], [/\bkb\b/gi, '壺鈴'],
  [/\bsmith\b/gi, '史密斯'], [/\bcable\b/gi, '纜繩'],
  // ── 單字：單邊 ──
  [/\bsa\b/gi, '單臂'], [/\bsl\b/gi, '單腿'], [/\bua\b/gi, '單臂'],
  // ── 單字：動作（rdl 要贏過 dl）──
  [/\brdl\b/gi, '羅馬尼亞硬舉'], [/\bohp\b/gi, '肩推'],
  [/\bbp\b/gi, '臥推'], [/\bsp\b/gi, '肩推'], [/\bdl\b/gi, '硬舉'],
  [/\bpulldown\b/gi, '滑輪下拉'], [/\bpullup\b/gi, '引體向上'],
  [/\brow\b/gi, '划船'], [/\bcurl\b/gi, '彎舉'], [/\blunge\b/gi, '弓步'],
  [/\bsquat\b/gi, '深蹲'], [/\bpress\b/gi, '推'], [/\bfly\b/gi, '飛鳥'],
  [/\bdip(?:s)?\b/gi, '雙槓撐體'],
]

export function expandAbbrev(raw: string): string {
  let out = raw
  for (const [re, zh] of ABBREV) out = out.replace(re, zh)
  return out
}

export function resolveExercise(raw: string): Resolved | null {
  const n = normalizeExerciseName(raw)
  if (NORMALIZED_INDEX[n]) return { entry: NORMALIZED_INDEX[n], how: 'exact' }

  // 去掉括號內容：「坐姿纜繩划船（窄握）」→「坐姿纜繩划船」
  const stripped = n.replace(/[（(][^）)]*[）)]/g, '')
  if (stripped && NORMALIZED_INDEX[stripped]) return { entry: NORMALIZED_INDEX[stripped], how: 'stripped' }

  // 「A 或 B」「A / B」→ 取第一個選項（教練寫的第一個通常是主推的那個）
  for (const cand of stripped.split(/或|\/|、/).map((x) => x.trim()).filter(Boolean)) {
    if (NORMALIZED_INDEX[cand]) return { entry: NORMALIZED_INDEX[cand], how: 'alt' }
  }

  // ⭐ 修飾語優先於動作名。
  // ⚠️ 2026-09-21 抓到的 bug：「空槓過頭深蹲（全蹲版的體檢）」被子字串比對到「深蹲」
  //    （「空槓」跟「深蹲」都是 2 個字，長度平手時順序是隨機的），
  //    結果 Howard 舉重日的 5 組空槓體檢被算成真的股四訓練量（股四 6 → 13）。
  //    這類前綴會**否定整個動作的性質**，所以要在子字串比對之前先攔。
  for (const mod of VOLUME_NEGATING) {
    if (stripped.includes(mod)) return { entry: NORMALIZED_INDEX[mod], how: 'substring' }
  }

  // 最後：找最長的、包含在名字裡的 key
  for (const k of KEYS_BY_LEN) {
    if (k.length >= 2 && stripped.includes(k)) return { entry: NORMALIZED_INDEX[k], how: 'substring' }
  }

  // ⭐ 全部沒中 → 把英文速記展開成中文再跑一次（"SA DB RDL" → "單臂啞鈴羅馬尼亞硬舉"）。
  //    ⚠️ 放在最後：展開會改寫字串，先讓原字串有完整的比對機會，避免誤傷。
  const expanded = expandAbbrev(raw)
  if (expanded !== raw) {
    const hit = resolveExercise(expanded)
    if (hit) return hit
  }
  return null
}

// ═══════════════════════════════════════════════════════════
// 組數加總
// ═══════════════════════════════════════════════════════════

export interface VolumeResult {
  byMuscle: Partial<Record<Muscle, number>>
  /**
   * 間接量（各動作 `also` 的部位）。
   * ⚠️ 不要拿去比 10–20 區間——那個區間講的是直接組數。
   *    它存在的理由只有一個：判斷「這個部位是不是已經被別的動作餵飽了」，
   *    免得把「肩前束直接只有 3 組」報成缺口（其實 11 組胸推已經餵飽它）。
   */
  byMuscleIndirect: Partial<Record<Muscle, number>>
  byPattern: Partial<Record<Pattern, number>>
  /** 手臂過頭的總組數（含肩推與過頭三頭） */
  overhead: number
  /** ⭐ 只算「過頭位的拉」——背闊覆蓋要看這個，不要看 overhead */
  overheadPull: number
  total: number
  /** 暖身／呼吸／Posing／有氧，不計入肌肥大量 */
  excluded: number
  /** 解析不出來的動作名，要回頭補 map */
  unresolved: string[]
}

function emptyResult(): VolumeResult {
  return { byMuscle: {}, byMuscleIndirect: {}, byPattern: {}, overhead: 0, overheadPull: 0, total: 0, excluded: 0, unresolved: [] }
}

function addSets(r: VolumeResult, raw: string, sets: number) {
  const hit = resolveExercise(raw)
  if (!hit) { r.unresolved.push(raw); return }
  const e = hit.entry
  if (!countsAsVolume(e)) { r.excluded += sets; return }
  r.byMuscle[e.muscle] = (r.byMuscle[e.muscle] ?? 0) + sets
  for (const m of e.also ?? []) r.byMuscleIndirect[m] = (r.byMuscleIndirect[m] ?? 0) + sets
  r.byPattern[e.pattern] = (r.byPattern[e.pattern] ?? 0) + sets
  if (e.overhead) {
    r.overhead += sets
    if (e.muscle === 'back') r.overheadPull += sets
  }
  r.total += sets
}

/**
 * ⚠️ training_plan 的 sets 三種型別都出現過：
 *    number(4)、string("4")、null（「⚠️ 累了先砍這天」那種備註列）。
 *    也看過 "3-4" 這種區間 —— 取下限，寧可低估也不要高估訓練量。
 */
function parseSets(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const m = v.match(/\d+/)
    return m ? parseInt(m[0], 10) : 0
  }
  return 0
}

/** 課表（計畫）的一週組數 */
export function planVolume(trainingPlan: any): VolumeResult {
  const r = emptyResult()
  const days: any[] = trainingPlan?.days ?? []
  for (const d of days) {
    for (const ex of d?.exercises ?? []) {
      const sets = parseSets(ex?.sets)
      if (!sets || !ex?.name) continue   // 備註列（sets=null）直接跳過
      addSets(r, String(ex.name), sets)
    }
  }
  return r
}

/** 實做（training_sets）的組數。每一筆 = 1 組。 */
export function actualVolume(sets: Array<{ exercise_name: string | null }>): VolumeResult {
  const r = emptyResult()
  for (const s of sets) {
    if (!s?.exercise_name) continue
    addSets(r, s.exercise_name, 1)
  }
  return r
}

// ═══════════════════════════════════════════════════════════
// 對帳
// ═══════════════════════════════════════════════════════════

/** L1 P14 的口徑：10–20 組／肌群／週 */
export const VOLUME_MIN = 10
export const VOLUME_MAX = 20

export type VolumeFlag = 'under' | 'ok' | 'over'

export interface AuditRow {
  muscle: Muscle
  label: string
  plan: number
  actual: number
  /** 實做 − 計畫 */
  gap: number
  planFlag: VolumeFlag
  actualFlag: VolumeFlag
}

export function flagOf(n: number): VolumeFlag {
  return n < VOLUME_MIN ? 'under' : n > VOLUME_MAX ? 'over' : 'ok'
}

/**
 * 計畫 vs 實做 並排。
 * ⭐ 這才是教練要看的：「課表寫背 11 組，這週實際做了 7 組。」
 * ⚠️ actual 要傳「一週」的資料，不然 gap 沒有意義。
 */
export function auditVolume(plan: VolumeResult, actual: VolumeResult): AuditRow[] {
  const muscles = new Set<Muscle>(
    (Object.keys(plan.byMuscle) as Muscle[]).concat(Object.keys(actual.byMuscle) as Muscle[])
  )
  return Array.from(muscles)
    .map((m) => {
      const p = plan.byMuscle[m] ?? 0
      const a = actual.byMuscle[m] ?? 0
      return { muscle: m, label: MUSCLE_LABEL[m], plan: p, actual: a, gap: a - p, planFlag: flagOf(p), actualFlag: flagOf(a) }
    })
    .sort((x, y) => y.plan - x.plan || y.actual - x.actual)
}

// ═══════════════════════════════════════════════════════════
// 缺口與失衡
// ⭐ 2026-09-21 新增。理由很實際：這兩支抓到的東西，是單看「每肌群週組數」那張圖
//    永遠看不到的——因為那張圖只畫「有數字的部位」，掛零的整列會消失。
//    實際案例：一份課表肩中束 17 組、肩後束 2 組；另一份肩中束直接 0 組。
//    兩次都是全身最嚴重的問題，兩次那張圖都畫不出來。
// ═══════════════════════════════════════════════════════════

/**
 * 「一定要有覆蓋」的部位。
 * ⚠️ 刻意不含斜方／前臂／內收／外展——那四個靠複合動作間接吃得到，
 *    單獨掛零不代表有問題，列進來只會變成永遠在響的假警報。
 */
export const CORE_MUSCLES: Muscle[] = [
  'chest', 'back', 'delts_front', 'delts_side', 'delts_rear',
  'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core',
]

/** 「幾乎沒碰」的上限。不是「偏低」——偏低要知道目標才判得準。 */
export const NEARLY_NONE = 2

export interface Gap {
  muscle: Muscle
  label: string
  direct: number
  indirect: number
  /** zero = 直接跟間接都是 0；low = 直接 + 間接 ≤ 2 組，等於幾乎沒碰 */
  severity: 'zero' | 'low'
}

/**
 * 找掛零／嚴重偏低的部位。
 * ⚠️ 判斷用 `direct + indirect`，不是只看 direct——
 *    肩前束直接 3 組看起來像缺口，但 11 組胸推會間接餵到它，報出來是雜訊。
 */
export function findGaps(r: VolumeResult): Gap[] {
  const out: Gap[] = []
  for (const m of CORE_MUSCLES) {
    const direct = r.byMuscle[m] ?? 0
    const indirect = r.byMuscleIndirect[m] ?? 0
    if (direct === 0 && indirect === 0) out.push({ muscle: m, label: MUSCLE_LABEL[m], direct, indirect, severity: 'zero' })
    // ⚠️ 2026-09-21 收緊：原本門檻是「不到區間下限的一半（<5）」，實際跑一個籃球＋減脂的
    //    學員，12 項核心部位報了 8 項——因為他的課表本來就不是健美的量。
    //    「偏低」要知道目標才判得準，V3 沒有那個資訊；「幾乎沒碰」則是客觀的。
    //    → 門檻收到 ≤2 組。這樣仍抓得到真正的洞（實例：一份健體課表肩後束 2 組）。
    else if (direct + indirect <= NEARLY_NONE) out.push({ muscle: m, label: MUSCLE_LABEL[m], direct, indirect, severity: 'low' })
  }
  return out.sort((a, b) => (a.severity === b.severity ? a.direct - b.direct : a.severity === 'zero' ? -1 : 1))
}

/**
 * 對立肌群的比例。
 * ⚠️ 只放「同一個關節的兩側」，不是隨便兩個部位——
 *    比例有意義的前提是它們本來就該互相制衡。
 */
// ⚠️ why 必須是**中性**的——哪一邊多是跑出來才知道的。
//    第一版寫死「胸長期壓過背，肩會被拉到前引位置」，結果第一個真實學員是背 9 : 胸 3，
//    文案跟數字方向相反。敘述要描述「這一對為什麼該平衡」，不是預設誰壓過誰。
const OPPOSING: Array<{ a: Muscle; b: Muscle; why: string }> = [
  { a: 'delts_side', b: 'delts_rear', why: '肩的側面與後面。轉 1/4 跟背面看的是後束——中束再厚，後面空的，側面還是扁的' },
  { a: 'quads', b: 'hamstrings', why: '膝的前後側。長期偏一邊，除了外型，膝關節受力也會偏' },
  { a: 'chest', b: 'back', why: '肩帶的前後側。長期偏一邊，肩胛的靜態位置會被拉走' },
]

export const IMBALANCE_RATIO = 2.5

export interface Imbalance {
  high: Muscle; low: Muscle
  highLabel: string; lowLabel: string
  highSets: number; lowSets: number
  ratio: number
  why: string
}

export function findImbalances(r: VolumeResult): Imbalance[] {
  const out: Imbalance[] = []
  for (const { a, b, why } of OPPOSING) {
    const va = r.byMuscle[a] ?? 0
    const vb = r.byMuscle[b] ?? 0
    // ⚠️ 兩邊都很少的時候比例沒有意義（2 : 0 不是失衡，是兩個都沒練）→ 交給 findGaps 報
    if (va + vb < VOLUME_MIN) continue
    const [high, low, hv, lv] = va >= vb ? [a, b, va, vb] : [b, a, vb, va]
    const ratio = lv === 0 ? Infinity : hv / lv
    if (ratio >= IMBALANCE_RATIO) {
      out.push({ high, low, highLabel: MUSCLE_LABEL[high], lowLabel: MUSCLE_LABEL[low], highSets: hv, lowSets: lv, ratio, why })
    }
  }
  return out.sort((x, y) => y.ratio - x.ratio)
}

/** 推 : 拉（只算複合動作，單關節不進來） */
export function pushPullRatio(r: VolumeResult) {
  const push = (r.byPattern.h_push ?? 0) + (r.byPattern.v_push ?? 0)
  const pull = (r.byPattern.h_pull ?? 0) + (r.byPattern.v_pull ?? 0)
  return { push, pull }
}

/**
 * 間接量：把每個動作的次要部位也算一組。
 * ⚠️ **不要拿這個去比 10–20 組的區間**——那個區間講的是直接組數。
 *    這支存在的理由只有一個：要回答「這個部位是不是已經被別的動作餵飽了」。
 *    例：肩前束直接組數只有 7，但 11 組胸推會間接練到，所以再加直接前束是重複投資。
 */
export function indirectVolume(items: Array<{ name: string; sets: number }>): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {}
  for (const it of items) {
    const hit = resolveExercise(it.name)
    if (!hit || !countsAsVolume(hit.entry)) continue
    for (const m of hit.entry.also ?? []) out[m] = (out[m] ?? 0) + it.sets
  }
  return out
}
