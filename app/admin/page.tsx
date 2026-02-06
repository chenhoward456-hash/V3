'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Client {
  id: string
  unique_code: string
  name: string
  age: number
  gender: string
  status: 'normal' | 'attention' | 'alert'
  created_at: string
  expires_at: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    // 檢查是否已登入
    const checkAuth = () => {
      const cookies = document.cookie.split(';')
      const adminCookie = cookies.find(cookie => cookie.trim().startsWith('admin_password='))
      
      if (!adminCookie) {
        router.push('/admin/login')
        return
      }
      
      fetchClients()
    }
    
    checkAuth()
  }, [router])
  
  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('載入客戶資料錯誤:', error)
        return
      }
      
      setClients(data || [])
    } catch (error) {
      console.error('載入客戶資料錯誤:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const copyClientUrl = (uniqueCode: string) => {
    const url = `${window.location.origin}/c/${uniqueCode}`
    navigator.clipboard.writeText(url).then(() => {
      alert('學員網址已複製到剪貼簿')
    })
  }
  
  const handleLogout = () => {
    document.cookie = 'admin_password=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    router.push('/admin/login')
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-bold text-gray-900">教練後台</h1>
              <p className="text-sm text-gray-600">Howard 健康管理系統</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900"
            >
              登出
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">學員列表</h2>
          <Link
            href="/admin/clients/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            新增學員
          </Link>
        </div>
        
        {clients.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">還沒有學員資料</p>
            <Link
              href="/admin/clients/new"
              className="inline-block mt-4 text-blue-600 hover:text-blue-800"
            >
              新增第一個學員
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    學員資訊
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    狀態
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    建立時間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    到期時間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{client.name}</div>
                        <div className="text-sm text-gray-500">
                          {client.age}歲 • {client.gender}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        client.status === 'normal'
                          ? 'bg-green-100 text-green-800'
                          : client.status === 'attention'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {client.status === 'normal' ? '正常' : '需要關注'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(client.created_at).toLocaleDateString('zh-TW')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(client.expires_at).toLocaleDateString('zh-TW')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Link
                          href={`/admin/clients/${client.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          編輯
                        </Link>
                        <button
                          onClick={() => copyClientUrl(client.unique_code)}
                          className="text-green-600 hover:text-green-900"
                        >
                          複製網址
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
