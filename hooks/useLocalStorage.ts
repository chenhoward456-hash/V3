import { useState, useEffect } from 'react'

/**
 * Custom hook for localStorage with SSR support (避免 Hydration 錯誤)
 * @param key - localStorage key
 * @param initialValue - 初始值
 * @returns [storedValue, setValue]
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const [isClient, setIsClient] = useState(false)

  // 確保只在客戶端執行
  useEffect(() => {
    setIsClient(true)
  }, [])

  // 從 localStorage 讀取初始值
  useEffect(() => {
    if (!isClient) return

    try {
      const item = window.localStorage.getItem(key)
      if (item) {
        setStoredValue(JSON.parse(item))
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
    }
  }, [key, isClient])

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage.
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value
      
      // Save state
      setStoredValue(valueToStore)
      
      // Save to local storage (只在客戶端執行)
      if (isClient) {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }

  return [storedValue, setValue, isClient] as const
}
