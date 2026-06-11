// 同意版本記錄 — 跟 app/{terms,privacy,medical-disclaimer}/page.tsx 內顯示的「最後更新日期」對齊。
// 改版時 bump 這裡，既有用戶會被 ConsentGate 要求重新同意。
// 由 app/api/consent/route.ts 與 app/api/subscribe/free-trial/route.ts 共用，避免兩處版本漂移。
export const CURRENT_CONSENT_VERSIONS = {
  terms: '2026-03-07',
  privacy: '2026-03-07',
  health_disclaimer: '2026-03-07',
} as const
