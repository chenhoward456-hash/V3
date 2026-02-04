import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import ResourceDownloadButton from '@/components/ResourceDownloadButton'

const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Howard Chen',
  alternateName: 'Howard',
  jobTitle: 'CSCS 認證體能教練',
  description: '台中北屯 CSCS 體能教練，專精肌力訓練、代謝優化、營養調整',
  url: 'https://howard456.vercel.app',
  image: 'https://howard456.vercel.app/howard-profile.jpg',
  sameAs: [
    'https://www.instagram.com/chenhoward/',
    'https://lin.ee/dnbucVw',
  ],
  worksFor: {
    '@type': 'Organization',
    name: 'Coolday Fitness 北屯館',
    address: {
      '@type': 'PostalAddress',
      addressLocality: '台中市',
      addressRegion: '北屯區',
      addressCountry: 'TW',
    },
  },
  knowsAbout: [
    '肌力訓練',
    '體能訓練',
    '代謝優化',
    '營養優化',
    '血檢優化',
    '運動科學',
    'CSCS',
  ],
}

export const metadata: Metadata = {
  title: 'Howard - CSCS 數據化訓練管理 | 遠端訂閱制',
  description: 'CSCS 認證體能教練，提供科學化遠端管理訂閱。24小時內回覆，每月2次視訊追蹤。全台灣適用，台中地區可加選實體指導。',
  keywords: ['CSCS教練', '遠端訓練', '數據管理', '訂閱制', '科學化訓練', '個人化指導'],
  openGraph: {
    title: 'Howard - 科學化遠端管理訂閱',
    description: '24小時內回覆，每月2次視訊追蹤，科學化數據管理',
    type: 'website',
    url: 'https://howard-protocol.com',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Howard - 科學化遠端管理訂閱'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Howard - 科學化遠端管理訂閱',
    description: '24小時內回覆，每月2次視訊追蹤',
    images: ['/og-image.jpg']
  }
}

export default function HomePage() {
  return (
    <>
      {/* 結構化資料 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      
      <section className="section-container" style={{backgroundColor: '#F9F9F7'}}>
        {/* 個人頭像 - 適中大小 */}
      <div className="flex justify-center mb-8">
        <Image
          src="/howard-profile.jpg" 
          alt="Howard - Coolday Fitness 北屯館教練主管，CSCS 認證體能教練" 
          width={120}
          height={120}
          className="rounded-full"
          style={{
            objectFit: 'cover',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
          priority
        />
      </div>

      <h1 className="text-3xl md:text-5xl font-bold text-center mb-6" style={{color: '#2D2D2D', letterSpacing: '0.08em', lineHeight: '1.3'}}>
        <span style={{color: '#2D2D2D'}}>The Howard Protocol</span>
      </h1>
      <p className="doc-subtitle" style={{color: '#2D2D2D', maxWidth: '700px', margin: '0 auto 3rem', lineHeight: '1.8'}}>
        我是 Howard，CSCS 認證體能教練，高雄醫學大學運動醫學系畢業。<br />
        6 年實驗數據經驗，專注於科學化遠端管理。<br />
        24 小時內回覆你的訓練問題。
      </p>

      {/* 系統診斷導向 */}
      <div className="my-16 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>
            你的訓練需要遠端管理嗎？
          </h2>
          <p className="text-gray-600 text-lg mb-6">
            完成 30 秒評估，了解你是否適合科學化遠端管理
          </p>
          <Link 
            href="/diagnosis"
            className="inline-block bg-primary text-white px-10 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-all hover:scale-105 mb-4"
          >
            開始適應性評估 →
          </Link>
          <div className="text-center">
            <p className="text-gray-500 mb-2">或直接加 LINE 免費諮詢</p>
            <a
              href="https://lin.ee/dnbucVw"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-600 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              加 LINE 諮詢
            </a>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-12">
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
            <div className="text-4xl mb-4">�</div>
            <h3 className="text-xl font-bold mb-3" style={{color: '#2D2D2D'}}>
              科學化遠端管理
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              24 小時內 LINE 回覆、每月 2 次視訊追蹤。根據數據調整訓練方案。
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold mb-3" style={{color: '#2D2D2D'}}>
              數據化追蹤分析
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              HRV、睡眠品質、訓練數據。用科學方法優化你的訓練效果。
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-xl font-bold mb-3" style={{color: '#2D2D2D'}}>
              個人化訓練方案
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              客製化訓練計畫、營養策略。根據數據動態調整。
            </p>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link href="/diagnosis" className="text-gray-500 hover:text-primary text-sm underline">
            或先做 30 秒適應性評估，了解你的管理需求 →
          </Link>
        </div>
      </div>


      {/* 真誠區塊 - 6年實驗數據 + 社群證明 */}
      <div className="my-20 max-w-4xl mx-auto" style={{borderLeft: '4px solid #8B7355', paddingLeft: '2rem', backgroundColor: 'rgba(139, 115, 85, 0.03)', padding: '2rem 2rem 2rem 3rem', borderRadius: '0.5rem'}}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full border-2 border-gray-900 flex items-center justify-center text-gray-900 font-bold text-sm flex-shrink-0">DATA</div>
          <div>
            <h3 className="text-2xl font-semibold mb-3" style={{color: '#2D2D2D', letterSpacing: '0.02em'}}>6年個人實驗數據</h3>
            <p className="text-gray-600 leading-relaxed text-[15px] mb-4">
              從 2020 年系統崩潰到 2026 年完全重生，完整記錄每一步調整與數據變化。
            </p>
            
            {/* 數據展示 */}
            <div className="grid grid-cols-3 gap-4 my-6 p-4 bg-white rounded-xl">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">50+</div>
                <div className="text-xs text-gray-500">協助學員</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">6年</div>
                <div className="text-xs text-gray-500">實驗數據</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">100%</div>
                <div className="text-xs text-gray-500">數據驅動</div>
              </div>
            </div>

            <p className="italic text-gray-500 text-sm leading-relaxed" style={{fontFamily: 'Georgia, serif'}}>
              「這不是理論，是我在 2020 年身體系統崩潰後，花了六年時間，用自己的數據一點一滴換來的重生記錄。」
            </p>
          </div>
        </div>
      </div>

      {/* 實測案例 - Zone 2 訓練 */}
      <div className="my-24 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>
            實測案例
          </h2>
          <p className="text-gray-600 text-lg">
            備賽期間的 Zone 2 有氧訓練數據
          </p>
        </div>

        <div className="bg-gradient-to-br from-success/5 to-success/10 rounded-2xl p-8 md:p-10 border-2 border-success/20">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">🏃</span>
            <div>
              <h3 className="text-2xl font-bold" style={{color: '#2D2D2D'}}>Zone 2 登階機 5 大好處</h3>
              <p className="text-sm text-gray-600">12 週 Whoop 實測數據</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-5 text-center">
              <div className="text-3xl font-bold text-success mb-2">+40%</div>
              <div className="text-sm font-medium text-gray-700 mb-1">HRV 提升</div>
              <div className="text-xs text-gray-500">65ms → 91ms</div>
            </div>
            <div className="bg-white rounded-xl p-5 text-center">
              <div className="text-3xl font-bold text-primary mb-2">-10%</div>
              <div className="text-sm font-medium text-gray-700 mb-1">靜息心率</div>
              <div className="text-xs text-gray-500">58bpm → 52bpm</div>
            </div>
            <div className="bg-white rounded-xl p-5 text-center">
              <div className="text-3xl font-bold text-warning mb-2">+33%</div>
              <div className="text-sm font-medium text-gray-700 mb-1">深睡比例</div>
              <div className="text-xs text-gray-500">18% → 24%</div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 mb-6">
            <h4 className="font-bold mb-3" style={{color: '#2D2D2D'}}>5 大好處</h4>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span><strong>提升 HRV</strong> - 副交感神經活性強，壓力恢復力佳</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span><strong>降低 RHR</strong> - 心臟效率提升，心肺功能強化</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span><strong>睡眠更好</strong> - 穩定神經系統，深睡比例高</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span><strong>核心穩定</strong> - 大肌群連動，排列穩定</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span><strong>穩定情緒</strong> - Zone 2 有氧最能舒壓，腦內啡上升</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-success mb-6">
            <p className="text-sm text-gray-700 leading-relaxed">
              💡 <strong>重點</strong>：Zone 2 有氧不是只有創造熱量赤字，它能讓粒線體效率更佳，大家不重訓至少好好善待自己的心肺能力！
            </p>
          </div>

          <div className="text-center">
            <Link 
              href="/blog/zone-2-cardio-benefits"
              className="inline-block bg-success text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-all"
            >
              閱讀完整文章 →
            </Link>
          </div>
        </div>
      </div>

      {/* 無邊框卡片設計 - 去 AI 化 */}
      <div className="my-24 max-w-5xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-center" style={{color: '#2D2D2D', letterSpacing: '0.05em'}}>
          Howard
        </h1>
        <div className="grid md:grid-cols-3 gap-16">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-gray-900 flex items-center justify-center text-gray-900 font-bold text-xs">CSCS</div>
            <h4 className="text-xl font-medium mb-4" style={{color: '#2D2D2D', letterSpacing: '0.02em'}}>CSCS 認證<br />運動醫學背景</h4>
            <p className="text-gray-600 leading-relaxed text-[15px]">
              高雄醫學大學運動醫學系畢業，CSCS 國際認證體能教練。懂解剖學、生物力學。
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-gray-900 flex items-center justify-center text-gray-900 font-bold text-xs">系統</div>
            <h4 className="text-xl font-medium mb-4" style={{color: '#2D2D2D', letterSpacing: '0.02em'}}>系統化<br />訓練方法</h4>
            <p className="text-gray-600 leading-relaxed text-[15px]">
              整合訓練、營養、恢復的完整系統。不是單純帶練，而是建立長期健康習慣。
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-gray-900 flex items-center justify-center text-gray-900 font-bold text-xs">數據</div>
            <h4 className="text-xl font-medium mb-4" style={{color: '#2D2D2D', letterSpacing: '0.02em'}}>數據驅動<br />持續優化</h4>
            <p className="text-gray-600 leading-relaxed text-[15px]">
              不靠感覺，靠數據說話。定期追蹤進度，根據反應調整協定。
            </p>
          </div>
        </div>
      </div>

      {/* 免費資源區塊 */}
      <div className="my-24 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-semibold mb-4" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>免費下載：三層脂肪攻克計畫表</h3>
          <p className="text-gray-600">完整 12 週執行計畫，立即下載開始優化</p>
        </div>
        
        <div className="bg-gradient-to-br from-success/5 to-success/10 rounded-2xl p-10 border-2 border-success/20">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="text-6xl">📥</div>
            <div className="flex-1">
              <h4 className="text-2xl font-bold mb-3" style={{color: '#2D2D2D'}}>
                三層脂肪攻克計畫表
              </h4>
              <p className="text-gray-600 mb-4 leading-relaxed">
                完整 12 週執行計畫，分階段攻克內臟脂肪、皮下脂肪、頑固脂肪。
                包含詳細訓練動作、飲食策略、進度追蹤表。
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-3 py-1 bg-white rounded-full text-sm text-gray-700">✓ 12 週完整計畫</span>
                <span className="px-3 py-1 bg-white rounded-full text-sm text-gray-700">✓ 訓練動作詳解</span>
                <span className="px-3 py-1 bg-white rounded-full text-sm text-gray-700">✓ 飲食策略</span>
                <span className="px-3 py-1 bg-white rounded-full text-sm text-gray-700">✓ 進度追蹤表</span>
              </div>
              <ResourceDownloadButton
                fileUrl="/resources/three-layers-fat-loss-plan.pdf"
                source="homepage"
                className="inline-block bg-success text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 最新文章區塊 */}
      <div className="my-24 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <h3 className="text-3xl font-semibold" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>最新文章</h3>
          <Link 
            href="/blog"
            className="text-primary hover:underline text-sm font-medium"
          >
            查看全部 →
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <Link 
            href="/blog/muscle-building-science-2025"
            className="block bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-primary transition-all hover:shadow-lg"
          >
            <span className="text-xs text-primary font-medium">訓練方法</span>
            <h4 className="text-lg font-semibold mt-3 mb-2" style={{color: '#2D2D2D'}}>
              2025 增肌真相：這三個科學新發現
            </h4>
            <p className="text-gray-500 text-sm">5 分鐘閱讀</p>
          </Link>
          <Link 
            href="/blog/testosterone-optimization-3-months"
            className="block bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-primary transition-all hover:shadow-lg"
          >
            <span className="text-xs text-primary font-medium">血檢優化</span>
            <h4 className="text-lg font-semibold mt-3 mb-2" style={{color: '#2D2D2D'}}>
              三個月自然提升 20% 睪固酮
            </h4>
            <p className="text-gray-500 text-sm">6 分鐘閱讀</p>
          </Link>
          <Link 
            href="/blog/sleep-quality-hrv-optimization"
            className="block bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-primary transition-all hover:shadow-lg"
          >
            <span className="text-xs text-primary font-medium">恢復優化</span>
            <h4 className="text-lg font-semibold mt-3 mb-2" style={{color: '#2D2D2D'}}>
              HRV 告訴你睡眠品質的真相
            </h4>
            <p className="text-gray-500 text-sm">7 分鐘閱讀</p>
          </Link>
        </div>
      </div>

      {/* 還在猶豫？3 個選項 */}
      <div className="my-20 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h3 className="text-2xl font-semibold mb-3" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>還在猶豫？</h3>
          <p className="text-gray-600">選一個最適合你現在的方式開始</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/diagnosis" className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-primary hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm mb-4">01</div>
            <h4 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>30 秒系統診斷</h4>
            <p className="text-gray-600 text-sm">快速評估你的身體狀態，我會用結果頁幫你分級引導</p>
          </Link>
          <Link href="/line" className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-success hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center text-success font-bold text-sm mb-4">02</div>
            <h4 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>直接加 LINE</h4>
            <p className="text-gray-600 text-sm">選擇你的目標（減脂/睡眠/增肌），我會先給你免費資源</p>
          </Link>
          <Link href="/case" className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-warning hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center text-warning font-bold text-sm mb-4">03</div>
            <h4 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>看我的案例</h4>
            <p className="text-gray-600 text-sm">從系統崩潰到完全重生，6 年完整數據追蹤記錄</p>
          </Link>
        </div>
      </div>

      <div className="text-center my-20">
        <Link 
          href="/line"
          className="inline-block text-white px-12 py-4 rounded-full font-medium text-lg transition-all hover:opacity-90 hover:scale-105"
          style={{backgroundColor: '#2D2D2D', letterSpacing: '0.05em'}}
        >
          啟動優化協定 (Activate Protocol)
        </Link>
        <p className="text-gray-500 text-sm mt-4">加入 LINE，開始你的系統優化計畫</p>
      </div>
    </section>
    </>
  )
}
