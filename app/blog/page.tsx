import type { Metadata } from 'next'
import { createServerSupabase } from '@/lib/supabase'
import BlogFilter from '@/components/BlogFilter'

export const revalidate = 3600

export const metadata: Metadata = {
  title: '文章與知識 - Howard Protocol | 用數據理解你的身體',
  description: '用數據理解你的身體。涵蓋 TDEE 計算、碳循環飲食、血液檢查、訓練方法、營養科學、睡眠恢復等主題的實戰經驗分享。',
  alternates: { canonical: 'https://howard456.vercel.app/blog' },
  openGraph: {
    title: '文章與知識 - Howard Protocol',
    description: '用數據理解你的身體 — 訓練、營養、恢復優化的實戰經驗分享',
    url: 'https://howard456.vercel.app/blog',
  },
}

const hardcodedPosts = [
  {
    id: '25',
    title: '咖啡因對訓練有沒有用？三個常見錯誤讓你的 7% 歸零',
    description: '咖啡因能提升肌力 3-7%，但劑量太少、時機太晚、喝太頻繁會讓效果歸零。從機制到實作，三個常見錯誤一次修正。',
    date: '2026-04-30',
    category: '訓練方法',
    readTime: '10 分鐘',
    slug: 'caffeine-training-protocol-2026',
  },
  {
    id: '24',
    title: '腹肌一直練不大？研究告訴你為什麼 Plank 和高次數捲腹沒用',
    description: '腹肌也是肌肉，跟胸肌沒有差別——但多數人用 Plank 和高次數捲腹練，只練到耐力不練到肌肥大。EMG 研究證實負荷越大啟動越高，附 8 週加重課表。',
    date: '2026-04-22',
    category: '訓練恢復',
    readTime: '12 分鐘',
    slug: 'abs-hypertrophy-training-guide-2026',
  },
  {
    id: '23',
    title: '上胸練不大？你的上斜板角度可能設錯了',
    description: '上斜推角度越陡、上胸越有感？EMG 研究顯示 30 度才是上胸鎖骨頭啟動最大的角度，超過 45 度前三角肌就接管了。附 3 個今天就能改的訓練調整。',
    date: '2026-04-17',
    category: '訓練恢復',
    readTime: '5 分鐘',
    slug: 'incline-bench-angle-upper-chest',
  },
  {
    id: '22',
    title: '重訓會讓你禿頭嗎？教練親身走過，用研究告訴你真正的答案',
    description: '重訓拉高睪固酮會掉髮？2022 年統合分析顯示長期靜息睪固酮無顯著改變。真正的關鍵是 DHT 受體敏感度、抽菸、代謝症候群。教練親身經歷脂漏性皮膚炎落髮，分享正確判斷與介入方式。',
    date: '2026-04-17',
    category: '健康數據',
    readTime: '8 分鐘',
    slug: 'weight-training-hair-loss',
  },
  {
    id: '21',
    title: '打瘦瘦針期間，阻力訓練要怎麼介入？頻率、訓練量、動作選擇完整指南',
    description: 'GLP-1 治療期間平均流失 6 公斤肌肉。研究顯示阻力訓練可回補 +3kg 肌肉、+25% 肌力。完整指南：頻率、訓練量、動作選擇、蛋白質策略、8 週介入計畫。',
    date: '2026-04-05',
    category: '訓練恢復',
    readTime: '9 分鐘',
    slug: 'glp1-resistance-training-guide',
  },
  {
    id: '20',
    title: '打瘦瘦針會流失肌肉嗎？2026 年最新研究這樣說',
    description: 'GLP-1 藥物（Ozempic、Mounjaro）減重時最多 35% 流失的是肌肉。2026 年追蹤 15,782 人的最新統合分析告訴你：阻力訓練是唯一能將肌肉流失砍半的方法。',
    date: '2026-04-04',
    category: '營養與恢復',
    readTime: '8 分鐘',
    slug: 'glp1-muscle-loss-research-2026',
  },
  {
    id: '19',
    title: '睡眠不夠，真的會白練？運動科學告訴你睡眠如何影響增肌效率',
    description: '訓練認真、蛋白質也吃夠了，但肌肉就是長得慢？睡眠不足會從荷爾蒙、蛋白質合成、生理時鐘三個層面削減增肌效率。附 4 個今晚就能做的改善方法。',
    date: '2026-03-25',
    category: '訓練恢復',
    readTime: '7 分鐘',
    slug: 'sleep-muscle-growth',
  },
  {
    id: '18',
    title: 'Peak Week 實戰紀錄：12 天體脂 -2.2%、肌肉量反增 0.5kg 的操作細節',
    description: '大多數人拍照前餓自己，結果掉肌肉、皮下更腫。我用完全相反的方法：斷碳→超補→降訓練量，12 天體脂從 10.7% 降到 8.5%。完整操作邏輯分享。',
    date: '2026-03-22',
    category: '訓練恢復',
    readTime: '6 分鐘',
    slug: 'peak-week-case-study',
  },
  {
    id: '17',
    title: 'TDEE 是什麼？最完整的 TDEE 計算指南｜為什麼公式算出來的都不準',
    description: 'TDEE 是什麼？用最白話的方式解釋 TDEE 計算公式、BMR 基礎代謝率的差別，並告訴你為什麼網路上的 TDEE 計算器都不準。',
    date: '2026-03-22',
    category: '飲食營養',
    readTime: '15 分鐘',
    slug: 'what-is-tdee',
  },
  {
    id: '16',
    title: '蛋白質攝取完整指南：一天要吃多少？怎麼吃？台灣食物實測全整理',
    description: '蛋白質一天到底要吃多少？整理不同目標的建議量、台灣常見高蛋白食物實測數據、餐間分配策略，以及常見迷思破解。',
    date: '2026-03-22',
    category: '飲食營養',
    readTime: '12 分鐘',
    slug: 'protein-intake-guide',
  },
  {
    id: '15',
    title: '減脂停滯期完全攻略：為什麼體重不動了？5 個科學方法幫你突破卡關',
    description: '減脂停滯期是幾乎每個人都會遇到的瓶頸。從代謝適應、NEAT 下降、水分滯留三大原因切入，教你判斷真假停滯，並提供 5 個有科學根據的突破方法。',
    date: '2026-03-22',
    category: '飲食營養',
    readTime: '10 分鐘',
    slug: 'fat-loss-plateau-guide',
  },
  {
    id: '11',
    title: '你睡覺還在用嘴巴呼吸？這可能是你減脂卡關的原因',
    description: '脂肪 84% 靠呼吸代謝排出，但張嘴呼吸會讓你的燃脂系統在睡眠時失效。分享我 1800 個晚上的鼻呼吸實踐與背後的生理機制。',
    date: '2026-02-26',
    category: '訓練恢復',
    readTime: '5 分鐘',
    slug: 'mouth-breathing-fat-loss',
  },
  {
    id: '10',
    title: '睡眠效能協議：睡眠不能補考，但可以預先儲值',
    description: '熬夜補眠根本還不了睡眠債。分享我實測有效的睡眠環境設定、三件法寶、和完整的睡前協議，讓每分鐘睡眠發揮最大效益。',
    date: '2026-02-18',
    category: '訓練恢復',
    readTime: '6 分鐘',
    slug: 'sleep-efficiency-protocol',
  },
  {
    id: '9',
    title: '早上別只喝白開水 — 一杯不到 1 塊的電解質水配方',
    description: '喝了半小時就跑廁所，然後還是口渴、腦袋昏昏的？問題不是你喝太少，是白開水「留不住」。分享我每天早上的電解質水配方。',
    date: '2026-02-11',
    category: '飲食營養',
    readTime: '4 分鐘',
    slug: 'morning-electrolyte-water',
  },
  {
    id: '8',
    title: 'Zone 2 有氧訓練的 5 大好處 - Whoop 實測數據分享',
    description: '備賽期間用 Whoop 追蹤 12 週 Zone 2 訓練，HRV 提升 40%、深睡增加 33%。Zone 2 不只是消耗熱量，更是系統優化的關鍵。',
    date: '2026-02-01',
    category: '訓練恢復',
    readTime: '8 分鐘',
    slug: 'zone-2-cardio-benefits',
  },
  {
    id: '6',
    title: '健身比咖啡還提神？多巴胺的痛苦複利效應',
    description: '為什麼健身後腦袋特別清醒？大腦的痛苦與快樂平衡機制，如何用訓練取代廉價快感。',
    date: '2026-01-30',
    category: '訓練恢復',
    readTime: '5 分鐘',
    slug: 'workout-dopamine-better-than-coffee',
  },
  {
    id: '7',
    title: '你的肚子有三層脂肪，用錯順序永遠瘦不下來',
    description: '內臟脂肪、普通皮下脂肪、頑固脂肪，每一層的攻克戰術完全不同。分享我備賽時研究的脂肪代謝理論與實戰經驗。',
    date: '2026-01-30',
    category: '訓練恢復',
    readTime: '6 分鐘',
    slug: 'three-layers-fat-loss-strategy',
  },
  {
    id: '5',
    title: '2025 增肌真相：這三個科學新發現，直接打臉你的健身常識',
    description: '長位半程比全程有效？練完不痠才是練得好？力竭通常是假的？分享 2025 年最新的增肌科學研究。',
    date: '2026-01-30',
    category: '訓練恢復',
    readTime: '5 分鐘',
    slug: 'muscle-building-science-2025',
  },
  {
    id: '4',
    title: '女生必看！月經週期是你的減脂作弊碼：順著週期練才會瘦',
    description: '女性荷爾蒙波動極大，不懂得順著週期練，只是在跟自己的內分泌打架。分享如何利用濾泡期和黃體期優化訓練效果。',
    date: '2026-01-30',
    category: '訓練恢復',
    readTime: '6 分鐘',
    slug: 'female-menstrual-cycle-training',
  },
  {
    id: '3',
    title: '為什麼你睡 8 小時還是累？HRV 告訴你睡眠品質的真相',
    description: '睡眠時間不等於睡眠品質。透過追蹤 HRV（心率變異度），我將睡眠品質從紅燈變綠燈，分享 3 個實測有效的習慣。',
    date: '2026-01-30',
    category: '訓練恢復',
    readTime: '7 分鐘',
    slug: 'sleep-quality-hrv-optimization',
  },
  {
    id: '2',
    title: '沒用藥，我如何三個月內自然提升 20% 睪固酮？(515→625)',
    description: '透過科學化調整生活型態，三個月內將睪固酮從 515 提升到 625 ng/dL。分享我的實測數據與三個關鍵習慣。',
    date: '2026-01-30',
    category: '健康數據',
    readTime: '6 分鐘',
    slug: 'testosterone-optimization-3-months',
  },
]

async function getSupabasePosts() {
  try {
    const supabase = createServerSupabase()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, title, description, date, category, read_time, slug')
      .order('date', { ascending: false })
    if (error) {
      return []
    }
    return (data || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      date: p.date,
      category: p.category,
      readTime: p.read_time,
      slug: p.slug,
    }))
  } catch {
    return []
  }
}

export default async function BlogPage() {
  const supabasePosts = await getSupabasePosts()

  // Supabase 文章優先，hardcoded 只補 DB 沒有的（用 slug 去重）
  const dbSlugs = new Set(supabasePosts.map((p: any) => p.slug))
  const uniqueHardcoded = hardcodedPosts.filter(p => !dbSlugs.has(p.slug))
  const allPosts = [...supabasePosts, ...uniqueHardcoded].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  return (
    <div style={{ backgroundColor: '#F9F9F7' }} className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-navy">
            文章與知識
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            用數據理解你的身體
          </p>
        </div>

        <BlogFilter posts={allPosts} />

        <div className="mt-16 bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-10 text-center border-2 border-primary/20">
          <h3 className="text-2xl font-bold mb-4 text-navy">
            想要個人化的飲食建議？
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            60 秒免費體態分析，系統即時估算你的 TDEE 和每日營養目標。
          </p>
          <a
            href="/diagnosis"
            className="inline-block bg-primary text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            開始免費分析 →
          </a>
        </div>
      </div>
    </div>
  )
}
