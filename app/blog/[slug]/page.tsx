import { notFound } from 'next/navigation'
import Link from 'next/link'

// 文章內容（之後可以從 Markdown 檔案讀取）
const blogContent: Record<string, {
  title: string
  date: string
  category: string
  readTime: string
  content: string
}> = {
  'hba1c-optimization-journey': {
    title: '我如何從 HbA1c 5.9% 優化到 5.1%：6年代謝優化實驗',
    date: '2026-01-29',
    category: '血檢數據',
    readTime: '8 分鐘',
    content: `
## 前言：從系統崩潰到完全重生

2020 年，我的身體出現了嚴重的警訊：掉髮、慢性發炎、代謝問題。當時的 HbA1c 是 5.9%，醫生說「正常範圍，沒問題」。

但我知道，**這不是最佳值**。

經過 6 年的自我實驗與數據追蹤，我成功將 HbA1c 優化到 5.1%，整個人的狀態也從系統崩潰走向完全重生。

**這篇文章分享我的個人實驗紀錄，不構成醫療建議。**

---

## 健保紅線 vs 最佳值

### 醫生的標準（健保紅線）：
- HbA1c < 6.5%：正常
- HbA1c 6.5-6.9%：糖尿病前期
- HbA1c ≥ 7.0%：糖尿病

### 研究文獻的最佳值：
- HbA1c 4.8-5.3%：最佳代謝健康
- HbA1c 5.4-5.6%：可接受範圍
- HbA1c 5.7-6.4%：糖尿病前期（但醫生說正常）

**我的目標：不只是「正常」，而是「最佳」。**

---

## 我的數據變化

| 時間 | HbA1c | 空腹血糖 | 體重 | 狀態 |
|------|-------|----------|------|------|
| 2020.03 | 5.9% | 98 mg/dL | 78kg | 系統崩潰 |
| 2021.06 | 5.6% | 92 mg/dL | 75kg | 開始改善 |
| 2023.01 | 5.3% | 88 mg/dL | 72kg | 穩定優化 |
| 2026.01 | 5.1% | 85 mg/dL | 70kg | 完全重生 |

---

## 我做了什麼調整？

### 1. 飲食策略
- **減少精緻碳水**：從每餐 200g 米飯降到 100g
- **增加蛋白質**：每公斤體重 2g（140g/天）
- **優質脂肪**：Omega-3、橄欖油、酪梨
- **間歇性斷食**：16:8（早上 10 點到晚上 6 點進食）

### 2. 訓練計畫
- **肌力訓練**：每週 4 次，重點在大肌群
- **HIIT**：每週 2 次，提升胰島素敏感度
- **步行**：每天 10,000 步

### 3. 補劑使用（個人經驗）
- **鎂**：每天 400mg（改善胰島素敏感度）
- **Omega-3**：每天 2g EPA+DHA（降低發炎）
- **維生素 D**：每天 4000 IU（代謝健康）
- **鉻**：每天 200mcg（血糖穩定）

### 4. 生活型態
- **睡眠**：每天 7-8 小時
- **壓力管理**：冥想、深呼吸
- **陽光曝曬**：每天 20 分鐘

---

## 關鍵心得

### 1. 數據追蹤很重要
每 3-6 個月抽血追蹤，了解身體的變化趨勢。

### 2. 不要只看單一指標
除了 HbA1c，還要看空腹血糖、胰島素、發炎指標（CRP）。

### 3. 個人化很重要
我的方法不一定適合你，每個人的基因、生活型態都不同。

### 4. 長期堅持才有效
這不是 30 天挑戰，而是 6 年的持續優化。

---

## 免責聲明

**這是我的個人實驗紀錄，不構成醫療建議。**

所有內容均基於個人經驗與公開研究資料分享，不應取代專業醫療人員的意見。在進行任何健康相關決策前，請務必諮詢合格的醫師。

---

## 想了解更多？

如果你也想優化自己的代謝健康，歡迎透過 LINE 預約免費諮詢，我會分享更多個人經驗與實驗心得。

[預約免費諮詢](https://lin.ee/dnbucVw)
    `
  }
}

export async function generateStaticParams() {
  return Object.keys(blogContent).map((slug) => ({
    slug: slug,
  }))
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = blogContent[params.slug]

  if (!post) {
    notFound()
  }

  return (
    <div style={{backgroundColor: '#F9F9F7'}} className="min-h-screen">
      <article className="max-w-3xl mx-auto px-6 py-16">
        {/* 返回按鈕 */}
        <Link 
          href="/blog"
          className="inline-flex items-center text-gray-600 hover:text-primary mb-8 transition-colors"
        >
          ← 返回文章列表
        </Link>

        {/* 文章標題 */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
              {post.category}
            </span>
            <span className="text-gray-400 text-sm">{post.readTime}</span>
          </div>
          
          <h1 className="text-4xl font-bold mb-4" style={{color: '#2D2D2D'}}>
            {post.title}
          </h1>
          
          <div className="text-gray-500 text-sm">
            發布於 {post.date}
          </div>
        </header>

        {/* 文章內容 */}
        <div 
          className="prose prose-lg max-w-none"
          style={{
            color: '#2D2D2D',
            lineHeight: '1.8'
          }}
          dangerouslySetInnerHTML={{ 
            __html: post.content
              .split('\n')
              .map(line => {
                // 標題
                if (line.startsWith('## ')) {
                  return `<h2 style="font-size: 1.8rem; font-weight: bold; margin-top: 2rem; margin-bottom: 1rem; color: #2D2D2D;">${line.replace('## ', '')}</h2>`
                }
                if (line.startsWith('### ')) {
                  return `<h3 style="font-size: 1.4rem; font-weight: bold; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #2D2D2D;">${line.replace('### ', '')}</h3>`
                }
                // 粗體
                if (line.includes('**')) {
                  line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                }
                // 連結
                if (line.includes('[') && line.includes('](')) {
                  line = line.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
                }
                // 分隔線
                if (line === '---') {
                  return '<hr style="margin: 2rem 0; border-color: #E5E5E5;" />'
                }
                // 列表
                if (line.startsWith('- ')) {
                  return `<li style="margin-bottom: 0.5rem;">${line.replace('- ', '')}</li>`
                }
                // 表格（簡化處理）
                if (line.startsWith('|')) {
                  return line
                }
                // 一般段落
                if (line.trim()) {
                  return `<p style="margin-bottom: 1rem;">${line}</p>`
                }
                return ''
              })
              .join('')
          }}
        />

        {/* CTA */}
        <div className="mt-16 bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-10 text-center border-2 border-primary/20">
          <h3 className="text-2xl font-bold mb-4" style={{color: '#2D2D2D'}}>
            想了解個人化的健康優化方案？
          </h3>
          <p className="text-gray-600 mb-6">
            透過 LINE 預約免費諮詢，分享更多實驗心得與數據追蹤經驗。
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
      </article>
    </div>
  )
}
