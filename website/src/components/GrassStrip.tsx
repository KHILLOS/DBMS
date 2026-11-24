import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useLiteMode } from '../lib/perf'

/**
 * Realistic grass strip — layered SVG blades that sway in the wind.
 *
 * - Each blade is a tapered quadratic sliver with a root→tip gradient
 *   (sun-kissed, front and back layers for depth).
 * - Sway is a CSS rotate on the blade's own fill-box (base pivot), with
 *   deterministic pseudo-random duration/delay per blade so the field
 *   moves organically instead of in lock-step.
 * - Blades only animate while the strip is on screen (IntersectionObserver
 *   toggles animation-play-state) — off-screen grass costs nothing.
 * - Lite devices render fewer blades with animation off (CSS media too).
 * - Purely decorative: aria-hidden + pointer-events none.
 */
export default function GrassStrip({
  className = '',
  blades = 38,
  height = 60,
}: {
  className?: string
  blades?: number
  height?: number
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const lite = useLiteMode()
  const count = lite ? Math.round(blades * 0.55) : blades
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '120px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Deterministic pseudo-random — stable across renders
  const rand = (i: number, s: number) => {
    const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453
    return x - Math.floor(x)
  }

  const items = Array.from({ length: count }, (_, i) => {
    const x = (i / count) * 1120 + (rand(i, 6) - 0.5) * 26
    const h = 0.42 + rand(i, 1) * 0.55          // height fraction of viewBox
    const sx = 0.75 + rand(i, 2) * 0.7          // width scale
    const dur = 2.7 + rand(i, 3) * 1.9          // sway duration
    const delay = -rand(i, 4) * 3               // negative = already mid-sway
    const back = rand(i, 5) > 0.62              // depth layer
    const sun = !back && rand(i, 7) > 0.78      // extra-light blades
    return { x, h, sx, dur, delay, back, sun }
  })

  return (
    <div ref={ref} className={`grass-strip${inView ? ' grass-run' : ''} ${className}`} style={{ height }} aria-hidden>
      <svg viewBox={`0 0 1120 ${height}`} preserveAspectRatio="xMidYMax slice" role="presentation">
        <defs>
          <linearGradient id={`${uid}f`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--grass-root)' }} />
            <stop offset="0.55" style={{ stopColor: 'var(--grass-mid)' }} />
            <stop offset="1" style={{ stopColor: 'var(--grass-tip)' }} />
          </linearGradient>
          <linearGradient id={`${uid}b`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--grass-back-root)' }} />
            <stop offset="1" style={{ stopColor: 'var(--grass-back-tip)' }} />
          </linearGradient>
          <linearGradient id={`${uid}s`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--grass-mid)' }} />
            <stop offset="1" style={{ stopColor: 'var(--grass-sun)' }} />
          </linearGradient>
        </defs>
        {items.map((it, i) => (
          <g key={i} transform={`translate(${it.x.toFixed(1)}, ${height}) scale(${it.sx.toFixed(2)}, ${(it.h * height / 100).toFixed(3)})`}>
            <path
              className={`grass-blade${it.back ? ' back' : ''}`}
              d="M3,100 Q0.6,52 1.6,0 Q5.4,52 6,100 Z"
              fill={`url(#${uid}${it.sun ? 's' : it.back ? 'b' : 'f'})`}
              style={{ '--d': `${it.dur.toFixed(2)}s`, '--delay': `${it.delay.toFixed(2)}s` } as CSSProperties}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
