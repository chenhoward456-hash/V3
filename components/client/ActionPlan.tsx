'use client'

interface ActionPlanProps {
  healthGoals?: string
  nextCheckupDate?: string
  coachSummary?: string
  topSupplements?: { name: string }[]
}

export default function ActionPlan({ healthGoals, nextCheckupDate, coachSummary, topSupplements }: ActionPlanProps) {
  const hasAny = !!healthGoals || !!nextCheckupDate || !!coachSummary

  if (!hasAny) {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-20">
        <p className="text-gray-600">持續追蹤中，有問題隨時 LINE 我！— Howard 教練</p>
      </div>
    )
  }

  const checkupDate = nextCheckupDate ? new Date(nextCheckupDate) : null
  const isOverdue = checkupDate ? checkupDate < new Date() : false

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-20">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 你的行動計畫</h2>
      <div className="space-y-3">
        {healthGoals && (
          <div className="flex items-start">
            <span className="mr-2 flex-shrink-0">🎯</span>
            <p className="text-sm text-gray-700">
              <span className="font-medium">目標：</span>{healthGoals}
            </p>
          </div>
        )}
        {nextCheckupDate && (
          <div className="flex items-start">
            <span className="mr-2 flex-shrink-0">📅</span>
            <p className="text-sm text-gray-700">
              <span className="font-medium">下次回檢：</span>
              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                {checkupDate!.toLocaleDateString('zh-TW')}
                {isOverdue && ' （已逾期）'}
              </span>
            </p>
          </div>
        )}
        {topSupplements && topSupplements.length > 0 && (
          <div className="flex items-start">
            <span className="mr-2 flex-shrink-0">💊</span>
            <p className="text-sm text-gray-700">
              <span className="font-medium">今日重點：</span>
              {topSupplements.map(s => s.name).join('、')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
