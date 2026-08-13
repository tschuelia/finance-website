import { useContext } from 'react'
import { AuthContext } from '@/features/auth/auth-context'
import type { AuthContextValue } from '@/features/auth/auth-types'

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden.')
  }

  return context
}
