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
