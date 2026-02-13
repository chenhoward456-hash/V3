import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import ScrollReveal from '@/components/ScrollReveal'

const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Howard Chen',
  alternateName: 'Howard',
  jobTitle: 'CSCS 認證體能教練',
  description: '台中北屯 CSCS 體能教練，專精肌力訓練、數據化追蹤、個人化方案設計',
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
  knowsAbout: ['肌力訓練', '體能訓練', '代謝優化', '營養優化', '運動科學', 'CSCS'],
}

export const metadata: Metadata = {
  title: 'Howard - CSCS 數據化體能教練 | 科學訓練・遠端管理',
  description: 'CSCS 認證體能教練，運動醫學背景。數據化追蹤、個人化方案、持續調整。專注解決認真練但卡住的人。台中實體 / 全台遠端。',
  keywords: ['CSCS教練', '體能教練', '數據化訓練', '遠端訓練', '科學化訓練', '台中教練'],
  openGraph: {
    title: 'Howard - CSCS 數據化體能教練',
    description: '運動醫學背景 × 數據化追蹤 × 個人化方案',
    type: 'website',
    url: 'https://howard456.vercel.app',
    images: [{ url: '/howard-profile.jpg', width: 1200, height: 630, alt: 'Howard - CSCS 數據化體能教練' }],
  },
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />

      {/* ===== 區塊 1: Hero ===== */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f5f7fa 100%)' }}>
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="flex flex-col-reverse md:flex-row items-center gap-10 md:gap-16">
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6" style={{ color: '#1e3a5f' }}>
                練對了，<br />身體會告訴你
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-3 leading-relaxed">
                運動醫學背景 × 數據化追蹤 × 個人化方案
              </p>
              <p className="text-sm text-gray-400 mb-8">
                CSCS 認證體能教練 — 6 年經驗，專注解決認真練但卡住的人
              </p>
              <Link
                href="/diagnosis"
                className="inline-block bg-[#2563eb] text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-[#1d4ed8] transition-all"
              >
                30 秒了解你的狀況 →
              </Link>
            </div>
            <div className="flex-shrink-0">
              <Image
                src="/howard-profile.jpg"
                alt="Howard Chen - CSCS 認證體能教練"
                width={280}
                height={280}
                className="rounded-2xl"
                style={{ objectFit: 'cover', boxShadow: '0 8px 30px rgba(30, 58, 95, 0.12)' }}
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== 區塊 2: 痛點共鳴 ===== */}
      <ScrollReveal>
        <section className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" style={{ color: '#1e3a5f' }}>
            你是不是也這樣？
          </h2>
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {[
              { emoji: '💪', text: '認真練了半年，體態卻沒什麼變化' },
              { emoji: '🥗', text: '飲食控制很嚴格，體脂就是不降' },
              { emoji: '😫', text: '容易疲勞、恢復慢，不知道哪裡出問題' },
            ].map(({ emoji, text }) => (
              <div key={text} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
                <div className="text-4xl mb-4">{emoji}</div>
                <p className="text-gray-700 font-medium leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-500 text-lg">
            問題可能不在你不夠努力，而是<span className="font-semibold text-[#1e3a5f]">方向不對</span>。
          </p>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 3: 方法論 ===== */}
      <ScrollReveal>
        <section className="bg-[#f5f7fa] py-20">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4" style={{ color: '#1e3a5f' }}>
              Howard Protocol
            </h2>
            <p className="text-center text-gray-500 mb-14 text-lg">你的身體升級系統</p>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { num: '01', icon: '📊', title: '全面評估', desc: '了解你的身體數據、訓練歷程、生活習慣，找出真正的瓶頸' },
                { num: '02', icon: '📋', title: '個人化方案', desc: '根據你的狀況設計訓練、營養、恢復的完整計畫' },
                { num: '03', icon: '📱', title: '持續追蹤', desc: '透過線上系統追蹤你的進度，隨時調整方案' },
              ].map(({ num, icon, title, desc }) => (
                <div key={num} className="bg-white rounded-2xl p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-bold text-[#2563eb] bg-[#2563eb]/10 px-3 py-1 rounded-full">{num}</span>
                    <span className="text-2xl">{icon}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3" style={{ color: '#1e3a5f' }}>{title}</h3>
                  <p className="text-gray-600 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 4: 數字說話 ===== */}
      <ScrollReveal>
        <section className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14" style={{ color: '#1e3a5f' }}>
            關於 Howard
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { number: '6+', label: '年運動科學實務經驗' },
              { number: 'CSCS', label: '美國肌力體能認證' },
              { number: '24hr', label: '內回覆你的問題' },
              { number: '1 對 1', label: '完全個人化方案' },
            ].map(({ number, label }) => (
              <div key={label} className="text-center bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <div className="text-4xl md:text-5xl font-bold mb-3" style={{ color: '#2563eb' }}>{number}</div>
                <p className="text-gray-600 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 5: 適合誰 ===== */}
      <ScrollReveal>
        <section className="bg-[#f5f7fa] py-20">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-14" style={{ color: '#1e3a5f' }}>
              這套系統適合你嗎？
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-green-100">
                <h3 className="text-lg font-bold text-green-700 mb-5">✅ 適合你</h3>
                <ul className="space-y-3">
                  {[
                    '認真想改變但卡住的人',
                    '想用科學方法而不是土法煉鋼',
                    '外縣市或時間不固定，需要遠端指導',
                    '願意投資自己健康的人',
                  ].map(t => (
                    <li key={t} className="flex items-start gap-2 text-gray-700">
                      <span className="text-green-500 mt-0.5">✓</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-red-100">
                <h3 className="text-lg font-bold text-red-600 mb-5">❌ 不適合</h3>
                <ul className="space-y-3">
                  {[
                    '只想要短期速效的人',
                    '不願意配合追蹤和回報的人',
                    '純粹找人陪練的人',
                  ].map(t => (
                    <li key={t} className="flex items-start gap-2 text-gray-700">
                      <span className="text-red-400 mt-0.5">✗</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 6: 服務方案 ===== */}
      <ScrollReveal>
        <section className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14" style={{ color: '#1e3a5f' }}>
            合作方式
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex flex-col">
              <div className="text-sm font-semibold text-[#2563eb] bg-[#2563eb]/10 px-3 py-1 rounded-full self-start mb-5">遠端方案</div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#1e3a5f' }}>遠端追蹤方案</h3>
              <p className="text-gray-500 mb-5">適合外縣市或時間彈性需求</p>
              <ul className="space-y-3 text-gray-700 mb-8 flex-1">
                <li className="flex items-center gap-2"><span className="text-[#2563eb]">●</span>個人化訓練 + 營養方案</li>
                <li className="flex items-center gap-2"><span className="text-[#2563eb]">●</span>線上數據追蹤系統</li>
                <li className="flex items-center gap-2"><span className="text-[#2563eb]">●</span>每週檢視調整</li>
              </ul>
              <Link href="/remote" className="block text-center bg-[#2563eb] text-white py-3 rounded-xl font-semibold hover:bg-[#1d4ed8] transition-colors">
                了解更多 →
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex flex-col">
              <div className="text-sm font-semibold text-[#1e3a5f] bg-[#1e3a5f]/10 px-3 py-1 rounded-full self-start mb-5">實體方案</div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#1e3a5f' }}>實體訓練方案</h3>
              <p className="text-gray-500 mb-5">適合台中地區</p>
              <ul className="space-y-3 text-gray-700 mb-8 flex-1">
                <li className="flex items-center gap-2"><span className="text-[#1e3a5f]">●</span>一對一教練指導</li>
                <li className="flex items-center gap-2"><span className="text-[#1e3a5f]">●</span>完整訓練 + 營養規劃</li>
                <li className="flex items-center gap-2"><span className="text-[#1e3a5f]">●</span>動作矯正與技術指導</li>
              </ul>
              <Link href="/action" className="block text-center bg-white text-blue-600 border-2 border-blue-600 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors">
                預約諮詢 →
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 免費資源 ===== */}
      <ScrollReveal>
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 md:p-10 border border-green-200">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="text-5xl">📥</div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2" style={{ color: '#1e3a5f' }}>
                  免費文章：三層脂肪攻克戰術
                </h3>
                <p className="text-gray-600 mb-5 leading-relaxed">
                  內臟脂肪、皮下脂肪、頑固脂肪 — 每一層的攻克方式完全不同。用錯順序永遠瘦不下來。
                </p>
                <Link
                  href="/blog/three-layers-fat-loss-strategy"
                  className="inline-block bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
                >
                  免費閱讀 →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 7: CTA 結尾 ===== */}
      <section className="bg-[#1e3a5f] py-20 mt-10 rounded-t-3xl">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            不確定適不適合？先來測測看
          </h2>
          <p className="text-blue-200 text-lg mb-10">
            30 秒快速評估，了解你目前的狀況
          </p>
          <Link
            href="/diagnosis"
            className="inline-block bg-white text-[#1e3a5f] px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors"
          >
            開始免費評估 →
          </Link>
          <p className="mt-6">
            <Link href="/line" className="text-blue-300 hover:text-white text-sm underline transition-colors">
              或直接加 LINE 聊聊
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}
