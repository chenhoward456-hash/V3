'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  clientId: string  // unique_code or uuid
  onAccepted?: () => void
}

export default function ConsentGate({ clientId, onAccepted }: Props) {
  const [needsAccept, setNeedsAccept] = useState(false)
  const [checking, setChecking] = useState(true)
  const [checked, setChecked] = useState({
    terms: false,
    privacy: false,
    health_disclaimer: false,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch(`/api/consent?clientId=${encodeURIComponent(clientId)}`)
        const json = await res.json()
        if (cancelled) return
        if (json.success && !json.allAccepted) {
          setNeedsAccept(true)
        } else {
          setNeedsAccept(false)
          onAccepted?.()
        }
      } catch {
        // silent: not blocking app
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [clientId, onAccepted])

  const allChecked = checked.terms && checked.privacy && checked.health_disclaimer

  const handleSubmit = async () => {
    if (!allChecked) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          types: ['terms', 'privacy', 'health_disclaimer'],
        }),
      })
      if (!res.ok) throw new Error('提交失敗')
      setNeedsAccept(false)
      onAccepted?.()
    } catch (err) {
      alert('儲存同意紀錄失敗，請重試')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking || !needsAccept) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">📋 使用本服務前的重要事項</h2>
          <p className="text-xs text-gray-500 mt-1">為了保護你的權益，請先閱讀並勾選以下三份文件。</p>
        </div>

        <div className="p-6 space-y-4">
          <ConsentRow
            checked={checked.terms}
            onChange={(v) => setChecked({ ...checked, terms: v })}
            label="我已閱讀並同意"
            docName="服務條款"
            docPath="/legal/terms"
          />
          <ConsentRow
            checked={checked.privacy}
            onChange={(v) => setChecked({ ...checked, privacy: v })}
            label="我已閱讀並同意"
            docName="隱私政策"
            docPath="/legal/privacy"
          />
          <ConsentRow
            checked={checked.health_disclaimer}
            onChange={(v) => setChecked({ ...checked, health_disclaimer: v })}
            label="我已閱讀並理解"
            docName="健康免責聲明"
            docPath="/legal/disclaimer"
            highlight
          />

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
            ⚠️ 健康免責聲明特別重要：本服務不是醫療，所有建議僅供參考，您必須自負後果。
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!allChecked || submitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 font-medium text-sm"
          >
            {submitting ? '儲存中…' : '確認並繼續'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConsentRow({
  checked, onChange, label, docName, docPath, highlight,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  docName: string
  docPath: string
  highlight?: boolean
}) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-colors ${
      checked
        ? 'border-emerald-300 bg-emerald-50'
        : highlight ? 'border-amber-300 bg-amber-50/30 hover:bg-amber-50' : 'border-gray-200 hover:bg-gray-50'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-4 h-4"
      />
      <div className="flex-1 text-sm">
        <span className="text-gray-700">{label}</span>
        <Link
          href={docPath}
          target="_blank"
          className="ml-1 text-blue-600 underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          《{docName}》
        </Link>
      </div>
    </label>
  )
}
