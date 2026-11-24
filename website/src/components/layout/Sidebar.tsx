import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, FileText, Sparkles, Stethoscope, BookOpen, User } from 'lucide-react'
import { Logo } from './TopBar'

const items = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/ask-ai', icon: Sparkles, label: 'Ask AI' },
  { to: '/consult', icon: Stethoscope, label: 'Consult Doctor' },
  { to: '/learn', icon: BookOpen, label: 'Health Library' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function Sidebar() {
  return (
    <aside
      aria-label="Primary"
      className="hidden md:flex glass sidebar-shell"
      style={{
        position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 41,
        flexDirection: 'column', gap: 4, padding: '18px 14px',
        borderRight: '1px solid var(--glass-border)',
      }}
    >
      <div style={{ padding: '6px 8px 18px' }} className="sidebar-logo"><Logo /></div>
      {items.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className="nav-item"
          title={label}
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 14px', borderRadius: 13, textDecoration: 'none',
            fontWeight: isActive ? 700 : 500, fontSize: 14,
            color: isActive ? 'var(--green)' : 'var(--muted)',
            position: 'relative',
            transition: 'color .15s ease',
          })}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="sidebar-pill"
                  style={{ position: 'absolute', inset: 0, borderRadius: 13, background: 'var(--mint)', border: '1px solid var(--glass-border)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="nav-icon"><Icon size={19} strokeWidth={2} /></span>
                <span className="sidebar-label">{label}</span>
              </span>
            </>
          )}
        </NavLink>
      ))}
      <div className="glass sidebar-footer" style={{ marginTop: 'auto', padding: 12, borderRadius: 16 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className="pulse-dot" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 99, background: 'var(--green-bright)', flexShrink: 0 }} />
          Fully local build
        </p>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 11.5, lineHeight: 1.5 }}>Encrypted JWT sessions · server-side storage · audit log.</p>
      </div>
    </aside>
  )
}
