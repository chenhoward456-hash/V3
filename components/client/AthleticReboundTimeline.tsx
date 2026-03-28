'use client'

import { Trophy, Droplets, Zap, Utensils } from 'lucide-react'

interface AthleticReboundTimelineProps {
  /** 秤重到比賽的間距（小時） */
  gapHours: number
  /** 策略類型 */
  strategy: 'short' | 'medium' | 'long'
  /** 每小時補水量 (mL) */
  waterPerHour: number
  /** 體重 (kg) - 用於計算碳水量 */
  bodyWeight: number
}

interface TimelinePhase {
  label: string
  timeRange: string
  icon: React.ReactNode
  items: string[]
  highlight?: boolean
  color: {
    bg: string
    border: string
    text: string
    iconBg: string
  }
}

const strategyLabels: Record<string, string> = {
  short: '短間距（< 6 小時）',
  medium: '中間距（6-18 小時）',
  long: '長間距（> 18 小時）',
}

export default function AthleticReboundTimeline({
  gapHours,
  strategy,
  waterPerHour,
  bodyWeight,
}: AthleticReboundTimelineProps) {
  const phases: TimelinePhase[] = buildPhases(strategy, gapHours, waterPerHour, bodyWeight)

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
          <Zap size={20} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">超補償時間軸</h2>
          <p className="text-xs text-gray-500">
            秤重 → 比賽間距 {gapHours} 小時 · {strategyLabels[strategy]}
          </p>
        </div>
      </div>

      {/* Strategy summary */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-indigo-500 mb-0.5">補水速率</p>
            <p className="text-sm font-bold text-indigo-700">{waterPerHour} mL/hr</p>
          </div>
          <div>
            <p className="text-[10px] text-indigo-500 mb-0.5">碳水目標</p>
            <p className="text-sm font-bold text-indigo-700">
              {strategy === 'short' ? `${(bodyWeight * 1.2).toFixed(0)}g/hr` : strategy === 'medium' ? `${(bodyWeight * 8).toFixed(0)}g` : `${(bodyWeight * 10).toFixed(0)}g`}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-indigo-500 mb-0.5">間距時間</p>
            <p className="text-sm font-bold text-indigo-700">{gapHours}h</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-indigo-100" />

        <div className="space-y-3">
          {phases.map((phase, idx) => (
            <div key={idx} className="relative flex gap-3">
              {/* Node */}
              <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${phase.color.iconBg} ${phase.highlight ? 'ring-2 ring-indigo-400 shadow-md' : ''}`}>
                {phase.icon}
              </div>

              {/* Content */}
              <div className={`flex-1 rounded-xl px-4 py-3 border ${phase.color.bg} ${phase.color.border}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className={`text-xs font-bold ${phase.color.text}`}>{phase.label}</p>
                  <span className="text-[10px] text-gray-400">{phase.timeRange}</span>
                </div>
                <div className="space-y-1">
                  {phase.items.map((item, i) => (
                    <p key={i} className="text-[11px] text-gray-600 leading-relaxed">
                      • {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* References */}
      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
        <p className="text-[10px] text-gray-500 leading-relaxed">
          參考文獻：Reale et al. 2017（格鬥運動快速減重恢復）、Artioli et al. 2016（格鬥運動體重管理）、Thomas et al. 2016（ACSM 運動營養）。此計畫僅供參考，請在教練監督下執行。
        </p>
      </div>
    </div>
  )
}

function buildPhases(
  strategy: 'short' | 'medium' | 'long',
  gapHours: number,
  waterPerHour: number,
  bodyWeight: number,
): TimelinePhase[] {
  const droplets = <Droplets size={18} className="text-blue-600" />
  const utensils = <Utensils size={18} className="text-orange-600" />
  const zap = <Zap size={18} className="text-indigo-600" />
  const trophy = <Trophy size={18} className="text-amber-600" />

  if (strategy === 'short') {
    // < 6 hours: liquid carbs only, aggressive rehydration
    return [
      {
        label: '過磅完成',
        timeRange: 'T+0',
        icon: zap,
        highlight: true,
        items: [
          '立即開始補水：電解質飲料（含鈉 500-700mg/L）',
          `補水速率：${waterPerHour} mL/小時`,
          `液態碳水：${(bodyWeight * 1.2).toFixed(0)}g/小時（運動飲料、果汁、蜂蜜水）`,
          '避免固體食物 — 消化時間不夠',
        ],
        color: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'bg-blue-100' },
      },
      {
        label: '持續補充',
        timeRange: `T+1h → T+${Math.max(gapHours - 1, 1)}h`,
        icon: droplets,
        items: [
          '每 15-20 分鐘小口補水',
          '持續攝取液態碳水（稀釋運動飲料）',
          '監測排尿：目標淺黃色',
        ],
        color: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', iconBg: 'bg-cyan-100' },
      },
      {
        label: '比賽',
        timeRange: `T+${gapHours}h`,
        icon: trophy,
        items: [
          '賽前 30 分鐘：最後一口水 + 少量高 GI 碳水',
          `目標恢復體重 ${(bodyWeight * 0.02).toFixed(1)}-${(bodyWeight * 0.04).toFixed(1)}kg（部分恢復即可）`,
        ],
        color: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', iconBg: 'bg-amber-100' },
      },
    ]
  }

  if (strategy === 'medium') {
    // 6-18 hours: structured feeding + rehydration
    return [
      {
        label: '過磅完成 — 立即補水',
        timeRange: 'T+0',
        icon: droplets,
        highlight: true,
        items: [
          `補水速率：${waterPerHour} mL/小時（前 6 小時）`,
          '電解質飲料（鈉 500-700mg/L、鉀 200mg/L）',
          '第一餐：液態碳水 + 電解質（果汁、運動飲料）',
        ],
        color: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'bg-blue-100' },
      },
      {
        label: '結構化進食',
        timeRange: 'T+1h → T+6h',
        icon: utensils,
        items: [
          `總碳水目標：${(bodyWeight * 8).toFixed(0)}g（分 4-5 餐）`,
          '選擇高 GI 碳水：白飯、白麵包、馬鈴薯泥',
          '蛋白質：1.5-2.0 g/kg（雞胸、蛋白）',
          '低脂（< 0.5g/kg）、低纖（< 10g）— 加速消化',
        ],
        color: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', iconBg: 'bg-orange-100' },
      },
      {
        label: '持續補充 + 休息',
        timeRange: `T+6h → T+${Math.max(gapHours - 2, 8)}h`,
        icon: zap,
        items: [
          '每 2-3 小時進食一次',
          '補水速率降至 300-400 mL/小時',
          '儘量休息和睡眠',
        ],
        color: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', iconBg: 'bg-indigo-100' },
      },
      {
        label: '賽前準備',
        timeRange: `T+${Math.max(gapHours - 2, 8)}h → 比賽`,
        icon: trophy,
        items: [
          '賽前 3 小時：最後一餐（高碳水、低脂、低纖）',
          '賽前 1 小時：少量高 GI 碳水 + 200mg 咖啡因（可選）',
          `目標恢復體重 ${(bodyWeight * 0.04).toFixed(1)}-${(bodyWeight * 0.06).toFixed(1)}kg`,
        ],
        color: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', iconBg: 'bg-amber-100' },
      },
    ]
  }

  // Long gap (>18h): full carb loading
  return [
    {
      label: '過磅完成 — 立即補水',
      timeRange: 'T+0',
      icon: droplets,
      highlight: true,
      items: [
        `補水速率：${waterPerHour} mL/小時（前 6 小時）`,
        '電解質飲料（鈉 500-700mg/L）',
        '第一餐以液態碳水為主',
      ],
      color: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'bg-blue-100' },
    },
    {
      label: '全面碳水超補',
      timeRange: 'T+1h → T+12h',
      icon: utensils,
      items: [
        `總碳水目標：${(bodyWeight * 10).toFixed(0)}g（分 5-6 餐）`,
        '選擇高 GI 碳水：白飯、白吐司、年糕、馬鈴薯泥',
        '蛋白質：1.8 g/kg',
        '脂肪最低（< 0.5g/kg）— 加速胃排空',
        '鈉攝取 3000mg — 協助糖原+水分超補（SGLT-1 協同運輸）',
      ],
      color: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', iconBg: 'bg-orange-100' },
    },
    {
      label: '休息與恢復',
      timeRange: 'T+12h → T+18h',
      icon: zap,
      items: [
        '繼續少量進食（每 3 小時一餐）',
        '補水速率降至自然口渴即飲',
        '充分睡眠 — 最少 7-8 小時',
        '監測體重恢復進度',
      ],
      color: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', iconBg: 'bg-indigo-100' },
    },
    {
      label: '賽前準備',
      timeRange: `T+${Math.max(gapHours - 3, 18)}h → 比賽`,
      icon: trophy,
      items: [
        '賽前 3-4 小時：最後正餐（碳水 2-3g/kg、低脂低纖）',
        '賽前 1 小時：少量高 GI 碳水 + 200mg 咖啡因（可選）',
        `目標恢復體重 ${(bodyWeight * 0.05).toFixed(1)}-${(bodyWeight * 0.08).toFixed(1)}kg`,
        '不要嘗試新食物 — 只吃訓練時驗證過的東西',
      ],
      color: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', iconBg: 'bg-amber-100' },
    },
  ]
}
