import { useEffect, useState } from 'react'

const LITE_QUERY = '(max-width: 820px), (pointer: coarse)'

/**
 * Lite mode — true on phones, touch devices and low-core machines.
 * Use it to skip infinite JS-driven animations and heavy hover effects.
 * CSS-side lite rules live in index.css under the same media query.
 */
export function useLiteMode(): boolean {
  const [lite, setLite] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(LITE_QUERY).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(LITE_QUERY)
    const onChange = () => setLite(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return lite
}

export const isLiteDevice = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia(LITE_QUERY).matches
