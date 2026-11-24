import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useTheme, type Theme } from '../../lib/theme'

/**
 * Two encodes per theme:
 * - Desktop: 1080p (sharp, larger GOP — fine on real CPUs)
 * - Mobile/lite: 540p ALL-KEYFRAME (every frame instantly seekable — the
 *   Apple-style scrub encode; ~2 MB and ~3-4x cheaper seeks on phones)
 */
const DESKTOP_VIDEOS: Record<Theme, string> = {
  light: '/product_light.mp4',
  dark: '/product_dark.mp4',
}
const LITE_VIDEOS: Record<Theme, string> = {
  light: '/product_light_mobile.mp4',
  dark: '/product_dark_mobile.mp4',
}

/** Chosen once at module load — small screens / touch / low-core devices. */
const LITE_DEVICE = typeof window !== 'undefined' && (
  window.matchMedia('(max-width: 820px)').matches ||
  window.matchMedia('(pointer: coarse)').matches ||
  (navigator.hardwareConcurrency ?? 8) <= 4
)
const VIDEOS = LITE_DEVICE ? LITE_VIDEOS : DESKTOP_VIDEOS
/** Coarser seek quantization on lite devices = fewer, cheaper seeks. */
const MIN_SEEK_STEP = LITE_DEVICE ? 0.08 : 0.05

/**
 * Ambient video background — one <video> per theme, crossfaded on switch.
 *
 * Performance contract:
 * - Only the active theme's video is fetched; the other mounts on first
 *   switch (lazy `mounted` set), so first paint downloads a single file.
 * - The outgoing video pauses right after the 0.55s crossfade — at most
 *   two decoders run briefly, never permanently.
 * - Scroll parallax (translateY + scale) is a pure GPU transform applied
 *   to the wrapper, never the video element itself.
 * - Pauses when the tab is hidden; prefers-reduced-motion freezes the
 *   frame and disables parallax.
 */
export default function AmbientBackground() {
  const { resolvedTheme } = useTheme()
  const reduceMotion = useReducedMotion()
  const videoRefs = useRef<Record<Theme, HTMLVideoElement | null>>({ light: null, dark: null })

  /** Which theme's video is at full opacity. */
  const [shown, setShown] = useState<Theme>(resolvedTheme)
  /** Themes whose <video> element has been mounted (src assigned). */
  const [mounted, setMounted] = useState<ReadonlySet<Theme>>(() => new Set([resolvedTheme]))

  // Latest target theme — used inside stable callbacks to avoid stale closures.
  const targetRef = useRef(resolvedTheme)
  targetRef.current = resolvedTheme

  // Scroll parallax — wrapper transform only (GPU friendly).
  const { scrollYProgress } = useScroll()
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '9%'])
  const scale = useTransform(scrollYProgress, [0, 1], [1.06, 1.15])
  // Orbs drift at a slower rate — layered parallax depth.
  const orbY = useTransform(scrollYProgress, [0, 1], ['0%', '5%'])

  // Mount the target theme's video as soon as it becomes relevant.
  useEffect(() => {
    setMounted((prev) => {
      if (prev.has(resolvedTheme)) return prev
      const next = new Set(prev)
      next.add(resolvedTheme)
      return next
    })
  }, [resolvedTheme])

  // If the target video is already playable (e.g. cached), show it now;
  // otherwise the onCanPlay handler below flips `shown`.
  useEffect(() => {
    if (resolvedTheme === shown) return
    const v = videoRefs.current[resolvedTheme]
    if (v && v.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) setShown(resolvedTheme)
  }, [resolvedTheme, shown])

  // Pause when the tab is hidden, resume when visible.
  // Also honour Save-Data users: keep the video paused on its first frame.
  const saveData = typeof navigator !== 'undefined' && (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  const freezeVideo = reduceMotion || saveData

  // Scroll-scrub mode: videos are always paused — playback position is
  // driven entirely by scrub() above. Just make sure nothing ever plays.
  useEffect(() => {
    const active = videoRefs.current[shown]
    const other = videoRefs.current[shown === 'light' ? 'dark' : 'light']
    active?.pause()
    const t = window.setTimeout(() => other?.pause(), 560)
    return () => window.clearTimeout(t)
  }, [shown])

  const onReady = (t: Theme) => {
    if (targetRef.current === t) setShown(t)
  }

  /* ---- Scroll-scrubbed playback ----
     The video does NOT autoplay on a loop. Its currentTime is driven by
     page scroll: top of the page = first frame, bottom = last frame.

     Mobile-friendly seek engine:
     - fastSeek() when available (instant on all-keyframe encodes)
     - ONE seek in flight at a time: while `seeking`, the newest target is
       remembered and applied on the `seeked` event (no queue thrash)
     - coarse quantization on lite devices so we issue as few seeks as
       possible while still feeling continuous */
  const durationRef = useRef<Record<Theme, number>>({ light: 0, dark: 0 })
  const progressRef = useRef(0)
  const desiredRef = useRef<number | null>(null)

  const doSeek = useCallback((v: HTMLVideoElement, target: number) => {
    try {
      const media = v as HTMLVideoElement & { fastSeek?: (t: number) => void }
      if (typeof media.fastSeek === 'function') media.fastSeek(target)
      else v.currentTime = target
    } catch { /* seek not ready yet */ }
  }, [])

  const scrub = useCallback((p: number) => {
    progressRef.current = p
    const v = videoRefs.current[shown]
    if (!v || freezeVideo) return
    const d = durationRef.current[shown] || (Number.isFinite(v.duration) ? v.duration : 0)
    if (!d) return
    const target = Math.max(0, Math.min(p, 0.995)) * d
    if (Math.abs(v.currentTime - target) < MIN_SEEK_STEP) return
    if (v.seeking) {
      // A seek is mid-flight — remember the newest target only.
      desiredRef.current = target
      return
    }
    desiredRef.current = target
    doSeek(v, target)
  }, [shown, freezeVideo, doSeek])

  useMotionValueEvent(scrollYProgress, 'change', (p) => scrub(p))

  // Apply the newest queued target as soon as the current seek lands.
  useEffect(() => {
    const v = videoRefs.current[shown]
    if (!v) return
    const onSeeked = () => {
      const pending = desiredRef.current
      if (pending === null) return
      if (Math.abs(v.currentTime - pending) < MIN_SEEK_STEP) {
        desiredRef.current = null
        return
      }
      doSeek(v, pending)
    }
    v.addEventListener('seeked', onSeeked)
    return () => v.removeEventListener('seeked', onSeeked)
  }, [shown, doSeek])

  // When the shown video changes (crossfade), align it to the current progress
  useEffect(() => {
    const v = videoRefs.current[shown]
    if (!v || freezeVideo) return
    v.pause()
    // seek once ready (metadata may not be loaded yet)
    const align = () => scrub(progressRef.current)
    if (v.readyState >= 1) align()
  }, [shown, freezeVideo, scrub])

  const onLoadedMetadata = (t: Theme) => (e: React.SyntheticEvent<HTMLVideoElement>) => {
    durationRef.current[t] = e.currentTarget.duration || 0
    if (t === shown) scrub(progressRef.current)
  }

  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <motion.div
        style={{
          position: 'absolute', inset: '-7%',
          ...(reduceMotion ? {} : { y, scale, willChange: 'transform' }),
        }}
      >
        {(Object.keys(VIDEOS) as Theme[]).map((t) =>
          mounted.has(t) ? (
            <motion.video
              key={t}
              ref={(el) => { videoRefs.current[t] = el }}
              src={VIDEOS[t]}
              muted playsInline
              preload={shown === t || resolvedTheme === t ? 'auto' : 'metadata'}
              disablePictureInPicture
              disableRemotePlayback
              onCanPlay={() => onReady(t)}
              onLoadedMetadata={onLoadedMetadata(t)}
              initial={false}
              animate={{ opacity: shown === t ? 1 : 0 }}
              transition={{ duration: 0.55, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : null,
        )}
      </motion.div>
      <div className="bg-grid" aria-hidden />
      {/* Floating depth orbs — above video, below scrim; own slower parallax */}
      <motion.div style={reduceMotion ? { position: 'absolute', inset: 0 } : { position: 'absolute', inset: 0, y: orbY }}>
        <div className="orb orb-1" aria-hidden />
        <div className="orb orb-2" aria-hidden />
        <div className="orb orb-3" aria-hidden />
      </motion.div>
      {/* Readability scrim — static, never parallaxes with the video */}
      <div className="video-scrim" />
      {/* Static gradient wash — depth over the video, both themes */}
      <div className="page-wash" aria-hidden />
    </div>
  )
}
