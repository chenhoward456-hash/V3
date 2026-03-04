import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import ScrollReveal from '@/components/ScrollReveal'
import LineButton from '@/components/LineButton'

const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Howard Chen',
  alternateName: 'Howard',
  jobTitle: 'CSCS 認證體能教練 / Howard Protocol 創辦人',
  description: '數據驅動體態與健康管理系統 Howard Protocol 創辦人，CSCS 認證，運動醫學背景。智能系統 × 教練監督。',
  url: 'https://howard456.vercel.app',
  image: 'https://howard456.vercel.app/howard-profile.jpg',
  sameAs: [
    'https://www.instagram.com/chenhoward/',
    'https://line.me/ti/p/~0078185268',
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
  url: 'https://howard456.vercel.app',
  image: 'https://howard456.vercel.app/howard-profile.jpg',
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
    'https://line.me/ti/p/~0078185268',
  ],
}

export const metadata: Metadata = {
  title: 'Howard Protocol - 數據驅動的體態與健康管理 | CSCS 教練監督',
  description: '不只是教練服務，是一套數據驅動的體態與健康管理系統。自適應 TDEE 校正、每週智能分析、Refeed 自動觸發、月經週期濾鏡。CSCS 認證教練監督，運動醫學背景。台中實體 / 全台遠端。',
  keywords: ['數據化體態管理', '自適應TDEE', '智能營養系統', 'CSCS教練', '數據化訓練', '遠端訓練', '科學化減脂', '台中教練', '健康管理'],
  alternates: { canonical: 'https://howard456.vercel.app' },
  openGraph: {
    title: 'Howard Protocol - 數據驅動的體態與健康管理',
    description: '智能系統 24 小時分析 × CSCS 教練即時監督',
    type: 'website',
    url: 'https://howard456.vercel.app',
    images: [{ url: '/howard-profile.jpg', width: 1200, height: 630, alt: 'Howard Protocol - 數據驅動的體態與健康管理' }],
  },
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />

      {/* ===== 區塊 1: Hero ===== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-[#f5f7fa]">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="flex flex-col-reverse md:flex-row items-center gap-10 md:gap-16">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-block bg-primary/10 text-primary text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
                CSCS 認證 × 數據驅動
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-navy">
                練了半年沒變化？<br />問題不在你的努力
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-3 leading-relaxed">
                智能系統 24 小時分析 × CSCS 教練即時監督
              </p>
              <p className="text-sm text-gray-400 mb-8 leading-relaxed max-w-lg">
                不靠感覺、不靠公式 — 系統根據你的真實數據，每週自動分析體重趨勢、校正營養目標、偵測停滯期。
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/join"
                  className="inline-block bg-primary text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-primary-dark transition-all shadow-lg shadow-blue-500/25 text-center"
                >
                  免費體驗 →
                </Link>
                <Link
                  href="/diagnosis"
                  className="inline-block bg-white text-navy border-2 border-navy px-8 py-4 rounded-xl font-semibold text-lg hover:bg-navy/5 transition-all text-center"
                >
                  免費系統分析
                </Link>
              </div>
            </div>

            {/* 右側：Howard 照片 + 引擎 Demo 預覽 */}
            <div className="flex-shrink-0 flex flex-col items-center gap-4">
              <Image
                src="/howard-profile.jpg"
                alt="Howard Chen - CSCS 認證體能教練 / Howard Protocol 創辦人"
                width={240}
                height={240}
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

      {/* ===== 區塊 2: 痛點共鳴 ===== */}
      <ScrollReveal>
        <section className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-navy">
            你是不是也這樣？
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { emoji: '💪', text: '認真練了半年，體態卻沒什麼變化' },
              { emoji: '🥗', text: '飲食控制很嚴格，體脂就是不降' },
              { emoji: '😫', text: '容易疲勞、恢復慢，不知道哪裡出問題' },
              { emoji: '📋', text: '教練給了菜單，但從不根據你的數據調整' },
            ].map(({ emoji, text }) => (
              <div key={text} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                <div className="text-3xl mb-3">{emoji}</div>
                <p className="text-gray-700 font-medium leading-relaxed text-sm">{text}</p>
              </div>
            ))}
          </div>
          <div className="max-w-2xl mx-auto bg-navy/5 rounded-2xl p-6 text-center">
            <p className="text-gray-600 text-sm leading-relaxed">
              大部分教練給你一組靜態數字，然後<span className="font-bold text-navy">就沒有然後了</span>。
              <br />Howard Protocol 會根據你的體重趨勢，<span className="font-bold text-primary">每週自動分析、自動建議調整</span>。
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

      {/* ===== 區塊 4: 系統核心能力（合併） ===== */}
      <ScrollReveal>
        <section className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-navy">
            系統在背後幫你做什麼
          </h2>
          <p className="text-center text-gray-500 mb-14">每個功能都有運動科學文獻支撐</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '📊', title: '自適應 TDEE', desc: '不用公式猜 — 系統根據你的體重變化和飲食記錄，自動校正代謝率' },
              { icon: '🧠', title: '每週智能分析', desc: '掉太快？停滯了？方向對嗎？系統即時判斷，不用等教練手動看' },
              { icon: '🔄', title: 'Refeed 自動觸發', desc: 'RPE + 能量 + 低碳天數，三條件到位自動建議 Refeed' },
              { icon: '🩸', title: '月經週期濾鏡', desc: '黃體期體重浮動不會被誤判，系統不會叫你少吃' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl mb-3 text-center">{icon}</div>
                <h3 className="font-bold mb-2 text-sm text-center text-navy">{title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
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

      {/* ===== 區塊 6: 服務方案 ===== */}
      <ScrollReveal>
        <section className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-navy">
            選擇你的方案
          </h2>
          <p className="text-center text-gray-500 mb-14">同一套引擎，從免費開始</p>
          <div className="grid md:grid-cols-4 gap-5">
            {/* 免費體驗 $0 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 flex flex-col relative">
              <div className="absolute -top-3 left-6 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                推薦先試
              </div>
              <h3 className="text-xl font-bold mb-1 text-navy">免費體驗</h3>
              <p className="text-gray-400 text-sm mb-4">先用再決定</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-green-600">免費</span>
              </div>
              <ul className="space-y-3 text-gray-700 mb-8 flex-1 text-sm">
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>體重 / 體態追蹤</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>每日飲食紀錄</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>TDEE + 巨量營養素計算</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>每月 1 次 AI 問答</li>
              </ul>
              <Link
                href="/join"
                className="block text-center bg-green-500 text-white py-3.5 rounded-xl font-semibold hover:bg-green-600 transition-colors"
              >
                免費開始 →
              </Link>
            </div>

            {/* 自主管理 NT$499 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-primary/30 flex flex-col relative">
              <div className="absolute -top-3 left-6 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                最多人選
              </div>
              <h3 className="text-xl font-bold mb-1 text-navy">自主管理版</h3>
              <p className="text-gray-400 text-sm mb-4">系統幫你管，不需要教練</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-navy">NT$499</span>
                <span className="text-gray-400 text-sm"> /月</span>
              </div>
              <ul className="space-y-3 text-gray-700 mb-8 flex-1 text-sm">
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&#10003;</span>智能引擎 24 小時自動分析</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&#10003;</span>每週體重趨勢自動判讀</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&#10003;</span>自適應 TDEE 持續校正</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&#10003;</span>Refeed / Diet Break 自動觸發</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&#10003;</span>碳循環自動分配</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&#10003;</span>月經週期智能濾鏡</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&#10003;</span>HRV 恢復狀態自動調整</li>
              </ul>
              <Link
                href="/join"
                className="block text-center bg-primary text-white py-3.5 rounded-xl font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-blue-500/25"
              >
                免費體驗 →
              </Link>
            </div>

            {/* 教練指導 NT$2,999 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 flex flex-col relative">
              <div className="absolute -top-3 left-6 bg-navy text-white text-xs font-bold px-3 py-1 rounded-full">
                全台適用
              </div>
              <h3 className="text-xl font-bold mb-1 text-navy">教練指導版</h3>
              <p className="text-gray-400 text-sm mb-4">系統 + CSCS 教練監督</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-navy">NT$2,999</span>
                <span className="text-gray-400 text-sm"> /月</span>
              </div>
              <ul className="space-y-3 text-gray-700 mb-4 text-sm">
                <li className="flex items-start gap-2"><span className="text-navy mt-0.5">&#10003;</span>包含自主管理版所有功能</li>
              </ul>
              <div className="border-t border-gray-100 pt-4 mb-8 flex-1">
                <p className="text-xs text-gray-400 mb-3">額外包含：</p>
                <ul className="space-y-3 text-gray-700 text-sm">
                  <li className="flex items-start gap-2"><span className="text-navy mt-0.5">&#10003;</span>CSCS 教練每週 review</li>
                  <li className="flex items-start gap-2"><span className="text-navy mt-0.5">&#10003;</span>LINE 即時諮詢</li>
                  <li className="flex items-start gap-2"><span className="text-navy mt-0.5">&#10003;</span>每月 1 次視訊</li>
                </ul>
              </div>
              <LineButton
                source="homepage_plan"
                intent="coach_plan"
                className="block text-center bg-navy text-white py-3.5 rounded-xl font-semibold hover:bg-navy/90 transition-colors"
              >
                加 LINE 諮詢
              </LineButton>
            </div>

            {/* 實體 + 遠端 NT$5,000 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 flex flex-col relative">
              <div className="absolute -top-3 left-6 bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                台中限定
              </div>
              <h3 className="text-xl font-bold mb-1 text-navy">實體 + 智能管理</h3>
              <p className="text-gray-400 text-sm mb-4">一對一指導 + 系統全套</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-navy">NT$5,000</span>
                <span className="text-gray-400 text-sm"> /月</span>
              </div>
              <ul className="space-y-3 text-gray-700 mb-4 text-sm">
                <li className="flex items-start gap-2"><span className="text-amber-600 mt-0.5">&#10003;</span>包含教練指導版所有功能</li>
              </ul>
              <div className="border-t border-gray-100 pt-4 mb-8 flex-1">
                <p className="text-xs text-gray-400 mb-3">額外包含：</p>
                <ul className="space-y-3 text-gray-700 text-sm">
                  <li className="flex items-start gap-2"><span className="text-amber-600 mt-0.5">&#10003;</span>一對一動作評估與矯正</li>
                  <li className="flex items-start gap-2"><span className="text-amber-600 mt-0.5">&#10003;</span>即時訓練指導</li>
                  <li className="flex items-start gap-2"><span className="text-amber-600 mt-0.5">&#10003;</span>Coolday 北屯館</li>
                </ul>
              </div>
              <LineButton
                source="homepage_plan"
                intent="in_person"
                className="block text-center bg-white text-navy border-2 border-navy py-3.5 rounded-xl font-semibold hover:bg-navy/5 transition-colors"
              >
                加 LINE 預約
              </LineButton>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-8">
            月繳制，隨時可取消。自主管理版可隨時升級，補差額即可。
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

      {/* ===== 區塊 8: CTA 結尾 ===== */}
      <section className="bg-navy py-20 mt-10 rounded-t-3xl">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            不確定適不適合？先聊聊
          </h2>
          <p className="text-blue-200 text-lg mb-10">
            加 LINE 跟我說你的目標，我會先幫你確認方向
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/join"
              className="inline-block bg-white text-navy px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors"
            >
              免費體驗 →
            </Link>
            <LineButton
              source="homepage_bottom"
              intent="general"
              className="inline-block bg-transparent text-white border-2 border-white/50 px-10 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-colors"
            >
              加 LINE 聊聊 💬
            </LineButton>
          </div>
        </div>
      </section>
    </>
  )
}
