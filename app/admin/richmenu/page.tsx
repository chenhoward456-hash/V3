'use client'

import { useState } from 'react'

export default function RichMenuUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setStatus('idle')
    setMessage('')
  }

  async function handleUpload() {
    if (!file) return
    setStatus('uploading')
    setMessage('上傳中，請稍候...')

    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch('/api/line/richmenu', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setStatus('success')
        setMessage(`Rich Menu 設定完成！\nID: ${data.richMenuId}`)
      } else {
        setStatus('error')
        setMessage(`失敗：${data.error || '未知錯誤'}`)
      }
    } catch (err) {
      setStatus('error')
      setMessage(`網路錯誤：${err}`)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      padding: '24px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Rich Menu 上傳</h1>
      <p style={{ color: '#888', marginBottom: '24px', fontSize: '14px' }}>
        上傳 2500x1686 的圖片，自動建立並啟用 Rich Menu
      </p>

      {/* 檔案選擇 */}
      <label style={{
        display: 'block',
        padding: '40px 20px',
        border: '2px dashed #333',
        borderRadius: '12px',
        textAlign: 'center',
        cursor: 'pointer',
        marginBottom: '16px',
      }}>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        {preview ? (
          <img
            src={preview}
            alt="預覽"
            style={{ width: '100%', borderRadius: '8px' }}
          />
        ) : (
          <span style={{ color: '#666' }}>點這裡選擇圖片</span>
        )}
      </label>

      {file && (
        <p style={{ color: '#888', fontSize: '12px', marginBottom: '16px' }}>
          {file.name} ({(file.size / 1024).toFixed(0)} KB)
        </p>
      )}

      {/* 上傳按鈕 */}
      <button
        onClick={handleUpload}
        disabled={!file || status === 'uploading'}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '12px',
          border: 'none',
          fontSize: '18px',
          fontWeight: 'bold',
          cursor: file && status !== 'uploading' ? 'pointer' : 'not-allowed',
          background: status === 'success' ? '#4CAF50'
            : status === 'error' ? '#f44336'
            : '#00d2ff',
          color: '#fff',
          opacity: !file || status === 'uploading' ? 0.5 : 1,
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
