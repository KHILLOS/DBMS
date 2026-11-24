import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, FileText, Sparkles, Stethoscope, BookOpen } from 'lucide-react'

const items = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/ask-ai', icon: Sparkles, label: 'Ask AI' },
  { to: '/consult', icon: Stethoscope, label: 'Consult' },
  { to: '/learn', icon: BookOpen, label: 'Learn' },
]

export default function BottomNav() {
  return (
    <nav
      className="md:hidden glass bottomnav-shell"
      aria-label="Primary"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        borderTop: '1px solid var(--glass-border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -8px 30px -18px var(--green-glow)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', maxWidth: 560, margin: '0 auto' }}>
        {items.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="nav-item"
            style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '9px 4px 10px', textDecoration: 'none',
              color: isActive ? 'var(--green)' : 'var(--muted)',
              fontSize: 10.5, fontWeight: isActive ? 700 : 500,
              position: 'relative',
            })}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="bottomnav-pill"
                    style={{ position: 'absolute', top: 4, bottom: 4, left: 4, right: 4, borderRadius: 14, background: 'var(--mint)', zIndex: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <motion.span
                  whileTap={{ scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
                >
                  <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} />
                  {label}
                </motion.span>
                {isActive && (
                  <motion.span
                    layoutId="bottomnav-dot"
                    style={{ position: 'absolute', bottom: 3, left: '50%', x: '-50%', width: 4, height: 4, borderRadius: 99, background: 'var(--green)', zIndex: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
