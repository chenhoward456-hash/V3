'use client'

interface QuickActionsProps {
  enabledSections: { id: string; icon: string; label: string; completed: boolean }[]
  onNavigate: (sectionId: string) => void
}

export default function QuickActions({ enabledSections, onNavigate }: QuickActionsProps) {
  const uncompleted = enabledSections.filter(s => !s.completed)

  if (enabledSections.length === 0) return null

  // All done
  if (uncompleted.length === 0) {
    return (
      <div className="mb-3 px-4 py-3 bg-green-50 border border-green-200 rounded-2xl text-center">
        <p className="text-sm font-semibold text-green-700">
          All done for today!
        </p>
      </div>
    )
  }

  return (
    <div className="mb-3 overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 px-1 pb-1">
        {uncompleted.map(section => (
          <button
            key={section.id}
            onClick={() => onNavigate(section.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors shadow-sm"
          >
            <span>{section.icon}</span>
            <span className="whitespace-nowrap">{section.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
