/// <reference types="vitest/globals" />
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider, useTheme } from '../theme'

function TestComp() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme('light')}>Light</button>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('system')}>System</button>
    </div>
  )
}

test('defaults to system and resolves to light', () => {
  render(<ThemeProvider><TestComp /></ThemeProvider>)
  expect(screen.getByTestId('theme').textContent).toBe('system')
  expect(screen.getByTestId('resolved').textContent).toBe('light')
})

test('setTheme updates value and persists', () => {
  render(<ThemeProvider><TestComp /></ThemeProvider>)
  fireEvent.click(screen.getByText('Dark'))
  expect(screen.getByTestId('theme').textContent).toBe('dark')
  expect(screen.getByTestId('resolved').textContent).toBe('dark')
  expect(localStorage.getItem('med-theme')).toBe('dark')
})

test('explicit light overrides a dark system preference', () => {
  render(<ThemeProvider><TestComp /></ThemeProvider>)
  fireEvent.click(screen.getByText('Light'))
  expect(screen.getByTestId('theme').textContent).toBe('light')
  expect(screen.getByTestId('resolved').textContent).toBe('light')
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
})
