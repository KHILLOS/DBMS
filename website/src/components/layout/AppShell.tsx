import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useOutlet } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion'
import TopBar from './TopBar'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import AmbientBackground from './AmbientBackground'
import BackToTop from './BackToTop'
import GrassStrip from '../GrassStrip'
import { useTheme } from '../../lib/theme'

/** One-shot soft flash from the toggle corner when the theme changes. */
function ThemeSwitchFlash() {
  const { resolvedTheme } = useTheme()
  const [flash, setFlash] = useState(0)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setFlash((k) => k + 1)
  }, [resolvedTheme])
  if (flash === 0) return null
  return <div key={flash} className="theme-flash" aria-hidden />
}

export default function AppShell() {
  const { pathname } = useLocation()
  const outlet = useOutlet()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 })

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }, [pathname])

  return (
    <div style={{ minHeight: '100svh' }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <AmbientBackground />
      <ThemeSwitchFlash />
      <motion.div className="scroll-progress" style={{ scaleX }} />
      <Sidebar />
      <div className="md:ml-[76px] lg:ml-60" style={{ position: 'relative', zIndex: 1 }}>
        <TopBar />
        <main id="main-content" style={{ maxWidth: 1120, margin: '0 auto', padding: '22px 20px 110px' }} className="md:pb-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 0.61, 0.36, 1] } }}
              exit={{ opacity: 0, y: -14, transition: { duration: 0.22, ease: 'easeIn' } }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
        <div className="footer-meadow-wrap" aria-hidden>
          <GrassStrip height={64} blades={36} />
        </div>
        <footer className="site-footer">
          <span className="font-display" style={{ fontWeight: 700, fontSize: 12.5 }}>MED Health Locker</span>
          <nav style={{ display: 'flex', gap: 16, fontSize: 12.5 }} aria-label="Footer">
            <Link to="/learn" className="link-underline" style={{ color: 'var(--muted)', textDecoration: 'none', fontWeight: 600 }}>Health Library</Link>
            <Link to="/login" className="link-underline" style={{ color: 'var(--muted)', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
          </nav>
          <span className="muted" style={{ fontSize: 11.5 }}>Demo build · reports stay on this server · nothing shared externally</span>
        </footer>
      </div>
      <BottomNav />
      <BackToTop />
      <div className="md:hidden" style={{ height: 4 }} />
    </div>
  )
}
