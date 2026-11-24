import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiGet, apiPost, type User } from './api'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string, extra?: Record<string, unknown>) => Promise<void>
  register: (email: string, password: string, name: string, extra?: Record<string, unknown>) => Promise<void>
  loginPhone: (phone: string, code: string) => Promise<void>
  requestOtp: (phone: string) => Promise<{ demo: boolean; dev_code?: string; note?: string }>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const { user } = await apiGet<{ user: User }>('/auth/me')
      setUser(user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const login = async (email: string, password: string, extra: Record<string, unknown> = {}) => {
    const { user } = await apiPost<{ user: User }>('/auth/login', { email, password, ...extra })
    setUser(user)
  }

  const register = async (email: string, password: string, name: string, extra: Record<string, unknown> = {}) => {
    const { user } = await apiPost<{ user: User }>('/auth/register', { email, password, name, ...extra })
    setUser(user)
  }

  const loginPhone = async (phone: string, code: string) => {
    const { user } = await apiPost<{ user: User }>('/auth/phone/verify', { phone, code })
    setUser(user)
  }

  const requestOtp = async (phone: string) => {
    return apiPost<{ demo: boolean; dev_code?: string; note?: string }>('/auth/phone/request', { phone })
  }

  const logout = async () => {
    try { await apiPost('/auth/logout', {}) } catch { /* cookie may already be gone */ }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginPhone, requestOtp, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
