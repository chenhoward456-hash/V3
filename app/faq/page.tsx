import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '常見問題 FAQ - The Howard Protocol',
  description: 'Howard Chen，CSCS 認證體能教練，高雄醫學大學運動醫學系畢業。整合肌力訓練與營養優化，提供系統化的訓練指導。',
  alternates: { canonical: 'https://howard456.vercel.app/faq' },
  openGraph: {
    title: '常見問題 FAQ - The Howard Protocol',
    description: '訓練與健康優化的常見問題',
    url: 'https://howard456.vercel.app/faq',
  },
}

// FAQ 結構化資料（Google 搜尋結果豐富摘要）
function generateFAQSchema(faqs: { category: string; questions: { q: string; a: string }[] }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.flatMap(cat =>
      cat.questions.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      }))
    ),
  }
}

export default function FAQPage() {
  const faqs = [
    {
      category: '訓練相關',
      questions: [
        {
          q: '我完全沒有訓練經驗，可以開始嗎？',
          a: '當然可以！我會從最基礎的動作模式開始教起，確保你的姿勢正確再逐步增加重量。新手其實是最好訓練的，因為進步速度最快（神經適應期）。'
        },
        {
          q: '一週需要訓練幾次？',
          a: '建議一週 2-3 次，每次 60-90 分鐘。訓練不是越多越好，恢復同樣重要。我會根據你的生活作息與恢復能力設計適合的頻率。'
        },
        {
          q: '在家訓練可以嗎？還是一定要去健身房？',
          a: '如果你有基本器材（啞鈴、彈力帶），在家訓練也可以有不錯的效果。但如果目標是增肌或提升最大肌力，健身房的槓鈴訓練會更有效率。'
        },
        {
          q: '我有舊傷（膝蓋/腰/肩膀），還能訓練嗎？',
          a: '可以，但需要先評估。很多「舊傷」其實是動作模式錯誤或肌力不平衡造成的。透過正確的訓練反而能改善疼痛問題。建議先預約評估，我會設計適合你的訓練計畫。'
        }
      ]
    },
    {
      category: '營養與恢復',
      questions: [
        {
          q: '一定要吃補劑嗎？',
          a: '不一定。補劑只是「優化」，不是必需品。優先順序是：真實食物 > 睡眠 > 訓練 > 補劑。如果預算有限，建議先把飲食與睡眠做好。'
        },
        {
          q: '需要計算熱量和營養素嗎？',
          a: '初期不用太精確。我會教你用「手掌法」估算份量（例如：一掌心的蛋白質、一拳頭的碳水）。等到進步停滯或有明確目標（增肌/減脂）時，再考慮精算。'
        },
        {
          q: '間歇性斷食適合我嗎？',
          a: '要看你的生活作息與目標。如果你早上不餓、習慣晚點吃第一餐，間歇性斷食可以很自然地執行。但如果你早上很餓或訓練在早上，強迫斷食反而會影響表現。'
        }
      ]
    },
    {
      category: '服務與費用',
      questions: [
        {
          q: '有哪些方案？費用怎麼算？',
          a: '目前有三種方案：免費體驗（$0，體重追蹤 + 飲食紀錄 + TDEE 計算）、自主管理版（NT$499/月，智能引擎完整存取）、教練指導版（NT$2,999/月，系統 + CSCS 教練每週 review）。全部月繳制，隨時可取消。'
        },
        {
          q: '可以先免費試用嗎？',
          a: '可以！免費體驗方案不需信用卡，直接開通。包含體重追蹤、飲食紀錄、TDEE 自動計算。滿意再升級付費方案，補差額即可。'
        },
        {
          q: '自主管理版跟教練指導版差在哪？',
          a: '系統功能完全一樣。差別在於教練指導版有 Howard 本人每週 review 你的數據、LINE 即時諮詢（24 小時內回覆）、每月 1 次視訊。如果你有訓練基礎、能自己看懂系統建議，自主管理版就夠了。'
        },
        {
          q: '訓練地點在哪裡？',
          a: '實體訓練在台中市北屯區 Coolday Fitness。如果不在台中，可選擇自主管理版或教練指導版，全台遠端都能使用。'
        },
        {
          q: '如果中途想暫停或取消怎麼辦？',
          a: '月繳制，隨時可取消，不綁約。當月不退費，下個月停止扣款。自主管理版可隨時升級教練指導版，補差額即可。'
        }
      ]
    }
  ]

  const faqSchema = generateFAQSchema(faqs)

  return (
    <section className="section-container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <h2 className="doc-title">常見問題 FAQ</h2>
      <p className="doc-subtitle">關於訓練、營養的常見疑問，這裡都有解答。</p>

      <div className="space-y-12">
        {faqs.map((category, idx) => (
          <div key={idx}>
            <h3 className="text-2xl font-bold mb-6 text-primary">{category.category}</h3>
            <div className="space-y-6">
              {category.questions.map((item, qIdx) => (
                <div 
                  key={qIdx} 
                  className="bg-white/60 backdrop-blur-sm rounded-3xl p-8"
                  style={{boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)'}}
                >
                  <h4 className="text-lg font-semibold mb-3 text-text-primary">
                    Q: {item.q}
                  </h4>
                  <p className="text-text-secondary leading-relaxed">
                    A: {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 bg-primary/5 rounded-3xl p-8 text-center" style={{boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)'}}>
        <h3 className="text-2xl font-bold mb-4">還有其他問題？</h3>
        <p className="text-text-secondary mb-6 leading-relaxed">
          關於訓練、營養的疑問歡迎透過 LINE 或 Instagram 直接詢問，我會盡快回覆你。
        </p>
        <div className="flex justify-center gap-4">
          <a
            href="https://lin.ee/LP65rCc"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-success text-white px-8 py-4 rounded-2xl font-semibold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            💬 LINE 諮詢
          </a>
          <a
            href="https://www.instagram.com/chenhoward/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-primary text-white px-8 py-4 rounded-2xl font-semibold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            📷 Instagram
          </a>
        </div>
      </div>
    </section>
  )
}
