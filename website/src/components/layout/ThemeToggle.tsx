import { motion } from 'framer-motion'
import { Monitor, Sun, Moon } from 'lucide-react'
import { useTheme, type ThemeSetting } from '../../lib/theme'

const OPTIONS: { id: ThemeSetting; icon: typeof Sun; label: string }[] = [
  { id: 'system', icon: Monitor, label: 'Follow system theme' },
  { id: 'light', icon: Sun, label: 'Light theme' },
  { id: 'dark', icon: Moon, label: 'Dark theme' },
]

/** Segmented light / dark / system switch with a sliding pill indicator. */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Colour theme">
      {OPTIONS.map(({ id, icon: Icon, label }) => {
        const active = theme === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(id)}
            className={`theme-toggle-btn${active ? ' active' : ''}`}
          >
            {active && (
              <motion.span
                layoutId="theme-toggle-pill"
                className="theme-toggle-pill"
                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
              />
            )}
            <Icon size={14} strokeWidth={active ? 2.4 : 2} />
          </button>
        )
      })}
    </div>
  )
}
