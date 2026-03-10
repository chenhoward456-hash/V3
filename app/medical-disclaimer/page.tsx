import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '醫療免責聲明 - The Howard Protocol',
  description: 'Howard Protocol 是健身管理系統，非醫療服務。了解系統功能限制、教練資格說明、健康數據使用方式及緊急情況處理指引。',
  alternates: { canonical: 'https://howard456.vercel.app/medical-disclaimer' },
  openGraph: {
    title: '醫療免責聲明 - The Howard Protocol',
    description: 'Howard Protocol 健身管理系統之醫療免責聲明與使用限制說明',
    url: 'https://howard456.vercel.app/medical-disclaimer',
  },
}

export default function MedicalDisclaimerPage() {
  return (
    <section className="section-container">
      <h2 className="doc-title">醫療免責聲明</h2>
      <p className="doc-subtitle">
        使用 Howard Protocol 前，請詳閱以下重要聲明。
      </p>

      <div className="space-y-8">

        {/* 1. 重要聲明 */}
        <div
          className="bg-white/60 backdrop-blur-sm rounded-3xl p-8"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)' }}
        >
          <h3 className="text-xl font-bold mb-4">一、重要聲明</h3>
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-2xl mb-4">
            <p className="text-red-800 font-semibold mb-2">
              Howard Protocol 是健身管理系統，不是醫療服務。
            </p>
            <p className="text-red-700 leading-relaxed">
              本系統提供的所有內容，包括但不限於訓練計畫、營養建議、補劑資訊及健康數據分析，均不構成醫療診斷、醫療建議或醫療處方。本系統不能取代合格醫療專業人員的診斷與治療。若您有任何健康疑慮，請務必諮詢您的醫師或其他合格醫療專業人員。
            </p>
          </div>
          <p className="text-text-secondary leading-relaxed">
            使用本系統即表示您已理解並同意：您不會將本系統提供的任何資訊視為醫療建議，且您願意為自身的健康決策承擔完全責任。
          </p>
        </div>

        {/* 2. 教練資格 */}
        <div
          className="bg-white/60 backdrop-blur-sm rounded-3xl p-8"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)' }}
        >
          <h3 className="text-xl font-bold mb-4">二、教練資格說明</h3>
          <p className="text-text-secondary leading-relaxed mb-4">
            Howard Chen 的專業背景如下：
          </p>
          <ul className="space-y-3 text-text-secondary leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>持有 NSCA-CSCS（Certified Strength and Conditioning Specialist）肌力與體能專家認證</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>高雄醫學大學運動醫學系畢業</span>
            </li>
          </ul>
          <div className="mt-4 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-2xl">
            <p className="text-amber-800 leading-relaxed">
              儘管具備運動科學與運動醫學相關學歷，Howard Chen 不具備醫師、藥師、營養師或其他醫療專業人員之執業資格。其提供的所有建議均屬於健身與體能訓練領域，而非醫療行為。
            </p>
          </div>
        </div>

        {/* 3. 系統功能限制 */}
        <div
          className="bg-white/60 backdrop-blur-sm rounded-3xl p-8"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)' }}
        >
          <h3 className="text-xl font-bold mb-4">三、系統功能限制</h3>
          <p className="text-text-secondary leading-relaxed mb-6">
            Howard Protocol 系統的功能範圍有明確的界線，請務必了解：
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-green-50 rounded-2xl p-6">
              <h4 className="font-semibold text-green-800 mb-3">系統可以做的</h4>
              <ul className="space-y-2 text-green-700">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">&#10003;</span>
                  <span>根據您的身體數據進行 TDEE（每日總熱量消耗）估算</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">&#10003;</span>
                  <span>依據目標調整每日營養素目標（蛋白質、碳水、脂肪）</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">&#10003;</span>
                  <span>提供個人化的訓練建議與課表安排</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">&#10003;</span>
                  <span>追蹤訓練進度與身體組成變化趨勢</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">&#10003;</span>
                  <span>提供補劑使用的一般性資訊</span>
                </li>
              </ul>
            </div>

            <div className="bg-red-50 rounded-2xl p-6">
              <h4 className="font-semibold text-red-800 mb-3">系統不能做的</h4>
              <ul className="space-y-2 text-red-700">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">&#10007;</span>
                  <span>診斷任何疾病或健康狀況</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">&#10007;</span>
                  <span>開立處方藥物或醫療處方</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">&#10007;</span>
                  <span>提供任何形式的醫療治療</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">&#10007;</span>
                  <span>解讀醫療檢驗報告以做出臨床判斷</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">&#10007;</span>
                  <span>取代醫師、營養師或其他醫療專業人員的角色</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 4. 健康數據使用 */}
        <div
          className="bg-white/60 backdrop-blur-sm rounded-3xl p-8"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)' }}
        >
          <h3 className="text-xl font-bold mb-4">四、健康數據使用說明</h3>
          <p className="text-text-secondary leading-relaxed mb-4">
            為了提供更精準的訓練與營養建議，系統可能會收集並分析以下健康相關數據：
          </p>
          <ul className="space-y-2 text-text-secondary leading-relaxed mb-6">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>血液檢查報告（如血脂、血糖、荷爾蒙指標等）</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>體組成數據（體脂率、肌肉量、骨密度等）</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>月經週期紀錄（適用於女性學員）</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>睡眠品質與壓力指標</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>日常活動量與心率數據</span>
            </li>
          </ul>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-2xl">
            <p className="text-blue-800 leading-relaxed">
              <strong>重要提醒：</strong>這些數據僅供系統進行訓練與營養分析之用，不作為醫療診斷依據。若系統分析發現任何數據異常（例如血液指標超出正常範圍、月經週期嚴重不規律等），請立即諮詢您的醫師進行進一步檢查與評估。系統可能會提示您就醫，但此提示不構成醫療建議。
            </p>
          </div>
        </div>

        {/* 5. 禁止使用情況 */}
        <div
          className="bg-white/60 backdrop-blur-sm rounded-3xl p-8"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)' }}
        >
          <h3 className="text-xl font-bold mb-4">五、禁止使用情況</h3>
          <p className="text-text-secondary leading-relaxed mb-4">
            若您有以下情況，請勿在未取得醫師書面許可的前提下使用本系統的訓練或營養建議：
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-red-50/50 rounded-xl p-4">
              <span className="text-red-500 font-bold text-lg mt-0.5">1.</span>
              <div>
                <span className="font-semibold text-text-primary">急性疾病或感染期間</span>
                <p className="text-text-secondary text-sm mt-1">包括但不限於發燒、急性發炎、感染等正在進行中的疾病狀態。</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-red-50/50 rounded-xl p-4">
              <span className="text-red-500 font-bold text-lg mt-0.5">2.</span>
              <div>
                <span className="font-semibold text-text-primary">手術後恢復期</span>
                <p className="text-text-secondary text-sm mt-1">任何外科手術後，需經您的主治醫師評估並核准後，方可恢復訓練。</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-red-50/50 rounded-xl p-4">
              <span className="text-red-500 font-bold text-lg mt-0.5">3.</span>
              <div>
                <span className="font-semibold text-text-primary">懷孕或哺乳期間</span>
                <p className="text-text-secondary text-sm mt-1">懷孕與哺乳期的營養需求與運動限制有特殊考量，必須由婦產科醫師指導。</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-red-50/50 rounded-xl p-4">
              <span className="text-red-500 font-bold text-lg mt-0.5">4.</span>
              <div>
                <span className="font-semibold text-text-primary">正在使用處方藥物</span>
                <p className="text-text-secondary text-sm mt-1">特別是影響心血管、代謝、荷爾蒙或精神狀態的藥物，訓練與營養調整可能影響藥物效果。</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-red-50/50 rounded-xl p-4">
              <span className="text-red-500 font-bold text-lg mt-0.5">5.</span>
              <div>
                <span className="font-semibold text-text-primary">進食障礙（飲食失調）</span>
                <p className="text-text-secondary text-sm mt-1">包括厭食症、暴食症、暴食清除症等。營養追蹤與熱量計算可能加重病情，請先接受專業心理與醫療治療。</p>
              </div>
            </div>
          </div>
        </div>

        {/* 6. 補劑建議免責 */}
        <div
          className="bg-white/60 backdrop-blur-sm rounded-3xl p-8"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)' }}
        >
          <h3 className="text-xl font-bold mb-4">六、補劑建議免責聲明</h3>
          <p className="text-text-secondary leading-relaxed mb-4">
            系統中涉及的任何補劑（保健食品、運動營養品）相關資訊，請注意以下事項：
          </p>
          <ul className="space-y-3 text-text-secondary leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>所有補劑建議均基於 Howard Chen 的個人使用經驗與運動科學文獻，不構成醫療處方。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>補劑可能與您正在服用的處方藥物產生交互作用，使用前請務必諮詢您的醫師或藥師。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>個人對補劑的反應因體質而異，他人有效不代表對您同樣適用。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>補劑不能替代均衡飲食，也不能用於治療或預防任何疾病。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>若使用補劑後出現任何不適症狀，請立即停止使用並就醫。</span>
            </li>
          </ul>
          <div className="mt-4 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-2xl">
            <p className="text-amber-800 leading-relaxed">
              台灣衛福部提醒：保健食品非藥品，不具有治療疾病的效果。選購保健食品時請認明合格標示。
            </p>
          </div>
        </div>

        {/* 7. 緊急情況 */}
        <div
          className="bg-white/60 backdrop-blur-sm rounded-3xl p-8"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)' }}
        >
          <h3 className="text-xl font-bold mb-4">七、緊急情況處理</h3>
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-2xl mb-4">
            <p className="text-red-800 font-semibold mb-3">
              若您在訓練中或訓練後出現以下任何症狀，請立即停止訓練並就醫：
            </p>
            <ul className="space-y-2 text-red-700">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#9888;</span>
                <span>胸痛、胸悶或呼吸困難</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#9888;</span>
                <span>暈眩、意識模糊或昏厥</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#9888;</span>
                <span>嚴重頭痛或視力模糊</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#9888;</span>
                <span>心跳不規律或異常加速</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#9888;</span>
                <span>關節或骨骼發出異響伴隨劇烈疼痛</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#9888;</span>
                <span>持續性的肌肉痙攣或麻木</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#9888;</span>
                <span>運動後尿液呈深褐色（可能為橫紋肌溶解症）</span>
              </li>
            </ul>
          </div>
          <div className="bg-gray-50 rounded-2xl p-6">
            <p className="text-text-secondary leading-relaxed mb-2">
              <strong>台灣緊急醫療電話：</strong>
            </p>
            <p className="text-2xl font-bold text-red-600 mb-2">119（急救專線）</p>
            <p className="text-text-secondary text-sm leading-relaxed">
              若情況危急，請直接撥打 119 或前往最近的急診室。請勿透過本系統或聯繫教練來處理緊急醫療狀況。
            </p>
          </div>
        </div>

        {/* 最後更新日期 */}
        <div className="text-center text-text-secondary text-sm pt-4">
          <p>最後更新日期：2026 年 3 月 10 日</p>
        </div>

      </div>
    </section>
  )
}
