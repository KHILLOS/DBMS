import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Users, FileText, CalendarClock, ScrollText, ShieldCheck, Sparkles, Trash2, RefreshCw } from 'lucide-react'
import { CountUp, Skeleton } from '../components/ui'
import { asList, apiGet, apiPatch, apiDelete, type AdminStats, type User, type Report, type ConsultRequest, type AuditRow } from '../lib/api'
import { formatSize } from '../lib/store'
import { usePageTitle } from '../lib/usePageTitle'

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', background: 'var(--mint-2)' }
const td: React.CSSProperties = { padding: '11px 12px', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }

/** Colour-code audit actions for a scannable activity feed. */
function activityTone(action: string): string {
  if (/login|logout|session/.test(action)) return 'chip-green'
  if (/upload|report/.test(action)) return 'chip-blue'
  if (/delete|remove/.test(action)) return 'chip-rose'
  if (/captcha|honeypot|block|rate/.test(action)) return 'chip-amber'
  if (/consult|role|admin/.test(action)) return 'chip-violet'
  return 'chip-gray'
}

type Tab = 'overview' | 'users' | 'reports' | 'consults' | 'audit'

export default function Admin() {
  usePageTitle('Control Room')
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [consults, setConsults] = useState<ConsultRequest[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [s, u, r, c, a] = await Promise.all([
        apiGet<AdminStats>('/admin/stats'),
        apiGet<User[]>('/admin/users'),
        apiGet<Report[]>('/admin/reports'),
        apiGet<ConsultRequest[]>('/admin/consults'),
        apiGet<AuditRow[]>('/admin/audit'),
      ])
      setStats(s); setUsers(asList(u)); setReports(asList(r)); setConsults(asList(c)); setAudit(asList(a))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const changeRole = async (u: User, role: 'user' | 'admin') => {
    try {
      await apiPatch(`/admin/users/${u.id}/role`, { role })
      toast.success(`${u.email} is now ${role}`)
      void load(true)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const deleteUser = async (u: User) => {
    if (!window.confirm(`Delete ${u.email}? Their reports and files will be removed too.`)) return
    try {
      await apiDelete(`/admin/users/${u.id}`)
      toast.success('User deleted')
      void load(true)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const deleteReportAdmin = async (r: Report) => {
    if (!window.confirm(`Delete report “${r.file_name}” (owned by ${r.user_email})? This cannot be undone.`)) return
    try {
      await apiDelete(`/reports/${r.id}`)
      toast.success('Report deleted')
      void load(true)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const setConsultStatus = async (id: number, status: ConsultRequest['status']) => {
    try {
      await apiPatch(`/admin/consults/${id}/status`, { status })
      toast.success(`Consult marked ${status}`)
      void load(true)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }>; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: ShieldCheck },
    { id: 'users', label: 'Users', icon: Users, count: users.length },
    { id: 'reports', label: 'Reports', icon: FileText, count: reports.length },
    { id: 'consults', label: 'Consults', icon: CalendarClock, count: consults.length },
    { id: 'audit', label: 'Audit log', icon: ScrollText, count: audit.length },
  ]

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <span className="overline">Admin</span>
          <h1 className="section-title" style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={22} color="var(--green)" /> Control Room
          </h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>Admin portal — users, reports, consults and audit trail.</p>
        </div>
        <motion.button whileTap={{ scale: 0.96 }} className="btn-ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} style={loading ? { animation: 'spin 0.9s linear infinite' } : undefined} /> Refresh
        </motion.button>
      </motion.div>

      {/* Tabs */}
      <div className="glass admin-tabs" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <motion.button
            key={id}
            onClick={() => setTab(id)}
            whileTap={{ scale: 0.95 }}
            style={{ position: 'relative', border: 'none', background: 'transparent', padding: '9px 16px', borderRadius: 999, fontWeight: 600, fontSize: 13, color: tab === id ? '#fff' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 7, transition: 'color .2s ease', fontFamily: 'Inter, sans-serif' }}
            aria-pressed={tab === id}
          >
            {tab === id && (
              <motion.span
                layoutId="admin-tab-pill"
                style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--btn-grad)', boxShadow: '0 8px 18px -8px var(--green-glow)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Icon size={15} /> {label}
              {typeof count === 'number' && count > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
              )}
            </span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28, ease: 'easeOut' }}>

          {tab === 'overview' && (
            <div>
              {loading || !stats ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={92} radius={18} />)}
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                    {[
                      { label: 'Users', value: stats.users, icon: Users },
                      { label: 'Admins', value: stats.admins, icon: ShieldCheck },
                      { label: 'Reports', value: stats.reports, icon: FileText },
                      { label: 'Storage', value: null, text: formatSize(stats.storageBytes), icon: ScrollText },
                      { label: 'Consult requests', value: stats.consults, icon: CalendarClock },
                      { label: 'AI messages', value: stats.aiMessages, icon: Sparkles },
                    ].map((c, i) => (
                      <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.35 }} className="card card-glow card-lift" style={{ padding: '18px', textAlign: 'center' }}>
                        <div className={`icon-bubble ${['', 'amber', 'blue', 'violet', 'rose', ''][i % 6]}`} style={{ width: 34, height: 34, margin: '0 auto 10px', borderRadius: 11 }}>
                          <c.icon size={16} />
                        </div>
                        <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
                          {c.value !== null ? <CountUp value={c.value} /> : c.text}
                        </div>
                        <div className="muted" style={{ marginTop: 6, fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600 }}>{c.label}</div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="card" style={{ marginTop: 16, padding: '18px 20px' }}>
                    <h3 className="section-title" style={{ margin: '0 0 10px', fontSize: 15 }}>Latest activity</h3>
                    {audit.slice(0, 6).map((a, i) => (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.06, 0.35), duration: 0.3 }}
                        whileHover={{ x: 3 }}
                        style={{ display: 'flex', gap: 10, padding: '9px 6px', borderRadius: 10, borderBottom: '1px solid var(--line)', fontSize: 13, alignItems: 'baseline' }}
                      >
                        <span className={`chip ${activityTone(a.action)}`} style={{ fontSize: 10.5 }}>{a.action}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.user_email ?? 'system'} {a.detail ? `· ${a.detail}` : ''}</span>
                        <span className="muted" style={{ fontSize: 11.5 }}>{a.created_at}</span>
                      </motion.div>
                    ))}
                    {audit.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Nothing yet.</p>}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'users' && (
            <div className="card table-card">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['User', 'Email', 'Role', 'Reports', 'Joined', 'Last login', 'Actions'].map((h) => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3, ease: 'easeOut' }}
                    >
                      <td style={{ ...td, fontWeight: 600 }}>{u.name}</td>
                      <td style={td}>{u.email}</td>
                      <td style={td}>
                        <span className={u.role === 'admin' ? 'chip chip-green' : 'chip chip-gray'}>{u.role}</span>
                      </td>
                      <td style={td}>{(u as unknown as { reports: number }).reports}</td>
                      <td style={{ ...td, color: 'var(--muted)' }}>{u.created_at}</td>
                      <td style={{ ...td, color: 'var(--muted)' }}>{u.last_login ?? '—'}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => changeRole(u, u.role === 'admin' ? 'user' : 'admin')}>
                            {u.role === 'admin' ? 'Make user' : 'Make admin'}
                          </button>
                          <button className="btn-danger" style={{ padding: '6px 10px' }} onClick={() => deleteUser(u)} aria-label={`Delete ${u.email}`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'reports' && (
            <div className="card table-card">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['File', 'Owner', 'Type', 'Size', 'Status', 'Uploaded', 'Actions'].map((h) => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r, i) => (
                    <motion.tr key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3, ease: 'easeOut' }}>
                      <td style={{ ...td, fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.file_name}</td>
                      <td style={td}>{r.user_name} <span className="muted" style={{ fontSize: 11 }}>({r.user_email})</span></td>
                      <td style={td}><span className="chip chip-gray">{r.report_type}</span></td>
                      <td style={td}>{formatSize(r.size)}</td>
                      <td style={td}><span className="chip chip-green">{r.status}</span></td>
                      <td style={{ ...td, color: 'var(--muted)' }}>{r.created_at}</td>
                      <td style={td}>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }} className="btn-danger" style={{ padding: '6px 9px' }} onClick={() => void deleteReportAdmin(r)} aria-label={`Delete ${r.file_name}`} title="Delete report">
                          <Trash2 size={14} />
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                  {reports.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--muted)', fontStyle: 'italic' }}>No reports yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'consults' && (
            <div className="card table-card">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Patient', 'Doctor', 'When', 'Reason', 'Status', 'Update'].map((h) => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {consults.map((c, i) => (
                    <motion.tr key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3, ease: 'easeOut' }}>
                      <td style={td}>{c.user_name} <span className="muted" style={{ fontSize: 11 }}>({c.user_email})</span></td>
                      <td style={{ ...td, fontWeight: 600 }}>{c.doctor_name}</td>
                      <td style={td}>{c.date} · {c.time}</td>
                      <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.reason}</td>
                      <td style={td}>
                        <span className={c.status === 'confirmed' ? 'chip chip-green' : c.status === 'pending' ? 'chip chip-amber' : 'chip chip-gray'}>{c.status}</span>
                      </td>
                      <td style={td}>
                        <select
                          className="input"
                          style={{ padding: '6px 10px', fontSize: 12.5, width: 'auto' }}
                          value={c.status}
                          onChange={(e) => void setConsultStatus(c.id, e.target.value as ConsultRequest['status'])}
                          aria-label="Update consult status"
                        >
                          {['pending', 'confirmed', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </motion.tr>
                  ))}
                  {consults.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--muted)', fontStyle: 'italic' }}>No consult requests</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'audit' && (
            <div className="card table-card">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['#', 'Action', 'User', 'Detail', 'IP', 'Time'].map((h) => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a, i) => (
                    <motion.tr key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3, ease: 'easeOut' }}>
                      <td style={{ ...td, color: 'var(--muted)' }}>{a.id}</td>
                      <td style={td}><span className="chip chip-green">{a.action}</span></td>
                      <td style={td}>{a.user_email ?? '—'}</td>
                      <td style={{ ...td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.detail || '—'}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>{a.ip || '—'}</td>
                      <td style={{ ...td, color: 'var(--muted)' }}>{a.created_at}</td>
                    </motion.tr>
                  ))}
                  {audit.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--muted)', fontStyle: 'italic' }}>No audit events yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
