import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// 推播/通知的 url 多用 '/dashboard'，但學員儀表板其實在 /c/[unique_code]。
// 這頁讀 hp_client_id cookie 轉到該學員的儀表板，沒 cookie 就回首頁。
// 解決所有「點推播通知 → /dashboard 404」的問題。
export default function DashboardRedirect() {
  const code = cookies().get('hp_client_id')?.value
  if (code && /^[a-zA-Z0-9_-]{1,20}$/.test(code)) {
    redirect(`/c/${code}`)
  }
  redirect('/')
}
