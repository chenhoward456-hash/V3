import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { pushMessage } from '@/lib/line'
import { sendManualLineMessages } from '@/lib/manual-line-delivery'
const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset()
  vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', 'fake'); vi.stubEnv('ADMIN_LINE_USER_ID', 'admin')
  vi.stubEnv('HOWARD_BOT_RELAY_URL', 'http://relay.invalid'); vi.stubEnv('HOWARD_BOT_RELAY_SECRET', 'fake')
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
it('manual quota relay reports the actual successful receipt', async () => {
  fetchMock.mockResolvedValueOnce(new Response('monthly limit', { status: 429 })).mockResolvedValueOnce(new Response('', { status: 200 }))
  const result = await sendManualLineMessages('admin', [[{ type: 'text', text: 'fixture' }]])
  expect(result.pushed).toBe(true); expect(result.sent_count).toBe(1); expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('legacy caller retains original quota Response despite relay success', async () => {
  fetchMock.mockResolvedValueOnce(new Response('monthly limit', { status: 429 })).mockResolvedValueOnce(new Response('', { status: 200 }))
  expect((await pushMessage('admin', [{ type: 'text', text: 'fixture' }])).status).toBe(429)
})
it('manual 5xx performs one attempt and stops without retry', async () => {
  fetchMock.mockResolvedValue(new Response('', { status: 500 }))
  const result = await sendManualLineMessages('client', [[{ type: 'text', text: 'first' }], [{ type: 'text', text: 'second' }]])
  expect(result.pushed).toBe(false); expect(result.notification_status).toBe(500); expect(fetchMock).toHaveBeenCalledOnce()
})
it('relay connection ambiguity is unknown and not retried', async () => {
  fetchMock.mockResolvedValueOnce(new Response('monthly limit', { status: 429 })).mockRejectedValue(new Error('lost'))
  const result = await sendManualLineMessages('admin', [[{ type: 'text', text: 'fixture' }]])
  expect(result.pushed).toBe(false); expect(result.notification).toBe('unknown'); expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('failed relay receipt reports failure rather than original or successful status', async () => {
  fetchMock.mockResolvedValueOnce(new Response('monthly limit', { status: 429 })).mockResolvedValueOnce(new Response('', { status: 503 }))
  const result = await sendManualLineMessages('admin', [[{ type: 'text', text: 'fixture' }]])
  expect(result.pushed).toBe(false); expect(result.notification_status).toBe(503); expect(fetchMock).toHaveBeenCalledTimes(2)
})
