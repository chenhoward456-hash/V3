'use client'

import { useState, useEffect } from 'react'
import { EXPERIMENTS, forceVariant, clearVariant, peekVariant } from '@/lib/ab-testing'

export default function ExperimentsPage() {
  // Track which variant is currently stored for each experiment
  const [currentVariants, setCurrentVariants] = useState<Record<string, string | null>>({})
  // Track the forced-variant select value per experiment
  const [selectedForce, setSelectedForce] = useState<Record<string, string>>({})
  // Toast-style confirmation message
  const [toast, setToast] = useState<string | null>(null)

  // Read current assignments from localStorage on mount
  useEffect(() => {
    const entries: Record<string, string | null> = {}
    for (const expId of Object.keys(EXPERIMENTS)) {
      entries[expId] = peekVariant(expId)
    }
    setCurrentVariants(entries)
  }, [])

  function handleForce(experimentId: string) {
    const variant = selectedForce[experimentId]
    if (!variant) return
    forceVariant(experimentId, variant)
    setCurrentVariants(prev => ({ ...prev, [experimentId]: variant }))
    setToast(`"${experimentId}" forced to "${variant}". Reload the relevant page to see the change.`)
    setTimeout(() => setToast(null), 4000)
  }

  function handleClear(experimentId: string) {
    clearVariant(experimentId)
    setCurrentVariants(prev => ({ ...prev, [experimentId]: null }))
    setToast(`"${experimentId}" cleared. Next visit will re-roll a variant.`)
    setTimeout(() => setToast(null), 4000)
  }

  const experiments = Object.values(EXPERIMENTS)

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-900 mb-1">A/B Experiments</h1>
        <p className="text-sm text-gray-500 mb-8">
          Lightweight client-side A/B testing. All analytics flow through GA4.
        </p>

        {/* Toast */}
        {toast && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3">
            {toast}
          </div>
        )}

        {/* Experiment cards */}
        <div className="space-y-6">
          {experiments.map(exp => {
            const current = currentVariants[exp.id]
            return (
              <div
                key={exp.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* Title bar */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 font-mono">{exp.id}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {exp.variants.length} variants
                      {exp.weights
                        ? ` (weights: ${exp.weights.join(', ')})`
                        : ' (equal split)'}
                    </p>
                  </div>
                  {current && (
                    <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                      current: {current}
                    </span>
                  )}
                  {!current && (
                    <span className="text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                      not assigned
                    </span>
                  )}
                </div>

                {/* Variants */}
                <div className="px-5 py-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                    Variants
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {exp.variants.map(v => (
                      <span
                        key={v}
                        className={`text-xs px-3 py-1 rounded-full border ${
                          current === v
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {v}
                      </span>
                    ))}
                  </div>

                  {/* Force variant controls */}
                  <div className="flex items-center gap-2">
                    <select
                      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedForce[exp.id] || ''}
                      onChange={e =>
                        setSelectedForce(prev => ({ ...prev, [exp.id]: e.target.value }))
                      }
                    >
                      <option value="" disabled>
                        Select variant...
                      </option>
                      {exp.variants.map(v => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleForce(exp.id)}
                      disabled={!selectedForce[exp.id]}
                      className="text-sm font-semibold bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Force
                    </button>
                    <button
                      onClick={() => handleClear(exp.id)}
                      className="text-sm font-medium text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-red-200 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* GA4 instructions */}
        <div className="mt-10 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-3">How to check results in GA4</h2>
          <ol className="space-y-3 text-sm text-gray-700 list-decimal list-inside">
            <li>
              Go to <strong>GA4 &rarr; Explore &rarr; Free-form</strong>.
            </li>
            <li>
              Add a segment filtered by <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">event_name = ab_exposure</code> or{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">event_name = ab_conversion</code>.
            </li>
            <li>
              Add <strong>Dimensions</strong>:{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">experiment</code>,{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">variant</code>,{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">action</code> (for conversions).
            </li>
            <li>
              Add <strong>Metrics</strong>: Event count.
            </li>
            <li>
              Compare conversion rates across variants:{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                conversions / exposures
              </code>{' '}
              per variant.
            </li>
          </ol>

          <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <strong>Tip:</strong> Register{' '}
            <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">experiment</code>,{' '}
            <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">variant</code>, and{' '}
            <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">action</code> as custom
            dimensions in GA4 &rarr; Admin &rarr; Custom definitions so they appear in standard
            reports.
          </div>
        </div>

        {/* Quick reference */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-3">Quick reference: GA4 events</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="pb-2 pr-4">Event</th>
                  <th className="pb-2 pr-4">Parameters</th>
                  <th className="pb-2">When fired</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr className="border-t border-gray-100">
                  <td className="py-2 pr-4 font-mono text-xs">ab_exposure</td>
                  <td className="py-2 pr-4 text-xs">experiment, variant</td>
                  <td className="py-2 text-xs">Component mounts (once per page load)</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="py-2 pr-4 font-mono text-xs">ab_conversion</td>
                  <td className="py-2 pr-4 text-xs">experiment, variant, action</td>
                  <td className="py-2 text-xs">User performs target action (e.g. click upgrade)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
