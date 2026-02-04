'use client'

import { useState } from 'react'

interface MetricCardProps {
  title: string
  current: number
  target: number
  unit: string
  status: 'red' | 'yellow' | 'green'
  emoji: string
  description: string
}

export function MetricCard({ title, current, target, unit, status, emoji, description }: MetricCardProps) {
  const progress = (current / target) * 100
  
  const statusColors = {
    red: 'border-red-200 bg-red-50',
    yellow: 'border-yellow-200 bg-yellow-50',
    green: 'border-green-200 bg-green-50'
  }

  return (
    <div className={`border rounded-xl p-4 ${statusColors[status]}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-gray-900">{title}</h3>
        <span className="text-2xl">{emoji}</span>
      </div>
      
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-light text-gray-900">{current}</span>
          <span className="text-sm text-gray-500">/ {target} {unit}</span>
        </div>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-500 ${
              status === 'green' ? 'bg-green-500' : 
              status === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
      
      <p className="text-xs text-gray-600">{description}</p>
    </div>
  )
}

interface TaskButtonProps {
  name: string
  dosage: string
  timing: string
  completed: boolean
  onComplete: () => void
}

export function TaskButton({ name, dosage, timing, completed, onComplete }: TaskButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  const handleClick = () => {
    if (completed) return
    
    setIsAnimating(true)
    onComplete()
    
    setTimeout(() => {
      setIsAnimating(false)
    }, 600)
  }

  return (
    <button
      onClick={handleClick}
      disabled={completed}
      className={`relative p-4 rounded-xl border transition-all duration-300 ${
        completed 
          ? 'bg-green-50 border-green-200 cursor-not-allowed' 
          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
      } ${isAnimating ? 'scale-95' : 'scale-100'}`}
    >
      {completed && (
        <div className="absolute top-2 right-2">
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      
      <div className="text-left">
        <h4 className={`font-medium text-sm ${completed ? 'text-green-700' : 'text-gray-900'}`}>
          {name}
        </h4>
        <p className="text-xs text-gray-500 mt-1">{dosage}</p>
        <p className="text-xs text-gray-400">{timing}</p>
      </div>
      
      {isAnimating && (
        <div className="absolute inset-0 bg-green-500 rounded-xl opacity-20 animate-ping" />
      )}
    </button>
  )
}

interface ProgressChartProps {
  metrics: any[]
}

export function ProgressChart({ metrics }: ProgressChartProps) {
  return (
    <div className="space-y-4">
      {metrics.map((metric) => (
        <div key={metric.id} className="flex items-center gap-4">
          <div className="w-24 text-sm text-gray-600 font-medium">
            {metric.name}
          </div>
          <div className="flex-1">
            <div className="h-8 bg-gray-100 rounded-lg relative overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 relative"
                style={{ width: '100%' }}
              >
                <div 
                  className="absolute top-0 left-0 h-full bg-white border-r-2 border-gray-800"
                  style={{ left: `${(metric.current / metric.target) * 100}%` }}
                />
                <div 
                  className="absolute top-0 left-0 h-full w-0.5 bg-gray-800"
                  style={{ left: '80%' }}
                />
              </div>
            </div>
          </div>
          <div className="w-16 text-right">
            <div className="text-sm font-medium text-gray-900">
              {metric.current}
            </div>
            <div className="text-xs text-gray-500">
              / {metric.target}
            </div>
          </div>
        </div>
      ))}
      
      <div className="flex items-center gap-6 mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-xs text-gray-600">需改善</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <span className="text-xs text-gray-600">接近目標</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-xs text-gray-600">達標</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-800 rounded-full"></div>
          <span className="text-xs text-gray-600">目標線</span>
        </div>
      </div>
    </div>
  )
}
