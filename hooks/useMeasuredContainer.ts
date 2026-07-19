'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * 回傳 callback ref 與 measured 旗標：等容器實際量到寬度（>0）才為 true。
 * 用於延後掛載 Recharts ResponsiveContainer，避免初次渲染時
 * 容器尚未排版（width -1）噴出 console 警告。
 *
 * ⚠️ 用 callback ref（不是 useEffect 讀 ref.current）：這樣才能正確處理
 * 「容器延後掛載」——例如資料 async 載完後圖表 div 才 render。此時
 * 元件初次 commit 的 effect 早已跑過、ref.current 還是 null，舊寫法會
 * 永遠停在 measured=false（PeakWeekPlan 節奏圖空白的根因）。callback ref
 * 在 DOM 節點真正掛上的那一刻才觸發，不管是初次還是延後。
 */
export function useMeasuredContainer<T extends HTMLElement = HTMLDivElement>() {
  const [measured, setMeasured] = useState(false)
  const roRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: T | null) => {
    // 節點被換掉或卸載：先清掉舊的 observer
    if (roRef.current) {
      roRef.current.disconnect()
      roRef.current = null
    }
    if (!node) return
    if (node.clientWidth > 0) {
      setMeasured(true)
      return
    }
    // jsdom 等測試環境沒有 ResizeObserver：直接放行，維持原本行為
    if (typeof ResizeObserver === 'undefined') {
      setMeasured(true)
      return
    }
    const ro = new ResizeObserver(() => {
      if (node.clientWidth > 0) {
        setMeasured(true)
        ro.disconnect()
        roRef.current = null
      }
    })
    ro.observe(node)
    roRef.current = ro
  }, [])

  return { ref, measured }
}
