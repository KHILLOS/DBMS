import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AppShell from './components/layout/AppShell'
import Home from './pages/Home'
import { AuthProvider } from './lib/auth'
import { ThemeProvider } from './lib/theme'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PageSkeleton } from './components/ui'
import './index.css'

/* Route-level code splitting — keeps the initial bundle lean. */
const Reports = lazy(() => import('./pages/Reports'))
const AskAI = lazy(() => import('./pages/AskAI'))
const Consult = lazy(() => import('./pages/Consult'))
const Learn = lazy(() => import('./pages/Learn'))
const Profile = lazy(() => import('./pages/Profile'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Admin = lazy(() => import('./pages/Admin'))

const page = (node: React.ReactNode) => <Suspense fallback={<PageSkeleton />}>{node}</Suspense>

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/reports" element={<ProtectedRoute>{page(<Reports />)}</ProtectedRoute>} />
            <Route path="/ask-ai" element={<ProtectedRoute>{page(<AskAI />)}</ProtectedRoute>} />
            <Route path="/consult" element={<ProtectedRoute>{page(<Consult />)}</ProtectedRoute>} />
            <Route path="/learn" element={page(<Learn />)} />
            <Route path="/profile" element={<ProtectedRoute>{page(<Profile />)}</ProtectedRoute>} />
            <Route path="/login" element={page(<Login />)} />
            <Route path="/register" element={page(<Register />)} />
            <Route path="/admin" element={<ProtectedRoute adminOnly>{page(<Admin />)}</ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 2500,
            className: 'toast-glass',
            style: { bottom: '86px' },
            success: { iconTheme: { primary: '#7CB342', secondary: '#fff' } },
          }}
        />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
