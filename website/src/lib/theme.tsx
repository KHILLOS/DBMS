import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'
export type ThemeSetting = 'system' | 'light' | 'dark'

interface ThemeContextValue {
  /** What the user picked — 'system' follows the OS preference. */
  theme: ThemeSetting
  /** The concrete theme currently applied. */
  resolvedTheme: Theme
  setTheme: (setting: ThemeSetting) => void
}

const STORAGE_KEY = 'med-theme'
const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Dual-theme provider.
 * - Default follows `prefers-color-scheme` (system).
 * - Manual choice persists to localStorage.
 * - Writes `data-theme="light|dark"` on <html>; index.html seeds the same
 *   attribute before first paint to avoid a flash of the wrong theme.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [setting, setSetting] = useState<ThemeSetting>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  })
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme)

  const resolvedTheme: Theme = setting === 'system' ? systemTheme : setting

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolvedTheme === 'dark' ? '#0B120A' : '#F7FAF0')
  }, [resolvedTheme])

  const setTheme = useCallback((next: ThemeSetting) => {
    setSetting(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme: setting, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
