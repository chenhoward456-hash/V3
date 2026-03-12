import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import ScrollReveal from '@/components/ScrollReveal'
import LineButton from '@/components/LineButton'
import PwaRedirect from '@/components/PwaRedirect'
import FaqAccordion from '@/components/FaqAccordion'
import StickyMobileCta from '@/components/StickyMobileCta'
import ABTest from '@/components/ABTest'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'

const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Howard Chen',
  alternateName: 'Howard',
  jobTitle: 'CSCS 認證體能教練 / Howard Protocol 創辦人',
  description: '數據驅動體態與健康管理系統 Howard Protocol 創辦人，CSCS 認證，運動醫學背景。智能系統 × 教練監督。',
  url: SITE_URL,
  image: `${SITE_URL}/howard-profile.jpg`,
  sameAs: [
    'https://www.instagram.com/chenhoward/',
    'https://lin.ee/LP65rCc',
  ],
  worksFor: {
    '@type': 'Organization',
    name: 'Howard Protocol',
    address: {
      '@type': 'PostalAddress',
      addressLocality: '台中市',
      addressRegion: '北屯區',
      addressCountry: 'TW',
    },
  },
  knowsAbout: ['肌力訓練', '體能訓練', '代謝優化', '營養優化', '運動科學', 'CSCS', '數據化健康管理', '體態管理'],
}

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Howard Protocol',
  description: '數據驅動的體態與健康管理系統。CSCS 認證教練監督 × 智能系統 24 小時分析。',
  url: SITE_URL,
  image: `${SITE_URL}/howard-profile.jpg`,
  address: {
    '@type': 'PostalAddress',
    addressLocality: '台中市',
    addressRegion: '北屯區',
    addressCountry: 'TW',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 24.1827,
    longitude: 120.6866,
  },
  areaServed: [
    { '@type': 'City', name: '台中市' },
    { '@type': 'Country', name: '台灣' },
  ],
  serviceType: ['個人教練', '遠端訓練管理', '營養諮詢'],
  priceRange: '$$',
  sameAs: [
    'https://www.instagram.com/chenhoward/',
    'https://lin.ee/LP65rCc',
  ],
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Howard Protocol',
  url: SITE_URL,
  logo: `${SITE_URL}/icon-192.png`,
  image: `${SITE_URL}/howard-profile.jpg`,
  description: '數據驅動的體態與健康管理系統。CSCS 認證教練監督 × 智能系統 24 小時分析。',
  founder: {
    '@type': 'Person',
    name: 'Howard Chen',
    jobTitle: 'CSCS 認證體能教練',
    url: SITE_URL,
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: '台中市',
    addressRegion: '北屯區',
    addressCountry: 'TW',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    email: 'chenhoward456@gmail.com',
    telephone: '+886-978-185-268',
    availableLanguage: ['zh-TW', 'en'],
  },
  sameAs: [
    'https://www.instagram.com/chenhoward/',
    'https://lin.ee/LP65rCc',
  ],
}

const webApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Howard Protocol',
  description: '數據驅動的體態與健康管理系統',
  url: SITE_URL,
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web',
  inLanguage: 'zh-TW',
  offers: [
    {
      '@type': 'Offer',
      name: '免費體驗',
      description: '體重趨勢追蹤 + 飲食紀錄 + TDEE 自動計算 + 14 天後自動校正營養目標',
      price: '0',
      priceCurrency: 'TWD',
    },
    {
      '@type': 'Offer',
      name: '自主管理方案',
      description: '身心狀態追蹤 + AI 飲食顧問無限使用 + 碳水循環 + 停滯期偵測',
      price: '499',
      priceCurrency: 'TWD',
      billingIncrement: 'P1M',
    },
    {
      '@type': 'Offer',
      name: '教練指導方案',
      description: '自主管理全部功能 + CSCS 教練每週 review + LINE 即時問答 + 訓練/補劑/血檢追蹤',
      price: '2999',
      priceCurrency: 'TWD',
      billingIncrement: 'P1M',
    },
  ],
  author: {
    '@type': 'Person',
    name: 'Howard Chen',
    jobTitle: 'CSCS 認證體能教練',
    url: SITE_URL,
  },
}

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Howard Protocol 數據驅動健康管理',
  description: '結合 CSCS 認證教練監督與智能系統 24 小時分析的體態與健康管理服務。自適應 TDEE 校正、每週智能分析、Refeed 自動觸發。',
  provider: {
    '@type': 'Organization',
    name: 'Howard Protocol',
    url: SITE_URL,
  },
  serviceType: '健康管理與體態優化',
  areaServed: {
    '@type': 'Country',
    name: '台灣',
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Howard Protocol 方案',
    itemListElement: [
      {
        '@type': 'Offer',
        name: '免費體驗',
        description: '體重趨勢 + 飲食紀錄 + TDEE 計算 + 14 天自動校正',
        price: '0',
        priceCurrency: 'TWD',
      },
      {
        '@type': 'Offer',
        name: '自主管理方案',
        description: 'AI 飲食顧問無限使用 + 身心狀態追蹤 + 碳水循環',
        price: '499',
        priceCurrency: 'TWD',
        billingIncrement: 'P1M',
      },
      {
        '@type': 'Offer',
        name: '教練指導方案',
        description: 'CSCS 教練每週 review + LINE 即時諮詢 + 訓練/補劑/血檢追蹤',
        price: '2999',
        priceCurrency: 'TWD',
        billingIncrement: 'P1M',
      },
    ],
  },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '這跟一般的飲食 App 有什麼不同？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '一般 App 只讓你記錄熱量，但不會告訴你「方向對不對」。Howard Protocol 的智能引擎會根據你的真實體重趨勢，自動校正 TDEE、每週分析進度、判斷你該不該調整 — 是一套會「思考」的系統。',
      },
    },
    {
      '@type': 'Question',
      name: '我不會計算熱量，可以用嗎？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '可以！初期不用太精確，用「手掌法」估算份量就好。系統會根據你的體重趨勢自動校正，就算記錄不完美，14 天後系統也能算出你實際燃燒多少。',
      },
    },
    {
      '@type': 'Question',
      name: '要綁約嗎？可以隨時取消嗎？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '全部月繳制，不綁約，隨時可取消。當月不退費，下個月停止扣款。免費版永久免費，隨時可升級付費方案。',
      },
    },
    {
      '@type': 'Question',
      name: '免費版可以用多久？有什麼限制？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '免費版永久免費，包含體重趨勢追蹤、飲食紀錄、TDEE 自動計算、和 14 天後自動校正營養目標。付費版額外解鎖身心狀態追蹤、AI 飲食顧問、教練每週 review 等功能。',
      },
    },
    {
      '@type': 'Question',
      name: '需要什麼設備？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '只需要手機和一台體重計就好。系統透過 LINE 和網頁運作，不需要安裝額外 App。建議使用智慧型體重計（能測體脂），但普通體重計也可以。',
      },
    },
  ],
}

export const metadata: Metadata = {
  title: 'Howard Protocol - 數據驅動的體態與健康管理 | CSCS 教練監督',
  description: '不只是教練服務，是一套數據驅動的體態與健康管理系統。自適應 TDEE 校正、每週智能分析、Refeed 自動觸發、月經週期濾鏡。CSCS 認證教練監督，運動醫學背景。台中實體 / 全台遠端。',
  keywords: ['數據化體態管理', '自適應TDEE', '智能營養系統', 'CSCS教練', '數據化訓練', '遠端訓練', '科學化減脂', '台中教練', '健康管理'],
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'Howard Protocol - 數據驅動的體態與健康管理',
    description: '智能系統 24 小時分析 × CSCS 教練即時監督',
    type: 'website',
    url: SITE_URL,
    images: [{ url: '/howard-profile.jpg', width: 1200, height: 630, alt: 'Howard Protocol - 數據驅動的體態與健康管理' }],
  },
}

export default function HomePage() {
  return (
    <>
      <PwaRedirect />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* ===== 區塊 1: Hero ===== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-[#f5f7fa]">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="flex flex-col-reverse md:flex-row items-center gap-10 md:gap-16">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-block bg-primary/10 text-primary text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
                CSCS 認證 × 數據驅動
              </div>
              <ABTest
                experimentId="landing_hero"
                variants={{
                  data_focus: (
                    <>
                      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-navy">
                        你不是不夠努力<br />你只是每天都在<br className="md:hidden" />用感覺做決定
                      </h1>
                      <p className="text-lg md:text-xl text-gray-600 mb-3 leading-relaxed">
                        每天 2 分鐘記錄，系統告訴你今天做對了沒有
                      </p>
                      <p className="text-sm text-gray-400 mb-6 leading-relaxed max-w-lg">
                        系統追蹤你的體重趨勢，每週自動校正目標。<br />
                        不是給你數字就消失 — 是每天告訴你：對，繼續。
                      </p>
                    </>
                  ),
                  coach_focus: (
                    <>
                      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-navy">
                        CSCS 教練 + 智能系統<br />你的專屬<br className="md:hidden" />體態管理團隊
                      </h1>
                      <p className="text-lg md:text-xl text-gray-600 mb-3 leading-relaxed">
                        不只是系統分析 — 還有真人教練每週幫你把關
                      </p>
                      <p className="text-sm text-gray-400 mb-6 leading-relaxed max-w-lg">
                        運動醫學背景教練 + 數據驅動系統，雙重保障。<br />
                        方向對了，結果只是時間問題。
                      </p>
                    </>
                  ),
                }}
                fallback={
                  <>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-navy">
                      你不是不夠努力<br />你只是每天都在<br className="md:hidden" />用感覺做決定
                    </h1>
                    <p className="text-lg md:text-xl text-gray-600 mb-3 leading-relaxed">
                      每天 2 分鐘記錄，系統告訴你今天做對了沒有
                    </p>
                    <p className="text-sm text-gray-400 mb-6 leading-relaxed max-w-lg">
                      系統追蹤你的體重趨勢，每週自動校正目標。<br />
                      不是給你數字就消失 — 是每天告訴你：對，繼續。
                    </p>
                  </>
                }
              />
              {/* 社會證明 */}
              <div className="flex items-center gap-4 mb-8 text-sm text-gray-500">
                <span className="flex items-center gap-1"><span className="font-bold text-navy">6+</span> 年系統開發</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span className="flex items-center gap-1"><span className="font-bold text-navy">CSCS</span> 認證</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span className="flex items-center gap-1"><span className="font-bold text-navy">30 秒</span> 開通</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/join"
                  className="inline-block bg-primary text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-primary-dark transition-all shadow-lg shadow-blue-500/25 text-center min-h-[48px]"
                >
                  免費開始記錄 →
                </Link>
                <LineButton
                  source="homepage_hero"
                  intent="general"
                  className="inline-block bg-white text-navy border-2 border-navy px-8 py-4 rounded-xl font-semibold text-lg hover:bg-navy/5 transition-all text-center min-h-[48px]"
                >
                  加 LINE 了解更多
                </LineButton>
              </div>
            </div>

            {/* 右側：Howard 照片 + 引擎 Demo 預覽 */}
            <div className="flex-shrink-0 flex flex-col items-center gap-4">
              <Image
                src="/howard-profile.jpg"
                alt="Howard Chen - CSCS 認證體能教練 / Howard Protocol 創辦人"
                width={240}
                height={240}
                sizes="(max-width: 768px) 240px, 240px"
                className="rounded-2xl object-cover shadow-[0_8px_30px_rgba(30,58,95,0.12)]"
                priority
              />
              {/* 靜態 Engine Demo 卡片 */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 w-[260px]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🧠</span>
                  <span className="text-xs font-bold text-gray-900">每週智能分析</span>
                  <span className="ml-auto text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">進度正常</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-gray-400">TDEE</p>
                    <p className="text-sm font-bold text-gray-900">2,340</p>
                    <p className="text-[9px] text-gray-400">kcal</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-gray-400">體重變化</p>
                    <p className="text-sm font-bold text-green-600">-0.6%</p>
                    <p className="text-[9px] text-gray-400">/週</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-gray-400">每日赤字</p>
                    <p className="text-sm font-bold text-green-600">380</p>
                    <p className="text-[9px] text-gray-400">kcal</p>
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-green-700">🟢 體重穩定下降，完美符合目標範圍。維持目前計畫。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 區塊 2: 痛點共鳴（過程型 → 結果型收尾） ===== */}
      <ScrollReveal>
        <section className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-navy">
            你是不是也這樣？
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { emoji: '🍽️', text: '每天吃完飯不知道今天算不算合格' },
              { emoji: '🏋️', text: '訓練完不確定今天的強度是對的還是太過' },
              { emoji: '📉', text: '停滯了不知道是該繼續撐還是調整計畫' },
              { emoji: '😶‍🌫️', text: '靠感覺過了三個月，回頭看根本不知道哪裡出了問題' },
            ].map(({ emoji, text }) => (
              <div key={text} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                <div className="text-3xl mb-3">{emoji}</div>
                <p className="text-gray-700 font-medium leading-relaxed text-sm">{text}</p>
              </div>
            ))}
          </div>
          <div className="max-w-2xl mx-auto bg-navy/5 rounded-2xl p-6 text-center">
            <p className="text-gray-600 text-sm leading-relaxed">
              問題不是你不夠努力，是<span className="font-bold text-navy">沒有東西告訴你方向對不對</span>。
              <br />Howard Protocol 每天幫你確認：<span className="font-bold text-primary">方向對，繼續。方向偏，這樣調。</span>
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 3: 真實數據成果 ===== */}
      <ScrollReveal>
        <section className="bg-[#f5f7fa] py-20">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-navy">
              用數據說話，不用嘴巴
            </h2>
            <p className="text-center text-gray-500 mb-14">Howard 本人 6 年系統追蹤的真實數據</p>
            <div className="grid md:grid-cols-4 gap-6 mb-10">
              {[
                { label: 'HRV（心率變異）', before: '65 ms', after: '91 ms', change: '+40%', color: 'text-green-600' },
                { label: '靜息心率', before: '58 bpm', after: '52 bpm', change: '-10%', color: 'text-green-600' },
                { label: 'HOMA-IR（胰島素阻抗）', before: '偏高', after: '0.49', change: '正常', color: 'text-green-600' },
                { label: 'Testosterone', before: '515', after: '625 ng/dL', change: '+21%', color: 'text-green-600' },
              ].map(({ label, before, after, change, color }) => (
                <div key={label} className="bg-white rounded-2xl p-6 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-2">{label}</p>
                  <p className="text-xs text-gray-400 line-through mb-1">{before}</p>
                  <p className="text-2xl font-bold text-gray-900 mb-1">{after}</p>
                  <p className={`text-sm font-semibold ${color}`}>{change}</p>
                </div>
              ))}
            </div>
            <div className="text-center">
              <Link href="/case" className="text-primary hover:underline text-sm font-medium">
                查看完整 6 年數據紀錄 →
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 3.5: 學員真實成果 ===== */}
      <ScrollReveal>
        <section className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-navy">
            學員真實成果
          </h2>
          <p className="text-center text-gray-500 mb-14">系統追蹤 + 教練監督的真實數據</p>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              {
                initials: 'L.Y.',
                period: '減脂 12 週',
                stat: '-8.2 kg',
                detail: '體脂 28% → 21%',
                color: 'from-green-400 to-emerald-500',
                quote: '以前靠感覺減肥，每次都復胖。這次系統每週告訴我方向對不對，12 週後看到數據才知道原來可以這麼穩定。',
              },
              {
                initials: 'K.C.',
                period: '增肌 16 週',
                stat: '+3.1 kg 肌肉量',
                detail: '體脂維持 15%',
                color: 'from-blue-400 to-indigo-500',
                quote: '增肌最怕吃太多變胖，系統幫我精準控制熱量盈餘，16 週肌肉量上去了，體脂幾乎沒變。',
              },
              {
                initials: 'S.W.',
                period: '產後恢復 20 週',
                stat: '-15 kg',
                detail: '回到孕前體重',
                color: 'from-purple-400 to-pink-500',
                quote: '產後帶小孩根本沒時間研究，每天只花 2 分鐘記錄，系統自動幫我調整。20 週回到孕前體重，自己都不敢相信。',
              },
            ].map(({ initials, period, stat, detail, color, quote }) => (
              <div
                key={initials}
                className="relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-shadow"
              >
                {/* Gradient top accent */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${color}`} />

                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {initials}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-navy">{period}</p>
                    <p className="text-[10px] text-gray-400">{initials.replace('.', '')} 同學</p>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-bold text-navy">{stat}</span>
                  <span className="text-xs text-gray-400">|</span>
                  <span className="text-xs font-semibold text-green-600">{detail}</span>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed italic">
                  &ldquo;{quote}&rdquo;
                </p>
              </div>
            ))}
          </div>
          <p className="text-center text-[10px] text-gray-400">
            以上為真實學員數據，個人結果因執行力而異
          </p>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 3.6: 信任指標 ===== */}
      <ScrollReveal>
        <section className="bg-navy/5 py-10">
          <div className="max-w-4xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { icon: '🏅', value: '6+', unit: '年', label: '教練經驗' },
                { icon: '📊', value: '200+', unit: '位', label: '學員數據' },
                { icon: '🔬', value: '科學化', unit: '', label: '追蹤系統' },
                { icon: '💬', value: 'LINE', unit: '', label: '即時支援' },
              ].map(({ icon, value, unit, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <span className="text-2xl">{icon}</span>
                  <p className="text-lg font-bold text-navy">
                    {value}<span className="text-sm font-normal text-gray-500">{unit ? ` ${unit}` : ''}</span>
                  </p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 4: 系統核心能力（用戶語言 + 數字錨點） ===== */}
      <ScrollReveal>
        <section className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-navy">
            系統在背後幫你做什麼
          </h2>
          <p className="text-center text-gray-500 mb-14">每個功能都有運動科學文獻支撐</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '📊', title: '系統學你的身體', anchor: '追蹤 14 天後自動校正', desc: '每個人代謝不一樣。系統追蹤你的體重趨勢，自動算出你實際燃燒多少 — 比任何公式都準，因為用的是你自己的數據。' },
              { icon: '🧠', title: '系統幫你看方向', anchor: '每週一早上推送', desc: '掉太快？停滯了？方向對嗎？系統每週自動判斷，直接告訴你該怎麼調 — 不用等、不用猜。' },
              { icon: '🔄', title: '系統告訴你該放鬆', anchor: '3 個信號同時亮才觸發', desc: '節食太久身體會反抗。系統監測你的疲勞和低碳天數，時機到了主動提醒你 Refeed — 你不需要懂原理。' },
              { icon: '🩸', title: '系統不會誤判你', anchor: '自動排除黃體期波動', desc: '經期前體重浮動是正常的。系統知道這件事，不會因為體重上升就叫你少吃。' },
            ].map(({ icon, title, anchor, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl mb-3 text-center">{icon}</div>
                <h3 className="font-bold mb-1 text-sm text-center text-navy">{title}</h3>
                <p className="text-[10px] text-primary font-semibold text-center mb-2">{anchor}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 4.5: 時間軸 — 用了之後會發生什麼 ===== */}
      <ScrollReveal>
        <section className="bg-[#f5f7fa] py-20">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-navy">
              用了之後會發生什麼
            </h2>
            <p className="text-center text-gray-500 mb-14">不靠意志力，靠系統幫你累積</p>
            <div className="space-y-0">
              {[
                { day: '第 1 天', text: '填入基本資料，系統算出你的起點和每日目標', color: 'bg-blue-500' },
                { day: '第 14 天', text: '系統根據你的真實體重趨勢，自動校正 TDEE', color: 'bg-indigo-500' },
                { day: '第 30 天', text: '第一份月報出爐，看到趨勢線的方向', color: 'bg-purple-500' },
                { day: '第 90 天', text: '回頭看三個月的數據，你會知道每一步是怎麼走過來的', color: 'bg-green-500' },
              ].map(({ day, text, color }, i) => (
                <div key={day} className="flex gap-4 items-start">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full ${color} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                      {day.replace('第 ', '').replace(' 天', '')}
                    </div>
                    {i < 3 && <div className="w-0.5 h-12 bg-gray-200" />}
                  </div>
                  <div className="pt-2 pb-8">
                    <p className="text-xs font-bold text-gray-400 mb-1">{day}</p>
                    <p className="text-sm text-gray-700 font-medium">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 5: 適合誰 ===== */}
      <ScrollReveal>
        <section className="bg-[#f5f7fa] py-20">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-navy">
              這套系統適合你嗎？
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-green-100">
                <h3 className="text-lg font-bold text-green-700 mb-5">適合你</h3>
                <ul className="space-y-3">
                  {[
                    '認真想改變但一直卡住的人',
                    '想用數據和科學方法，不想土法煉鋼',
                    '想要系統幫你追蹤，不只是教練的感覺',
                    '外縣市或時間不固定，需要遠端管理',
                    '願意每天花 2 分鐘記錄數據的人',
                  ].map(t => (
                    <li key={t} className="flex items-start gap-2 text-gray-700 text-sm">
                      <span className="text-green-500 mt-0.5 font-bold">+</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-red-100">
                <h3 className="text-lg font-bold text-red-600 mb-5">不適合</h3>
                <ul className="space-y-3">
                  {[
                    '只想要速效、不願意等 2-4 週看數據的人',
                    '不願意配合每日記錄飲食和體重的人',
                    '純粹找人陪練、不在意數據的人',
                  ].map(t => (
                    <li key={t} className="flex items-start gap-2 text-gray-700 text-sm">
                      <span className="text-red-400 mt-0.5 font-bold">-</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 6: 兩條路徑定價 ===== */}
      <ScrollReveal>
        <section className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-navy">
            免費開始，用了再決定
          </h2>
          <p className="text-center text-gray-500 mb-14">不需信用卡，30 秒建立帳號</p>
          <div className="grid md:grid-cols-2 gap-6">
            {/* 左：自己來 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-green-200 flex flex-col">
              <h3 className="text-xl font-bold text-navy mb-2">自己來</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                系統幫你記錄和分析，你自己做決定。
              </p>

              {/* 免費 */}
              <div className="bg-green-50 rounded-xl p-4 mb-3">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-bold text-navy">$0</span>
                  <span className="text-xs text-gray-400">永久免費</span>
                </div>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li className="flex items-start gap-1.5"><span className="text-green-500">&#10003;</span>體重趨勢 + 飲食紀錄 + TDEE 計算</li>
                  <li className="flex items-start gap-1.5"><span className="text-green-500">&#10003;</span>14 天後自動校正營養目標</li>
                </ul>
              </div>

              {/* 升級 $499 */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-bold text-navy">$499</span>
                  <span className="text-xs text-gray-400">/月 · 升級解鎖</span>
                </div>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li className="flex items-start gap-1.5"><span className="text-green-500">&#10003;</span>身心狀態追蹤（睡眠、能量、壓力）</li>
                  <li className="flex items-start gap-1.5"><span className="text-green-500">&#10003;</span>AI 飲食顧問無限使用</li>
                </ul>
              </div>

              <div className="mt-auto">
                <Link
                  href="/join"
                  className="block bg-green-500 text-white py-3.5 rounded-xl font-semibold hover:bg-green-600 transition-colors text-center text-lg min-h-[48px] flex items-center justify-center"
                >
                  免費開始記錄 →
                </Link>
                <p className="text-xs text-gray-400 text-center mt-2">不需信用卡，30 秒開通</p>
              </div>
            </div>

            {/* 右：教練帶 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-primary flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-4 py-1 rounded-full">
                最多人選
              </div>
              <h3 className="text-xl font-bold text-navy mb-2">教練帶</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                系統分析 + CSCS 教練每週 review，雙重保障。
              </p>

              {/* 遠端 $2,999 */}
              <div className="bg-blue-50 rounded-xl p-4 mb-3">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-bold text-navy">$2,999</span>
                  <span className="text-xs text-gray-400">/月 · 全台遠端</span>
                </div>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li className="flex items-start gap-1.5"><span className="text-primary">&#10003;</span>自主管理全部功能</li>
                  <li className="flex items-start gap-1.5"><span className="text-primary">&#10003;</span>教練每週營養 review + LINE 即時問答</li>
                  <li className="flex items-start gap-1.5"><span className="text-primary">&#10003;</span>訓練 / 補劑 / 血檢完整追蹤</li>
                </ul>
              </div>

              {/* 實體 $5,000 */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-bold text-navy">$5,000</span>
                  <span className="text-xs text-gray-400">/月 · 台中北屯</span>
                </div>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li className="flex items-start gap-1.5"><span className="text-navy">&#10003;</span>教練指導全部功能</li>
                  <li className="flex items-start gap-1.5"><span className="text-navy">&#10003;</span>每月實體 1 對 1 + 動作矯正 + 課表設計</li>
                </ul>
              </div>

              <div className="mt-auto">
                <LineButton
                  source="homepage_plan"
                  intent="general"
                  className="block bg-primary text-white py-3.5 rounded-xl font-semibold hover:bg-primary-dark transition-colors text-center text-lg"
                >
                  加 LINE 開始 →
                </LineButton>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-8">
            全部月繳制，隨時可取消。免費版隨時可升級，補差額即可。
          </p>
          <p className="text-center text-[10px] text-gray-300 mt-3">
            服務提供：Howard Protocol ｜ chenhoward456@gmail.com ｜ 0978-185-268
          </p>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 7: 關於 Howard ===== */}
      <ScrollReveal>
        <section className="bg-[#f5f7fa] py-16">
          <div className="max-w-4xl mx-auto px-6">
            <div className="bg-white rounded-2xl p-8 shadow-sm flex flex-col md:flex-row items-center gap-8">
              <Image
                src="/howard-profile.jpg"
                alt="Howard Chen"
                width={120}
                height={120}
                sizes="120px"
                className="rounded-xl object-cover"
              />
              <div>
                <h3 className="text-xl font-bold mb-2 text-navy">Howard Chen</h3>
                <p className="text-sm text-gray-500 mb-3">CSCS 認證 / 高雄醫學大學運動醫學系 / 6+ 年實務經驗</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  我花了 6 年時間，從自己的身體實驗中，建立了這套數據驅動的體態與健康管理系統。
                  每一個功能背後都有運動科學文獻支撐，不是憑感覺教練。
                  我相信：好的系統比好的意志力更可靠。
                </p>
              </div>
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
                <h3 className="text-2xl font-bold mb-2 text-navy">
                  免費文章：三層脂肪攻克戰術
                </h3>
                <p className="text-gray-600 mb-5 leading-relaxed text-sm">
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

      {/* ===== 區塊 7.5: FAQ 常見問題 ===== */}
      <ScrollReveal>
        <section className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-navy">
            常見問題
          </h2>
          <p className="text-center text-gray-500 mb-10">還在猶豫？先看看這些</p>
          <FaqAccordion />
          <div className="text-center mt-8">
            <Link href="/faq" className="text-primary hover:underline text-sm font-medium">
              查看更多常見問題 →
            </Link>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 區塊 8: CTA 結尾 ===== */}
      <section className="bg-navy py-20 mt-10 rounded-t-3xl">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            每天 2 分鐘，讓系統幫你確認方向
          </h2>
          <p className="text-blue-200 text-lg mb-4">
            免費開始記錄，14 天後系統會自動告訴你接下來怎麼做
          </p>

          {/* Urgency badge */}
          <div className="inline-block bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-sm font-semibold px-5 py-2 rounded-full mb-8">
            限時優惠：自主管理版首月 NT$399（原價 NT$499）
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Link
              href="/join"
              className="inline-block bg-green-500 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-green-600 transition-colors min-h-[48px] shadow-lg shadow-green-500/25"
            >
              免費體驗 →
            </Link>
            <Link
              href="/join"
              className="inline-block bg-white text-navy px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors min-h-[48px]"
            >
              NT$399/月 開始 →
            </Link>
            <Link
              href="/diagnosis"
              className="inline-block bg-transparent text-white border-2 border-white/50 px-10 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-colors min-h-[48px]"
            >
              先免費體驗分析
            </Link>
          </div>

          {/* Trust signals */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-blue-300/80 text-sm">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              不需要綁約，隨時取消
            </span>
            <span className="hidden sm:block w-1 h-1 rounded-full bg-blue-300/40" />
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              30 秒開始，不需信用卡
            </span>
            <span className="hidden sm:block w-1 h-1 rounded-full bg-blue-300/40" />
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              免費版永久免費
            </span>
          </div>
        </div>
      </section>
      {/* ===== Sticky Mobile CTA ===== */}
      <StickyMobileCta />
    </>
  )
}
