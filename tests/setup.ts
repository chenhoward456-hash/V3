import '@testing-library/jest-dom/vitest'

// 測試環境的假環境變數。
// 有些模組（lib/auth-middleware.ts、lib/line.ts…）在 import 時就呼叫 createClient()，
// 沒有這些值會在載入階段直接拋 "supabaseUrl is required"，讓整個測試檔的所有 case 一起失敗
// （2026-06-21 line-handlers 拉進 auth-middleware 後 tests/api/line-webhook.test.ts 104 個全掛就是這個）。
// 值都是假的：測試一律 mock 掉真正的 Supabase / LINE 呼叫，這裡只是讓 client 建得起來。
const TEST_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  SESSION_SECRET: 'test-session-secret-not-a-real-secret',
  LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
  LINE_CHANNEL_SECRET: 'test-line-secret',
}

for (const [key, value] of Object.entries(TEST_ENV)) {
  if (!process.env[key]) process.env[key] = value
}
