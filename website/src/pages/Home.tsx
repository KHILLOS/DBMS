import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { FileText, Sparkles, Stethoscope, BookOpen, ChevronRight, ChevronDown, Lightbulb, KeyRound, ShieldCheck, LayoutGrid, HeartPulse, Activity, type LucideIcon } from 'lucide-react'
import UploadCard from '../components/UploadCard'
import GrassStrip from '../components/GrassStrip'
import { EmptyState, StatusChip, Modal, CountUp, Magnetic, useTilt, Skeleton } from '../components/ui'
import { staggerInView, riseItem, viewportOnce, staggerContainer } from '../lib/motion'
import { useLiteMode } from '../lib/perf'
import { useAuth } from '../lib/auth'
import { asList, apiGet, type Report } from '../lib/api'
import { greeting, formatDate, formatSize } from '../lib/store'
import { usePageTitle } from '../lib/usePageTitle'
import { DEMO_INSIGHTS, type DemoInsight } from '../lib/demo'

const MotionLink = motion.create(Link)

const quick = [
  { to: '/reports', icon: FileText, label: 'My Reports', desc: 'View all uploaded reports', tone: '' },
  { to: '/ask-ai', icon: Sparkles, label: 'Ask AI', desc: 'Get health insights from reports', tone: 'violet' },
  { to: '/consult', icon: Stethoscope, label: 'Consult Doctor', desc: 'Connect with a doctor', tone: 'blue' },
  { to: '/learn', icon: BookOpen, label: 'Health Library', desc: 'Read health articles', tone: 'amber' },
]

function HeroArt() {
  const reduceMotion = useReducedMotion()
  const lite = useLiteMode()
  const still = reduceMotion || lite
  return (
    <motion.svg
      viewBox="0 0 200 160" width="100%" height="100%" aria-hidden role="img"
      animate={still ? undefined : { y: [0, -8, 0] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <circle cx="100" cy="78" r="62" fill="var(--hero-1)" />
      <circle cx="100" cy="74" r="46" fill="var(--hero-2)" />
      <g className="hero-orbit">
        <circle cx="100" cy="78" r="54" fill="none" stroke="var(--hero-dot)" strokeWidth="1.5" strokeDasharray="3 9" opacity="0.9" />
        <circle cx="154" cy="78" r="4.5" fill="var(--hero-accent)" />
      </g>
      <motion.path
        d="M100 52v44M78 74h44" stroke="var(--hero-accent)" strokeWidth="11" strokeLinecap="round"
        initial={{ opacity: 0.85 }}
        animate={still ? undefined : { opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.path
        d="M22 130h34l8-16 10 30 12-38 10 24h34" fill="none" stroke="var(--hero-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={still ? { pathLength: 1, opacity: 1 } : { pathLength: [0, 1], opacity: [0, 1, 1, 0.75] }}
        transition={still
          ? { duration: 1.6, ease: 'easeOut', delay: 0.3 }
          : { duration: 2.4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.8, delay: 0.3 }}
      />
      <circle cx="160" cy="34" r="7" fill="var(--hero-dot)" />
      <circle cx="36" cy="40" r="5" fill="var(--hero-dot-2)" />
      <circle cx="168" cy="112" r="4.5" fill="var(--hero-dot)" />
    </motion.svg>
  )
}

function ReportRow({ r }: { r: Report }) {
  return (
    <motion.div
      variants={riseItem}
      className="report-row"
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', borderBottom: '1px solid var(--line)', borderRadius: 12 }}
    >
      <div className="icon-bubble"><FileText size={19} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.file_name}</p>
        <p className="muted" style={{ margin: '2px 0 0', fontSize: 12.5 }}>{r.report_type} · {formatDate(r.created_at)} · {formatSize(r.size)}</p>
      </div>
      <StatusChip status={r.status} />
    </motion.div>
  )
}

/** Visitor feature card with 3D tilt + mouse spotlight. */
function FeatureCard({ icon: Icon, tone, title, body }: { icon: LucideIcon; tone: string; title: string; body: string }) {
  const { tiltRef, tiltBind, tiltStyle } = useTilt<HTMLDivElement>()
  return (
    <motion.div
      ref={tiltRef}
      variants={riseItem}
      {...tiltBind}
      className="card card-glow spotlight"
      style={{ padding: 20, ...tiltStyle }}
      whileHover={{ y: -5, boxShadow: 'var(--shadow-lift)' }}
    >
      <motion.div
        className={`icon-bubble ${tone}`}
        whileHover={{ rotate: -8, scale: 1.08 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      >
        <Icon size={20} />
      </motion.div>
      <p className="font-display" style={{ margin: '12px 0 4px', fontWeight: 700, fontSize: 15 }}>{title}</p>
      <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{body}</p>
      <span className="quick-arrow" aria-hidden><ChevronRight size={16} /></span>
    </motion.div>
  )
}

/** Quick-access card with 3D tilt + mouse spotlight (desktop, motion-safe). */
function QuickCard({ to, icon: Icon, label, desc, tone }: {
  to: string; icon: LucideIcon; label: string; desc: string; tone: string
}) {
  const { tiltRef, tiltBind, tiltStyle } = useTilt<HTMLAnchorElement>()
  return (
    <MotionLink
      ref={tiltRef}
      to={to}
      variants={riseItem}
      {...tiltBind}
      className="card card-glow spotlight"
      style={{ padding: 18, textDecoration: 'none', color: 'inherit', display: 'block', ...tiltStyle }}
      whileHover={{ y: -6, boxShadow: 'var(--shadow-lift)' }}
      whileTap={{ scale: 0.97 }}
    >
      <motion.div
        className={`icon-bubble ${tone}`}
        whileHover={{ rotate: -8, scale: 1.08 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      >
        <Icon size={20} />
      </motion.div>
      <span className="quick-arrow" aria-hidden><ChevronRight size={16} /></span>
      <p style={{ margin: '12px 0 2px', fontWeight: 700, fontSize: 14.5 }}>{label}</p>
      <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45 }}>{desc}</p>
    </MotionLink>
  )
}

/** AI insight card with 3D tilt + mouse spotlight. */
function InsightCard({ insight, idx, onOpen }: { insight: DemoInsight; idx: number; onOpen: (i: DemoInsight) => void }) {
  const { tiltRef, tiltBind, tiltStyle } = useTilt<HTMLButtonElement>()
  return (
    <motion.button
      ref={tiltRef}
      onClick={() => onOpen(insight)}
      {...tiltBind}
      className="card card-glow card-lift spotlight"
      style={{ padding: 18, textAlign: 'left', width: '100%', ...tiltStyle }}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: idx * 0.08, ease: 'easeOut' }}
      whileTap={{ scale: 0.98 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5 }}>{insight.title}</p>
        <span className="chip chip-amber">Sample</span>
      </div>
      <p className="font-display" style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--green)', fontWeight: 700 }}>{insight.value}</p>
      <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5 }}>{insight.range}</p>
      <p className="muted" style={{ margin: '8px 0 0', fontSize: 12.5, lineHeight: 1.5 }}>Tap for details →</p>
    </motion.button>
  )
}

export default function Home() {
  usePageTitle('Home')
  const { user, loading: authLoading } = useAuth()
  const reduceMotion = useReducedMotion()
  const lite = useLiteMode()
  const still = reduceMotion || lite
  const [reports, setReports] = useState<Report[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [insight, setInsight] = useState<DemoInsight | null>(null)
  const [now, setNow] = useState(() => new Date())
  const heroRef = useRef<HTMLElement>(null)

  // Scroll-linked hero: content lifts and eases back as you scroll away.
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(heroProgress, [0, 1], [0, -36])
  const heroOpacity = useTransform(heroProgress, [0, 0.85], [1, 0.4])

  // Live clock chip — keeps the hero feeling alive (30s tick).
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  const loadReports = async () => {
    if (!user) { setReports([]); return }
    setReportsLoading(true)
    try { setReports(asList(await apiGet<Report[] | { data: Report[] }>('/reports'))) } catch { /* not signed in */ } finally { setReportsLoading(false) }
  }

  useEffect(() => { if (!authLoading) void loadReports() }, [authLoading, user])

  return (
    <div>
      {/* Greeting — scroll-linked lift/fade (entrance comes from the page transition) */}
      <motion.section
        ref={heroRef}
        className="card greeting-mesh card-glow card-glow-slow corner-brackets"
        style={{
          padding: '24px 24px 44px', display: 'flex', gap: 18, alignItems: 'center', overflow: 'hidden', position: 'relative',
          border: '1px solid var(--glass-border)',
          ...(reduceMotion ? {} : { y: heroY, opacity: heroOpacity }),
        }}
      >
        <motion.div
          aria-hidden
          className="aurora"
          style={{ width: 260, height: 260, right: '-6%', top: '-40%', background: 'radial-gradient(circle, var(--green-08), transparent 65%)' }}
          animate={still ? undefined : { scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <h1 className="section-title" style={{ fontSize: 'clamp(1.45rem, 3vw, 2rem)', lineHeight: 1.15 }}>
            {user ? <>{greeting()}, <span className="grad-text-animated">{user.name.split(' ')[0]}</span></> : <>Welcome to <span className="grad-text-animated">MED Health Locker</span></>}
          </h1>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, maxWidth: 460 }}>
            {user
              ? 'Upload your medical reports to keep them organized in one place — and get easy-to-read health insights.'
              : 'Sign in to upload reports and unlock your private health locker. Everything stays on this server — nothing is shared.'}
          </p>
          <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {user ? (
              <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={reports.length}
                    variants={riseItem}
                    initial={{ scale: 0.85, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="chip chip-green"
                    style={{ display: 'inline-flex' }}
                  >
                    <CountUp value={reports.length} /> &nbsp;report{reports.length === 1 ? '' : 's'} stored
                  </motion.span>
                </AnimatePresence>
                <motion.span variants={riseItem} className="chip chip-gray" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </motion.span>
                {reports.length > 0 && (
                  <motion.span variants={riseItem} className="chip chip-green">{formatSize(reports.reduce((s, r) => s + r.size, 0))} stored</motion.span>
                )}
                {user.role === 'admin' && (
                  <motion.span variants={riseItem}>
                    <Link to="/admin" style={{ textDecoration: 'none' }}><span className="chip chip-amber">Admin</span></Link>
                  </motion.span>
                )}
                <motion.span variants={riseItem} className="chip chip-gray">Stored on server · secured</motion.span>
              </motion.div>
            ) : (
              <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <motion.span variants={riseItem}>
                  <Magnetic strength={0.2}>
                    <Link to="/register" className="btn-primary" style={{ textDecoration: 'none', fontSize: 13.5 }}>
                      <KeyRound size={15} /> Create free account
                    </Link>
                  </Magnetic>
                </motion.span>
                <motion.span variants={riseItem}>
                  <Link to="/login" className="btn-ghost" style={{ textDecoration: 'none', fontSize: 13.5 }}>
                    Sign in
                  </Link>
                </motion.span>
                <motion.span variants={riseItem} className="chip chip-gray">PDF · JPG · PNG ≤ 10 MB</motion.span>
                <motion.span variants={riseItem} className="chip chip-gray">100% on-server</motion.span>
              </motion.div>
            )}
          </div>
        </div>
        <div className="hidden md:block" style={{ width: 230, height: 180, flexShrink: 0, position: 'relative' }}>
          <div aria-hidden style={{ position: 'absolute', inset: '-12%', borderRadius: '50%', background: 'radial-gradient(circle, var(--green-08), transparent 68%)' }} />
          <HeroArt />
          <span className="hero-chip floaty" aria-hidden style={{ top: '-6%', left: '6%', animationDelay: '.5s' }}><HeartPulse size={15} /></span>
          <span className="hero-chip floaty" aria-hidden style={{ bottom: '-4%', right: '4%', animationDelay: '1.7s' }}><Activity size={15} /></span>
          <span className="hero-chip floaty" aria-hidden style={{ top: '42%', right: '-8%', animationDelay: '2.9s' }}><Stethoscope size={14} /></span>
        </div>
        <GrassStrip className="hero-grass" height={32} blades={24} />
      </motion.section>

      {/* Upload */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        style={{ marginTop: 26 }}
      >
        {user ? (
          <UploadCard large onUploaded={() => void loadReports()} />
        ) : (
          <Link to="/login" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="card card-glow card-glow-slow upload-zone" style={{ padding: '30px 26px 46px', textAlign: 'center', borderRadius: 22, position: 'relative', overflow: 'hidden' }}>
              <div style={{ width: 54, height: 54, margin: '0 auto 14px', borderRadius: 999, background: 'var(--btn-grad)', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 12px 24px -10px var(--green-glow)' }}>
                <KeyRound size={24} />
              </div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>Sign in to upload a medical report</p>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Free account · PDF, JPG, PNG up to 10 MB · stored privately on this server</p>
              <span className="btn-primary" style={{ marginTop: 16 }}>Sign in / Create account</span>
              <GrassStrip className="cta-grass" height={30} blades={20} />
            </div>
          </Link>
        )}
      </motion.section>

      {/* Visitor features strip */}
      {!user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={still ? { opacity: 1 } : { opacity: 1, y: [0, 6, 0] }}
          transition={still ? { duration: 0.3 } : { y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.3 } }}
          style={{ textAlign: 'center', marginTop: 16 }}
          aria-hidden
        >
          <ChevronDown size={18} color="var(--muted)" />
        </motion.div>
      )}
      {!user && (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ marginTop: 26 }}
        >
          <span className="overline quiet">Why MED</span>
          <h2 className="section-title" style={{ margin: '0 0 14px', fontSize: '1.25rem' }}>Built like a product. Private like your diary.</h2>
          <motion.div
            variants={staggerInView}
            initial="initial"
            whileInView="whileInView"
            viewport={viewportOnce}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}
          >
            {[
              { icon: ShieldCheck, tone: '', title: 'Private by design', body: 'httpOnly JWT sessions, bcrypt passwords and per-user file ownership — nothing ever leaves your server.' },
              { icon: LayoutGrid, tone: 'blue', title: 'Organized locker', body: 'Upload PDFs and images, then search, preview and manage everything from one clean dashboard.' },
              { icon: Sparkles, tone: 'violet', title: 'Honest AI assistant', body: 'The assistant stays truthful in demo mode — no invented findings until a real AI backend is wired in.' },
            ].map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </motion.div>
        </motion.section>
      )}

      <div className="section-sep" aria-hidden />

      {/* Quick access */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="cv-auto"
        style={{ marginTop: 26 }}
      >
        <h2 className="section-title" style={{ margin: '0 0 14px' }}>Quick access</h2>
        <motion.div
          variants={staggerInView}
          initial="initial"
          whileInView="whileInView"
          viewport={viewportOnce}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}
        >
          {quick.map(({ to, icon, label, desc, tone }) => (
            <QuickCard key={to} to={to} icon={icon} label={label} desc={desc} tone={tone} />
          ))}
        </motion.div>
      </motion.section>

      <div className="section-sep" aria-hidden />

      {/* Recent reports */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="card cv-auto"
        style={{ marginTop: 26, padding: '20px 22px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Recent reports</h2>
          {reports.length > 0 && (
            <Magnetic strength={0.15}>
              <Link to="/reports" className="nudge" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--green)', fontWeight: 600, fontSize: 13.5, textDecoration: 'none' }}>
                See all <ChevronRight size={15} />
              </Link>
            </Magnetic>
          )}
        </div>
        {!user ? (
          <EmptyState title="Private to you" body="Sign in to see your reports here. Files are tied to your account — nobody else can view them." action={<Link to="/login" className="btn-soft" style={{ textDecoration: 'none' }}>Sign in</Link>} />
        ) : reportsLoading ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
                <Skeleton width={38} height={38} radius={12} />
                <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                  <Skeleton height={12} width="55%" />
                  <Skeleton height={10} width="35%" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <EmptyState title="No reports yet" body="Your uploaded medical reports will appear here. Files are stored on the server, tied to your account." />
        ) : (
          <motion.div variants={staggerInView} initial="initial" whileInView="whileInView" viewport={viewportOnce}>
            {reports.slice(0, 3).map((r) => <ReportRow key={r.id} r={r} />)}
            {reports.length > 3 && <p className="muted" style={{ margin: '10px 0 0', fontSize: 12.5 }}>+{reports.length - 3} more in Reports</p>}
          </motion.div>
        )}
      </motion.section>

      <div className="section-sep" aria-hidden />

      {/* AI insights */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="cv-auto"
        style={{ marginTop: 26 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.span animate={still ? undefined : { rotate: [0, -10, 0, 10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} style={{ display: 'inline-flex' }}>
              <Lightbulb size={19} color="var(--green)" />
            </motion.span>
            AI insights for you
          </h2>
          <span className="chip chip-gray">Demo</span>
        </div>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {DEMO_INSIGHTS.map((i, idx) => (
            <InsightCard key={i.id} insight={i} idx={idx} onOpen={setInsight} />
          ))}
        </div>
      </motion.section>

      <Modal open={!!insight} onClose={() => setInsight(null)} title={insight?.title ?? ''}>
        {insight && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="chip chip-amber">Demo insight — sample only</span>
            <p className="font-display" style={{ margin: '16px 0 0', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--green)' }}>{insight.value}</p>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 600 }}>{insight.range}</p>
            <p style={{ margin: '16px 0 0', fontSize: 14, lineHeight: 1.65 }}>{insight.note}</p>
            <Link to="/ask-ai" className="btn-soft nudge" style={{ marginTop: 16, textDecoration: 'none', fontSize: 13 }}>
              <Sparkles size={15} /> Ask AI about this
            </Link>
            <p className="muted" style={{ margin: '16px 0 0', fontSize: 12.5, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              Insights shown here are examples. Real AI analysis will require the AI backend (Claude is working on it).
            </p>
          </motion.div>
        )}
      </Modal>
    </div>
  )
}
