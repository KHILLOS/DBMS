import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Plus, UploadCloud, AlertTriangle } from 'lucide-react'
import { AnimatedCheck, Magnetic } from './ui'
import { uploadReport, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useLiteMode } from '../lib/perf'

const MAX_MB = 10

type Phase = { state: 'idle' } | { state: 'uploading'; progress: number } | { state: 'done'; fileName: string } | { state: 'error'; message: string }

/** One-shot celebration burst — transform/opacity only, skipped for reduced motion. */
function CelebrationBurst() {
  const reduceMotion = useReducedMotion()
  if (reduceMotion) return null
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * 72, y: Math.sin(angle) * 72, opacity: 0, scale: 0.35 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
            style={{ width: 8, height: 8, borderRadius: 99, background: i % 2 ? 'var(--grad-b)' : 'var(--grad-c)', position: 'absolute' }}
          />
        )
      })}
    </div>
  )
}

export default function UploadCard({ onUploaded, large }: { onUploaded?: () => void; large?: boolean }) {
  const { user } = useAuth()
  const reduceMotion = useReducedMotion()
  const lite = useLiteMode()
  const still = reduceMotion || lite
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>({ state: 'idle' })
  const [dragOver, setDragOver] = useState(false)

  const validate = (file: File): string | null => {
    const ok = ['application/pdf', 'image/jpeg', 'image/png']
    if (!ok.includes(file.type)) return 'Only PDF, JPG or PNG files are supported.'
    if (file.size > MAX_MB * 1024 * 1024) return `File is too large — maximum ${MAX_MB} MB.`
    return null
  }

  const handleFile = async (file: File) => {
    const err = validate(file)
    if (err) { setPhase({ state: 'error', message: err }); return }
    if (!user) { setPhase({ state: 'error', message: 'Sign in to upload reports — your locker is private.' }); return }

    setPhase({ state: 'uploading', progress: 0 })
    try {
      const meta = await uploadReport(file, (pct) => setPhase({ state: 'uploading', progress: pct }))
      setPhase({ state: 'done', fileName: meta.file_name })
      onUploaded?.()
    } catch (e) {
      const msg = e instanceof ApiError
        ? (e.status === 401 ? 'Your session expired — sign in again.' : e.message)
        : 'Upload failed. Try again.'
      setPhase({ state: 'error', message: msg })
    }
  }

  const borderColor = dragOver ? 'var(--green)' : phase.state === 'error' ? 'var(--danger-line)' : 'var(--line-strong)'

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label="Upload a medical report — opens file picker, or drop a file here"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) void handleFile(f)
      }}
      animate={{
        scale: dragOver ? 1.012 : 1,
        boxShadow: dragOver ? '0 0 0 5px var(--green-08), 0 18px 44px -18px var(--green-glow)' : '0 0 0 0 rgba(0,0,0,0)',
      }}
      transition={{ duration: 0.2 }}
      className="upload-zone"
      style={{
        border: `1.5px dashed ${borderColor}`,
        borderRadius: 22,
        padding: large ? '30px 26px' : '24px 22px',
        textAlign: 'center',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <motion.div
        aria-hidden
        style={{ position: 'absolute', inset: 0, background: 'radial-gradient(420px 160px at 50% -30%, var(--surface-2), transparent 70%)', pointerEvents: 'none' }}
        animate={still ? undefined : { opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ''
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {phase.state === 'idle' || phase.state === 'error' ? (
          <motion.div key="idle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} style={{ position: 'relative' }}>
            <motion.div
              animate={still ? { rotate: dragOver ? 90 : 0 } : { y: [0, -6, 0], rotate: dragOver ? 90 : 0 }}
              transition={still ? { rotate: { duration: 0.25 } } : { y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 0.25 } }}
              style={{ width: 54, height: 54, margin: '0 auto 14px', borderRadius: 999, background: phase.state === 'error' ? 'linear-gradient(135deg,#C0453B,#8E1F17)' : 'var(--btn-grad)', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 12px 24px -10px var(--green-glow), inset 0 1px 0 rgba(255,255,255,.25)', position: 'relative' }}
            >
              <span className={`upload-target-ring${dragOver ? ' dragging' : ''}`} aria-hidden />
              {phase.state === 'error' ? <AlertTriangle size={24} /> : <Plus size={26} />}
            </motion.div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: large ? 17 : 15.5 }}>Upload a medical report</p>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
              Drag &amp; drop here, or tap to browse — PDF, JPG, PNG up to {MAX_MB} MB · stored on the server, private to you
            </p>
            {phase.state === 'error' && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} role="alert" style={{ margin: '12px 0 0' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>{phase.message}</p>
                {phase.message.includes('Sign in') && (
                  <Link to="/login" className="btn-soft" style={{ marginTop: 10, fontSize: 12.5, textDecoration: 'none', display: 'inline-flex' }}>Sign in</Link>
                )}
              </motion.div>
            )}
            <div style={{ marginTop: 16, display: 'inline-block' }}>
              <Magnetic strength={0.2}>
                <span className="btn-primary"><Plus size={17} /> Choose file</span>
              </Magnetic>
            </div>
          </motion.div>
        ) : phase.state === 'uploading' ? (
          <motion.div key="uploading" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} style={{ padding: '6px 0', position: 'relative' }}>
            <motion.div
              className="icon-bubble"
              style={{ margin: '0 auto 12px', width: 50, height: 50, borderRadius: 999 }}
              animate={still ? undefined : { scale: [1, 1.08, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <UploadCloud size={22} />
            </motion.div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15.5 }}>Uploading…</p>
            <div className="progress-shine" style={{ margin: '14px auto 6px', maxWidth: 300, height: 9, borderRadius: 99, background: 'var(--line)', overflow: 'hidden', boxShadow: 'inset 2px 2px 6px var(--green-08)' }}>
              <motion.div
                style={{ height: '100%', background: 'linear-gradient(90deg, var(--grad-b), var(--grad-a))', borderRadius: 99 }}
                animate={{ width: `${phase.progress}%` }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              />
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{phase.progress}%</p>
          </motion.div>
        ) : (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} style={{ padding: '6px 0', position: 'relative' }}>
            <CelebrationBurst />
            <div style={{ position: 'relative', width: 54, height: 54, margin: '0 auto 12px' }}>
              <span className="ripple-ring" />
              <span className="ripple-ring" style={{ animationDelay: '0.25s' }} />
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 17 }}
                style={{ width: 54, height: 54, borderRadius: 999, background: 'var(--btn-grad)', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 12px 26px -10px var(--green-glow)' }}
              >
                <AnimatedCheck size={24} />
              </motion.div>
            </div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15.5 }}>Uploaded successfully</p>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13, maxWidth: 320, marginInline: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phase.fileName}</p>
            <button className="glass-btn" style={{ marginTop: 14 }} onClick={(e) => { e.stopPropagation(); setPhase({ state: 'idle' }) }}>
              Upload another
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
