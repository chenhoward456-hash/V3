import useSWR from 'swr'

interface UseClientDataOptions {
  revalidateOnFocus?: boolean
  dedupingInterval?: number
}

interface UseClientDataResult {
  data?: {
    client: any
    todayLogs: any[]
    bodyData: any[]
    wellness: any[]
    recentLogs: any[]
    trainingLogs: any[]
  }
  error?: Error
  isLoading: boolean
  mutate: any
}

/**
 * 使用 SWR 封裝的客戶資料獲取 Hook
 * @param clientId 客戶唯一代碼
 * @param options SWR 配置選項
 * @returns SWR 結果物件
 */
export function useClientData(
  clientId: string, 
  options: UseClientDataOptions = {}
): UseClientDataResult {
  const {
    revalidateOnFocus = false,
    dedupingInterval = 10000 // 10秒內相同請求不重複發
  } = options

  // 使用 API route 獲取資料
  const fetcher = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '獲取資料失敗')
    }
    const json = await response.json()
    if (!json.success) {
      throw new Error(json.error || 'Failed to fetch')
    }
    return json.data
  }

  const { data, error, isLoading, mutate } = useSWR(
    clientId ? `/api/clients?clientId=${clientId}` : null,
    fetcher,
    {
      revalidateOnFocus,
      dedupingInterval,
      refreshInterval: 30000, // 30秒自動刷新
      errorRetryCount: 3,
      onError: (error) => {
        console.error('客戶資料獲取失敗:', error)
      }
    }
  )

  return {
    data,
    error,
    isLoading,
    mutate
  }
}
