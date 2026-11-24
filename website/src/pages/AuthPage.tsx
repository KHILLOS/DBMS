import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Cross, Lock, Mail, Phone, KeyRound, ArrowLeft, ShieldCheck, FileLock2 } from 'lucide-react'
import GrassStrip from '../components/GrassStrip'
import Captcha from '../components/Captcha'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { staggerContainer, riseItem } from '../lib/motion'
import { useLiteMode } from '../lib/perf'
import { usePageTitle } from '../lib/usePageTitle'

type Method = 'google' | 'phone' | 'password'
type PhoneStep = 'enter' | 'verify'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 16px',
  borderRadius: 14,
  fontSize: 14,
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4 5.6l6.3 5.3C41.6 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  )
}

/** Visual-only password strength meter (register mode). */
function pwStrength(pw: string): { score: number; label: string } {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  const labels = ['Too short', 'Weak', 'Okay', 'Good', 'Strong', 'Excellent']
  return { score: Math.min(s, 5), label: labels[Math.min(s, 5)] }
}

function StrengthMeter({ pw }: { pw: string }) {
  const { score, label } = pwStrength(pw)
  if (!pw) return null
  const color = score <= 1 ? 'var(--danger)' : score <= 3 ? 'var(--amber)' : 'var(--green)'
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 8 }} aria-label={`Password strength: ${label}`}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            initial={false}
            animate={{ opacity: i < score ? 1 : 0.18, scaleX: i < score ? 1 : 0.6 }}
            style={{ flex: 1, height: 4, borderRadius: 99, background: color }}
          />
        ))}
      </div>
      <span className="muted" style={{ fontSize: 11.5, fontWeight: 600 }}>{label}</span>
    </motion.div>
  )
}

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register, loginPhone, requestOtp } = useAuth()
  const reduceMotion = useReducedMotion()
  const lite = useLiteMode()
  const still = reduceMotion || lite
  const { resolvedTheme } = useTheme()
  usePageTitle(isLogin ? 'Sign in' : 'Create account')

  const [method, setMethod] = useState<Method>(isLogin ? 'password' : 'password')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const otpShakeRef = useRef<HTMLDivElement>(null)

  // password form
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [captcha, setCaptcha] = useState({ token: '', answer: '' })
  const formLoadedAt = useRef(Date.now())
  const honeypot = useRef('')

  // phone otp flow
  const [phone, setPhone] = useState('')
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('enter')
  const [otp, setOtp] = useState('')
  const [devCode, setDevCode] = useState('')

  // Shake the OTP box when verification fails (skipped for reduced motion)
  useEffect(() => {
    if (!error || phoneStep !== 'verify') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    otpShakeRef.current?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-7px)' },
        { transform: 'translateX(7px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 320, easing: 'ease-out' },
    )
  }, [error, phoneStep])

  const done = (msg: string) => {
    toast.success(msg)
    const from = (location.state as { from?: string } | null)?.from
    navigate(from && !['/login', '/register'].includes(from) ? from : '/', { replace: true })
  }

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!isLogin) {
      if (form.password !== form.confirm) { setError('Passwords do not match'); return }
      if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
      if (!captcha.answer) { setError('Please solve the human check'); return }
    }
    setBusy(true); setError('')
    try {
      const extra = { captchaToken: captcha.token, captchaAnswer: captcha.answer, website: honeypot.current, formLoadedAt: formLoadedAt.current }
      if (isLogin) await login(form.email, form.password, extra)
      else await register(form.email, form.password, form.name, extra)
      done(isLogin ? 'Welcome back' : 'Locker created — welcome!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setCaptcha({ token: captcha.token, answer: '' })
    } finally {
      setBusy(false)
    }
  }

  const requestCode = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const r = await requestOtp(phone)
      setPhoneStep('verify')
      if (r.demo && r.dev_code) {
        setDevCode(r.dev_code)
        toast.success('Demo mode — code shown below (no SMS gateway yet)', { duration: 5000 })
      } else {
        toast.success('Code sent')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setBusy(false)
    }
  }

  const verifyCode = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await loginPhone(phone, otp)
      done('Signed in with phone')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  const fillDemo = () => setOtp(devCode)

  return (
    <div style={{ minHeight: '82vh', display: 'grid', placeItems: 'center' }}>
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="card card-glow"
        style={{ width: 'min(94vw, 900px)', overflow: 'hidden', padding: 0 }}
      >
        <div className="auth-split" style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
          {/* Brand panel */}
          <div className="auth-brand" style={{
            background: 'linear-gradient(150deg, #3B6320 0%, #223F12 100%)',
            color: '#E8F5F0', padding: '34px 30px', display: 'flex', flexDirection: 'column', gap: 18, position: 'relative', overflow: 'hidden',
          }}>
            {/* Theme-matched ambient video texture */}
            <video
              className="auth-brand-video"
              src={`/product_${resolvedTheme}.mp4`}
              autoPlay loop muted playsInline
              disablePictureInPicture
              aria-hidden
            />
            <motion.div aria-hidden style={{ position: 'absolute', width: 300, height: 300, right: -80, top: -80, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} animate={still ? undefined : { scale: [1, 1.12, 1] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }} />
            <motion.div aria-hidden style={{ position: 'absolute', width: 200, height: 200, left: -60, bottom: -60, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} animate={still ? undefined : { scale: [1, 1.18, 1] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }} />

            {/* Floating glass security chips */}
            {[
              { Icon: ShieldCheck, top: '24%', right: '14%', delay: 0, size: 46 },
              { Icon: FileLock2, top: '52%', right: '7%', delay: 1.4, size: 38 },
              { Icon: Lock, top: '76%', right: '21%', delay: 2.6, size: 34 },
            ].map(({ Icon, top, right, delay, size }) => (
              <div key={delay} className="brand-chip floaty" aria-hidden style={{ position: 'absolute', top, right, width: size, height: size, animationDelay: `${delay}s` }}>
                <Icon size={Math.round(size * 0.44)} color="#E8F5F0" />
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,.25)' }}>
                <Cross size={20} color="#E8F5F0" fill="#E8F5F0" />
              </span>
              <span>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 17 }}>MED</span>
                <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, opacity: 0.8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Health Locker</span>
              </span>
            </div>

            <div style={{ position: 'relative' }}>
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                {isLogin ? 'Welcome back to your locker.' : 'Your health, locked to you.'}
              </h2>
              <p style={{ margin: '12px 0 0', fontSize: 13.5, lineHeight: 1.65, opacity: 0.85 }}>
                Sign in with Google, a phone OTP, or email — reports stay private and server-side validated.
              </p>
            </div>

            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 12, fontSize: 13, opacity: 0.92, position: 'relative' }}>
              {[
                { icon: ShieldMark, text: 'bcrypt passwords · JWT httpOnly cookies · rate limits' },
                { icon: ShieldQuestionMark, text: 'Captcha + honeypot + speed checks on sign-up' },
                { icon: PhoneMark, text: 'Phone OTP with 5 attempts and 5-minute expiry' },
              ].map(({ icon, text }) => (
                <li key={text} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{icon}{text}</li>
              ))}
            </ul>
            <GrassStrip className="auth-grass" height={36} blades={30} />
          </div>

          {/* Form panel */}
          <div className="auth-form glass" style={{ padding: '30px 28px', borderRadius: 0 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>{isLogin ? 'Sign in' : 'Create your locker'}</h1>
            <p className="muted" style={{ margin: '6px 0 20px', fontSize: 14 }}>
              {isLogin ? 'Access your private health archive.' : 'Free forever — your data stays yours.'}
            </p>

            {/* Method switcher */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--mint-2)', padding: 5, borderRadius: 999, border: '1px solid var(--line)' }}>
              {([
                { id: 'google', label: 'Google', icon: <GoogleMark /> },
                { id: 'phone', label: 'Phone OTP', icon: <Phone size={14} /> },
                { id: 'password', label: 'Email + Password', icon: <Mail size={14} /> },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setMethod(m.id); setError('') }}
                  style={{ position: 'relative', flex: 1, border: 'none', background: 'transparent', padding: '9px 4px', borderRadius: 999, fontWeight: 600, fontSize: 12.5, color: method === m.id ? '#fff' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'color .2s', fontFamily: 'Inter, sans-serif' }}
                  aria-pressed={method === m.id}
                >
                  {method === m.id && (
                    <motion.span
                      layoutId={`auth-method-${mode}`}
                      style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--btn-grad)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{m.icon}<span className="auth-method-label">{m.label}</span></span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {/* GOOGLE */}
              {method === 'google' && (
                <motion.div key="g" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.25 }} style={{ display: 'grid', gap: 14 }}>
                  <a href="/api/auth/google" className="btn-google" style={{ textDecoration: 'none' }}>
                    <GoogleMark /> Continue with Google
                  </a>
                  <p className="muted" style={{ fontSize: 12.5, textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                    Needs <code>GOOGLE_CLIENT_ID</code> + <code>GOOGLE_CLIENT_SECRET</code> set on the server — until then it shows a clear "not configured" notice instead of failing silently.
                  </p>
                </motion.div>
              )}

              {/* PHONE OTP */}
              {method === 'phone' && (
                <motion.div key="p" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.25 }}>
                  {phoneStep === 'enter' ? (
                    <form onSubmit={requestCode} style={{ display: 'grid', gap: 14 }}>
                      <div>
                        <label htmlFor="phone" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>Phone number</label>
                        <input id="phone" style={inputStyle} className="input" placeholder="+91 98765 43210" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" />
                        <p className="muted" style={{ margin: '6px 0 0', fontSize: 11.5 }}>Include country code. Codes expire in 5 minutes, 5 attempts max.</p>
                      </div>
                      <motion.button whileTap={{ scale: 0.97 }} className="btn-primary" type="submit" disabled={busy} style={{ padding: 13 }}>
                        {busy ? 'Sending…' : 'Send OTP'}
                      </motion.button>
                    </form>
                  ) : (
                    <form onSubmit={verifyCode} style={{ display: 'grid', gap: 14 }}>
                      <button type="button" onClick={() => { setPhoneStep('enter'); setDevCode('') }} style={{ alignSelf: 'start', background: 'none', border: 'none', color: 'var(--green)', fontWeight: 600, fontSize: 12.5, display: 'flex', gap: 4, alignItems: 'center', padding: 0 }}>
                        <ArrowLeft size={14} /> Change number
                      </button>
                      <div ref={otpShakeRef}>
                        <label htmlFor="otp" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                          Enter 6-digit code sent to {phone}
                        </label>
                        <input id="otp" autoFocus style={{ ...inputStyle, letterSpacing: '0.9em', textAlign: 'center', fontWeight: 700, fontSize: 20, paddingLeft: '0.9em', ...(otp.length === 6 ? { borderColor: 'var(--green)', boxShadow: '0 0 0 3px var(--green-08)' } : {}) }} className="otp-input" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required autoComplete="one-time-code" />
                      </div>
                      {devCode && (
                        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="neu-inset" style={{ padding: '12px 14px', fontSize: 13 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <span>Demo code (no SMS gateway):</span>
                            <button type="button" className="chip chip-green" style={{ border: 'none' }} onClick={fillDemo}>{devCode} — tap to fill</button>
                          </div>
                        </motion.div>
                      )}
                      <motion.button whileTap={{ scale: 0.97 }} className="btn-primary" type="submit" disabled={busy || otp.length !== 6} style={{ padding: 13 }}>
                        {busy ? 'Verifying…' : 'Verify & Sign in'}
                      </motion.button>
                      <button type="button" onClick={requestCode} style={{ background: 'none', border: 'none', color: 'var(--green)', fontWeight: 600, fontSize: 12.5 }}>
                        Resend code
                      </button>
                    </form>
                  )}
                </motion.div>
              )}

              {/* PASSWORD */}
              {method === 'password' && (
                <motion.form key="pwd" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.25 }} onSubmit={submitPassword}>
                  <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ display: 'grid', gap: 14 }}>
                  {/* honeypot — bots fill it, humans can't see it */}
                  <input
                    aria-hidden="true" tabIndex={-1} autoComplete="off" name="website"
                    style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    onChange={(e) => { honeypot.current = e.target.value }}
                  />

                  {!isLogin && (
                    <motion.div variants={riseItem}>
                      <label htmlFor="name" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>Full name</label>
                      <input id="name" style={inputStyle} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoComplete="name" placeholder="Your name" />
                    </motion.div>
                  )}
                  <motion.div variants={riseItem}>
                    <label htmlFor="email" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>Email</label>
                    <input id="email" type="email" style={inputStyle} className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" placeholder="you@domain.com" />
                  </motion.div>
                  <motion.div variants={riseItem}>
                    <label htmlFor="password" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>Password</label>
                    <input id="password" type="password" style={inputStyle} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder={isLogin ? '••••••••' : 'Min 8 characters'} />
                    {!isLogin && <StrengthMeter pw={form.password} />}
                  </motion.div>
                  {!isLogin && (
                    <motion.div variants={riseItem}>
                      <label htmlFor="confirm" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>Confirm password</label>
                      <input id="confirm" type="password" style={inputStyle} className="input" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required autoComplete="new-password" placeholder="Repeat it" />
                    </motion.div>
                  )}

                  <motion.div variants={riseItem}>
                    <Captcha value={captcha} onChange={setCaptcha} />
                  </motion.div>

                  {error && (
                    <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>
                      {error}
                    </motion.p>
                  )}

                  <motion.button variants={riseItem} whileTap={{ scale: 0.97 }} className="btn-primary" type="submit" disabled={busy} style={{ padding: 14 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {busy
                        ? <><span className="btn-spinner" aria-hidden /> {isLogin ? 'Signing in…' : 'Creating…'}</>
                        : <><KeyRound size={16} /> {isLogin ? 'Sign In' : 'Create Account'}</>}
                    </span>
                  </motion.button>
                  </motion.div>
                </motion.form>
              )}
            </AnimatePresence>

            {error && method !== 'password' && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert" style={{ margin: '14px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--danger)', textAlign: 'center' }}>
                {error}
              </motion.p>
            )}

            <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
              {isLogin ? (
                <>New here? <Link className="link-underline" to="/register" style={{ color: 'var(--green)', fontWeight: 700, textDecoration: 'none' }}>Create your locker</Link></>
              ) : (
                <>Already registered? <Link className="link-underline" to="/login" style={{ color: 'var(--green)', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link></>
              )}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/* tiny inline icons for the brand checklist */
const ShieldMark = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
)
const ShieldQuestionMark = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="M9 9a3 3 0 0 1 6 .8c0 .8-.6 1.2-1.5 1.6" /><circle cx="12" cy="15" r="0.5" fill="currentColor" />
  </svg>
)
const PhoneMark = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" />
  </svg>
)

export const LockIcon = Lock
