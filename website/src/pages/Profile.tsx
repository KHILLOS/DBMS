import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { User, Save, Trash2, FileText, CalendarClock, Bell, ShieldCheck, Lock } from 'lucide-react'
import { CountUp, AnimatedCheck } from '../components/ui'
import { useAuth } from '../lib/auth'
import { asList, apiGet, apiPost, apiPut, ApiError, type Report, type ConsultRequest, type NotificationRow } from '../lib/api'
import { usePageTitle } from '../lib/usePageTitle'
import { formatDate } from '../lib/store'

export default function Profile() {
  usePageTitle('Profile')
  const { user, refresh, logout } = useAuth()
  const [profile, setProfile] = useState({ name: '', phone: '', age: '' })
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [counts, setCounts] = useState({ reports: 0, consults: 0, notifications: 0 })

  useEffect(() => {
    if (user) setProfile({ name: user.name, phone: user.phone ?? '', age: user.age ?? '' })
  }, [user])

  useEffect(() => {
    if (!user) return
    Promise.allSettled([
      apiGet<Report[] | { data: Report[] }>('/reports').then((r) => setCounts((c) => ({ ...c, reports: asList(r).length }))),
      apiGet<ConsultRequest[] | { data: ConsultRequest[] }>('/consults').then((r) => setCounts((c) => ({ ...c, consults: asList(r).length }))),
      apiGet<NotificationRow[] | { data: NotificationRow[] }>('/notifications').then((r) => setCounts((c) => ({ ...c, notifications: asList(r).length }))),
    ])
  }, [user])

  const saveDetails = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await apiPut('/auth/me', profile)
      await refresh()
      toast.success('Profile saved')
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1400)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (pw.next !== pw.confirm) { toast.error('New passwords do not match'); return }
    if (pw.next.length < 8) { toast.error('New password must be at least 8 characters'); return }
    setPwBusy(true)
    try {
      await apiPost('/auth/change-password', { current: pw.current, next: pw.next })
      toast.success('Password updated')
      setPw({ current: '', next: '', confirm: '' })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to change password')
    } finally {
      setPwBusy(false)
    }
  }

  const initials = (user?.name ?? 'U').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <span className="overline">Account</span>
        <h1 className="section-title" style={{ fontSize: '1.5rem', margin: 0 }}>Profile</h1>
        <p className="muted" style={{ margin: '8px 0 20px', fontSize: 14 }}>Your account details, security and locker stats.</p>
      </motion.div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, delay: 0.06 }} className="card card-glow" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <motion.div
              className="avatar-ring"
              whileHover={{ scale: 1.06, rotate: -3 }}
              transition={{ type: 'spring', stiffness: 350, damping: 16 }}
              style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--btn-grad)', color: '#E8F5F0', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 20, boxShadow: '0 10px 22px -8px var(--green-glow), inset 0 1px 0 rgba(255,255,255,.2)' }}
            >
              {initials}
            </motion.div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <User size={16} color="var(--green)" /> {user?.name}
                {user?.role === 'admin' && <span className="chip chip-amber" style={{ fontSize: 10 }}><ShieldCheck size={10} /> Admin</span>}
              </p>
              <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>
                {user?.email}{user?.created_at ? ` · joined ${formatDate(user.created_at)}` : ''}
              </p>
            </div>
          </div>

          <form onSubmit={saveDetails} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label htmlFor="name" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>Full name</label>
              <input id="name" className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
            </div>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>Email (read-only)</label>
              <input id="email" className="input" value={user?.email ?? ''} disabled style={{ opacity: 0.7 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label htmlFor="phone" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>Phone (optional)</label>
                <input id="phone" className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              </div>
              <div>
                <label htmlFor="age" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>Age (optional)</label>
                <input id="age" className="input" inputMode="numeric" value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })} />
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} className="btn-primary" type="submit" disabled={busy}>
              {savedFlash
                ? <><AnimatedCheck size={17} /> Saved</>
                : busy ? 'Saving…' : <><Save size={16} /> Save changes</>}
            </motion.button>
          </form>
        </motion.div>

        <div style={{ display: 'grid', gap: 18 }}>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, delay: 0.12 }} className="card" style={{ padding: 22 }}>
            <h2 className="section-title" style={{ margin: '0 0 14px' }}>Your locker stats</h2>
            {[
              { icon: FileText, label: 'Reports stored', value: counts.reports },
              { icon: CalendarClock, label: 'Consult requests', value: counts.consults },
              { icon: Bell, label: 'Notifications', value: counts.notifications },
            ].map(({ icon: Icon, label, value }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
                whileHover={{ x: 4 }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px', borderRadius: 12, borderBottom: '1px solid var(--line)', transition: 'background .15s ease' }}
              >
                <motion.div className="icon-bubble" style={{ width: 38, height: 38, borderRadius: 12 }} whileHover={{ rotate: -8, scale: 1.08 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}><Icon size={17} /></motion.div>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label}</span>
                <strong className="font-display" style={{ fontSize: 17, fontVariantNumeric: 'tabular-nums' }}><CountUp value={value} /></strong>
              </motion.div>
            ))}
            <p className="muted" style={{ margin: '12px 0 0', fontSize: 12.5, lineHeight: 1.6 }}>
              Files are stored on the server (server/uploads) and only visible to your signed-in account.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, delay: 0.18 }} className="card" style={{ padding: 22 }}>
            <h2 className="section-title" style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={18} color="var(--green)" /> Change password
            </h2>
            <form onSubmit={changePassword} style={{ display: 'grid', gap: 12 }}>
              <input className="input" type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" />
              <input className="input" type="password" placeholder="New password (min 8 chars)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required autoComplete="new-password" />
              <input className="input" type="password" placeholder="Confirm new password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required autoComplete="new-password" />
              <motion.button whileTap={{ scale: 0.97 }} className="btn-soft" type="submit" disabled={pwBusy}>
                {pwBusy
                  ? <><span className="btn-spinner btn-spinner-soft" aria-hidden /> Updating…</>
                  : <>Update password</>}
              </motion.button>
            </form>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, delay: 0.24 }} className="card card-danger" style={{ padding: 22 }}>
            <h2 className="section-title" style={{ margin: '0 0 8px', color: 'var(--danger)' }}>Sign out</h2>
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>End this session on this device. You can sign back in anytime.</p>
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="btn-danger"
              style={{ marginTop: 14 }}
              onClick={() => void logout().then(() => toast.success('Signed out'))}
            >
              <Trash2 size={16} /> Sign out
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
