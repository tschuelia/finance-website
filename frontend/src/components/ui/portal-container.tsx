import { createContext, useContext } from 'react'
import type { ReactNode, RefObject } from 'react'

type PortalContainer = RefObject<HTMLElement | null> | undefined

const PortalContainerContext = createContext<PortalContainer>(undefined)

type PortalContainerProviderProps = {
  children: ReactNode
  value: RefObject<HTMLElement | null>
}

const PortalContainerProvider = ({ children, value }: PortalContainerProviderProps) => (
  <PortalContainerContext.Provider value={value}>{children}</PortalContainerContext.Provider>
)

const usePortalContainer = (): PortalContainer => useContext(PortalContainerContext)

export { PortalContainerProvider, usePortalContainer }
