import type { Variants, Transition } from 'framer-motion'

export const springSoft: Transition = { type: 'spring', stiffness: 260, damping: 26 }
export const springBouncy: Transition = { type: 'spring', stiffness: 380, damping: 22 }

export const viewportOnce = { once: true, margin: '-60px' } as const

export const fadeUp = (delay = 0): Variants => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, delay, ease: 'easeOut' } },
})

export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

export const staggerInView: Variants = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

export const riseItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

export const scalePop: Variants = {
  initial: { opacity: 0, scale: 0.9, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0, transition: springSoft },
}

export const listRow: Variants = {
  initial: { opacity: 0, x: -14 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, x: 28, transition: { duration: 0.25, ease: 'easeIn' } },
}
