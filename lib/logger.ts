/**
 * 結構化日誌模組
 * 在 production 環境輸出 JSON 格式，方便 Vercel / 外部 log 服務解析
 * 在 development 環境輸出可讀格式
 */

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  module: string
  message: string
  data?: Record<string, unknown>
  error?: string
  timestamp: string
}

const isDev = process.env.NODE_ENV === 'development'

function formatLog(entry: LogEntry): string {
  if (isDev) {
    const prefix = { info: 'ℹ️', warn: '⚠️', error: '❌' }[entry.level]
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
    const errStr = entry.error ? ` | ${entry.error}` : ''
    return `${prefix} [${entry.module}] ${entry.message}${dataStr}${errStr}`
  }
  return JSON.stringify(entry)
}

function log(level: LogLevel, module: string, message: string, extra?: { data?: Record<string, unknown>; error?: unknown }) {
  const entry: LogEntry = {
    level,
    module,
    message,
    timestamp: new Date().toISOString(),
  }

  if (extra?.data) entry.data = extra.data
  if (extra?.error) {
    entry.error = extra.error instanceof Error ? extra.error.message : String(extra.error)
  }

  const formatted = formatLog(entry)

  if (level === 'error') {
    console.error(formatted)
  } else if (level === 'warn') {
    console.warn(formatted)
  } else {
    console.log(formatted)
  }
}

export function createLogger(module: string) {
  return {
    info: (message: string, data?: Record<string, unknown>) => log('info', module, message, { data }),
    warn: (message: string, data?: Record<string, unknown>) => log('warn', module, message, { data }),
    error: (message: string, error?: unknown, data?: Record<string, unknown>) => log('error', module, message, { error, data }),
  }
}
