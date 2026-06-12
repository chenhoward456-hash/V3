import { redirect } from 'next/navigation'

// /case/data 的內容已合併進 /case（單一頁面）。保留此路由做轉址，舊連結與 SEO 不斷。
export default function CaseDataPage() {
  redirect('/case')
}
