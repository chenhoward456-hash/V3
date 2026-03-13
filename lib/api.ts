// API 服務配置
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

// 通用 API 請求函數
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  }

  try {
    const response = await fetch(url, defaultOptions)
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    throw error
  }
}

// 診斷 API
export const diagnosisAPI = {
  // 提交診斷結果
  submitResult: async (data: {
    answers: Record<string, string | number | boolean>
    result: Record<string, unknown>
    userInfo?: { name?: string; email?: string; phone?: string }
  }) => {
    return apiRequest('/diagnosis/submit', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  
  // 獲取診斷歷史
  getHistory: async (userId?: string) => {
    return apiRequest(`/diagnosis/history${userId ? `?userId=${userId}` : ''}`)
  }
}

// 服務 API
export const serviceAPI = {
  // 獲取服務方案
  getPlans: async () => {
    return apiRequest('/services/plans')
  },
  
  // 提交服務詢問
  submitInquiry: async (data: {
    planId: string
    userInfo: { name?: string; email?: string; phone?: string }
    message?: string
  }) => {
    return apiRequest('/services/inquiry', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  
  // 預約諮詢
  bookConsultation: async (data: {
    datetime: string
    userInfo: { name?: string; email?: string; phone?: string }
    type: 'online' | 'offline'
  }) => {
    return apiRequest('/services/book-consultation', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
}

// 使用者 API
export const userAPI = {
  // 更新使用者資料
  updateProfile: async (data: {
    name?: string
    email?: string
    phone?: string
    location?: string
  }) => {
    return apiRequest('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },
  
  // 獲取使用者資料
  getProfile: async () => {
    return apiRequest('/user/profile')
  }
}

// 內容 API
export const contentAPI = {
  // 獲取部落格文章
  getPosts: async (params?: {
    category?: string
    limit?: number
    offset?: number
  }) => {
    const searchParams = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter((entry): entry is [string, string] => entry[1] != null)
          .map(([k, v]) => [k, String(v)])
      )
    )
    return apiRequest(`/blog/posts?${searchParams}`)
  },
  
  // 獲取單篇文章
  getPost: async (slug: string) => {
    return apiRequest(`/blog/posts/${slug}`)
  },
  
  // 獲取案例研究
  getCases: async () => {
    return apiRequest('/cases')
  }
}
