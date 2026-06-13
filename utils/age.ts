// 年齡 / 出生年換算工具
// 設計：DB 存「西元出生年」(clients.birth_year)，age 由每日 cron 依此重算（會隨時間自動增加）。
// 前端教練習慣用民國年輸入，故提供雙向換算。西元 = 民國 + 1911（民國1年=1912）。

/** 民國年 → 西元年。無效輸入回 null。 */
export function minguoToAD(minguo: number | null | undefined): number | null {
  if (minguo == null || !Number.isFinite(minguo) || minguo <= 0) return null
  return minguo + 1911
}

/** 西元年 → 民國年。無效輸入回 null。 */
export function adToMinguo(adYear: number | null | undefined): number | null {
  if (adYear == null || !Number.isFinite(adYear)) return null
  return adYear - 1911
}

/** 由西元出生年推算目前年齡（年精度，會隨年份自動增加）。超出合理範圍回 null。 */
export function ageFromBirthYear(
  birthYearAD: number | null | undefined,
  now: Date = new Date(),
): number | null {
  if (birthYearAD == null || !Number.isFinite(birthYearAD)) return null
  const age = now.getFullYear() - birthYearAD
  if (age < 0 || age > 150) return null
  return age
}
