'use client'

import { trackLineClick } from '@/lib/analytics'

interface LineButtonProps {
  source: string
  intent?: string
  slug?: string
  articleTitle?: string
  variant?: string
  className?: string
  /** 自訂預填訊息。若未提供，會根據 source + intent + articleTitle 自動生成 */
  message?: string
  children: React.ReactNode
}

/**
 * 根據上下文自動生成 LINE 預填訊息
 * 讓 Howard 收到訊息時立刻知道對方從哪來、看了什麼、想要什麼
 */
function getDefaultMessage(source: string, intent?: string, articleTitle?: string): string {
  // 特定 intent 優先
  if (intent === 'fat_loss') return '我想減脂，想了解你的系統化減脂方式，可以先幫我評估嗎？'
  if (intent === 'recovery') return '我想改善睡眠跟恢復，想了解 HRV 追蹤跟營養調整怎麼搭配。'
  if (intent === 'muscle_gain') return '我想增肌，想確認目前的訓練和營養計畫是否有效。'
  if (intent === 'coach_plan') return '我對教練指導版有興趣，想了解具體怎麼運作。'
  if (intent === 'coaching_upsell') return '我剛完成體態分析，想了解訂閱方案的詳細內容。'
  if (intent === 'unlock_full_report') return '我剛做完免費診斷，想看完整報告，可以聊聊嗎？'
  if (intent === 'payment_support') return '我在付款/訂閱過程遇到問題，需要協助。'

  // 根據來源頁面
  if (articleTitle) return `我剛看完「${articleTitle}」，想了解更多個人化的建議。`
  if (source === 'homepage_hero' || source === 'homepage_plan') return '我想了解你的系統化訓練方式，可以先幫我評估嗎？'
  if (source === 'remote_page') return '我看了遠端方案頁面，想了解哪個方案適合我。'
  if (source === 'diagnosis_teaser') return '我剛做完免費診斷，想了解下一步怎麼開始。'
  if (source === 'nav_cta' || source === 'nav_mobile') return '嗨，我從網站過來的，想了解你的服務。'
  if (source === 'blog_post') return '我在你的部落格看到一些內容，想了解更多。'
  if (source.startsWith('sticky_cta')) return '我正在看你的網站，想直接聊聊我的狀況。'

  return '嗨，我從網站過來的，想了解你的服務。'
}

export default function LineButton({ source, intent, slug, articleTitle, variant, message, className, children }: LineButtonProps) {
  const handleClick = () => {
    trackLineClick(source, {
      intent,
      slug,
      articleTitle,
      variant,
    })
  }

  // 組合預填訊息，導向 /line 頁面（帶 query params）讓用戶複製後加 LINE
  const prefillMessage = message || getDefaultMessage(source, intent, articleTitle)
  const lineUrl = `/line?msg=${encodeURIComponent(prefillMessage)}&src=${encodeURIComponent(source)}`

  return (
    <a
      href={lineUrl}
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  )
}
