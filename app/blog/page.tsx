import type { Metadata } from 'next'
import BlogFilter from '@/components/BlogFilter'

export const metadata: Metadata = {
  title: '知識分享 - Howard | 訓練、營養、恢復優化',
  description: '個人實驗紀錄、研究心得與學習筆記。涵蓋訓練方法、營養策略、睡眠恢復、血檢優化等主題。',
  openGraph: {
    title: '知識分享 - Howard',
    description: '訓練、營養、恢復優化的實戰經驗分享',
  },
}

const blogPosts = [
  {
    id: '10',
    title: '睡眠效能協議：睡眠不能補考，但可以預先儲值',
    description: '熬夜補眠根本還不了睡眠債。分享我實測有效的睡眠環境設定、三件法寶、和完整的睡前協議，讓每分鐘睡眠發揮最大效益。',
    date: '2026-02-18',
    category: '恢復優化',
    readTime: '6 分鐘',
    slug: 'sleep-efficiency-protocol',
  },
  {
    id: '9',
    title: '早上別只喝白開水 — 一杯不到 1 塊的電解質水配方',
    description: '喝了半小時就跑廁所，然後還是口渴、腦袋昏昏的？問題不是你喝太少，是白開水「留不住」。分享我每天早上的電解質水配方。',
    date: '2026-02-11',
    category: '營養策略',
    readTime: '4 分鐘',
    slug: 'morning-electrolyte-water',
  },
  {
    id: '8',
    title: 'Zone 2 有氧訓練的 5 大好處 - Whoop 實測數據分享',
    description: '備賽期間用 Whoop 追蹤 12 週 Zone 2 訓練，HRV 提升 40%、深睡增加 33%。Zone 2 不只是消耗熱量，更是系統優化的關鍵。',
    date: '2026-02-01',
    category: '訓練方法',
    readTime: '8 分鐘',
    slug: 'zone-2-cardio-benefits',
  },
  {
    id: '6',
    title: '健身比咖啡還提神？多巴胺的痛苦複利效應',
    description: '為什麼健身後腦袋特別清醒？大腦的痛苦與快樂平衡機制，如何用訓練取代廉價快感。',
    date: '2026-01-30',
    category: '訓練方法',
    readTime: '5 分鐘',
    slug: 'workout-dopamine-better-than-coffee',
  },
  {
    id: '7',
    title: '你的肚子有三層脂肪，用錯順序永遠瘦不下來',
    description: '內臟脂肪、普通皮下脂肪、頑固脂肪，每一層的攻克戰術完全不同。分享我備賽時研究的脂肪代謝理論與實戰經驗。',
    date: '2026-01-30',
    category: '訓練方法',
    readTime: '6 分鐘',
    slug: 'three-layers-fat-loss-strategy',
  },
  {
    id: '5',
    title: '2025 增肌真相：這三個科學新發現，直接打臉你的健身常識',
    description: '長位半程比全程有效？練完不痠才是練得好？力竭通常是假的？分享 2025 年最新的增肌科學研究。',
    date: '2026-01-30',
    category: '訓練方法',
    readTime: '5 分鐘',
    slug: 'muscle-building-science-2025',
  },
  {
    id: '4',
    title: '女生必看！月經週期是你的減脂作弊碼：順著週期練才會瘦',
    description: '女性荷爾蒙波動極大，不懂得順著週期練，只是在跟自己的內分泌打架。分享如何利用濾泡期和黃體期優化訓練效果。',
    date: '2026-01-30',
    category: '訓練方法',
    readTime: '6 分鐘',
    slug: 'female-menstrual-cycle-training',
  },
  {
    id: '3',
    title: '為什麼你睡 8 小時還是累？HRV 告訴你睡眠品質的真相',
    description: '睡眠時間不等於睡眠品質。透過追蹤 HRV（心率變異度），我將睡眠品質從紅燈變綠燈，分享 3 個實測有效的習慣。',
    date: '2026-01-30',
    category: '恢復優化',
    readTime: '7 分鐘',
    slug: 'sleep-quality-hrv-optimization',
  },
  {
    id: '2',
    title: '沒用藥，我如何三個月內自然提升 20% 睪固酮？(515→625)',
    description: '透過科學化調整生活型態，三個月內將睪固酮從 515 提升到 625 ng/dL。分享我的實測數據與三個關鍵習慣。',
    date: '2026-01-30',
    category: '血檢優化',
    readTime: '6 分鐘',
    slug: 'testosterone-optimization-3-months',
  },
]

export default function BlogPage() {
  return (
    <div style={{ backgroundColor: '#F9F9F7' }} className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#2D2D2D' }}>
            知識分享
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            個人實驗紀錄、研究心得與學習筆記。<br />
            所有內容均為個人經驗分享，不構成醫療建議。
          </p>
        </div>

        <BlogFilter posts={blogPosts} />

        <div className="mt-16 bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-10 text-center border-2 border-primary/20">
          <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D2D2D' }}>
            想獲得更深度的內容？
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            透過 LINE 預約免費諮詢，了解個人化的健康優化方案。
          </p>
          <a
            href="https://lin.ee/dnbucVw"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-success text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            預約免費諮詢
          </a>
        </div>
      </div>
    </div>
  )
}
