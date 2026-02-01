import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '工具與資源 - The Howard Protocol',
  description: 'Howard 實測使用的裝備清單與推薦書單。基礎補劑建議、穿戴裝備、訓練書籍推薦。品質優先，沒有業配。',
  openGraph: {
    title: '工具與資源 - The Howard Protocol',
    description: '實測裝備清單與推薦書單',
  },
}

export default function ToolsPage() {
  return (
    <section className="section-container">
      <h2 className="doc-title">工具與資源</h2>
      <p className="doc-subtitle">Howard 實測使用的裝備清單 + 推薦書單。品質優先，沒有業配。</p>

      {/* Howard Protocol 執行流程圖 */}
      <div className="my-16 max-w-5xl mx-auto">
        <h3 className="text-3xl font-bold text-center mb-4" style={{color: '#2D2D2D', letterSpacing: '0.05em'}}>
          Howard Protocol 執行流程
        </h3>
        <p className="text-center text-gray-600 mb-12">
          系統化的數據追蹤與優化流程，透明且有科學根據
        </p>

        <div className="bg-white border-2 border-gray-200 rounded-2xl p-8">
          {/* 流程步驟 */}
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                  01
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
                  數據採集 (Data Collection)
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed mb-3">
                  建立你的身體基線數據，了解目前系統狀態
                </p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid md:grid-cols-3 gap-3 text-base md:text-sm">
                    <div>
                      <span className="font-mono text-primary">▸</span> 體組成分析
                    </div>
                    <div>
                      <span className="font-mono text-primary">▸</span> HRV 睡眠追蹤
                    </div>
                    <div>
                      <span className="font-mono text-primary">▸</span> 訓練能力測試
                    </div>
                    <div>
                      <span className="font-mono text-primary">▸</span> 飲食記錄分析
                    </div>
                    <div>
                      <span className="font-mono text-primary">▸</span> 血檢數據（選配）
                    </div>
                    <div>
                      <span className="font-mono text-primary">▸</span> 生活型態評估
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="text-3xl text-gray-300">↓</div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-success text-white flex items-center justify-center font-bold">
                  02
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
                  模型建立 (Protocol Design)
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed mb-3">
                  根據數據設計專屬的優化協定
                </p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid md:grid-cols-2 gap-3 text-base md:text-sm">
                    <div>
                      <span className="font-mono text-success">✓</span> 訓練量化設計（組數/次數/強度）
                    </div>
                    <div>
                      <span className="font-mono text-success">✓</span> 營養介入策略（熱量/營養素）
                    </div>
                    <div>
                      <span className="font-mono text-success">✓</span> 恢復優化方案（睡眠/壓力管理）
                    </div>
                    <div>
                      <span className="font-mono text-success">✓</span> 補品使用時機（依個人需求）
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="text-3xl text-gray-300">↓</div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-warning text-white flex items-center justify-center font-bold">
                  03
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
                  執行追蹤 (Execution & Monitoring)
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed mb-3">
                  持續監控數據變化，確保協定有效執行
                </p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid md:grid-cols-2 gap-3 text-base md:text-sm">
                    <div>
                      <span className="font-mono text-warning">●</span> 每日 HRV 監測（恢復狀態）
                    </div>
                    <div>
                      <span className="font-mono text-warning">●</span> 每週訓練量追蹤（進步曲線）
                    </div>
                    <div>
                      <span className="font-mono text-warning">●</span> 每月體組成檢測（成效驗證）
                    </div>
                    <div>
                      <span className="font-mono text-warning">●</span> LINE 即時回饋（問題排除）
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="text-3xl text-gray-300">↓</div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold">
                  04
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
                  協定修正 (Protocol Adjustment)
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed mb-3">
                  根據數據反饋動態調整，持續優化系統
                </p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2 text-base md:text-sm">
                    <div>
                      <span className="font-mono text-gray-900">→</span> 如果 HRV 下降 → 降低訓練量或增加恢復日
                    </div>
                    <div>
                      <span className="font-mono text-gray-900">→</span> 如果體重停滯 → 調整熱量或營養素比例
                    </div>
                    <div>
                      <span className="font-mono text-gray-900">→</span> 如果睡眠品質差 → 優化作息或補充鎂
                    </div>
                    <div>
                      <span className="font-mono text-gray-900">→</span> 如果訓練表現下降 → 檢查恢復與營養狀態
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 循環標示 */}
          <div className="mt-8 pt-6 border-t-2 border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              ♻️ 這是一個持續循環的過程，每 4-6 週重新評估並調整協定
            </p>
          </div>
        </div>
      </div>

      <h3 className="my-10 text-[1.3rem] font-bold text-text-primary">💊 基礎補劑建議</h3>
      
      <div className="bg-white border-2 border-border p-10 rounded-2xl mb-8">
        <p className="text-text-secondary mb-6 leading-relaxed">
          補劑品牌眾多，選擇有第三方檢測認證的較有保障（例如：Thorne、Life Extension、Doctor&apos;s Best、NOW Foods）。<br />
          <strong>個人使用經驗</strong>中，以下項目可能有幫助（使用前請諮詢專業人員）：
        </p>
        
        <ul className="text-text-secondary leading-loose pl-6 space-y-2">
          <li><strong>維生素 D3 + K2</strong> - 大多數人都缺乏，影響骨質與免疫</li>
          <li><strong>Omega-3 魚油</strong> - 抗發炎，支持心血管健康</li>
          <li><strong>鎂</strong> - 改善睡眠品質，放鬆神經系統</li>
          <li><strong>肌酸</strong> - 訓練者必備，提升力量與肌肉量</li>
        </ul>
      </div>

      <div className="bg-warning/8 p-6 rounded-xl border-l-4 border-warning my-8">
        <strong className="text-warning block mb-2 text-sm">⚠️ 使用提醒</strong>
        <span className="text-text-secondary text-[15px] leading-relaxed">
          補劑只能「優化」而非「取代」真實食物。<br />
          建議諮詢營養師或醫師，確認是否需要補充。
        </span>
      </div>

      <h3 className="my-12 text-[1.3rem] font-bold text-text-primary">⌚ 穿戴裝備</h3>
      
      <table className="specs-table">
        <thead>
          <tr>
            <th className="w-[30%]">裝置類型</th>
            <th className="w-[35%]">推薦型號</th>
            <th className="w-[35%]">功能說明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>HRV 監測手錶</strong>
              <span>訓練恢復追蹤</span>
            </td>
            <td className="text-sm">
              Garmin Forerunner 系列<br />
              Apple Watch
            </td>
            <td className="text-text-secondary text-sm">
              精準 HRV 追蹤，判斷恢復狀態與訓練強度
            </td>
          </tr>
          <tr>
            <td>
              <strong>睡眠與恢復追蹤</strong>
              <span>深度睡眠分析</span>
            </td>
            <td className="text-sm">
              Oura Ring Gen 3<br />
              Whoop 4.0
            </td>
            <td className="text-text-secondary text-sm">
              非侵入式睡眠品質監控，提供恢復分數建議
            </td>
          </tr>
          <tr>
            <td>
              <strong>訓練鞋款</strong>
              <span>步態優化</span>
            </td>
            <td className="text-sm">
              Altra Torin 系列
            </td>
            <td className="text-text-secondary text-sm">
              Zero Drop 設計，符合足部生物力學
            </td>
          </tr>
          <tr>
            <td>
              <strong>連續血糖監測（進階）</strong>
              <span>即時血糖反應</span>
            </td>
            <td className="text-sm">
              Freestyle Libre 3
            </td>
            <td className="text-text-secondary text-sm">
              追蹤碳水化合物對血糖的影響（選配）
            </td>
          </tr>
        </tbody>
      </table>

      <h3 className="my-12 text-[1.3rem] font-bold text-text-primary">📚 推薦書單</h3>
      
      <table className="specs-table">
        <thead>
          <tr>
            <th className="w-[35%]">書名</th>
            <th className="w-[65%]">為什麼推薦</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>為什麼要睡覺</strong>
              <span>Why We Sleep</span>
            </td>
            <td className="text-text-secondary text-sm">
              神經科學家 Matthew Walker 的睡眠科學經典。<br />
              了解睡眠如何影響肌肉恢復、荷爾蒙分泌、認知功能。
            </td>
          </tr>
          <tr>
            <td>
              <strong>超預期壽命</strong>
              <span>Outlive</span>
            </td>
            <td className="text-text-secondary text-sm">
              Peter Attia 的長壽醫學指南。<br />
              整合運動、營養、代謝健康的完整框架。
            </td>
          </tr>
          <tr>
            <td>
              <strong>肌力訓練聖經</strong>
              <span>Starting Strength</span>
            </td>
            <td className="text-text-secondary text-sm">
              Mark Rippetoe 的力學基礎教材。<br />
              深蹲、硬舉、臥推的生物力學詳解。新手必讀。
            </td>
          </tr>
          <tr>
            <td>
              <strong>原子習慣</strong>
              <span>Atomic Habits</span>
            </td>
            <td className="text-text-secondary text-sm">
              James Clear 的行為改變系統。<br />
              健康不是靠意志力，而是建立正確的系統與環境。
            </td>
          </tr>
        </tbody>
      </table>

      <div className="bg-primary/8 p-6 rounded-xl my-8">
        <strong className="text-primary block mb-2 text-sm">💡 閱讀建議</strong>
        <span className="text-text-secondary text-[15px] leading-relaxed">
          不需要一次讀完所有書。建議從《原子習慣》開始，建立系統化思維。<br />
          如果對訓練有興趣，《肌力訓練聖經》是最好的投資。
        </span>
      </div>
    </section>
  )
}
