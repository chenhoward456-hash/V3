'use client'

import { useState } from 'react'

export default function RichMenuUpload() {
  const [marketingFile, setMarketingFile] = useState<File | null>(null)
  const [memberFile, setMemberFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleUpload() {
    if (!marketingFile && !memberFile) return
    setStatus('uploading')
    setMessage('上傳中，伺服器壓縮處理...')

    try {
      const formData = new FormData()
      if (marketingFile) formData.append('marketingImage', marketingFile)
      if (memberFile) formData.append('memberImage', memberFile)

      const res = await fetch('/api/line/richmenu', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setStatus('success')
        const lines = ['Rich Menu 設定完成！']
        if (data.marketingMenuId) lines.push(`行銷版 ID: ${data.marketingMenuId} (${data.marketingStatus})`)
        if (data.memberMenuId) lines.push(`學員版 ID: ${data.memberMenuId} (${data.memberStatus})`)
        setMessage(lines.join('\n'))
      } else {
        setStatus('error')
        setMessage(`失敗：${JSON.stringify(data, null, 2)}`)
      }
    } catch (err) {
      setStatus('error')
      setMessage(`錯誤：${err}`)
    }
  }

  const hasFile = marketingFile || memberFile

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      padding: '24px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Rich Menu 管理</h1>
      <p style={{ color: '#888', marginBottom: '24px', fontSize: '14px' }}>
        上傳 2500x1686 的圖片，系統會自動建立兩套 Rich Menu
      </p>

      {/* 行銷版 */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '8px' }}>
          行銷版（預設 — 新用戶/未綁定看到）
        </h2>
        <p style={{ color: '#666', fontSize: '12px', marginBottom: '8px' }}>
          按鈕：免費教學 | 免費評估 | 線上方案 | 實體教練課 | 關於我們 | 聯繫客服
        </p>
        <label style={{
          display: 'block',
          padding: '30px 20px',
          border: '2px dashed #333',
          borderRadius: '12px',
          textAlign: 'center',
          cursor: 'pointer',
        }}>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={e => { setMarketingFile(e.target.files?.[0] || null); setStatus('idle') }}
            style={{ display: 'none' }}
          />
          <span style={{ color: '#666' }}>
            {marketingFile ? `${marketingFile.name} (${(marketingFile.size / 1024).toFixed(0)} KB)` : '點這裡選擇行銷版圖片'}
          </span>
        </label>
      </div>

      {/* 學員版 */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '8px' }}>
          學員版（綁定後自動切換）
        </h2>
        <p style={{ color: '#666', fontSize: '12px', marginBottom: '8px' }}>
          按鈕：記體重 | 記飲食 | 記訓練 | 今日狀態 | 7天趨勢 | 聯繫客服
        </p>
        <label style={{
          display: 'block',
          padding: '30px 20px',
          border: '2px dashed #333',
          borderRadius: '12px',
          textAlign: 'center',
          cursor: 'pointer',
        }}>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={e => { setMemberFile(e.target.files?.[0] || null); setStatus('idle') }}
            style={{ display: 'none' }}
          />
          <span style={{ color: '#666' }}>
            {memberFile ? `${memberFile.name} (${(memberFile.size / 1024).toFixed(0)} KB)` : '點這裡選擇學員版圖片'}
          </span>
        </label>
      </div>

      {/* 上傳按鈕 */}
      <button
        onClick={handleUpload}
        disabled={!hasFile || status === 'uploading'}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '12px',
          border: 'none',
          fontSize: '18px',
          fontWeight: 'bold',
          cursor: hasFile && status !== 'uploading' ? 'pointer' : 'not-allowed',
          background: status === 'success' ? '#4CAF50'
            : status === 'error' ? '#f44336'
            : '#00d2ff',
          color: '#fff',
          opacity: !hasFile || status === 'uploading' ? 0.5 : 1,
        }}
      >
        {status === 'uploading' ? '上傳中...'
          : status === 'success' ? '設定完成！'
          : status === 'error' ? '重新上傳'
          : '上傳並啟用 Rich Menu'}
      </button>

      {/* 狀態訊息 */}
      {message && (
        <pre style={{
          marginTop: '16px',
          padding: '16px',
          background: '#1a1a1a',
          borderRadius: '8px',
          fontSize: '14px',
          whiteSpace: 'pre-wrap',
          color: status === 'success' ? '#4CAF50'
            : status === 'error' ? '#f44336'
            : '#fff',
        }}>
          {message}
        </pre>
      )}
    </div>
  )
}
