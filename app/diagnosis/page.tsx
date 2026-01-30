'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { trackDiagnosisComplete, trackLineClick } from '@/lib/analytics'

export default function DiagnosisPage() {
  const [currentQuestion, setCurrentQuestion] = useLocalStorage('diagnosis_currentQuestion', 1)
  const [answers, setAnswers] = useLocalStorage<number[]>('diagnosis_answers', [0, 0, 0, 0])
  const [showResult, setShowResult] = useLocalStorage('diagnosis_showResult', false)
  const [waist, setWaist] = useLocalStorage('diagnosis_waist', '')
  const [height, setHeight] = useLocalStorage('diagnosis_height', '')
  const [whtr, setWhtr] = useState('--')
  const [, , isClient] = useLocalStorage('_client_check', true)

  const handleAnswer = (questionNum: number, score: number) => {
    const newAnswers = [...answers]
    newAnswers[questionNum - 1] = score
    setAnswers(newAnswers)

    if (questionNum < 4) {
      setCurrentQuestion(questionNum + 1)
    } else {
      setShowResult(true)
      // 追蹤診斷測驗完成
      const totalScore = newAnswers.reduce((a, b) => a + b, 0)
      trackDiagnosisComplete(totalScore)
    }
  }

  const calculateWHtR = () => {
    const w = parseFloat(waist)
    const h = parseFloat(height)
    if (!isNaN(w) && !isNaN(h) && h > 0) {
      const result = (w / h).toFixed(3)
      setWhtr(result)
      if (isClient) {
        localStorage.setItem('diagnosis_whtr', result)
      }
    } else {
      setWhtr('--')
    }
  }

  // 頁面載入時恢復 WHtR 計算結果
  useEffect(() => {
    if (isClient) {
      const savedWhtr = localStorage.getItem('diagnosis_whtr')
      if (savedWhtr) {
        setWhtr(savedWhtr)
      } else {
        calculateWHtR()
      }
    }
  }, [isClient, waist, height])

  const totalScore = answers.reduce((a, b) => a + b, 0)

  const getResultContent = () => {
    if (totalScore >= 8) {
      return {
        color: 'danger',
        title: '需要優先關注',
        content: (
          <>
            <strong className="text-danger">根據個人經驗，你可能處於高壓力狀態</strong><br /><br />
            常見的生活型態警訊：<br />
            • 長期壓力可能影響代謝效率<br />
            • 睡眠不足可能降低動力與恢復能力<br />
            • 生活型態失衡可能影響整體狀態<br /><br />
            <strong className="text-danger">建議：優先諮詢醫師進行完整健康檢查</strong><br /><br />
            <div className="mt-4 pt-4 border-t border-danger/20">
              <strong className="block mb-2">💡 個人經驗分享（僅供參考）：</strong>
              1. 優先諮詢醫師進行完整健康檢查<br />
              2. 調整作息：確保每晚 7-8 小時睡眠<br />
              3. 優化飲食：減少加工食品，增加原型食物<br />
              4. 開始輕度運動（每週 2-3 次散步或瑜伽）
            </div>
          </>
        )
      }
    } else if (totalScore >= 4) {
      return {
        color: 'warning',
        title: '可以優化',
        content: (
          <>
            <strong className="text-warning">根據個人經驗，你的生活型態有優化空間</strong><br /><br />
            常見的改善機會：<br />
            • 訓練與營養可能需要調整<br />
            • 睡眠品質可能影響恢復能力<br />
            • 生活型態優化可能帶來更好的狀態<br /><br />
            <strong className="text-warning">現在開始調整，可能帶來明顯改善</strong><br /><br />
            <div className="mt-4 pt-4 border-t border-warning/20">
              <strong className="block mb-2">💡 個人經驗分享（僅供參考）：</strong>
              1. 開始規律運動（每週 3 次肌力訓練）<br />
              2. 優化飲食：減少加工食品，增加原型食物<br />
              3. 改善睡眠品質：固定作息、睡前 2 小時避免藍光<br />
              4. 諮詢專業教練或醫師，建立系統化改善計畫
            </div>
          </>
        )
      }
    } else {
      return {
        color: 'success',
        title: '狀態良好',
        content: (
          <>
            <strong className="text-success">根據個人經驗，你的生活型態看起來不錯</strong><br /><br />
            但要注意：<br />
            • 「正常」不等於「最佳化」<br />
            • 持續追蹤能幫助你保持領先<br />
            • 定期檢視生活型態能發現潛在問題<br /><br />
            <strong className="text-success">建議：可考慮定期進行健康檢查</strong><br /><br />
            <div className="mt-4 pt-4 border-t border-success/20">
              <strong className="block mb-2">💡 個人經驗分享（僅供參考）：</strong>
              1. 維持規律運動習慣（每週 3-4 次訓練）<br />
              2. 定期追蹤訓練數據與身體狀況<br />
              3. 持續學習營養與訓練知識<br />
              4. 考慮進階優化：HRV 追蹤、睡眠監測
            </div>
          </>
        )
      }
    }
  }

  const result = getResultContent()

  return (
    <section className="section-container">
      <h2 className="doc-title">生活型態評估</h2>
      <p className="doc-subtitle">4 個問題，評估你的生活型態與訓練需求</p>

      <div className="bg-warning/5 border-2 border-warning/30 rounded-xl p-6 mb-8">
        <p className="text-text-secondary text-sm leading-relaxed">
          ⚠️ <strong>重要提醒</strong>：此評估僅供<strong>個人參考</strong>，基於教練個人經驗分享，<strong>不構成任何醫療建議或診斷</strong>。若有健康疑慮，請務必諮詢合格醫師進行完整檢查。
        </p>
      </div>

      <div className="flex justify-center gap-4 my-12">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold border-3 transition-all ${
              step < currentQuestion || showResult
                ? 'border-success bg-success text-white'
                : step === currentQuestion
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-white text-text-muted'
            }`}
          >
            {step < currentQuestion || showResult ? '✓' : step}
          </div>
        ))}
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="bg-white border-2 border-border p-10 rounded-2xl shadow-lg">
          
          {!showResult && currentQuestion === 1 && (
            <div>
              <h3 className="text-2xl mb-2 text-text-primary font-bold">Q1. 下午2點後會出現強烈腦霧嗎？</h3>
              <p className="text-text-secondary text-[15px] mb-8">無法專注、想睡覺、情緒低落</p>
              
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => handleAnswer(1, 3)}
                  className="w-full text-left p-5 bg-bg-tertiary border-2 border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-base font-medium"
                >
                  <strong>A.</strong> 經常，幾乎每天 <span className="text-danger text-sm ml-2 font-mono">[+3]</span>
                </button>
                <button
                  onClick={() => handleAnswer(1, 1)}
                  className="w-full text-left p-5 bg-bg-tertiary border-2 border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-base font-medium"
                >
                  <strong>B.</strong> 偶爾，一週 2-3 次 <span className="text-warning text-sm ml-2 font-mono">[+1]</span>
                </button>
                <button
                  onClick={() => handleAnswer(1, 0)}
                  className="w-full text-left p-5 bg-bg-tertiary border-2 border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-base font-medium"
                >
                  <strong>C.</strong> 很少或從不 <span className="text-success text-sm ml-2 font-mono">[0]</span>
                </button>
              </div>
            </div>
          )}

          {!showResult && currentQuestion === 2 && (
            <div>
              <h3 className="text-2xl mb-2 text-text-primary font-bold">Q2. 你的腰圍身高比 (WHtR) 是多少？</h3>
              <p className="text-text-secondary text-[15px] mb-4">腰圍 (cm) ÷ 身高 (cm)</p>
              
              <div className="bg-bg-tertiary p-8 rounded-xl mb-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input
                    type="number"
                    placeholder="腰圍 (cm)"
                    value={waist}
                    onChange={(e) => {
                      setWaist(e.target.value)
                      calculateWHtR()
                    }}
                    className="p-3 border-2 border-border rounded-lg text-base"
                  />
                  <input
                    type="number"
                    placeholder="身高 (cm)"
                    value={height}
                    onChange={(e) => {
                      setHeight(e.target.value)
                      calculateWHtR()
                    }}
                    className="p-3 border-2 border-border rounded-lg text-base"
                  />
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <span className="text-text-secondary text-sm">計算結果: </span>
                  <span className="text-primary font-bold font-mono text-3xl">{whtr}</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => handleAnswer(2, 3)}
                  className="w-full text-left p-5 bg-bg-tertiary border-2 border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-base font-medium"
                >
                  <strong>A.</strong> ≥ 0.53 (超標) <span className="text-danger font-mono">[+3]</span>
                </button>
                <button
                  onClick={() => handleAnswer(2, 1)}
                  className="w-full text-left p-5 bg-bg-tertiary border-2 border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-base font-medium"
                >
                  <strong>B.</strong> 0.45 - 0.52 (警戒) <span className="text-warning font-mono">[+1]</span>
                </button>
                <button
                  onClick={() => handleAnswer(2, 0)}
                  className="w-full text-left p-5 bg-bg-tertiary border-2 border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-base font-medium"
                >
                  <strong>C.</strong> &lt; 0.45 (優秀) <span className="text-success font-mono">[0]</span>
                </button>
              </div>
            </div>
          )}

          {!showResult && currentQuestion === 3 && (
            <div>
              <h3 className="text-2xl mb-2 text-text-primary font-bold">Q3. 早晨起床時的「動力感」如何？</h3>
              <p className="text-text-secondary text-[15px] mb-8">精力、鬥志、性慾</p>
              
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => handleAnswer(3, 3)}
                  className="w-full text-left p-5 bg-bg-tertiary border-2 border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-base font-medium"
                >
                  <strong>A.</strong> 非常低落，像沒電 <span className="text-danger font-mono">[+3]</span>
                </button>
                <button
                  onClick={() => handleAnswer(3, 1)}
                  className="w-full text-left p-5 bg-bg-tertiary border-2 border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-base font-medium"
                >
                  <strong>B.</strong> 普通，需要咖啡啟動 <span className="text-warning font-mono">[+1]</span>
                </button>
                <button
                  onClick={() => handleAnswer(3, 0)}
                  className="w-full text-left p-5 bg-bg-tertiary border-2 border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-base font-medium"
                >
                  <strong>C.</strong> 充沛，醒來就能衝 <span className="text-success font-mono">[0]</span>
                </button>
              </div>
            </div>
          )}

          {!showResult && currentQuestion === 4 && (
            <div>
              <h3 className="text-2xl mb-2 text-text-primary font-bold">Q4. 最近有掉髮或皮膚狀況不穩定嗎？</h3>
              <p className="text-text-secondary text-[15px] mb-8">落髮量增加、痘痘、濕疹</p>
              
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => handleAnswer(4, 3)}
                  className="w-full text-left p-5 bg-bg-tertiary border-2 border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-base font-medium"
                >
                  <strong>A.</strong> 是，而且很明顯 <span className="text-danger font-mono">[+3]</span>
                </button>
                <button
                  onClick={() => handleAnswer(4, 1)}
                  className="w-full text-left p-5 bg-bg-tertiary border-2 border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-base font-medium"
                >
                  <strong>B.</strong> 偶爾有，不太穩定 <span className="text-warning font-mono">[+1]</span>
                </button>
                <button
                  onClick={() => handleAnswer(4, 0)}
                  className="w-full text-left p-5 bg-bg-tertiary border-2 border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-base font-medium"
                >
                  <strong>C.</strong> 沒有，狀態穩定 <span className="text-success font-mono">[0]</span>
                </button>
              </div>
            </div>
          )}

          {showResult && (
            <div>
              <div className="text-center mb-8">
                <div className="inline-block bg-success/10 border-2 border-success rounded-full px-6 py-2 mb-6">
                  <span className="text-success font-mono font-bold text-sm">/// SCAN_COMPLETE</span>
                </div>
                <h3 className="text-3xl font-bold mb-4">評估結果</h3>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-text-secondary">總分:</span>
                  <span className="text-6xl font-bold font-mono text-primary">{totalScore}</span>
                  <span className="text-text-muted text-2xl">/12</span>
                </div>
              </div>

              <div className={`bg-${result.color}/5 border-2 border-${result.color} rounded-xl p-8 mb-6`}>
                <div className={`bg-${result.color}/10 p-6 rounded-xl border-l-4 border-${result.color}`}>
                  <span className={`code-label text-${result.color}`}>{result.title}</span>
                  <div className="leading-loose mt-4">
                    {result.content}
                  </div>
                </div>
              </div>

              {/* 個人化建議和分級引導 */}
              <div className="space-y-6">
                {totalScore >= 8 && (
                  <div className="bg-danger/5 border-2 border-danger rounded-xl p-8">
                    <h4 className="text-xl font-bold mb-4 text-danger">⚠️ 建議立即優化</h4>
                    <p className="text-text-secondary mb-6 leading-relaxed">
                      你的身體系統出現多個警訊，建議盡快進行專業評估和系統性調整。
                      長期忽略這些訊號可能影響健康和生活品質。
                    </p>
                    <a
                      href="https://lin.ee/dnbucVw"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-danger text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all w-full text-center"
                      onClick={() => trackLineClick('diagnosis_result_high')}
                    >
                      立即預約免費諮詢
                    </a>
                  </div>
                )}

                {totalScore >= 4 && totalScore < 8 && (
                  <div className="bg-warning/5 border-2 border-warning rounded-xl p-8">
                    <h4 className="text-xl font-bold mb-4 text-warning">💡 有改善空間</h4>
                    <p className="text-text-secondary mb-6 leading-relaxed">
                      你的身體系統有優化空間。建議先了解正確的訓練和營養方法，
                      再決定是否需要專業指導。
                    </p>
                    <div className="space-y-4">
                      <a
                        href="https://lin.ee/dnbucVw"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-success text-white px-6 py-3 rounded-xl font-bold text-center hover:opacity-90 transition-all"
                        onClick={() => trackLineClick('diagnosis_result_medium')}
                      >
                        預約免費諮詢
                      </a>
                      <div className="text-center">
                        <p className="text-sm text-text-muted mb-3">或先閱讀相關文章：</p>
                        <div className="flex flex-col gap-2">
                          <Link href="/blog/three-layers-fat-loss-strategy" className="text-primary hover:underline text-sm">
                            → 三層脂肪減脂策略
                          </Link>
                          <Link href="/blog/testosterone-optimization-3-months" className="text-primary hover:underline text-sm">
                            → 睪固酮自然提升方法
                          </Link>
                          <Link href="/blog/sleep-quality-hrv-optimization" className="text-primary hover:underline text-sm">
                            → 睡眠品質優化指南
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {totalScore < 4 && (
                  <div className="bg-success/5 border-2 border-success rounded-xl p-8">
                    <h4 className="text-xl font-bold mb-4 text-success">✓ 狀態良好</h4>
                    <p className="text-text-secondary mb-6 leading-relaxed">
                      你的身體系統運作良好！可以考慮進一步提升效能，
                      或追蹤我的內容學習更多優化技巧。
                    </p>
                    <div className="space-y-4">
                      <a
                        href="https://www.instagram.com/chenhoward/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-primary text-white px-6 py-3 rounded-xl font-bold text-center hover:opacity-90 transition-all"
                      >
                        追蹤 IG 獲得每日內容
                      </a>
                      <div className="text-center">
                        <p className="text-sm text-text-muted mb-3">推薦進階內容：</p>
                        <div className="flex flex-col gap-2">
                          <Link href="/blog/muscle-building-science-2025" className="text-primary hover:underline text-sm">
                            → 2025 增肌真相
                          </Link>
                          <Link href="/training" className="text-primary hover:underline text-sm">
                            → Howard 訓練系統
                          </Link>
                          <Link href="/nutrition" className="text-primary hover:underline text-sm">
                            → 營養優化協議
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    if (isClient) {
                      localStorage.removeItem('diagnosis_currentQuestion')
                      localStorage.removeItem('diagnosis_answers')
                      localStorage.removeItem('diagnosis_showResult')
                      localStorage.removeItem('diagnosis_waist')
                      localStorage.removeItem('diagnosis_height')
                      localStorage.removeItem('diagnosis_whtr')
                    }
                    setCurrentQuestion(1)
                    setAnswers([0, 0, 0, 0])
                    setShowResult(false)
                    setWaist('')
                    setHeight('')
                    setWhtr('--')
                  }}
                  className="text-text-secondary hover:text-primary transition-colors text-sm underline"
                >
                  🔄 重新開始測驗
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
