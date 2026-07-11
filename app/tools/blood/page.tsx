'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'
import { BLOOD_MARKERS, type MarkerKey } from '@/lib/blood-panel'

const CITATIONS = [
  {
    text: 'ApoB 預測心血管風險優於 LDL-C（233,455 人統合分析）',
    cite: 'Sniderman et al., Circ Cardiovasc Qual Outcomes (2011) · PMID: 21487090',
    href: 'https://pubmed.ncbi.nlm.nih.gov/21487090/',
  },
  {
    text: 'hs-CRP 是心血管風險的發炎指標，可做風險分層',
    cite: 'Ridker, Circulation (2003) · PMID: 12551853',
    href: 'https://pubmed.ncbi.nlm.nih.gov/12551853/',
  },
  {
    text: 'HOMA-IR 以空腹血糖＋胰島素估算身體對胰島素的反應（原始公式）',
    cite: 'Matthews et al., Diabetologia (1985) · PMID: 3899825',
    href: 'https://pubmed.ncbi.nlm.nih.gov/3899825/',
  },
  {
    text: '維生素 D 補足與男性睪固酮上升相關（隨機對照試驗）',
    cite: 'Pilz et al., Horm Metab Res (2011) · PMID: 21154195',
    href: 'https://pubmed.ncbi.nlm.nih.gov/21154195/',
  },
]

export default function BloodPanelPage() {
  // 預設：全部都在清單裡（不用填就有完整價值）。使用者可把「已驗過」的點掉——加分的減法，不是門檻。
  const [testedKeys, setTestedKeys] = useState<Set<MarkerKey>>(new Set())
  const [copied, setCopied] = useState(false)

  const toggleTested = useCallback((key: MarkerKey) => {
    setTestedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const remaining = useMemo(() => BLOOD_MARKERS.filter(m => !testedKeys.has(m.key)), [testedKeys])

  const copyQuestions = useCallback(async () => {
    const list = remaining.length ? remaining : BLOOD_MARKERS
    const text =
      '帶去問醫師的血檢問題：\n\n' +
      list.map((m, i) => `${i + 1}. ${m.name}（${m.en}）\n   ${m.askDoctor}`).join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
      trackEvent('blood_tool_copy', { remaining: remaining.length })
    } catch {
      /* 剪貼簿被擋就算了，清單本身已在畫面上 */
    }
  }, [remaining])

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-2xl mx-auto px-5 py-12 md:py-16">
        {/* Hero */}
        <header className="mb-8">
          <p className="text-sm font-semibold text-primary-600 mb-3">免費清單 · 血檢</p>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-snug mb-4">
            健保說你「正常」，
            <br />
            但這 5 個它沒幫你驗
          </h1>
          <p className="text-slate-600 leading-relaxed">
            健保健檢是設計來抓已經生病的人，不是幫你提前看到代謝出狀況。這是我自己會自費加驗的 5
            個，每一項都附一句可以帶去問醫師的問題。
          </p>
          <p className="mt-4 text-xs text-slate-500 leading-relaxed">
            這頁不解讀你的數字、也不存任何資料。看完直接複製問診清單帶走就好。
          </p>
        </header>

        {/* 5 張清單卡（免填，一進來就完整） */}
        <section className="space-y-3 mb-8">
          {BLOOD_MARKERS.map((m, i) => {
            const tested = testedKeys.has(m.key)
            return (
              <article
                key={m.key}
                className={`bg-white border border-slate-200 rounded-2xl p-5 transition-opacity ${
                  tested ? 'opacity-50' : 'opacity-100'
                }`}
              >
                <div className="flex items-start gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full border border-primary-600 bg-primary-50 text-primary-600 font-bold text-sm flex items-center justify-center tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap mb-2">
                      <h2 className="text-lg font-bold text-slate-900">{m.name}</h2>
                      <span className="text-sm font-medium text-slate-400">{m.en}</span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">{m.plain}</p>
                    <p className="text-xs text-slate-500 leading-relaxed mb-3">
                      <span className="font-semibold text-slate-600">健保為何略過：</span>
                      {m.whyNhiSkips}
                    </p>
                    <div className="bg-primary-50 rounded-xl px-4 py-3">
                      <p className="text-xs font-semibold text-primary-700 mb-1">帶去問醫師</p>
                      <p className="text-sm text-slate-700 leading-relaxed">「{m.askDoctor}」</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => toggleTested(m.key)}
                    className={`text-xs font-medium transition-colors ${
                      tested ? 'text-slate-400 hover:text-slate-600' : 'text-primary-600 hover:text-primary-700'
                    }`}
                  >
                    {tested ? '↩ 放回清單' : '✓ 這個我驗過了'}
                  </button>
                </div>
              </article>
            )
          })}
        </section>

        {/* 一鍵帶走 */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-10 text-center">
          <p className="text-sm text-slate-600 mb-4">
            {remaining.length === 0
              ? '這 5 個你都驗過了 — 你已經比多數人多看到很多。'
              : `複製${remaining.length === BLOOD_MARKERS.length ? '這 5 個' : `剩下 ${remaining.length} 個`}的問診問題，下次抽血前拿出來。`}
          </p>
          <button
            type="button"
            onClick={copyQuestions}
            className="inline-block bg-primary-600 hover:bg-primary-700 transition-colors text-white font-bold px-8 py-3.5 rounded-xl"
          >
            {copied ? '已複製 ✓' : '複製問診清單'}
          </button>
        </section>

        {/* 研究出處 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">這些說法的出處</h2>
          <ul className="space-y-3">
            {CITATIONS.map(c => (
              <li key={c.cite} className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-sm text-slate-700 leading-relaxed mb-2">{c.text}</p>
                <a
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
                >
                  {c.cite} ↗
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500 leading-relaxed">
            我是 CSCS 肌力與體能訓練專家，不是醫師。這頁是我自己會加驗的清單與研究整理，不是診斷、也不是要你不看醫生。
            該驗哪些、數字怎麼解讀，請跟你的醫師討論。
          </p>
        </section>

        {/* CTA */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">驗完之後，數字怎麼串起來看？</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-5">
            血檢只是其中一塊。免費體驗一次系統分析，看看血檢、訓練、營養、體組成怎麼互相牽動。
          </p>
          <Link
            href="/diagnosis"
            onClick={() => trackEvent('cta_click', { source: 'tools_blood', destination: 'diagnosis' })}
            className="inline-block bg-primary-600 hover:bg-primary-700 transition-colors text-white font-bold px-8 py-4 rounded-xl"
          >
            免費體驗系統分析
          </Link>
        </section>
      </div>
    </div>
  )
}
