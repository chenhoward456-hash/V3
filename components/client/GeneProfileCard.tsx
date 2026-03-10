'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface GeneProfileCardProps {
  mthfr: string | null
  apoe: string | null
  serotonin: string | null  // gene_depression_risk: LL/SL/SS or low/moderate/high
  notes: string | null
  geneticCorrections?: { gene: string; rule: string; adjustment: string }[]
  clientId: string
  onMutate: () => void
}

const MTHFR_OPTIONS = [
  { value: '', label: '未檢測' },
  { value: 'normal', label: '正常' },
  { value: 'heterozygous', label: '雜合突變（C677T 或 A1298C）' },
  { value: 'homozygous', label: '純合突變（C677T）' },
]

const APOE_OPTIONS = [
  { value: '', label: '未檢測' },
  { value: 'e2/e2', label: 'e2/e2' },
  { value: 'e2/e3', label: 'e2/e3' },
  { value: 'e3/e3', label: 'e3/e3（最常見）' },
  { value: 'e3/e4', label: 'e3/e4（一個 e4）' },
  { value: 'e4/e4', label: 'e4/e4（高風險）' },
]

const SEROTONIN_OPTIONS = [
  { value: '', label: '未檢測' },
  { value: 'LL', label: 'LL（長/長）' },
  { value: 'SL', label: 'SL（短/長）' },
  { value: 'SS', label: 'SS（短/短）' },
]

// 基因型的風險提示文字
function getRiskHint(gene: string, value: string | null): string | null {
  if (!value) return null
  if (gene === 'mthfr') {
    if (value === 'heterozygous') return '葉酸代謝部分受損，建議補充活性葉酸（5-MTHF）'
    if (value === 'homozygous') return '葉酸代謝嚴重受損，必須補充活性葉酸，赤字期自動收窄'
  }
  if (gene === 'apoe') {
    if (value === 'e3/e4') return 'LDL-C 對飽和脂肪敏感度 2-3 倍，脂肪來源需注意'
    if (value === 'e4/e4') return '心血管高風險，飽和脂肪嚴格限制，優先 MUFA/MCT'
  }
  if (gene === 'serotonin') {
    if (value === 'SL' || value === 'moderate') return '血清素回收中等受損，碳水不宜過低'
    if (value === 'SS' || value === 'high') return '血清素回收效率最差，碳水下限提高，Peak Week 耗竭縮短'
  }
  return null
}

export default function GeneProfileCard({
  mthfr, apoe, serotonin, notes,
  geneticCorrections,
  clientId, onMutate,
}: GeneProfileCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [formMthfr, setFormMthfr] = useState(mthfr || '')
  const [formApoe, setFormApoe] = useState(apoe || '')
  const [formSerotonin, setFormSerotonin] = useState(serotonin || '')
  const [formNotes, setFormNotes] = useState(notes || '')

  const hasAnyGene = !!(mthfr || apoe || serotonin)
  const activeCorrections = geneticCorrections?.filter(gc => gc.adjustment) || []

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          gene_mthfr: formMthfr || null,
          gene_apoe: formApoe || null,
          gene_depression_risk: formSerotonin || null,
          gene_notes: formNotes || null,
        }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error || '儲存失敗')
      }
      await onMutate()
      setEditing(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '儲存失敗，請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🧬</span>
          <span className="font-semibold text-gray-900">基因檔案</span>
          {hasAnyGene && (
            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
              已設定
            </span>
          )}
          {!hasAnyGene && (
            <span className="text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">
              未填寫
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Active corrections summary (show even when collapsed if has corrections) */}
      {!expanded && activeCorrections.length > 0 && (
        <div className="px-4 pb-3 -mt-1">
          <div className="text-xs text-purple-600 space-y-0.5">
            {activeCorrections.slice(0, 2).map((gc, i) => (
              <div key={i}>🧬 {gc.rule}</div>
            ))}
            {activeCorrections.length > 2 && (
              <div className="text-gray-400">+{activeCorrections.length - 2} 項修正</div>
            )}
          </div>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50">
          {!editing ? (
            // View mode
            <div className="pt-3 space-y-3">
              <div className="grid grid-cols-1 gap-2">
                <GeneRow label="MTHFR" value={mthfr} options={MTHFR_OPTIONS} gene="mthfr" />
                <GeneRow label="APOE" value={apoe} options={APOE_OPTIONS} gene="apoe" />
                <GeneRow label="5-HTTLPR" value={serotonin} options={SEROTONIN_OPTIONS} gene="serotonin" />
                {notes && (
                  <div className="text-xs text-gray-500 mt-1">備註：{notes}</div>
                )}
              </div>

              {/* Genetic corrections display */}
              {activeCorrections.length > 0 && (
                <div className="bg-purple-50 rounded-xl p-3 space-y-1.5">
                  <div className="text-xs font-medium text-purple-700">系統已套用的基因修正：</div>
                  {activeCorrections.map((gc, i) => (
                    <div key={i} className="text-xs text-purple-600">
                      • {gc.adjustment}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setEditing(true)}
                className="w-full py-2 text-sm text-purple-600 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors"
              >
                {hasAnyGene ? '修改基因資料' : '填寫基因檢測結果'}
              </button>
            </div>
          ) : (
            // Edit mode
            <div className="pt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">MTHFR 葉酸代謝基因</label>
                <select
                  value={formMthfr}
                  onChange={(e) => setFormMthfr(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  {MTHFR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {formMthfr && getRiskHint('mthfr', formMthfr) && (
                  <p className="text-xs text-purple-500 mt-1">{getRiskHint('mthfr', formMthfr)}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">APOE 脂質代謝基因</label>
                <select
                  value={formApoe}
                  onChange={(e) => setFormApoe(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  {APOE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {formApoe && getRiskHint('apoe', formApoe) && (
                  <p className="text-xs text-purple-500 mt-1">{getRiskHint('apoe', formApoe)}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">5-HTTLPR 血清素轉運體基因</label>
                <select
                  value={formSerotonin}
                  onChange={(e) => setFormSerotonin(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  {SEROTONIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {formSerotonin && getRiskHint('serotonin', formSerotonin) && (
                  <p className="text-xs text-purple-500 mt-1">{getRiskHint('serotonin', formSerotonin)}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">備註</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="其他基因資訊..."
                  maxLength={500}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-600">{saveError}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(false); setSaveError('') }}
                  className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 text-sm text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {saving ? '儲存中...' : '儲存'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Sub-component: display a single gene row in view mode
function GeneRow({ label, value, options, gene }: {
  label: string
  value: string | null
  options: { value: string; label: string }[]
  gene: string
}) {
  const displayLabel = options.find(o => o.value === value)?.label || '未檢測'
  const hint = getRiskHint(gene, value)
  const hasRisk = !!hint

  return (
    <div className="flex items-start justify-between py-1">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <div className="text-right">
        <span className={`text-xs font-medium ${hasRisk ? 'text-purple-700' : value ? 'text-gray-700' : 'text-gray-400'}`}>
          {displayLabel}
        </span>
        {hint && <div className="text-[10px] text-purple-500 mt-0.5 max-w-[200px]">{hint}</div>}
      </div>
    </div>
  )
}
