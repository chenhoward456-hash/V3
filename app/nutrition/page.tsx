import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '營養與恢復 - The Howard Protocol',
  description: '代謝靈活性優化、MTHFR 甲基化修復、睡眠優化指南。訓練只是刺激，真正的成長發生在休息與營養補充階段。',
  openGraph: {
    title: '營養與恢復 - The Howard Protocol',
    description: '代謝優化、基因修復、睡眠協議',
  },
}

export default function NutritionPage() {
  return (
    <section className="section-container">
      <h2 className="doc-title">營養與恢復</h2>
      <p className="doc-subtitle">訓練只是刺激，真正的成長發生在休息與營養補充階段。</p>

      <div className="bg-success/5 border-2 border-success/30 rounded-xl p-6 mb-8">
        <p className="text-text-secondary text-sm leading-relaxed">
          🥗 <strong>營養策略分享</strong>：以下內容為個人研究與實踐經驗。任何飲食調整或補劑使用前，請先諮詢營養師或醫師，確保適合您的健康狀況。
        </p>
      </div>

      <div className="protocol-card">
        <span className="tag blue">化學層 | Chemistry</span>
        <h3 className="text-2xl mb-4 font-bold">⚡ 代謝靈活性優化</h3>
        <p className="mb-6 text-text-secondary">
          人體就像油電混合車。目標不是單純的「少吃」，而是教會身體如何根據當下需求，自由切換「燃糖」或「燃脂」模式。
        </p>
        
        <div className="code-block">
          <span className="code-label">燃料控制策略</span>
          <div className="leading-loose">
            <strong>1. 碳水循環 (Carb Cycling)</strong><br />
            • <strong>高碳日 (訓練日)</strong>：攝取澱粉回填肝醣，最大化肌肉合成。<br />
            • <strong>低碳日 (休息日)</strong>：限制碳水 &lt; 50g，強迫身體燃燒脂肪作為燃料。<br /><br />
            
            <strong>2. 間歇性斷食 (Intermittent Fasting)</strong><br />
            將進食窗口壓縮在 8 小時內 (12pm-8pm)。<br />
            目的不是餓肚子，而是降低基礎胰島素水平，重啟細胞自噬 (Autophagy)。<br /><br />
            
            <strong>3. [外掛] 酒精防禦協議</strong><br />
            應酬是不可避免的社交。執行以下三步驟，最小化酒精對睪固酮的打擊：<br />
            • <strong>脂質前導</strong>：喝酒前 30 分鐘先吃高脂食物（橄欖油、堅果、酪梨），減緩酒精吸收速度<br />
            • <strong>水分稀釋</strong>：每杯酒配一杯水，降低血液酒精濃度<br />
            • <strong>B 群修復</strong>：隔天早上補充 B 群 + NAC（N-乙醯半胱氨酸），加速肝臟代謝
          </div>
        </div>

        <div className="bg-primary/8 p-6 rounded-xl border-l-4 border-primary mt-6">
          <strong className="text-primary block mb-2 text-sm">💡 工程師思維</strong>
          <span className="text-text-secondary text-sm leading-relaxed">
            大多數人的代謝是「卡死」的（只能燃糖，一餓就手抖）。<br />
            這套協議是為了修復你的<strong>代謝開關</strong>，讓你即使在靜態工作時，也能高效燃脂。
          </span>
        </div>
      </div>

      <div className="protocol-card">
        <span className="tag green">基因優化</span>
        <h3 className="text-2xl mb-4 font-bold">🧬 MTHFR 甲基化修復</h3>
        <p className="mb-6 text-text-secondary">
          針對可能有 MTHFR 基因變異的族群（研究顯示約 40% 華人帶有此變異）。<br />
          此變異可能降低葉酸代謝效率。<strong>建議先進行基因檢測確認</strong>，再決定是否需要補充。
        </p>
        
        <div className="code-block">
          <span className="code-label">補劑方案</span>
          <div className="leading-loose">
            • <strong>Methylfolate (活性葉酸)</strong>：400-800 mcg/天<br />
            • <strong>Methylcobalamin (活性 B12)</strong>：1000 mcg/天<br />
            • <strong>P5P (活性 B6)</strong>：25 mg/天<br />
            • <strong>TMG (甜菜鹼)</strong>：500 mg/天
          </div>
        </div>

        <div className="bg-success/8 p-6 rounded-xl border-l-4 border-success mt-6">
          <strong className="text-success block mb-2 text-sm">✓ 預期效果</strong>
          <span className="text-text-secondary text-sm leading-relaxed">
            4-6 週後，同半胱氨酸應降至 &lt; 8 μmol/L。<br />
            部分使用者回報情緒穩定度提升與認知功能改善。
          </span>
        </div>
      </div>

      <div className="protocol-card">
        <span className="tag orange">恢復協議</span>
        <h3 className="text-2xl mb-4 font-bold">😴 睡眠優化指南</h3>
        <p className="mb-6 text-text-secondary">
          睡眠是肌肉生長與荷爾蒙分泌的黃金時間。<br />
          睡不好，訓練再努力也是白費。
        </p>
        
        <div className="code-block">
          <span className="code-label">睡眠檢查清單</span>
          <div className="leading-loose">
            ✓ <strong>目標睡眠時間</strong>：7-9 小時<br />
            ✓ <strong>環境溫度</strong>：18-20°C（涼爽環境有助深度睡眠）<br />
            ✓ <strong>睡前 2 小時</strong>：避免藍光（手機、電腦）<br />
            ✓ <strong>咖啡因截止時間</strong>：下午 2 點後不攝取<br />
            ✓ <strong>睡前補劑</strong>：鎂 300mg + 甘氨酸 3g
          </div>
        </div>

        <div className="bg-secondary/8 p-6 rounded-xl border-l-4 border-secondary mt-6">
          <strong className="text-secondary block mb-2 text-sm">💤 進階追蹤</strong>
          <span className="text-text-secondary text-sm leading-relaxed">
            使用 Oura Ring 或 Whoop 追蹤 HRV（心率變異度）。<br />
            HRV 下降 = 恢復不足，建議降低訓練強度或增加休息日。
          </span>
        </div>
      </div>
    </section>
  )
}
