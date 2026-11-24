import { useEffect } from 'react'

/** Keep the browser tab in sync with the current page. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · MED Health Locker` : 'MED Health Locker'
    return () => { document.title = 'MED Health Locker' }
  }, [title])
}
