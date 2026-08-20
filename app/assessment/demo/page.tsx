/**
 * 入會體測報告 —— DEMO 版（固定資料，不接資料庫）。
 *
 * 給 Howard 看「產品長什麼樣」用的（2026-08-20：「我想先知道你說的產品為何」）。
 * 數據取自他 2026-08-15 拍的真實 ACCUNIQ 報表，**已去除身分識別**。
 *
 * 這一頁要取代的東西：現在會員做完體測拿到的那張機器印的紙。
 * 那張紙每間健身房都一樣、會員看不懂、要靠教練嘴巴解釋 ——
 * 而嘴巴的品質等於教練資歷，那正是菜鳥賣不動教練課的原因。
 *
 * 設計原則：
 * 1. **一句話結論在最上面** —— 會員只記得住一件事，那件事必須是對的那件
 * 2. 三個數字，不是二十個（機器給二十個，那是它賣不動的原因）
 * 3. 每個數字都要說「所以呢」，不能只是報數
 * 4. 合規：全程不用診斷語言，健康指標只說「參考值」與「建議諮詢」
 */
import Link from 'next/link'

// ── 來自 OCR 的原始數據（demo 固定值）──
const D = {
  measuredAt: '2026-08-15',
  gender: '男性', age: 35, height: 175,
  weight: 75.8, bodyFatPct: 21.0, fatMass: 15.9, leanMass: 59.9,
  skeletalMuscle: 33.5, smi: 8.16, bmi: 24.8,
  waistCm: 94, whr: 0.90, visceralArea: 83, visceralLevel: 8,
  bmr: 1664,
  trunkFat: 8.40, limbFat: 6.17,
  segMuscle: { 軀幹: 26.40, 左臂: 3.37, 右臂: 3.40, 左腿: 9.11, 右腿: 9.12 },
}

// ── 引擎算出來的建議 ──
const P = {
  tdee: 2355,          // Mifflin 1682 × 1.4
  calories: 1950,      // 赤字 405
  protein: 152, fat: 61, carbs: 198,
  targetWeight: 71.8,  // 12 週
  targetFatPct: 16.5,
  ratePerWeek: 0.34,
  weeks: 12,
}

function Stat({ label, value, unit, note, tone = 'neutral' }: {
  label: string; value: string; unit?: string; note?: string
  tone?: 'neutral' | 'watch' | 'good'
}) {
  const valueColor =
    tone === 'watch' ? 'text-amber-700' : tone === 'good' ? 'text-emerald-700' : 'text-gray-900'
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <p className="text-[11px] text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>
        {value}<span className="text-sm font-normal text-slate-400 ml-0.5">{unit}</span>
      </p>
      {note && <p className="text-[11px] text-slate-500 mt-1 leading-snug">{note}</p>}
    </div>
  )
}

export default function AssessmentDemoPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">

        {/* 表頭 */}
        <div>
          <p className="text-[11px] text-slate-400 tabular-nums">體測日期 {D.measuredAt}</p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">你的身體現況</h1>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {D.gender} · {D.age} 歲 · {D.height} cm · {D.weight} kg
          </p>
        </div>

        {/* ① 一句話結論 —— 會員只會記得住一件事 */}
        <div className="bg-white border-l-4 border-l-primary-600 border border-slate-200 rounded-2xl p-5">
          <p className="text-[11px] text-slate-400 mb-1.5">一句話</p>
          <p className="text-lg font-bold text-gray-900 leading-snug">
            你的肌肉量是夠的 —— 要處理的是<span className="text-primary-600">集中在肚子的那 8.4 公斤脂肪</span>。
          </p>
          <p className="text-sm text-slate-600 mt-2.5 leading-relaxed">
            你全身有 {D.fatMass} 公斤脂肪，其中 <b className="tabular-nums">{D.trunkFat} 公斤在軀幹</b> ——
            佔了 53%。四肢加起來才 {D.limbFat} 公斤。
            所以你看起來「還好」但腰圍下不去，不是錯覺。
          </p>
        </div>

        {/* ② 三個數字（不是二十個）*/}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">這次量出來，三個要看的數字</p>
          <div className="grid grid-cols-1 gap-2.5">
            <Stat
              label="腹圍" value={String(D.waistCm)} unit="cm" tone="watch"
              note={`男性一般以 90 cm 為參考線，你高出 4 cm。這個數字比體重更值得追 —— 它掉下來的時候，衣服會先有感覺。`}
            />
            <Stat
              label="體脂率" value={String(D.bodyFatPct)} unit="%" tone="watch"
              note="男性 15% 以下屬精瘦、20% 上下是一般範圍。你不算超標，但脂肪的位置不理想。"
            />
            <Stat
              label="骨骼肌重" value={String(D.skeletalMuscle)} unit="kg" tone="good"
              note={`SMI ${D.smi}，落在標準範圍，軀幹肌肉甚至高於標準。這是好消息 —— 你不用增肌，減脂時保住它就好。`}
            />
          </div>
        </div>

        {/* ③ 三個月能到哪 —— 有數字才有說服力 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-[11px] text-slate-400 mb-2">{P.weeks} 週之後</p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold text-gray-900 tabular-nums">{D.weight}</span>
            <span className="text-slate-400">→</span>
            <span className="text-2xl font-bold text-primary-600 tabular-nums">{P.targetWeight}</span>
            <span className="text-sm text-slate-400">kg</span>
            <span className="text-xs text-slate-400 ml-1 tabular-nums">
              （體脂 {D.bodyFatPct}% → {P.targetFatPct}%）
            </span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            一週 {P.ratePerWeek} 公斤，慢到你不會覺得在節食。
            這個速度掉的幾乎都是脂肪 —— 掉太快的話肌肉會跟著走，
            而你現在的肌肉量正是不需要犧牲的東西。
          </p>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500 leading-relaxed">
              <b className="text-slate-700">同時腹圍會從 {D.waistCm} 往 90 以下走。</b>
              {' '}那是這次體測真正的目標，體重只是它的副產品。
            </p>
          </div>
        </div>

        {/* ④ 每天吃什麼 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-[11px] text-slate-400 mb-2.5">每天吃這些</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              ['熱量', P.calories, 'kcal'],
              ['蛋白質', P.protein, 'g'],
              ['碳水', P.carbs, 'g'],
              ['脂肪', P.fat, 'g'],
            ].map(([l, v, u]) => (
              <div key={l as string} className="bg-slate-50 rounded-xl px-2 py-2.5 text-center">
                <p className="text-[10px] text-slate-400">{l}</p>
                <p className="text-base font-bold text-gray-900 tabular-nums leading-tight mt-0.5">{v}</p>
                <p className="text-[10px] text-slate-400">{u}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            你的基礎代謝 <b className="tabular-nums">{D.bmr}</b>、日常消耗約 <b className="tabular-nums">{P.tdee}</b>。
            每天少吃約 400 大卡 —— 那大概是一杯手搖加一份消夜的量，不是叫你餓肚子。
          </p>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            蛋白質 {P.protein} 克是這四個數字裡<b>最重要的一個</b>：
            減脂期蛋白吃不夠，掉的體重會有一半是肌肉。
          </p>
        </div>

        {/* ⑤ 怎麼練 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-[11px] text-slate-400 mb-2.5">怎麼練</p>
          <ul className="space-y-2.5 text-sm text-slate-600">
            <li className="flex gap-2.5">
              <span className="text-primary-600 font-bold shrink-0">1</span>
              <span><b className="text-gray-900">一週兩到三次重訓，全身。</b>
                你的目的是「減脂時保住 {D.skeletalMuscle} 公斤肌肉」，不是長更多。
                全身分化每個部位一週練到兩次，比分部位有效率。</span>
            </li>
            <li className="flex gap-2.5">
              <span className="text-primary-600 font-bold shrink-0">2</span>
              <span><b className="text-gray-900">重量不要退。</b>
                熱量在赤字的時候，如果連重量都掉，身體就沒有理由留住肌肉。</span>
            </li>
            <li className="flex gap-2.5">
              <span className="text-primary-600 font-bold shrink-0">3</span>
              <span><b className="text-gray-900">想加消耗就加走路，不要拿掉重訓。</b>
                有氧幫你花熱量，重訓幫你保住肌肉 —— 兩件不同的事。</span>
            </li>
          </ul>
        </div>

        {/* ⑥ 你的肌肉分佈（證明「肌肉夠」不是空話）*/}
        <details className="bg-white border border-slate-200 rounded-2xl p-5">
          <summary className="cursor-pointer text-sm font-medium text-gray-800 select-none">
            看你的肌肉分佈
          </summary>
          <div className="mt-3 space-y-1.5">
            {Object.entries(D.segMuscle).map(([part, kg]) => (
              <div key={part} className="flex items-baseline justify-between text-sm">
                <span className="text-slate-600">{part}</span>
                <span className="tabular-nums text-gray-900">{kg} kg</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
            左右差距都在 1% 以內，代表沒有明顯的代償或不平衡。
            軀幹 {D.segMuscle.軀幹} 公斤高於同身高的標準範圍。
          </p>
        </details>

        {/* ⑦ CTA —— 教練不用會賣，數字已經賣完了 */}
        <div className="bg-primary-600 rounded-2xl p-5 text-white">
          <p className="text-base font-bold leading-snug">
            這份計畫要有人幫你盯數字嗎？
          </p>
          <p className="text-sm text-white/80 mt-2 leading-relaxed">
            上面的數字是系統依你這次體測算的。真正難的不是知道要做什麼，
            是十二週之後還在做 —— 那是教練的工作。
          </p>
          <Link
            href="/join"
            className="mt-4 block text-center bg-white text-primary-700 text-sm font-bold py-3 rounded-xl"
          >
            我想了解教練課
          </Link>
        </div>

        {/* 合規聲明 */}
        <p className="text-[11px] text-slate-400 leading-relaxed pb-6">
          本報告依據體組成分析儀的量測值與一般族群參考範圍產生，屬健康與體態管理建議，
          不是醫療診斷、也不能取代醫療專業評估。若你有慢性疾病、規則服藥、懷孕哺乳或近期手術，
          開始任何飲食或訓練計畫前請先諮詢醫師或營養師。
          體組成量測值會受水分、進食與量測時間影響，單次數值僅供參考，趨勢比單點更有意義。
        </p>
      </div>
    </main>
  )
}
