import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion'
import toast from 'react-hot-toast'
import { Bell, Cross, LogOut, LayoutDashboard, ShieldCheck } from 'lucide-react'
import { asList, apiGet, apiPost, type NotificationRow } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { formatDateTime } from '../../lib/store'
import ThemeToggle from './ThemeToggle'

const iconBtn: React.CSSProperties = {
  width: 42, height: 42, borderRadius: 14,
  border: '1px solid var(--glass-border)',
  background: 'var(--surface-2)',
  display: 'grid', placeItems: 'center', color: 'var(--ink)',
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <motion.span
        whileHover={{ rotate: 90 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        style={{ width: small ? 34 : 38, height: small ? 34 : 38, borderRadius: 12, background: 'var(--btn-grad)', display: 'grid', placeItems: 'center', boxShadow: '0 6px 14px -6px var(--green-glow), inset 0 1px 0 rgba(255,255,255,.2)' }}
      >
        <Cross size={small ? 18 : 20} color="#E8F5F0" fill="#E8F5F0" />
      </motion.span>
      <span style={{ lineHeight: 1.1 }}>
        <span className="font-display" style={{ display: 'block', fontWeight: 800, fontSize: small ? 15 : 17, color: 'var(--green)', letterSpacing: '-0.01em' }}>MED</span>
        <span style={{ display: 'block', fontSize: small ? 9.5 : 10.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Health Locker</span>
      </span>
    </Link>
  )
}

export default function TopBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<NotificationRow[]>([])
  const [scrolled, setScrolled] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 10))

  const loadNotifs = useCallback(async () => {
    if (!user) { setNotifs([]); return }
    try { setNotifs(asList(await apiGet<NotificationRow[] | { data: NotificationRow[] }>('/notifications'))) } catch { /* ignore */ }
  }, [user])

  useEffect(() => { void loadNotifs() }, [loadNotifs])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const unread = notifs.filter((n) => !n.read).length
  const initials = user ? user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : ''

  const doLogout = async () => {
    await logout()
    toast.success('Signed out')
    navigate('/')
  }

  const markAll = async () => {
    await apiPost('/notifications/read-all', {}).catch(() => {})
    setNotifs((ns) => ns.map((n) => ({ ...n, read: 1 })))
    toast.success('All caught up')
  }

  return (
    <motion.header
      className="glass topbar-shell"
      animate={scrolled ? { boxShadow: 'var(--shadow-shell)' } : { boxShadow: '0 0 0 0 rgba(0,0,0,0)' }}
      transition={{ duration: 0.3 }}
      style={{ position: 'sticky', top: 0, zIndex: 40, borderBottom: '1px solid var(--glass-border)' }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div className="md:hidden"><Logo small /></div>
        <div className="hidden md:block topbar-spacer" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ThemeToggle />

          {user && (
            <div ref={ref} style={{ position: 'relative' }}>
              <motion.button
                onClick={() => setOpen((o) => !o)}
                aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
                aria-expanded={open}
                whileTap={{ scale: 0.92 }}
                animate={unread > 0 ? { rotate: [0, -14, 12, -8, 0] } : {}}
                transition={{ duration: 0.6, delay: 0.6 }}
                style={{ ...iconBtn, position: 'relative' }}
              >
                <Bell size={19} />
                {unread > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.28, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                    style={{ position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: 99, background: 'var(--danger)', border: '2px solid var(--page-elevated)' }}
                  />
                )}
              </motion.button>

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="modal-panel"
                    style={{ position: 'absolute', right: 0, top: 52, width: 'min(340px, 88vw)', zIndex: 50, overflow: 'hidden', borderRadius: 18 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--line)', background: 'var(--mint-2)' }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
                      {unread > 0 && (
                        <button onClick={() => void markAll()} style={{ background: 'none', border: 'none', color: 'var(--green)', fontWeight: 600, fontSize: 12.5 }}>
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div style={{ maxHeight: 320, overflow: 'auto' }}>
                      {notifs.length === 0 && (
                        <div style={{ padding: '26px 20px', textAlign: 'center' }}>
                          <div className="icon-bubble floaty" style={{ margin: '0 auto 10px', width: 44, height: 44, borderRadius: 14 }}>
                            <Bell size={19} />
                          </div>
                          <p className="muted" style={{ margin: 0, fontSize: 13.5, textAlign: 'center' }}>All caught up ✨</p>
                        </div>
                      )}
                      <AnimatePresence>
                        {notifs.map((n, i) => (
                          <motion.div
                            key={n.id}
                            initial={{ opacity: 0, x: 14 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.25 }}
                            whileHover={{ x: 3 }}
                            style={{ padding: '13px 18px', borderBottom: '1px solid var(--line)', background: n.read ? 'transparent' : 'var(--mint-2)' }}
                          >
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {!n.read && <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--green)', flexShrink: 0 }} />}
                              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{n.title}</span>
                            </div>
                            <p className="muted" style={{ margin: '3px 0 0', fontSize: 12.5 }}>{n.body}</p>
                            <span className="muted" style={{ fontSize: 11 }}>{formatDateTime(n.created_at)}</span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {user ? (
            <>
              {user.role === 'admin' && (
                <Link to="/admin" aria-label="Admin Control Room" title="Control Room" style={{ ...iconBtn, color: 'var(--green)' }}>
                  <ShieldCheck size={19} />
                </Link>
              )}
              <motion.button
                onClick={() => void doLogout()}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                aria-label="Sign out"
                title="Sign out"
                style={{ ...iconBtn, borderRadius: '50%', color: 'var(--green)' }}
              >
                <LogOut size={17} />
              </motion.button>
              <motion.div whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.95 }}>
                <Link to="/profile" aria-label="Open profile" className="avatar-ring" style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--btn-grad)', color: '#E8F5F0', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 6px 16px -6px var(--green-glow), inset 0 1px 0 rgba(255,255,255,.2)' }}>
                  {initials}
                </Link>
              </motion.div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/login" className="btn-ghost" style={{ textDecoration: 'none', padding: '10px 16px', fontSize: 13 }}>Sign in</Link>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="topbar-cta">
                <Link to="/register" className="btn-primary" style={{ textDecoration: 'none', padding: '10px 18px', fontSize: 13 }}>Get Started</Link>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  )
}

export function DashboardIcon() { return <LayoutDashboard size={16} /> }
