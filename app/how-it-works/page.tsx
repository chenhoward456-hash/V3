import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '這套系統怎麼運作 — The Howard Protocol',
  description: '數據驅動的體態與健康管理系統：每日數據追蹤、引擎自動調整營養、Howard 標準血檢最佳化、教練在迴圈。5 分鐘看懂，先免費試。',
  alternates: { canonical: 'https://howard456.vercel.app/how-it-works' },
  openGraph: {
    title: '這套系統怎麼運作 — The Howard Protocol',
    description: '5 分鐘看懂這套數據驅動的體態健康系統，先免費試再決定。',
    url: 'https://howard456.vercel.app/how-it-works',
  },
}

const PILLARS = [
  {
    icon: '📊',
    title: '每日數據追蹤',
    sub: '每天 2 分鐘，餵系統真實資料',
    body: '每天記體重和飲食（付費版再加睡眠、能量、壓力等身心狀態）。不用記得很精確，初期用手掌法估份量就夠——系統看的是趨勢，不是單日數字。只需要手機和體重計，透過 LINE 和網頁運作，不用裝 App。',
  },
  {
    icon: '🧠',
    title: '引擎自動調整營養',
    sub: '學你的身體，不是套公式',
    body: '追蹤 14 天後，系統用你的真實體重趨勢自動校正你實際燃燒多少熱量——比任何公式準。之後每週自動分析該維持還是該調，連 Refeed 時機都會在疲勞訊號同時亮時才提醒。女性經期前的體重浮動系統知道是正常的。還有一條：體脂太低時系統會自動收手，不為了數字把人榨乾。',
  },
  {
    icon: '🩸',
    title: 'Howard 標準血檢最佳化',
    sub: '「正常」跟「最佳」是兩回事（教練指導以上方案）',
    body: '醫院的參考範圍是「沒生病」的標準，不是「狀態最好」的標準。我用一套比醫院更嚴的最佳化目標（藍標）追蹤你的血檢趨勢——例如 HOMA-IR 看的不是 <2.0 而是 <0.8。我是教練、不是醫師、不做診斷：血檢在這裡是「追蹤與優化方向」，數據往哪偏、生活方式與補充怎麼調，並建議與你的醫師討論後再決定。',
  },
  {
    icon: '🧑‍🏫',
    title: '教練在迴圈',
    sub: '系統算數據，人做判斷（教練指導以上方案）',
    body: '系統 24 小時分析，但最後把關的是人。我（CSCS、運動醫學系）每週 review 你的營養與進度，LINE 即時問答。原則固定：找根因不單點報數字、一次只動一個變數、荷爾蒙優先——碳水是最後才動的。系統給我看到你的全部數據，所以給的是針對你這週的判斷，不是通用建議。',
  },
]

const TIERS = [
  { name: '免費', price: '$0', priceNote: '永久免費', who: '先試系統準不準', what: '體重趨勢、飲食紀錄、TDEE 計算、14 天自動校正營養目標' },
  { name: '自主管理', price: 'NT$499', priceNote: '/月', who: '自己做決定、系統當儀表板', what: '免費版全部＋身心狀態追蹤＋AI 私人顧問（用你的數據回答）＋碳水循環＋停滯期偵測' },
  { name: '教練指導', price: 'NT$2,999', priceNote: '/月', who: '要有人把關方向', what: '自主管理全部＋CSCS 教練每週 review＋LINE 即時問答＋訓練／補劑／血檢完整追蹤', highlight: true },
  { name: 'Protocol', price: '邀請制', priceNote: '', who: '長期健康深度優化', what: '教練指導全部＋基因導向的營養與補充方向、血檢趨勢深度追蹤、與你的醫師協作把「正常」推到「最佳」。先聊聊、確認適合你再進行（教練服務、非醫療診斷）' },
]

export default function HowItWorksPage() {
  return (
    <div className="bg-white">
      {/* HERO */}
      <section className="bg-slate-900 text-white px-5 py-14 md:py-20">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs tracking-[0.2em] text-primary-400 font-medium mb-5">THE HOWARD PROTOCOL · 系統怎麼運作</p>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-5">
            這套系統，<br className="hidden md:block" />到底在幫你做什麼？
          </h1>
          <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-xl">
            一套數據驅動的體態與健康管理系統，給認真想改變、但每天都在用感覺做決定的人。
            不用先付錢、不用先約諮詢——這一頁看完，你就知道系統怎麼運作、為什麼有效、適不適合你。
          </p>
          <Link href="/diagnosis" className="inline-block mt-8 bg-primary-600 hover:bg-primary-700 transition-colors text-white font-bold px-7 py-3.5 rounded-xl">
            先免費試 30 秒 →
          </Link>
        </div>
      </section>

      {/* 痛點 */}
      <section className="px-5 py-12 md:py-16 max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">為什麼一般的減脂方式會卡住</h2>
        <p className="text-slate-500 leading-relaxed mb-5">
          大部分人的減脂長這樣：網路上查一個 TDEE 公式、抓一個熱量目標，然後開始猜。
        </p>
        <ul className="space-y-2 mb-5">
          {['吃完飯不知道今天算不算合格', '練完不確定強度是對的還是太過', '停滯了，不知道該繼續撐還是該調整', '三個月後回頭，根本不知道哪一步出了問題'].map(s => (
            <li key={s} className="text-sm text-slate-600 flex gap-2"><span className="text-rose-400">·</span>{s}</li>
          ))}
        </ul>
        <p className="text-slate-600 leading-relaxed">
          問題不是你不夠努力，是<b className="text-slate-900">沒有東西告訴你方向對不對</b>。公式給你一個數字就消失了，但你的身體每天都在變。
          這套系統做的事很簡單：每天幫你確認——方向對，繼續；方向偏，這樣調。
        </p>
      </section>

      {/* 四支柱 */}
      <section className="px-5 py-12 md:py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">系統怎麼運作：四根支柱</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {PILLARS.map(p => (
              <div key={p.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-2xl mb-2">{p.icon}</div>
                <div className="font-semibold text-slate-900">{p.title}</div>
                <div className="text-xs text-primary-600 mb-2">{p.sub}</div>
                <div className="text-sm text-slate-600 leading-relaxed">{p.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 親身證據 */}
      <section className="px-5 py-12 md:py-16 max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">我自己就是第一個案例</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          我不是只賣系統，我先在自己身上跑了 6 年。2020 年我的身體崩過一次：嚴重落髮、慢性發炎、持續疲勞。
          用這套系統一路修到現在——<b className="text-slate-900">7.8% 體脂、HRV 從 65 升到 91ms、HOMA-IR 0.49、血檢幾乎全項落在最佳區</b>。
          包含原始檢驗單（未修圖）的完整紀錄都公開。
        </p>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 mb-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            也誠實說一件事：備賽減到 7.8% 那麼瘦，睪固酮確實會掉。這是激進減脂的代價，所以系統才會內建「依體脂自動收手」。看得到代價、也防得住，才是真的系統。
          </p>
        </div>
        <Link href="/case" className="text-sm text-primary-600 font-medium hover:underline">看完整的 6 年數據紀錄與血檢鐵證 →</Link>
      </section>

      {/* 方案 */}
      <section className="px-5 py-12 md:py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">方案差在哪（快速概覽）</h2>
          <p className="text-slate-500 mb-8">全部月繳制，不綁約，隨時取消。下面是快速概覽，<Link href="/remote" className="text-primary-600 font-medium hover:underline">完整方案與定價在這裡 →</Link></p>
          <div className="grid sm:grid-cols-2 gap-3">
            {TIERS.map(t => (
              <div key={t.name} className={`rounded-2xl border p-5 ${t.highlight ? 'border-primary-300 bg-primary-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-semibold text-slate-900">{t.name}</span>
                  <span className="text-sm"><b className="text-slate-900">{t.price}</b><span className="text-slate-400 text-xs">{t.priceNote}</span></span>
                </div>
                <div className="text-xs text-primary-600 mb-2">給{t.who}</div>
                <div className="text-sm text-slate-600 leading-relaxed">{t.what}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 我是誰 */}
      <section className="px-5 py-12 md:py-16 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-sm text-slate-700 leading-relaxed">
            <b className="text-slate-900">Howard Chen</b> — 高雄醫學大學運動醫學系 / NSCA-CSCS 肌力與體能專家 / 6+ 年實務經驗，台中北屯。
            每個功能背後都有運動科學文獻支撐，不是憑感覺教練。我相信：好的系統比好的意志力更可靠。
          </p>
          <p className="text-xs text-slate-500 leading-relaxed mt-3 pt-3 border-t border-slate-200">
            我是教練、不是醫師。這套系統提供數據追蹤、趨勢觀察與最佳化方向，並與你的醫師協作——不做醫療診斷、處方或治療。任何健康決策請諮詢合格醫師。
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-16 bg-slate-900 text-white text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">先免費試，30 秒看到你的數字</h2>
          <p className="text-slate-300 mb-8 leading-relaxed">
            不用註冊、不用信用卡、不用先加 LINE。輸入性別、體重、目標，系統直接算出你的 TDEE、每日參考熱量和預估達標時程——這就是付費學員每天在用的同一顆引擎。
          </p>
          <Link href="/diagnosis" className="inline-block bg-primary-600 hover:bg-primary-700 transition-colors text-white font-bold px-8 py-4 rounded-xl text-lg">
            免費系統分析 →
          </Link>
          <p className="text-xs text-slate-500 mt-4">試完覺得準，再決定要不要讓系統每天幫你追蹤。</p>
        </div>
      </section>

      {/* 免責 */}
      <section className="px-5 py-8 max-w-3xl mx-auto">
        <p className="text-xs text-slate-400 leading-relaxed">
          本服務為教練基於數據趨勢的觀察與生活方式建議，非醫療行為；個人案例僅供參考，效果因人而異，健康疑慮請諮詢合格醫師。
        </p>
      </section>
    </div>
  )
}
