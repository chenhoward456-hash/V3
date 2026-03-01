import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  typescript: true,
})

// 產品設定
export const EBOOK_PRODUCTS = {
  'system-reboot-v1': {
    name: 'System Reboot：睡眠與神經系統優化實戰手冊',
    description: '4 章節完整協定：HRV 動態矩陣、精準補劑、睡前降落 SOP',
    amount: 299, // TWD（零位小數幣別，不需 ×100）
    currency: 'twd' as const,
  },
} as const

export type EbookProductKey = keyof typeof EBOOK_PRODUCTS
