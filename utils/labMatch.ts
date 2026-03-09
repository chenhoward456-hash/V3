// 血檢指標名稱精確匹配工具
// 用查表取代 includes() 子字串匹配，徹底避免誤判
//
// 設計：每個血檢指標都有一個 canonical ID，所有已知寫法（中英文、縮寫）
// 都映射到同一個 ID。matchName 比對時只看 canonical ID 是否相同。

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_\-()（）/,\.]/g, '')
}

// canonical ID → 所有已知寫法
const TEST_ALIASES: Record<string, string[]> = {
  // ── 代謝 / 血糖 ──
  fasting_glucose: ['空腹血糖', 'fasting glucose', 'fbs', '飯前血糖'],
  fasting_insulin: ['空腹胰島素', 'fasting insulin'],
  homa_ir: ['homa-ir', 'homa ir', '胰島素阻抗'],
  hba1c: ['hba1c', '糖化血色素', '糖化血紅素', 'glycated hemoglobin', 'glycated haemoglobin'],
  uric_acid: ['尿酸', 'uric acid', 'ua'],

  // ── 血脂 ──
  triglyceride: ['三酸甘油酯', 'triglyceride', 'triglycerides', 'tg'],
  apob: ['apob', 'apolipoprotein b', 'apo b'],
  lpa: ['lp(a)', 'lpa', 'lipoprotein(a)', 'lipoprotein a'],
  ldl: ['ldl-c', 'ldl', '低密度脂蛋白', '低密度膽固醇'],
  hdl: ['hdl-c', 'hdl', '高密度脂蛋白', '高密度膽固醇'],
  total_cholesterol: ['總膽固醇', 'total cholesterol', 'tc', 't-cho'],

  // ── 肝功能 ──
  ast: ['ast', 'got', 'sgot', '麩草酸轉胺酶', 'ast(got)', 'got(ast)', 'ast/got', 'got/ast'],
  alt: ['alt', 'gpt', 'sgpt', '麩丙酮酸轉胺酶', 'alt(gpt)', 'gpt(alt)', 'alt/gpt', 'gpt/alt'],
  ggt: ['ggt', 'γ-gt', 'gamma-gt', 'r-gt', '丙麩氨酸轉肽酶'],
  albumin: ['白蛋白', 'albumin', 'alb'],

  // ── 腎功能 ──
  creatinine: ['肌酸酐', 'creatinine', 'cre', 'cr'],
  bun: ['bun', '血尿素氮', '尿素氮', 'blood urea nitrogen'],
  egfr: ['egfr', '腎絲球過濾率', 'gfr'],

  // ── 甲狀腺 ──
  tsh: ['tsh', '促甲狀腺激素', '促甲狀腺素'],
  free_t4: ['free t4', 'ft4', '游離甲狀腺素', '游離t4'],
  free_t3: ['free t3', 'ft3', '游離t3', '游離三碘甲狀腺素'],

  // ── 鐵代謝 / 血球 ──
  ferritin: ['鐵蛋白', 'ferritin'],
  hemoglobin: ['血紅素', 'hemoglobin', 'hgb', 'hb', 'haemoglobin'],
  mcv: ['mcv', '平均紅血球體積', '平均紅血球容積'],
  wbc: ['白血球', 'wbc', 'white blood cell'],
  platelet: ['血小板', 'platelet', 'plt', 'platelet count'],

  // ── 發炎 ──
  crp: ['crp', 'c反應蛋白', 'hs-crp', 'hscrp', 'c-reactive protein', 'high sensitivity crp'],
  homocysteine: ['同半胱胺酸', 'homocysteine', 'hcy'],

  // ── 維生素 ──
  vitamin_d: ['維生素d', 'vitamin d', '25-ohd', '25ohd', 'vit d', 'vit.d', '25-oh vitamin d', '25-oh'],
  vitamin_b12: ['維生素b12', 'vitamin b12', 'b12', '鈷胺素', 'cobalamin'],
  folate: ['葉酸', 'folate', 'folic acid', 'vitamin b9'],

  // ── 礦物質 ──
  magnesium: ['鎂', 'magnesium', 'mg'],
  zinc: ['鋅', 'zinc', 'zn'],
  calcium: ['鈣', 'calcium', 'ca'],

  // ── 荷爾蒙 ──
  testosterone: ['睪固酮', 'testosterone', '總睪固酮', 'total testosterone'],
  free_testosterone: ['游離睪固酮', 'free testosterone'],
  cortisol: ['皮質醇', 'cortisol', '可體松'],
  dheas: ['dhea-s', 'dheas', '脫氫表雄酮硫酸鹽', '硫酸脫氫異雄固酮', 'dhea'],
  estradiol: ['雌二醇', 'estradiol', 'e2'],
  shbg: ['shbg', '性荷爾蒙結合球蛋白'],

  // ── 其他 ──
  omega3: ['omega-3 index', 'omega3 index', 'omega3', 'epa+dha'],
}

// 建立反向查表：正規化名稱 → canonical ID
const CANONICAL_MAP = new Map<string, string>()
for (const [id, aliases] of Object.entries(TEST_ALIASES)) {
  for (const alias of aliases) {
    const key = normalize(alias)
    if (CANONICAL_MAP.has(key) && CANONICAL_MAP.get(key) !== id) {
      console.warn(`[labMatch] 重複映射: "${alias}" (${key}) → ${id}, 已存在 → ${CANONICAL_MAP.get(key)}`)
    }
    CANONICAL_MAP.set(key, id)
  }
}

/**
 * 精確匹配血檢指標名稱（查表法，不使用 includes()）
 * @param testName 使用者輸入的血檢名稱
 * @param keywords 要匹配的關鍵字（任一關鍵字屬於同一指標即匹配）
 */
export function matchLabName(testName: string, keywords: string[]): boolean {
  const id = CANONICAL_MAP.get(normalize(testName))
  if (!id) return false
  return keywords.some(k => CANONICAL_MAP.get(normalize(k)) === id)
}

/**
 * 取得血檢指標的 canonical ID
 */
export function getLabCanonicalId(testName: string): string | null {
  return CANONICAL_MAP.get(normalize(testName)) ?? null
}
