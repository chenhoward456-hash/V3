'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
  icon?: string
  leaving?: boolean
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, icon?: string) => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let toastId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success', icon?: string) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type, icon }])

    // Start leave animation after 2s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
    }, 2000)

    // Remove after animation completes
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 2300)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center pointer-events-none">
        {toasts.map((toast) => {
          const bgColor = toast.type === 'success'
            ? 'bg-green-500'
            : toast.type === 'error'
              ? 'bg-red-500'
              : 'bg-blue-500'

          return (
            <div
              key={toast.id}
              className={`${bgColor} text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 mt-4 pointer-events-auto transition-all duration-300 ${
                toast.leaving
                  ? 'opacity-0 -translate-y-2'
                  : 'opacity-100 translate-y-0 animate-slide-in-down'
              }`}
            >
              {toast.icon && <span className="text-lg">{toast.icon}</span>}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
