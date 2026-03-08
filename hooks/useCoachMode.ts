'use client'

import { useState, useEffect, useCallback } from 'react'

interface UseCoachModeResult {
  isCoachMode: boolean
  showPinPopover: boolean
  pinInput: string
  pinError: boolean
  pinLoading: boolean
  savedPin: string
  coachHeaders: Record<string, string>
  setShowPinPopover: (v: boolean) => void
  setPinInput: (v: string) => void
  handlePinSubmit: () => Promise<void>
  toggleCoachMode: () => void
}

export function useCoachMode(): UseCoachModeResult {
  const [isCoachMode, setIsCoachMode] = useState(false)
  const [showPinPopover, setShowPinPopover] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [savedPin, setSavedPin] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('coachMode')
      const pin = sessionStorage.getItem('coachPin')
      if (saved === 'true' && pin) {
        setIsCoachMode(true)
        setSavedPin(pin)
      }
    }
  }, [])

  const handlePinSubmit = useCallback(async () => {
    if (!pinInput || pinLoading) return
    setPinLoading(true)
    setPinError(false)
    try {
      const res = await fetch('/api/coach/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.valid) {
          setIsCoachMode(true)
          setSavedPin(pinInput)
          sessionStorage.setItem('coachMode', 'true')
          sessionStorage.setItem('coachPin', pinInput)
          setShowPinPopover(false)
          setPinInput('')
        } else { setPinError(true) }
      } else { setPinError(true) }
    } catch { setPinError(true) }
    finally { setPinLoading(false) }
  }, [pinInput, pinLoading])

  const toggleCoachMode = useCallback(() => {
    if (isCoachMode) {
      setIsCoachMode(false)
      setSavedPin('')
      sessionStorage.removeItem('coachMode')
      sessionStorage.removeItem('coachPin')
    } else {
      setShowPinPopover(prev => !prev)
    }
  }, [isCoachMode])

  const coachHeaders = { 'Content-Type': 'application/json', 'x-coach-pin': savedPin }

  return {
    isCoachMode,
    showPinPopover,
    pinInput,
    pinError,
    pinLoading,
    savedPin,
    coachHeaders,
    setShowPinPopover,
    setPinInput,
    handlePinSubmit,
    toggleCoachMode,
  }
}
