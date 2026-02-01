import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '個案追蹤 - The Howard Protocol',
  description: '6年系統修復的完整數據紀錄。從2020年系統崩潰到2026年完全重生，透過系統化訓練與營養介入達到菁英等級。',
  openGraph: {
    title: '個案追蹤 - The Howard Protocol',
    description: '6年系統修復的完整數據紀錄 - 從系統崩潰到完全重生',
  },
}

export default function CasePage() {
  return (
    <section className="section-container">
      <h2 className="doc-title">個案追蹤</h2>
      <p className="doc-subtitle">6年系統修復的完整數據紀錄 | Case Study 2020-2026</p>

      <div className="bg-warning/5 border-2 border-warning/30 rounded-xl p-6 mb-8">
        <p className="text-text-secondary text-sm leading-relaxed">
          ⚠️ <strong>個人經驗分享</strong>：以下內容為個人案例紀錄，僅供參考。每個人的身體狀況不同，效果因人而異。任何健康相關決策請諮詢專業醫療人員。
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-10 my-16">
        <div className="relative">
          <div className="absolute -top-3 -left-3 bg-danger/75 text-white px-4 py-1.5 rounded-full font-normal text-sm z-10">
            2020 年初
          </div>
          <div className="h-[300px] md:h-[420px] rounded-[1.5rem] overflow-hidden" style={{boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04), 0 12px 32px rgba(0, 0, 0, 0.03)'}}>
            <img 
              src="/before.jpg" 
              alt="2020 年系統崩潰狀態" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="mt-6">
            <h3 className="text-danger mb-4 text-lg font-medium">❌ 系統失效</h3>
            <div className="bg-bg-tertiary/40 p-6 rounded-2xl border-l-[3px] border-danger/40">
              <div className="text-text-secondary leading-loose text-[15px]">
                • 嚴重落髮（頭頂明顯稀疏）<br />
                • 圓潤浮腫的臉型<br />
                • 全身性慢性發炎<br />
                • 持續疲勞、無動力<br />
                • hs-CRP 發炎指標異常
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -top-3 -left-3 bg-success/75 text-white px-4 py-1.5 rounded-full font-normal text-sm z-10">
            2026 年
          </div>
          <div className="h-[300px] md:h-[420px] rounded-[1.5rem] overflow-hidden" style={{boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04), 0 12px 32px rgba(0, 0, 0, 0.03)'}}>
            <img 
              src="/after.jpg" 
              alt="2026 年完全重生狀態 - 頭髮恢復與體態改善" 
              className="w-full h-full object-cover object-[center_20%]"
              style={{ objectPosition: 'center 20%' }}
            />
          </div>
          <div className="mt-6">
            <h3 className="text-success mb-4 text-lg font-medium">✓ 系統優化</h3>
            <div className="bg-bg-tertiary/40 p-6 rounded-2xl border-l-[3px] border-success/40">
              <div className="text-text-secondary leading-loose text-[15px]">
                • 頭髮恢復濃密<br />
                • 精實體態 (FFMI 23.6)<br />
                • 發炎指標正常化<br />
                • 精力充沛、高效能<br />
                • HRV 達到菁英等級 (91ms)
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-border p-10 rounded-2xl my-12">
        <h3 className="mb-6 text-text-primary text-[1.3rem] font-bold">🔬 核心發現</h3>
        <div className="code-block">
          <span className="code-label">系統分析結果</span>
          <div className="leading-loose">
            根據<strong>個人經驗</strong>，落髮可能不只是「年紀問題」，而是身體系統發出的警告訊號。<br /><br />
            
            經過系統化追蹤與調整，我發現三大可能原因：<br />
            1. <strong>慢性發炎</strong> - 可能影響毛囊健康<br />
            2. <strong>荷爾蒙波動</strong> - 睪固酮偏低，DHT 轉換過度<br />
            3. <strong>代謝問題</strong> - 胰島素阻抗，營養輸送受阻
          </div>
        </div>
      </div>

      <h3 className="my-16 text-2xl font-bold text-text-primary">📈 數據時間軸</h3>
      
      <div className="grid gap-8">
        <div className="protocol-card">
          <span className="tag red">2020 年初</span>
          <h3 className="text-xl mb-4 text-danger font-bold">系統崩潰期</h3>
          <p className="text-text-secondary mb-4">
            嚴重落髮、浮腫、慢性疲勞
          </p>
          <div className="bg-bg-tertiary p-4 rounded-lg font-mono">
            <div className="text-danger font-bold text-2xl mb-2">
              hs-CRP: 高
            </div>
            <div className="text-text-muted text-sm">發炎指標異常</div>
          </div>
        </div>

        <div className="protocol-card">
          <span className="tag orange">2022 年</span>
          <h3 className="text-xl mb-4 text-warning font-bold">系統修復期</h3>
          <p className="text-text-secondary mb-4">
            開始系統化訓練與營養介入
          </p>
          <div className="bg-bg-tertiary p-4 rounded-lg font-mono">
            <div className="text-warning font-bold text-2xl mb-2">
              Testosterone: 515 ng/dL
            </div>
            <div className="text-text-muted text-sm">荷爾蒙偏低</div>
          </div>
        </div>

        <div className="protocol-card">
          <span className="tag green">2026 年</span>
          <h3 className="text-xl mb-4 text-success font-bold">系統優化完成</h3>
          <p className="text-text-secondary mb-4">
            所有指標達到菁英水平
          </p>
          <div className="bg-bg-tertiary p-4 rounded-lg font-mono">
            <div className="text-success font-bold text-xl mb-2">
              Testosterone: 625 ng/dL<br />
              HOMA-IR: 0.49<br />
              HRV: 91 ms
            </div>
            <div className="text-text-muted text-sm">ELITE 等級</div>
          </div>
        </div>
      </div>

      {/* Technical Stack */}
      <div className="my-24 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12" style={{color: '#2D2D2D', letterSpacing: '0.05em'}}>
          Technical Stack
        </h2>
        <p className="text-center text-gray-600 mb-12">
          專業背景與技術規格
        </p>

        <div className="bg-white border-2 border-gray-200 rounded-2xl p-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* 學歷認證 */}
            <div>
              <h3 className="text-sm font-bold text-gray-400 mb-4 tracking-wider">EDUCATION & CERTIFICATION</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-primary font-mono text-sm">▸</span>
                  <div>
                    <p className="font-medium text-gray-900">高雄醫學大學 運動醫學系</p>
                    <p className="text-sm text-gray-500">Bachelor of Sports Medicine</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-primary font-mono text-sm">▸</span>
                  <div>
                    <p className="font-medium text-gray-900">NSCA-CSCS 肌力與體能專家</p>
                    <p className="text-sm text-gray-500">Certified Strength & Conditioning Specialist</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 技術專長 */}
            <div>
              <h3 className="text-sm font-bold text-gray-400 mb-4 tracking-wider">TECHNICAL EXPERTISE</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-success font-mono text-sm">✓</span>
                  <div>
                    <p className="font-medium text-gray-900">數據追蹤與分析</p>
                    <p className="text-sm text-gray-500">HRV / 血檢 / 體組成 / 訓練量化</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-success font-mono text-sm">✓</span>
                  <div>
                    <p className="font-medium text-gray-900">系統化訓練設計</p>
                    <p className="text-sm text-gray-500">肌力 / 代謝 / 恢復 / 營養介入</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-success font-mono text-sm">✓</span>
                  <div>
                    <p className="font-medium text-gray-900">個人實驗數據庫</p>
                    <p className="text-sm text-gray-500">6 年完整追蹤記錄（2020-2026）</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 數據規格 */}
          <div className="mt-8 pt-8 border-t-2 border-gray-100">
            <h3 className="text-sm font-bold text-gray-400 mb-4 tracking-wider">PERFORMANCE METRICS (2026)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="font-mono text-2xl font-bold text-primary">625</div>
                <div className="text-xs text-gray-500 mt-1">Testosterone (ng/dL)</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="font-mono text-2xl font-bold text-success">0.49</div>
                <div className="text-xs text-gray-500 mt-1">HOMA-IR</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="font-mono text-2xl font-bold text-warning">91</div>
                <div className="text-xs text-gray-500 mt-1">HRV (ms)</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="font-mono text-2xl font-bold text-gray-900">ELITE</div>
                <div className="text-xs text-gray-500 mt-1">Overall Grade</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center my-16">
        <Link 
          href="/training"
          className="inline-block bg-primary text-white px-10 py-5 rounded-xl text-lg font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
        >
          查看完整訓練系統 →
        </Link>
      </div>
    </section>
  )
}
