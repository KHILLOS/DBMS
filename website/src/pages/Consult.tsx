import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Star, CalendarClock, Stethoscope } from 'lucide-react'
import { Modal, AnimatedCheck, useTilt, Skeleton } from '../components/ui'
import { DEMO_DOCTORS, type DemoDoctor } from '../lib/demo'
import { asList, apiGet, apiPost, ApiError, type ConsultRequest } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/store'
import { usePageTitle } from '../lib/usePageTitle'

const statusChip: Record<string, string> = {
  pending: 'chip chip-amber',
  confirmed: 'chip chip-green',
  completed: 'chip chip-gray',
  cancelled: 'chip chip-error',
}

/** Doctor card with 3D tilt + mouse spotlight (desktop, motion-safe). */
const AVATAR_TONE_COUNT = 4

function DoctorCard({ doctor: d, index, onRequest, signedIn }: {
  doctor: DemoDoctor
  index: number
  onRequest: (d: DemoDoctor) => void
  signedIn: boolean
}) {
  const { tiltRef, tiltBind, tiltStyle } = useTilt<HTMLDivElement>()
  return (
    <motion.div
      ref={tiltRef}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.06 }}
      {...tiltBind}
      className="card card-glow spotlight"
      style={{ padding: 18, ...tiltStyle }}
      whileHover={{ y: -5, boxShadow: 'var(--shadow-lift)' }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
          <motion.div
            whileHover={{ scale: 1.08, rotate: -4 }}
            transition={{ type: 'spring', stiffness: 380, damping: 16 }}
            className={`doc-tone doc-tone-${index % AVATAR_TONE_COUNT}`}
            style={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15, border: '2px solid var(--page-elevated)', boxShadow: '0 6px 16px -6px var(--green-glow)' }}
          >
            {d.name.split(' ').slice(1).map((p) => p[0]).join('')}
          </motion.div>
          <span className="pulse-dot" style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 99, background: '#22B47E', border: '2px solid var(--page-elevated)' }} />
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{d.name}</p>
          <p className="muted" style={{ margin: '2px 0 0', fontSize: 12.5 }}>{d.specialty} · {d.hospital}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <span className="chip chip-green"><Star size={11} /> {d.rating}</span>
        <span className="chip chip-gray">{d.experience} exp</span>
        <span className="chip chip-gray"><CalendarClock size={11} /> {d.nextSlot}</span>
        {d.nextSlot.toLowerCase().includes('today') && (
          <span className="pulse-dot" aria-label="Available today" style={{ width: 8, height: 8, borderRadius: 99, background: '#22B47E', display: 'inline-block' }} />
        )}
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="btn-primary"
        style={{ width: '100%', marginTop: 14 }}
        onClick={() => { if (!signedIn) { toast.error('Sign in to request an appointment'); return } onRequest(d) }}
        disabled={!signedIn}
      >
        <Stethoscope size={16} /> {signedIn ? 'Request Appointment' : 'Sign in to request'}
      </motion.button>
    </motion.div>
  )
}

export default function Consult() {
  usePageTitle('Consult a Doctor')
  const { user } = useAuth()
  const [selected, setSelected] = useState<DemoDoctor | null>(null)
  const [requests, setRequests] = useState<ConsultRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ date: '', time: '', reason: '' })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const load = async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try { setRequests(asList(await apiGet<ConsultRequest[] | { data: ConsultRequest[] }>('/consults'))) } catch { /* ignore */ } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [user])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected || !user) return
    setBusy(true)
    try {
      await apiPost('/consults', { doctorId: selected.id, doctorName: selected.name, date: form.date, time: form.time, reason: form.reason })
      setSent(true)
      setForm({ date: '', time: '', reason: '' })
      void load()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to send request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <span className="overline">Appointments</span>
        <h1 className="section-title" style={{ fontSize: '1.5rem', margin: 0 }}>Consult a Doctor</h1>
        <p className="muted" style={{ margin: '8px 0 20px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>
            Request an appointment. <span className="chip chip-amber" style={{ verticalAlign: 'middle' }}>Demo doctors</span> requests are stored on the server.
          </span>
          <span className="chip chip-green"><Stethoscope size={11} /> {DEMO_DOCTORS.length} specialists</span>
        </p>
      </motion.div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {DEMO_DOCTORS.map((d, i) => (
          <DoctorCard key={d.id} doctor={d} index={i} onRequest={(doc) => { setSelected(doc); setSent(false) }} signedIn={!!user} />
        ))}
      </div>

      {user && (
        <motion.section initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, ease: 'easeOut' }} className="card" style={{ marginTop: 24, padding: '18px 20px' }}>
          <h2 className="section-title" style={{ margin: '0 0 10px' }}>Your requests</h2>
          {loading ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {[0, 1].map((i) => <Skeleton key={i} height={40} radius={12} />)}
            </div>
          ) : requests.length === 0 ? (
            <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>No requests yet — pick a doctor above and request an appointment.</p>
          ) : (
            requests.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
                whileHover={{ x: 4 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 6px', borderRadius: 12, borderBottom: '1px solid var(--line)', fontSize: 13.5, flexWrap: 'wrap' }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <strong>{r.doctor_name}</strong> <span className="muted">· {r.date} at {r.time}</span>
                  <p className="muted" style={{ margin: '3px 0 0', fontSize: 12.5 }}>{r.reason}</p>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: 11.5 }}>Requested {formatDateTime(r.created_at)}</p>
                </div>
                <span className={statusChip[r.status] ?? 'chip chip-gray'}>{r.status}</span>
              </motion.div>
            ))
          )}
        </motion.section>
      )}

      <Modal open={!!selected} onClose={() => !busy && setSelected(null)} title={selected ? `Request — ${selected.name}` : ''}>
        {selected && !sent ? (
          <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 14, background: 'var(--mint-2)', border: '1px solid var(--line)' }}>
              <div className={`doc-tone doc-tone-${DEMO_DOCTORS.findIndex((x) => x.id === selected.id) % AVATAR_TONE_COUNT}`} style={{ width: 46, height: 46, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, border: '2px solid var(--page-elevated)' }}>
                {selected.name.split(' ').slice(1).map((p) => p[0]).join('')}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5 }}>{selected.name}</p>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: 12.5 }}>{selected.specialty} · {selected.hospital}</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input className="input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Preferred date" />
              <input className="input" type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} aria-label="Preferred time" />
            </div>
            <textarea className="input" rows={3} placeholder="Reason for consultation…" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} aria-label="Reason" style={{ resize: 'vertical' }} />
            <motion.button whileTap={{ scale: 0.97 }} className="btn-primary" type="submit" disabled={busy}>
              {busy ? <><span className="btn-spinner" aria-hidden /> Sending…</> : <><Stethoscope size={16} /> Send Request</>}
            </motion.button>
            <p className="muted" style={{ margin: 0, fontSize: 11.5, textAlign: 'center' }}>Demo doctors — requests are saved to your account but no clinic is contacted.</p>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 4px' }}>
            <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 12px' }}>
              <span className="ripple-ring" />
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 17 }}
                style={{ width: 56, height: 56, borderRadius: 999, background: 'var(--btn-grad)', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 12px 26px -10px var(--green-glow)' }}
              >
                <AnimatedCheck size={24} />
              </motion.div>
            </div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>Request recorded</p>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>Saved to your account. An admin will see it in the Control Room (demo).</p>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setSelected(null)}>Done</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
