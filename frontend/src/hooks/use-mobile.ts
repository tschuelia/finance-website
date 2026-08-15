import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 768

const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT

const subscribe = (onStoreChange: () => void) => {
  const mediaQueryList = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mediaQueryList.addEventListener('change', onStoreChange)

  return () => mediaQueryList.removeEventListener('change', onStoreChange)
}

export const useIsMobile = () => {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
