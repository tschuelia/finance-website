import type { ApiError } from '@/api/index'
import type { AuthenticatedUser, LoginRequest } from '@/types/auth'

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; sessionExpired: boolean }
  | { status: 'authenticated'; user: AuthenticatedUser }
  | { status: 'error'; error: ApiError }

export type AuthContextValue = {
  state: AuthState
  signIn: (payload: LoginRequest) => Promise<AuthenticatedUser>
  signOut: () => Promise<void>
  isSigningIn: boolean
  isSigningOut: boolean
}
