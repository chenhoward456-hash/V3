import type { Metadata } from 'next'
import Link from 'next/link'
import LineButton from '@/components/LineButton'
import ScrollReveal from '@/components/ScrollReveal'

export const metadata: Metadata = {
  title: '方案說明 - Howard Protocol 智能管理系統 | 全台遠端 / 台中實體',
  description: '智能引擎 × CSCS 教練監督。自適應 TDEE 每週校正、體重趨勢自動判讀、Refeed 自動觸發、月經週期濾鏡。全台遠端訂閱 / 台中實體訓練。',
  alternates: { canonical: 'https://howard456.vercel.app/remote' },
  openGraph: {
    title: '方案說明 - Howard Protocol 智能管理系統',
    description: '智能引擎 × CSCS 教練監督。全台遠端訂閱 / 台中實體訓練。',
    url: 'https://howard456.vercel.app/remote',
  },
}

export default function RemotePage() {
  return (
    <>
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #f5f7fa 0%, #ffffff 100%)' }}>
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-24 text-center">
          <div className="inline-block bg-[#2563eb]/10 text-[#2563eb] text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            Howard Protocol
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4" style={{ color: '#1e3a5f' }}>
            不只是教練服務<br />是一套會持續進化的管理系統
          </h1>
          <p className="text-lg text-gray-500 mb-4 max-w-2xl mx-auto">
            系統每週根據你的真實數據自動校正 — 不靠感覺，不靠公式。
          </p>
          <p className="text-sm text-gray-400">
            自適應 TDEE × 每週智能分析 × Refeed 自動觸發 × CSCS 教練監督
          </p>
        </div>
      </section>

      {/* ===== 免費分析 vs 完整訂閱 對比 ===== */}
      <ScrollReveal>
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4" style={{ color: '#1e3a5f' }}>
            免費體驗 vs 完整訂閱
          </h2>
          <p className="text-center text-gray-500 mb-10 text-sm">
            免費分析是一次性估算，訂閱後系統會持續進化
          </p>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="grid grid-cols-3">
              {/* Header */}
              <div className="p-4 bg-gray-50 border-b border-r border-gray-200" />
              <div className="p-4 bg-gray-50 border-b border-r border-gray-200 text-center">
                <p className="text-sm font-bold text-gray-500">免費體驗</p>
              </div>
              <div className="p-4 bg-[#2563eb]/5 border-b border-gray-200 text-center">
                <p className="text-sm font-bold text-[#2563eb]">訂閱後</p>
              </div>

              {/* Rows */}
              {[
                { label: 'TDEE 估算', free: '公式估算（一次性）', paid: '自適應校正（每週更新）' },
                { label: '營養目標', free: '固定數字', paid: '根據體重趨勢自動校正' },
                { label: '停滯期偵測', free: '—', paid: '自動偵測 + 提示' },
                { label: 'Refeed', free: '—', paid: '三條件自動觸發' },
                { label: '月經週期', free: '—', paid: '黃體期智能濾鏡' },
                { label: '教練監督', free: '—', paid: 'CSCS 教練每週 review' },
              ].map(({ label, free, paid }, i) => (
                <div key={label} className="contents">
                  <div className={`p-3 border-r border-gray-200 ${i < 5 ? 'border-b border-gray-100' : ''}`}>
                    <p className="text-xs font-semibold text-gray-700">{label}</p>
                  </div>
                  <div className={`p-3 border-r border-gray-200 text-center ${i < 5 ? 'border-b border-gray-100' : ''}`}>
                    <p className={`text-xs ${free === '—' ? 'text-gray-300' : 'text-gray-500'}`}>{free}</p>
                  </div>
                  <div className={`p-3 text-center ${i < 5 ? 'border-b border-gray-100' : ''}`}>
                    <p className="text-xs font-medium text-[#2563eb]">{paid}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 方案選擇（2 欄，與首頁一致） ===== */}
      <ScrollReveal>
        <section className="bg-[#f5f7fa] py-20">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4" style={{ color: '#1e3a5f' }}>
              選擇你的方案
            </h2>
            <p className="text-center text-gray-500 mb-12 text-sm">兩種方案，同一套智能引擎</p>

            <div className="grid md:grid-cols-2 gap-8">
              {/* 主推：智能管理方案 */}
              <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-[#2563eb]/30 flex flex-col relative">
                <div className="absolute -top-3 left-6 bg-[#2563eb] text-white text-xs font-bold px-3 py-1 rounded-full">
                  全台適用
                </div>
                <h3 className="text-2xl font-bold mb-2" style={{ color: '#1e3a5f' }}>Howard Protocol 智能管理</h3>
                <p className="text-gray-500 mb-6 text-sm">智能引擎 + CSCS 教練監督</p>
                <ul className="space-y-3 text-gray-700 mb-8 flex-1 text-sm">
                  <li className="flex items-center gap-2"><span className="text-[#2563eb]">&#10003;</span>智能引擎 24 小時自動分析</li>
                  <li className="flex items-center gap-2"><span className="text-[#2563eb]">&#10003;</span>每週體重趨勢自動判讀</li>
                  <li className="flex items-center gap-2"><span className="text-[#2563eb]">&#10003;</span>自適應 TDEE 持續校正</li>
                  <li className="flex items-center gap-2"><span className="text-[#2563eb]">&#10003;</span>Refeed / Diet Break 自動觸發</li>
                  <li className="flex items-center gap-2"><span className="text-[#2563eb]">&#10003;</span>碳循環自動分配（訓練日/休息日）</li>
                  <li className="flex items-center gap-2"><span className="text-[#2563eb]">&#10003;</span>月經週期智能濾鏡（女性）</li>
                  <li className="flex items-center gap-2"><span className="text-[#2563eb]">&#10003;</span>CSCS 教練每週監督 + LINE 諮詢</li>
                </ul>
                <LineButton
                  source="remote_page"
                  intent="smart_plan"
                  className="block text-center bg-[#2563eb] text-white py-3.5 rounded-xl font-semibold hover:bg-[#1d4ed8] transition-colors shadow-lg shadow-blue-500/25"
                >
                  加 LINE 諮詢方案
                </LineButton>
              </div>

              {/* 實體 + 智能管理 */}
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 flex flex-col relative">
                <div className="absolute -top-3 left-6 bg-[#1e3a5f] text-white text-xs font-bold px-3 py-1 rounded-full">
                  台中限定
                </div>
                <h3 className="text-2xl font-bold mb-2" style={{ color: '#1e3a5f' }}>實體訓練 + 智能管理</h3>
                <p className="text-gray-500 mb-6 text-sm">一對一指導 + 智能引擎全套</p>
                <ul className="space-y-3 text-gray-700 mb-4 text-sm">
                  <li className="flex items-center gap-2"><span className="text-[#1e3a5f]">&#10003;</span>包含上方所有智能管理功能</li>
                </ul>
                <div className="border-t border-gray-100 pt-4 mb-8 flex-1">
                  <p className="text-xs text-gray-400 mb-3">額外包含：</p>
                  <ul className="space-y-3 text-gray-700 text-sm">
                    <li className="flex items-center gap-2"><span className="text-[#1e3a5f]">&#10003;</span>一對一動作評估與矯正</li>
                    <li className="flex items-center gap-2"><span className="text-[#1e3a5f]">&#10003;</span>即時訓練指導與調整</li>
                    <li className="flex items-center gap-2"><span className="text-[#1e3a5f]">&#10003;</span>Coolday Fitness 北屯館</li>
                  </ul>
                </div>
                <Link href="/action" className="block text-center bg-white text-[#1e3a5f] border-2 border-[#1e3a5f] py-3.5 rounded-xl font-semibold hover:bg-[#1e3a5f]/5 transition-colors">
                  預約諮詢 →
                </Link>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-8">
              價格會在 LINE 諮詢時根據你的需求與目標客製化報價
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 適合誰 ===== */}
      <ScrollReveal>
        <section className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12" style={{ color: '#1e3a5f' }}>
            這套系統適合你嗎？
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-green-100">
              <h3 className="text-lg font-bold text-green-700 mb-5">適合你</h3>
              <ul className="space-y-3">
                {[
                  '認真想改變但一直卡住的人',
                  '想用數據和系統方法，不想土法煉鋼',
                  '想讓系統自動追蹤，不只靠教練感覺',
                  '外縣市或時間不固定，需要遠端管理',
                  '願意每天花 2 分鐘記錄體重和飲食',
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
        </section>
      </ScrollReveal>

      {/* ===== FAQ ===== */}
      <ScrollReveal>
        <section className="bg-[#f5f7fa] py-20">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12" style={{ color: '#1e3a5f' }}>
              常見問題
            </h2>
            <div className="space-y-4">
              {[
                {
                  q: '免費分析和訂閱後有什麼差別？',
                  a: '免費分析是一次性公式估算，給你 TDEE 和巨量營養素的初始數字。訂閱後，系統每天追蹤你的實際體重和飲食記錄，每週自動校正 TDEE、自動偵測停滯期、自動觸發 Refeed，持續進化。',
                },
                {
                  q: '系統怎麼自動校正營養目標？',
                  a: '系統根據你每週的體重趨勢（不是單日浮動），對比你的飲食記錄，自動反推你真實的 TDEE。如果掉太快，會提示增加熱量保護肌肉；如果停滯了，會提示調整赤字或觸發 Refeed。全部自動判斷，不需等教練手動分析。',
                },
                {
                  q: '我需要記錄什麼？怎麼記？',
                  a: '每天花 2 分鐘：記錄體重（早晨空腹）+ 飲食（拍照或文字記錄都可以）。透過 LINE 傳送即可，不需下載特殊 App。系統會自動分析你傳的數據。',
                },
                {
                  q: '可以先試一個月嗎？',
                  a: '可以。月繳制，隨時可以取消。但建議至少連續使用 4 週，系統需要 2-3 週的數據才能精準校正你的 TDEE，第 4 週開始你會感受到系統的自適應能力。',
                },
                {
                  q: '女性月經週期真的不會被誤判嗎？',
                  a: '對。系統內建月經週期濾鏡：當你標記經期開始後，黃體期（排卵後 14-28 天）如果體重上升 0.5-2kg，系統會自動判定為荷爾蒙導致的水分滯留，不會誤判為「方向錯誤」，也不會叫你少吃。',
                },
                {
                  q: '完全沒有訓練經驗可以嗎？',
                  a: '建議先有 3-6 個月的訓練基礎。如果是完全新手，建議先從實體一對一教練開始學會基本動作，再轉遠端智能管理。台中地區可以選「實體訓練 + 智能管理」方案。',
                },
                {
                  q: '可以退費嗎？',
                  a: '月繳制，當月不退費，下個月可取消不續約。詳細退費規則會在 LINE 諮詢時說明。',
                },
              ].map(({ q, a }) => (
                <div key={q} className="bg-white rounded-xl p-6 border border-gray-200">
                  <h3 className="text-base font-bold mb-2" style={{ color: '#1e3a5f' }}>Q: {q}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 免責聲明 ===== */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-6">
          <h3 className="text-sm font-bold mb-3 text-amber-700">⚠️ 重要聲明</h3>
          <div className="space-y-2 text-gray-600 text-xs leading-relaxed">
            <p>
              <strong>1. 非醫療服務：</strong>此服務提供的是系統輔助的營養管理建議與教練指導，<strong>不構成醫療建議、診斷或治療</strong>。如有健康疑慮，請務必諮詢合格醫師。
            </p>
            <p>
              <strong>2. 效果因人而異：</strong>訓練與營養管理的效果因個人體質、配合度、生活習慣而異，<strong>不保證特定成效</strong>。需配合每日記錄才能讓系統發揮最大效果。
            </p>
            <p>
              <strong>3. 個資保護：</strong>您提供的體重、飲食等數據僅用於系統分析與教練指導，不會外洩給第三方。
            </p>
          </div>
        </div>
      </section>

      {/* ===== CTA 結尾 ===== */}
      <section className="bg-[#1e3a5f] py-20 rounded-t-3xl">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            讓系統幫你管理，從第一天開始
          </h2>
          <p className="text-blue-200 text-lg mb-10">
            加 LINE 跟我聊聊你的目標，我會先幫你確認系統適不適合你
          </p>
          <LineButton
            source="remote_page"
            intent="bottom_cta"
            className="inline-block bg-white text-[#1e3a5f] px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors"
          >
            加 LINE 諮詢方案
          </LineButton>
          <p className="mt-6">
            <Link href="/diagnosis" className="text-blue-300 hover:text-white text-sm underline transition-colors">
              還沒體驗過？先免費體驗系統分析 →
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}
