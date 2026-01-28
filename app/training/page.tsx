import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '訓練工程 - The Howard Protocol',
  description: '肌力訓練三大原則：機械張力、神經適應、結構優化。CSCS 系統化訓練設計，從動作力學到週期化編排。',
  openGraph: {
    title: '訓練工程 - The Howard Protocol',
    description: '機械張力、神經適應、結構優化三大訓練原則',
  },
}

export default function TrainingPage() {
  return (
    <section className="section-container">
      <h2 className="doc-title">訓練工程</h2>
      <p className="doc-subtitle">肌力訓練不是「練得累」就有效。這三個原則決定你的訓練品質。</p>

      <div className="bg-primary/5 border-2 border-primary/30 rounded-xl p-6 mb-8">
        <p className="text-text-secondary text-sm leading-relaxed">
          💡 <strong>訓練原則分享</strong>：以下內容基於運動科學研究與個人訓練經驗。開始任何訓練計畫前，建議先諮詢專業教練或醫療人員評估身體狀況。
        </p>
      </div>

      <div className="protocol-card">
        <span className="tag blue">訓練原則 1</span>
        <h3 className="text-2xl mb-4 font-bold">🔧 機械張力 (Mechanical Tension)</h3>
        <p className="mb-6 text-text-secondary">
          肌肉生長的根本原因是「物理刺激」，不是疲勞感或痠痛。<br />
          關鍵在於：給予肌肉足夠的負荷，並逐步增加這個負荷。
        </p>
        
        <div className="code-block">
          <span className="code-label">實踐方法</span>
          <div className="leading-loose">
            <strong>1. 漸進式超負荷 (Progressive Overload)</strong><br />
            每週嘗試增加重量、次數或組數。不要總是用同樣的重量練習。<br /><br />
            
            <strong>2. 動作幅度 (Range of Motion)</strong><br />
            完整的動作範圍 = 更大的機械張力。半蹲不如全蹲有效。<br /><br />
            
            <strong>3. 時間張力 (Time Under Tension)</strong><br />
            控制動作速度，特別是離心階段（下降）。3 秒下降比自由落體有效。
          </div>
        </div>

        <div className="bg-primary/8 p-6 rounded-xl border-l-4 border-primary mt-6">
          <strong className="text-primary block mb-2 text-sm">💡 訓練建議</strong>
          <span className="text-text-secondary text-sm leading-relaxed">
            新手優先追求重量進步（每週 +2.5kg）。<br />
            中階者可用組數/次數增加（例如從 3x8 進步到 3x10）。<br />
            進階者需要更複雜的週期化設計。
          </span>
        </div>
      </div>

      <div className="protocol-card">
        <span className="tag green">訓練原則 2</span>
        <h3 className="text-2xl mb-4 font-bold">⚡ 神經適應 (Neural Adaptation)</h3>
        <p className="mb-6 text-text-secondary">
          初學者的力量進步主要來自「神經系統學習」，而非肌肉變大。<br />
          大腦需要學會如何徵召更多肌纖維、更有效率地發力。
        </p>
        
        <div className="code-block">
          <span className="code-label">實踐方法</span>
          <div className="leading-loose">
            <strong>1. 動作模式優先 (Movement Pattern First)</strong><br />
            學會正確的深蹲、硬舉、臥推模式，比追求重量更重要。<br /><br />
            
            <strong>2. RPE 自覺強度管理</strong><br />
            用 RPE 1-10 量表評估訓練強度。新手建議停在 RPE 7-8（還能做 2-3 下）。<br /><br />
            
            <strong>3. 頻率 &gt; 單次訓練量</strong><br />
            同一個動作一週練 2-3 次，比一次練爆更有效（神經需要重複刺激）。
          </div>
        </div>

        <div className="bg-success/8 p-6 rounded-xl border-l-4 border-success mt-6">
          <strong className="text-success block mb-2 text-sm">✓ 新手福利期</strong>
          <span className="text-text-secondary text-sm leading-relaxed">
            訓練 0-6 個月的新手，力量可以每週進步。這是神經適應的黃金期。<br />
            不要浪費這段時間在花式動作上，專注在基本多關節動作（深蹲、硬舉、臥推、划船）。
          </span>
        </div>
      </div>

      <div className="protocol-card">
        <span className="tag orange">訓練原則 3</span>
        <h3 className="text-2xl mb-4 font-bold">⚖️ 結構優化 (Structural Optimization)</h3>
        <p className="mb-6 text-text-secondary">
          真正的平衡不是「推拉比例」，而是「肋骨」與「骨盆」的相對關係。<br />
          如果喪失了 <strong>ZOA (Zone of Apposition)</strong>，核心將失去剛性，導致代償與疼痛。
        </p>
        
        <div className="code-block">
          <span className="code-label">工程實踐</span>
          <div className="leading-loose">
            <strong>1. 重建 ZOA (Zone of Apposition)</strong><br />
            修正肋骨外翻，讓橫膈膜與骨盆底肌平行對齊。這是核心剛性與脊椎穩定的唯一來源。<br /><br />
            
            <strong>2. 360° 呼吸力學</strong><br />
            停止頸式呼吸。建立能在負重下維持的 IAP (腹內壓)，由內而外撐起脊椎。<br /><br />
            
            <strong>3. 近端穩定，遠端活動</strong><br />
            先鎖定中軸 (Ribcage/Pelvis)，四肢的活動度 (Mobility) 自然會解鎖。
          </div>
        </div>

        <div className="bg-secondary/8 p-6 rounded-xl border-l-4 border-secondary mt-6">
          <strong className="text-secondary block mb-2 text-sm">⚠️ 常見系統錯誤</strong>
          <span className="text-text-secondary text-sm leading-relaxed">
            拼命練核心卻還是腰痠？因為肋骨外翻導致橫膈膜無法穩定脊椎。<br />
            <strong>解法：</strong>先學會吐氣將肋骨下沈，再談大重量訓練。
          </span>
        </div>
      </div>

      <div className="bg-white border-2 border-border p-10 rounded-2xl mt-12">
        <h3 className="mb-6 text-text-primary text-[1.3rem] font-bold">📋 新手訓練範本（週 3 次全身）</h3>
        
        <div className="bg-bg-tertiary p-6 rounded-xl mb-6">
          <strong className="block mb-3 text-text-primary">Day A - 推為主</strong>
          <div className="text-text-secondary leading-loose text-[15px]">
            1. 深蹲 3x8 (RPE 7-8)<br />
            2. 臥推 3x8<br />
            3. 啞鈴肩推 3x10<br />
            4. 划船 3x12 (拉動作補償)<br />
            5. 核心訓練
          </div>
        </div>

        <div className="bg-bg-tertiary p-6 rounded-xl">
          <strong className="block mb-3 text-text-primary">Day B - 拉為主</strong>
          <div className="text-text-secondary leading-loose text-[15px]">
            1. 硬舉 3x5 (RPE 8)<br />
            2. 引體向上 / 滑輪下拉 3x8<br />
            3. 槓鈴划船 3x10<br />
            4. 羅馬尼亞硬舉 3x10<br />
            5. 面拉 3x15 (矯正圓肩)
          </div>
        </div>

        <p className="mt-6 text-text-muted text-sm leading-relaxed">
          * 週一 Day A、週三 Day B、週五 Day A，下週輪替<br />
          * 每週嘗試增加重量或次數（漸進式超負荷）<br />
          * 動作品質優先，不要為了重量犧牲姿勢
        </p>
      </div>
    </section>
  )
}
