/// <reference types="vitest/globals" />
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import App from '../../App'

/* Page-level render smoke with a signed-in admin session and realistic
   mocked API data — exercises rows, tables, modals-ready states, chips. */

const user = { id: 1, email: 'admin@med.test', name: 'Test Admin', phone: '', age: '', role: 'admin' as const, created_at: '2026-10-01', last_login: null }
const report = { id: 'r1', file_name: 'bloodwork.pdf', mime: 'application/pdf', size: 204800, report_type: 'Lab', status: 'Analyzed', created_at: '2026-10-01T10:00:00Z' }
const consult = { id: 1, user_id: 1, doctor_id: 'd1', doctor_name: 'Dr. Meera Sharma', date: '2026-10-05', time: '17:30', reason: 'General checkup', status: 'pending' as const, created_at: '2026-10-01T09:00:00Z' }
const audit = { id: 1, user_id: 1, user_email: 'admin@med.test', action: 'login', detail: '', ip: '127.0.0.1', created_at: '2026-10-01' }

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/auth/me')) return json({ user })
    if (url.includes('/auth/captcha')) return json({ token: 'tok', question: '2 + 3' })
    if (url.includes('/admin/stats')) return json({ users: 5, admins: 1, reports: 1, storageBytes: 204800, consults: 1, notifications: 1, aiMessages: 2 })
    if (url.includes('/admin/users')) return json([{ ...user, reports: 1 }])
    if (url.includes('/admin/reports')) return json([{ ...report, user_id: 1, user_name: 'Test Admin', user_email: 'admin@med.test' }])
    if (url.includes('/admin/consults')) return json([{ ...consult, user_name: 'Test Admin', user_email: 'admin@med.test' }])
    if (url.includes('/admin/audit')) return json([audit])
    if (url.includes('/reports')) return json([report])
    if (url.includes('/consults')) return json([consult])
    if (url.includes('/notifications')) return json([{ id: 1, title: 'Welcome', body: 'Locker ready', read: 0, created_at: '2026-10-01T08:00:00Z' }])
    if (url.includes('/ai/history')) return json([])
    return json({})
  }))
})

function visit(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

test('Reports renders the uploaded document row', async () => {
  visit('/reports')
  expect(await screen.findByText('bloodwork.pdf')).toBeTruthy()
  expect((await screen.findAllByText(/stored on the server/i)).length).toBeGreaterThan(0)
})

test('Ask AI shows the signed-in welcome and history input', async () => {
  visit('/ask-ai')
  expect(await screen.findByText(/Hi, Test — I'm your health assistant/i)).toBeTruthy()
  expect(screen.getByRole('button', { name: /send message/i })).toBeTruthy()
})

test('Consult renders doctors and the pending request row', async () => {
  visit('/consult')
  expect(await screen.findByText('Dr. Meera Sharma')).toBeTruthy()
  expect(await screen.findByText('pending')).toBeTruthy()
})

test('Learn renders the demo article grid', async () => {
  visit('/learn')
  expect(await screen.findByText('How much water do you actually need?')).toBeTruthy()
  expect(screen.getAllByText(/vitamin D/i).length).toBeGreaterThan(0)
})

test('Profile renders identity, stats, and sign-out', async () => {
  visit('/profile')
  expect((await screen.findAllByText('Test Admin')).length).toBeGreaterThan(0)
  expect(screen.getByText(/Your locker stats/i)).toBeTruthy()
  expect(screen.getAllByRole('button', { name: /sign out/i }).length).toBeGreaterThan(0)
})

test('Admin Control Room renders stats, tables, and audit feed', async () => {
  visit('/admin')
  expect(await screen.findByText(/Control Room/i)).toBeTruthy()
  // stat tiles
  expect(await screen.findByText('AI messages')).toBeTruthy()
  // users table
  expect(screen.getByText('admin@med.test')).toBeTruthy()
  // consults tab
  fireEvent.click(screen.getByRole('button', { name: /consults/i }))
  await waitFor(() => expect(screen.getByText('General checkup')).toBeTruthy())
})

