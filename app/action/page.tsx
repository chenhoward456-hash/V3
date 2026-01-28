import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '開始行動 - The Howard Protocol',
  description: '準備好提升你的訓練與健康了嗎？專業訓練指導、客製化計畫、動作技術指導、營養策略建議。',
  openGraph: {
    title: '開始行動 - The Howard Protocol',
    description: '預約專業訓練指導與一對一諮詢',
  },
}

export default function ActionPage() {
  return (
    <section className="section-container">
      <h2 className="doc-title">開始行動</h2>
      <p className="doc-subtitle">準備好提升你的訓練與健康了嗎？從這裡開始。</p>

      <div className="bg-white border-2 border-border p-12 rounded-3xl my-12">
        <h3 className="text-2xl mb-8 text-text-primary font-bold">📋 三步驟開始訓練</h3>
        
        <div className="grid gap-10">
          <div className="flex gap-8 items-start">
            <div className="min-w-[60px] h-[60px] bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center text-white text-2xl font-extrabold flex-shrink-0">1</div>
            <div>
              <h4 className="text-xl mb-3 text-primary font-bold">評估現況</h4>
              <p className="text-text-secondary leading-relaxed mb-4">
                先了解你的起點：
              </p>
              <ul className="text-text-secondary leading-loose pl-6 space-y-2">
                <li>體態評估（圓肩？骨盆前傾？）</li>
                <li>動作能力測試（能否正確深蹲、硬舉？）</li>
                <li>訓練目標與生活作息評估</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-8 items-start">
            <div className="min-w-[60px] h-[60px] bg-gradient-to-br from-success to-green-600 rounded-full flex items-center justify-center text-white text-2xl font-extrabold flex-shrink-0">2</div>
            <div>
              <h4 className="text-xl mb-3 text-success font-bold">學習基本動作</h4>
              <p className="text-text-secondary leading-relaxed mb-4">
                先把基礎打穩，不要急著加重量：
              </p>
              <ul className="text-text-secondary leading-loose pl-6 space-y-2">
                <li>深蹲、硬舉、臥推、划船 - 四大基本動作</li>
                <li>前 4 週專注在動作品質（用輕重量練習）</li>
                <li>用手機錄影檢查姿勢，或找教練指導</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-8 items-start">
            <div className="min-w-[60px] h-[60px] bg-gradient-to-br from-secondary to-orange-600 rounded-full flex items-center justify-center text-white text-2xl font-extrabold flex-shrink-0">3</div>
            <div>
              <h4 className="text-xl mb-3 text-secondary font-bold">執行訓練計畫</h4>
              <p className="text-text-secondary leading-relaxed">
                動作學會後，開始系統化訓練。需要客製化計畫？預約 1 對 1 諮詢。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="support-box">
        <div className="text-6xl mb-6">💪</div>
        <h3 className="text-3xl mb-4 font-bold">需要專業訓練指導？</h3>
        <p className="text-text-secondary max-w-3xl mx-auto mb-10 leading-relaxed text-lg">
          自己練容易姿勢錯誤、進步緩慢。<br />
          專業教練能幫你少走彎路，避免運動傷害。<br />
          如果你想要真正進步，你需要系統化指導。
        </p>
        
        <ul className="mb-10">
          <li>客製化訓練計畫（週期化編排、RPE 管理）</li>
          <li>動作技術指導（深蹲、硬舉、臥推矯正）</li>
          <li>姿勢評估與矯正訓練（圓肩、骨盆前傾）</li>
          <li>營養策略建議（增肌 / 減脂飲食設計）</li>
          <li>訓練進度追蹤與調整</li>
        </ul>

        <div className="bg-primary/12 p-8 rounded-xl my-10 max-w-2xl mx-auto text-left">
          <strong className="text-primary block mb-4 text-base">💡 適合以下情況</strong>
          <ul className="text-text-secondary text-[15px] list-none p-0 space-y-3">
            <li>→ 想開始肌力訓練，但不知道從何開始</li>
            <li>→ 自己練一陣子了，但進步停滯</li>
            <li>→ 有圓肩、駝背等姿勢問題</li>
            <li>→ 需要專業指導避免運動傷害</li>
          </ul>
        </div>

        <a
          href="https://lin.ee/dnbucVw"
          target="_blank"
          rel="noopener noreferrer"
          className="support-btn"
        >
          預約諮詢 - 開始專業訓練
        </a>

        <div className="mt-12 pt-10 border-t border-primary/20">
          <p className="text-text-secondary text-sm leading-relaxed">
            📍 服務地點：台中市北屯區<br />
            🎓 專業認證：CSCS • 運動醫學背景<br />
            � 專長領域：肌力訓練 • 動作矯正 • 營養優化
          </p>
        </div>
      </div>

      <div className="mt-16 p-10 bg-white border-2 border-border rounded-2xl">
        <h3 className="mb-6 text-text-primary text-[1.3rem] font-bold">其他聯絡方式</h3>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <strong className="text-primary block mb-3 text-base">Instagram</strong>
            <a
              href="https://www.instagram.com/chenhoward/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-primary transition-colors text-[15px]"
            >
              @chenhoward →
            </a>
            <p className="text-text-muted text-sm mt-2">協議更新、案例分享</p>
          </div>
          
          <div>
            <strong className="text-success block mb-3 text-base">LINE 官方帳號</strong>
            <a
              href="https://lin.ee/dnbucVw"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-success transition-colors text-[15px]"
            >
              加入好友 →
            </a>
            <p className="text-text-muted text-sm mt-2">快速諮詢、預約排程</p>
          </div>
        </div>
      </div>
    </section>
  )
}
