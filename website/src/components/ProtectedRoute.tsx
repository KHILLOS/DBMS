import { Navigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { useAuth } from '../lib/auth'

export function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div className="page-spinner" />
          <p className="muted" style={{ fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>Opening your locker…</p>
        </motion.div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />

  if (adminOnly && user.role !== 'admin') {
    return (
      <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20 }}>
        <div>
          <div className="icon-bubble" style={{ margin: '0 auto 14px', width: 56, height: 56, borderRadius: 18 }}><Lock size={24} /></div>
          <h2 className="section-title" style={{ margin: 0 }}>Admins only</h2>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>The Control Room is restricted to MED administrators.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
