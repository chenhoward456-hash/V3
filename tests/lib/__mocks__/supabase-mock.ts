import { vi } from 'vitest'

export const mockGetUser = vi.fn()
export const mockSupabaseClient = {
  auth: { getUser: mockGetUser },
}
