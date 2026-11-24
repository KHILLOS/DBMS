/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react'
import App from '../../App'

/* Regression: backend may return paginated { data: [...] } envelopes.
   The frontend (asList) must render rows from BOTH shapes. */

const user = { id: 1, email: 'u@med.test', name: 'Env User', phone: '', age: '', role: 'user' as const, created_at: '2026-10-01', last_login: null }
const report = { id: 'r1', file_name: 'envelope.pdf', mime: 'application/pdf', size: 1024, report_type: 'Lab', status: 'Analyzed', created_at: '2026-10-01T10:00:00Z' }
const consult = { id: 1, user_id: 1, doctor_id: 'd1', doctor_name: 'Dr. Envelope', date: '2026-10-05', time: '17:30', reason: 'Check', status: 'pending' as const, created_at: '2026-10-01' }

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/auth/me')) return json({ user })
    if (url.includes('/reports')) return json({ data: [report], total: 1, limit: 20, offset: 0 }) // paginated envelope
    if (url.includes('/consults')) return json({ data: [consult], total: 1, limit: 20, offset: 0 }) // paginated envelope
    if (url.includes('/notifications')) return json({ data: [] })
    if (url.includes('/ai/history')) return json({ data: [] })
    return json({})
  }))
})

test('Reports renders rows from a paginated { data } envelope', async () => {
  window.history.pushState({}, '', '/reports')
  render(<App />)
  expect(await screen.findByText('envelope.pdf')).toBeTruthy()
})

test('Consult renders doctors and request rows from envelopes', async () => {
  window.history.pushState({}, '', '/consult')
  render(<App />)
  expect(await screen.findByText('Dr. Envelope')).toBeTruthy()
  expect(await screen.findByText('pending')).toBeTruthy()
})
