import type { Metadata } from 'next'
import Link from 'next/link'
import LineButton from '@/components/LineButton'
import ScrollReveal from '@/components/ScrollReveal'
import ABTest from '@/components/ABTest'

export const metadata: Metadata = {
  title: '方案與定價 - Howard Protocol 智能管理系統 | 全台遠端 / 台中實體',
  description: 'NT$499 起，自適應 TDEE 每週校正、體重趨勢自動判讀、Refeed 自動觸發、月經週期濾鏡。全台遠端訂閱 / 台中實體訓練。',
  alternates: { canonical: 'https://howard456.vercel.app/remote' },
  openGraph: {
    title: '方案與定價 - Howard Protocol 智能管理系統',
    description: 'NT$499/月起。智能引擎自動分析，不賣教練時間，賣系統能力。',
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
            自適應 TDEE × 每週智能分析 × Refeed 自動觸發 × 恢復狀態自動調整
          </p>
        </div>
      </section>

      {/* ===== 免費分析 vs 完整訂閱 對比 ===== */}
      <ScrollReveal>
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4" style={{ color: '#1e3a5f' }}>
            免費體驗 vs 訂閱後
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
                { label: '恢復狀態調整', free: '—', paid: 'HRV 個人基線 + 營養自動調整' },
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

      {/* ===== 三層方案定價 ===== */}
      <ScrollReveal>
        <section className="bg-[#f5f7fa] py-20">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4" style={{ color: '#1e3a5f' }}>
              選擇你的方案
            </h2>
            <p className="text-center text-gray-500 mb-12 text-sm">同一套智能引擎，兩種使用方式</p>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">

              {/* 方案 1：自主管理 NT$499 */}
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 flex flex-col relative">
                <div className="absolute -top-3 left-6 bg-[#2563eb] text-white text-xs font-bold px-3 py-1 rounded-full">
                  最多人選
                </div>
                <h3 className="text-xl font-bold mb-1" style={{ color: '#1e3a5f' }}>自主管理版</h3>
                <p className="text-gray-400 text-sm mb-1">系統幫你管，不需要教練</p>
                <p className="text-[#2563eb] text-xs font-medium mb-4">適合知道方向、需要工具輔助的你</p>
                <div className="mb-1">
                  <span className="text-4xl font-bold" style={{ color: '#1e3a5f' }}>NT$499</span>
                  <span className="text-gray-400 text-sm"> /月</span>
                </div>
                <p className="text-xs text-gray-400 mb-6">每天不到 NT$17，比一杯超商咖啡便宜</p>
                <ul className="space-y-3 text-gray-700 mb-8 flex-1 text-sm">
                  <li className="flex items-start gap-2"><span className="text-[#2563eb] mt-0.5">&#10003;</span>智能引擎 24 小時自動分析</li>
                  <li className="flex items-start gap-2"><span className="text-[#2563eb] mt-0.5">&#10003;</span>每週體重趨勢自動判讀</li>
                  <li className="flex items-start gap-2"><span className="text-[#2563eb] mt-0.5">&#10003;</span>自適應 TDEE 持續校正</li>
                  <li className="flex items-start gap-2"><span className="text-[#2563eb] mt-0.5">&#10003;</span>Refeed / Diet Break 自動觸發</li>
                  <li className="flex items-start gap-2"><span className="text-[#2563eb] mt-0.5">&#10003;</span>碳循環自動分配（訓練/休息日）</li>
                  <li className="flex items-start gap-2"><span className="text-[#2563eb] mt-0.5">&#10003;</span>月經週期智能濾鏡（女性）</li>
                  <li className="flex items-start gap-2"><span className="text-[#2563eb] mt-0.5">&#10003;</span>HRV 個人基線 + 恢復狀態調整</li>
                  <li className="flex items-start gap-2"><span className="text-[#2563eb] mt-0.5">&#10003;</span>減脂速度動態控制</li>
                </ul>
                <ABTest
                  experimentId="pricing_cta"
                  variants={{
                    original: (
                      <>
                        <Link
                          href="/join"
                          className="block text-center bg-[#2563eb] text-white py-3.5 rounded-xl font-semibold hover:bg-[#1d4ed8] transition-colors shadow-lg shadow-blue-500/25"
                        >
                          免費體驗 &rarr;
                        </Link>
                        <p className="text-center text-xs text-gray-400 mt-3">
                          免費試用，不需綁卡
                        </p>
                      </>
                    ),
                    urgency: (
                      <>
                        <Link
                          href="/join"
                          className="block text-center bg-[#2563eb] text-white py-3.5 rounded-xl font-semibold hover:bg-[#1d4ed8] transition-colors shadow-lg shadow-blue-500/25"
                        >
                          立即免費開始 — 名額有限 &rarr;
                        </Link>
                        <p className="text-center text-xs text-gray-400 mt-3">
                          每月限量開放，不需綁卡
                        </p>
                      </>
                    ),
                    social_proof: (
                      <>
                        <Link
                          href="/join"
                          className="block text-center bg-[#2563eb] text-white py-3.5 rounded-xl font-semibold hover:bg-[#1d4ed8] transition-colors shadow-lg shadow-blue-500/25"
                        >
                          加入使用者行列 &rarr;
                        </Link>
                        <p className="text-center text-xs text-gray-400 mt-3">
                          免費試用，和其他用戶一起開始
                        </p>
                      </>
                    ),
                  }}
                  fallback={
                    <>
                      <Link
                        href="/join"
                        className="block text-center bg-[#2563eb] text-white py-3.5 rounded-xl font-semibold hover:bg-[#1d4ed8] transition-colors shadow-lg shadow-blue-500/25"
                      >
                        免費體驗 &rarr;
                      </Link>
                      <p className="text-center text-xs text-gray-400 mt-3">
                        免費試用，不需綁卡
                      </p>
                    </>
                  }
                />
              </div>

              {/* 方案 2：教練指導 NT$2,999 — Recommended / Highlighted */}
              <div className="bg-white rounded-2xl p-8 shadow-md border-2 border-[#1e3a5f] flex flex-col relative ring-1 ring-[#1e3a5f]/20">
                <div className="absolute -top-3 left-6 bg-[#1e3a5f] text-white text-xs font-bold px-3 py-1 rounded-full">
                  推薦
                </div>
                <div className="absolute -top-3 right-6 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  全台適用
                </div>
                <h3 className="text-xl font-bold mb-1" style={{ color: '#1e3a5f' }}>教練指導版</h3>
                <p className="text-gray-400 text-sm mb-1">系統 + CSCS 教練監督</p>
                <p className="text-[#1e3a5f] text-xs font-medium mb-4">適合需要專業教練判斷與把關的你</p>
                <div className="mb-1">
                  <span className="text-4xl font-bold" style={{ color: '#1e3a5f' }}>NT$2,999</span>
                  <span className="text-gray-400 text-sm"> /月</span>
                </div>
                <p className="text-xs text-gray-400 mb-6">每天不到 NT$100，比一堂私人教練課便宜</p>
                <ul className="space-y-3 text-gray-700 mb-4 text-sm">
                  <li className="flex items-start gap-2"><span className="text-[#1e3a5f] mt-0.5">&#10003;</span>包含自主管理版所有功能</li>
                </ul>
                <div className="border-t border-gray-100 pt-4 mb-8 flex-1">
                  <p className="text-xs text-gray-400 mb-3">額外包含：</p>
                  <ul className="space-y-3 text-gray-700 text-sm">
                    <li className="flex items-start gap-2"><span className="text-[#1e3a5f] mt-0.5">&#10003;</span>CSCS 教練每週 review 數據</li>
                    <li className="flex items-start gap-2"><span className="text-[#1e3a5f] mt-0.5">&#10003;</span>LINE 即時諮詢（24hr 內回覆）</li>
                    <li className="flex items-start gap-2"><span className="text-[#1e3a5f] mt-0.5">&#10003;</span>每月 1 次視訊（30 分鐘）</li>
                    <li className="flex items-start gap-2"><span className="text-[#1e3a5f] mt-0.5">&#10003;</span>訓練計畫客製化建議</li>
                  </ul>
                </div>
                <LineButton
                  source="remote_page"
                  intent="coach_plan"
                  className="block text-center bg-[#1e3a5f] text-white py-3.5 rounded-xl font-semibold hover:bg-[#162d4a] transition-colors shadow-lg shadow-[#1e3a5f]/25"
                >
                  加 LINE 諮詢
                </LineButton>
                <p className="text-center text-xs text-gray-400 mt-3">
                  適合想要教練把關的人
                </p>
              </div>

            </div>

            <p className="text-center text-xs text-gray-400 mt-8">
              信用卡定期定額，每月自動扣款。可隨時在儀表板取消，取消後用到當期到期日。自主管理版可隨時升級教練指導版，補差額即可。
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 為什麼 499 就夠了 ===== */}
      <ScrollReveal>
        <section className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4" style={{ color: '#1e3a5f' }}>
            為什麼大部分人從自主管理開始
          </h2>
          <p className="text-center text-gray-500 mb-12 text-sm">
            系統在做事，不需要教練花時間 — 所以價格可以更低
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '🤖',
                title: '系統 24 小時運作',
                desc: '你每天輸入數據，系統自動計算趨勢、校正 TDEE、偵測停滯期。不需要等教練分析，也不需要約時間。',
              },
              {
                icon: '📊',
                title: '演算法取代人工判斷',
                desc: '傳統教練靠經驗判斷「該不該調」，我們用 7 天加權移動平均 + 能量平衡方程式自動判斷。更準、更快。',
              },
              {
                icon: '🔄',
                title: '自動觸發機制',
                desc: 'Refeed、Diet Break、碳循環、恢復調整 — 全部根據條件自動觸發，不需要教練手動下指令。',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className="font-bold mb-2 text-sm" style={{ color: '#1e3a5f' }}>{title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 適合誰 ===== */}
      <ScrollReveal>
        <section className="bg-[#f5f7fa] py-20">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12" style={{ color: '#1e3a5f' }}>
              這套系統適合你嗎？
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-green-100">
                <h3 className="text-lg font-bold text-green-700 mb-5">適合你</h3>
                <ul className="space-y-3">
                  {[
                    '有訓練基礎，但一直卡住不知道怎麼調整',
                    '想用數據和系統方法，不想土法煉鋼',
                    '想要 24 小時自動追蹤，不想等教練回覆',
                    '外縣市或時間不固定，需要自主管理',
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
          </div>
        </section>
      </ScrollReveal>

      {/* ===== FAQ ===== */}
      <ScrollReveal>
        <section className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12" style={{ color: '#1e3a5f' }}>
            常見問題
          </h2>
          <div className="space-y-4">
            {[
              {
                q: '自主管理版跟教練指導版差在哪？',
                a: '系統功能完全一樣。差別在於教練指導版有 Howard 本人每週 review 你的數據、LINE 即時諮詢、每月視訊。如果你有訓練基礎、能自己看懂系統建議，自主管理版就夠了。如果你想要教練額外把關，再升級。',
              },
              {
                q: '系統怎麼自動校正營養目標？',
                a: '系統根據你每週的體重趨勢（不是單日浮動），對比你的飲食記錄，自動反推你真實的 TDEE。如果掉太快，會提示增加熱量保護肌肉；如果停滯了，會提示調整赤字或觸發 Refeed。全部自動判斷。',
              },
              {
                q: '我需要記錄什麼？怎麼記？',
                a: '每天花 2 分鐘：記錄體重（早晨空腹）+ 飲食（拍照或文字記錄都可以）。透過 LINE 傳送即可，不需下載特殊 App。系統會自動分析你傳的數據。',
              },
              {
                q: '自主管理版可以隨時升級嗎？',
                a: '可以。隨時在 LINE 跟 Howard 說要升級，補差額就好。很多人先用自主管理版 1-2 個月，確認系統有用之後，再考慮要不要加教練指導。',
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
                q: '可以退費嗎？',
                a: '月繳制，當月不退費，下個月可取消不續約。',
              },
            ].map(({ q, a }) => (
              <div key={q} className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="text-base font-bold mb-2" style={{ color: '#1e3a5f' }}>Q: {q}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* ===== 免責聲明 ===== */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-6">
          <h3 className="text-sm font-bold mb-3 text-amber-700">重要聲明</h3>
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
            NT$499/月，讓系統幫你管理
          </h2>
          <p className="text-blue-200 text-lg mb-10">
            先免費體驗系統分析，覺得有用再訂閱
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/join"
              className="inline-block bg-white text-[#1e3a5f] px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors"
            >
              免費體驗 →
            </Link>
            <LineButton
              source="remote_page"
              intent="bottom_cta"
              className="inline-block bg-transparent text-white border-2 border-white/50 px-10 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-colors"
            >
              加 LINE 問問題
            </LineButton>
          </div>
        </div>
      </section>
    </>
  )
}
