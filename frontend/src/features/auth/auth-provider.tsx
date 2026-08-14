/* cspell:words Sitzung Anmeldedaten */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCurrentUser, login, logout } from '@/api/auth'
import { clearCsrfToken, setUnauthorizedHandler } from '@/api/index'
import { AuthContext } from '@/features/auth/auth-context'
import type { AuthContextValue, AuthState } from '@/features/auth/auth-types'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { AuthenticatedUser } from '@/types/auth'

const authQueryKey = ['auth', 'current-user'] as const

type AuthProviderProps = {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const queryClient = useQueryClient()
  const [sessionExpired, setSessionExpired] = useState(false)
  const currentUserQuery = useQuery<AuthenticatedUser | null>({
    queryKey: authQueryKey,
    queryFn: getCurrentUser,
    retry: false,
    refetchOnWindowFocus: true
  })
  const currentUser = resolveQuery(currentUserQuery)

  const removeAuthenticatedState = useCallback(() => {
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== authQueryKey[0]
    })
    queryClient.setQueryData<AuthenticatedUser | null>(authQueryKey, null)
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearCsrfToken()
      void queryClient
        .cancelQueries()
        .finally(() => {
          removeAuthenticatedState()
          setSessionExpired(true)
        })
        .catch(() => undefined)
    })

    return () => setUnauthorizedHandler(undefined)
  }, [queryClient, removeAuthenticatedState])

  const signInMutation = useMutation({
    mutationFn: login,
    onMutate: async () => {
      await queryClient.cancelQueries().catch(() => undefined)
      removeAuthenticatedState()
      clearCsrfToken()
      setSessionExpired(false)
    },
    onSuccess: (user) => {
      setSessionExpired(false)
      queryClient.setQueryData(authQueryKey, user)
    }
  })

  const signOutMutation = useMutation({
    mutationFn: logout,
    onMutate: async () => {
      await queryClient.cancelQueries().catch(() => undefined)
    },
    onSuccess: () => {
      clearCsrfToken()
      setSessionExpired(false)
      removeAuthenticatedState()
    }
  })

  const state: AuthState = useMemo(() => {
    if (sessionExpired) {
      return { status: 'anonymous', sessionExpired: true }
    }

    if (currentUser.status === 'loading') {
      return { status: 'loading' }
    }

    if (currentUser.status === 'success') {
      if (currentUser.data === null) {
        return { status: 'anonymous', sessionExpired: false }
      }
      return { status: 'authenticated', user: currentUser.data }
    }

    if (currentUser.error.status === 401) {
      return { status: 'anonymous', sessionExpired: false }
    }

    return { status: 'error', error: currentUser.error }
  }, [currentUser, sessionExpired])

  const value: AuthContextValue = {
    state,
    signIn: async (payload) => await signInMutation.mutateAsync(payload),
    signOut: async () => await signOutMutation.mutateAsync(),
    isSigningIn: signInMutation.isPending,
    isSigningOut: signOutMutation.isPending
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
