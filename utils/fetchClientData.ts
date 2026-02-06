import { createClient } from '@supabase/supabase-js'

// 補品介面定義
export interface Supplement {
  id: string
  name: string
  dosage: string
  timing: string
  why?: string
}

// 補品打卡記錄介面定義
export interface SupplementLog {
  id: string
  supplement_id: string
  date: string
  completed: boolean
}

// 身體數據介面定義
export interface BodyComposition {
  id: string
  date: string
  height?: number | null
  weight?: number | null
  body_fat?: number | null
  muscle_mass?: number | null
  visceral_fat?: number | null
  bmi?: number | null
}

// 血檢結果介面定義
export interface LabResult {
  id: string
  test_name: string
  value: number
  unit: string
  reference_range: string
  status: 'normal' | 'attention' | 'alert'
  date: string
}

// 客戶介面定義
export interface Client {
  id: string
  unique_code: string
  name: string
  age: number
  gender: string
  status: 'normal' | 'attention' | 'alert'
  lab_results: LabResult[]
  supplements: Supplement[]
}

// 完整的客戶資料介面定義
export interface ClientData {
  client: Client
  todayLogs: SupplementLog[]
  bodyData: BodyComposition[]
}

/**
 * 獲取客戶完整資料
 * @param clientId 客戶唯一代碼
 * @returns 完整的客戶資料
 */
export async function fetchClientData(clientId: string): Promise<ClientData> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  try {
    // 獲取客戶基本資料
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select(`
        *,
        lab_results (*),
        supplements (*)
      `)
      .eq('unique_code', clientId)
      .single()

    if (clientError) {
      throw new Error(`找不到此學員資料: ${clientError.message}`)
    }

    if (!client) {
      throw new Error('學員資料不存在')
    }

    // 檢查是否過期
    if (new Date(client.expires_at) < new Date()) {
      throw new Error('此學員資料已過期，請聯繫 Howard 教練')
    }

    // 獲取今日補品打卡記錄
    const today = new Date().toISOString().split('T')[0]
    const { data: logs, error: logsError } = await supabase
      .from('supplement_logs')
      .select('*')
      .eq('client_id', client.id)
      .eq('date', today)

    if (logsError) {
      console.warn('獲取補品打卡記錄失敗:', logsError)
    }

    // 獲取身體數據記錄
    const { data: bodyRecords, error: bodyError } = await supabase
      .from('body_composition')
      .select('*')
      .eq('client_id', client.id)
      .order('date', { ascending: false })

    if (bodyError) {
      console.warn('獲取身體數據記錄失敗:', bodyError)
    }

    return {
      client,
      todayLogs: logs || [],
      bodyData: bodyRecords || []
    }
  } catch (error) {
    console.error('載入客戶資料時發生錯誤:', error)
    throw error
  }
}

/**
 * 獲取客戶資料（包含所有關聯資料）
 * @param clientId 客戶唯一代碼
 * @returns 客戶資料
 */
export async function fetchClientWithAllData(clientId: string): Promise<ClientData> {
  return fetchClientData(clientId)
}
