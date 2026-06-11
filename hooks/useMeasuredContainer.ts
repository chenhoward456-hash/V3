'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 回傳 ref 與 measured 旗標：等容器實際量到寬度（>0）才為 true。
 * 用於延後掛載 Recharts ResponsiveContainer，避免初次渲染時
 * 容器尚未排版（width -1）噴出 console 警告。
 */
export function useMeasuredContainer<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [measured, setMeasured] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.clientWidth > 0) {
      setMeasured(true)
      return
    }
    // jsdom 等測試環境沒有 ResizeObserver：直接放行，維持原本行為
    if (typeof ResizeObserver === 'undefined') {
      setMeasured(true)
      return
    }
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0) {
        setMeasured(true)
        ro.disconnect()
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { ref, measured }
}
