/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../../App'

/* Full-app render smoke: catches crashes from any page-level component.
   The API is mocked as a logged-out state (401 on /auth/me). */

const json401 = () => new Response(JSON.stringify({ error: 'not signed in' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async () => json401()))
})

test('renders the signed-out Home with shell, toggle, and nav', () => {
  render(<App />)

  // Brand
  expect(screen.getAllByText(/MED/i).length).toBeGreaterThan(0)

  // Theme toggle (radiogroup with 3 modes)
  expect(screen.getByRole('radiogroup', { name: /colour theme/i })).toBeTruthy()

  // Nav (desktop sidebar + footer both link to Health Library)
  expect(screen.getAllByRole('link', { name: 'Health Library' }).length).toBeGreaterThan(0)

  // Hero copy
  expect(screen.getByText(/Welcome to/i)).toBeTruthy()

  // Visitor features strip
  expect(screen.getByText('Private by design')).toBeTruthy()
})

test('theme toggle switches to dark and persists', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('radio', { name: /dark theme/i }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  expect(localStorage.getItem('med-theme')).toBe('dark')
})

test('login route renders the auth page with all three methods', async () => {
  window.history.pushState({}, '', '/login')
  render(<App />)
  expect(await screen.findByRole('button', { name: /google/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /phone otp/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /email \+ password/i })).toBeTruthy()
})

test('protected routes redirect signed-out visitors to login', async () => {
  window.history.pushState({}, '', '/reports')
  render(<App />)
  // ProtectedRoute waits for /auth/me (mocked 401) then redirects
  await waitFor(() => expect(window.location.pathname).toBe('/login'))
})
