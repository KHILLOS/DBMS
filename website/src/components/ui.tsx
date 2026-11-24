import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { motion, AnimatePresence, useInView, useMotionValue, useReducedMotion, useScroll, useSpring } from 'framer-motion'
import { X, FileText } from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Modal — glass panel, spring entrance, Escape + focus trap            */
/* ------------------------------------------------------------------ */

/** Scroll progress bar for tall modal content — mounted inside the dialog
    (only when open) so its useScroll container ref is resolved. */
function ModalProgress({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const { scrollYProgress } = useScroll({ container: containerRef })
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 })
  return <motion.div className="modal-progress" style={{ scaleX }} aria-hidden />
}

export function Modal({ open, onClose, title, children, wide, progress }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
  progress?: boolean
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const node = dialogRef.current
      if (!node) return
      const focusables = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(4,16,12,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 60 }}
            aria-hidden
          />
          <motion.div
            ref={dialogRef}
            role="dialog" aria-modal="true" aria-label={title}
            tabIndex={-1}
            initial={{ opacity: 0, y: 26, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 26, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="modal-panel"
            style={{
              position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
              zIndex: 61, width: 'min(92vw, 560px)', maxHeight: '85vh', overflow: 'auto', padding: 0,
              borderRadius: 22, outline: 'none',
              ...(wide ? { width: 'min(94vw, 860px)' } : {}),
            }}
          >
            {progress && <ModalProgress containerRef={dialogRef} />}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px',
              borderBottom: '1px solid var(--line)',
              background: 'var(--mint-2)',
            }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{title}</h2>
              <button onClick={onClose} aria-label="Close dialog" className="btn-ghost" style={{ padding: '8px', borderRadius: '10px', border: 'none', background: 'transparent' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '22px' }}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ */
/* EmptyState — floaty icon, refined copy block                        */
/* ------------------------------------------------------------------ */

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '36px 20px' }}>
      <div className="icon-bubble floaty empty-orbit" style={{ margin: '0 auto 14px', width: 56, height: 56, borderRadius: 18 }}>
        <FileText size={24} />
      </div>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>{title}</p>
      <p className="muted" style={{ margin: '6px auto 0', fontSize: '13.5px', maxWidth: 340 }}>{body}</p>
      {action && <div style={{ marginTop: '16px' }}>{action}</div>}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Skeleton — themed shimmer                                            */
/* ------------------------------------------------------------------ */

export function Skeleton({ height = 20, width = '100%', radius = 8 }: { height?: number; width?: number | string; radius?: number }) {
  return (
    <div style={{ height, width, borderRadius: radius, background: 'linear-gradient(90deg, var(--line) 25%, var(--page-elevated) 50%, var(--line) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }}>
      <style>{`@keyframes shimmer { 0% {background-position: 200% 0} 100% {background-position: -200% 0} }`}</style>
    </div>
  )
}

/** Route-level Suspense fallback. */
export function PageSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 18 }} aria-busy="true" aria-label="Loading page">
      <Skeleton height={130} radius={22} />
      <Skeleton height={190} radius={22} />
      <Skeleton height={84} radius={22} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* StatusChip                                                           */
/* ------------------------------------------------------------------ */

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    Uploaded: 'chip chip-green',
    Processing: 'chip chip-amber',
    Analyzed: 'chip chip-green',
    Error: 'chip chip-error',
  }
  const cls = map[status] ?? 'chip chip-gray'
  return (
    <motion.span initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cls}>
      {status}
    </motion.span>
  )
}

/* ------------------------------------------------------------------ */
/* AnimatedCheck / TypingDots / CountUp / Magnetic                     */
/* ------------------------------------------------------------------ */

export function AnimatedCheck({ size = 24 }: { size?: number }) {
  return (
    <motion.svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <motion.path
        d="M5 13l4 4L19 7"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut', delay: 0.15 }}
      />
    </motion.svg>
  )
}

export function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', height: 18 }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--muted)', display: 'inline-block' }}
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

export function CountUp({ value, style, className }: { value: number; style?: CSSProperties; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { damping: 28, stiffness: 110 })
  const inView = useInView(ref, { once: true, margin: '-30px' })

  useEffect(() => { if (inView) mv.set(value) }, [inView, value, mv])
  useEffect(() => spring.on('change', (v) => { if (ref.current) ref.current.textContent = String(Math.round(v)) }), [spring])

  return <span ref={ref} className={className} style={style}>0</span>
}

/** Magnetic hover wrapper — element gently follows the cursor. */
export function Magnetic({ children, strength = 0.25 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useSpring(0, { stiffness: 180, damping: 14 })
  const y = useSpring(0, { stiffness: 180, damping: 14 })

  return (
    <motion.div
      ref={ref}
      style={{ x, y, display: 'inline-block' }}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect()
        if (!r) return
        x.set((e.clientX - (r.left + r.width / 2)) * strength)
        y.set((e.clientY - (r.top + r.height / 2)) * strength)
      }}
      onMouseLeave={() => { x.set(0); y.set(0) }}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* useTilt — 3D tilt + mouse-follow spotlight for cards.                */
/* Motion values update the DOM directly (zero React re-renders);      */
/* spotlight coords ride CSS vars consumed by `.spotlight::after`.      */
/* Disabled for prefers-reduced-motion.                                 */
/* ------------------------------------------------------------------ */

export function useTilt<T extends HTMLElement = HTMLDivElement>(max = 6) {
  const reduceMotion = useReducedMotion()
  const rx = useSpring(0, { stiffness: 260, damping: 22 })
  const ry = useSpring(0, { stiffness: 260, damping: 22 })
  const ref = useRef<T | null>(null)

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    ry.set((px - 0.5) * 2 * max)
    rx.set(-(py - 0.5) * 2 * max)
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
  }, [max, rx, ry])

  const onMouseLeave = useCallback(() => { rx.set(0); ry.set(0) }, [rx, ry])

  return {
    tiltRef: ref,
    tiltBind: reduceMotion ? {} : { onMouseMove, onMouseLeave },
    tiltStyle: reduceMotion ? {} : { rotateX: rx, rotateY: ry, transformPerspective: 800 },
  }
}
