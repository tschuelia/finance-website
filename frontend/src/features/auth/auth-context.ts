import { createContext } from 'react'
import type { AuthContextValue } from '@/features/auth/auth-types'

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
