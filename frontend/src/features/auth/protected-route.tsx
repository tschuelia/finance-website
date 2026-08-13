import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { useAuth } from '@/features/auth/use-auth'
import { LOGIN } from '@/routes/urls'

export const ProtectedRoute = () => {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return <LoadingState title="Sitzung wird geprüft" />
  }

  if (state.status === 'error') {
    return <ErrorState error={state.error} />
  }

  if (state.status === 'anonymous') {
    return (
      <Navigate
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
          sessionExpired: state.sessionExpired
        }}
        to={LOGIN}
      />
    )
  }

  return <Outlet />
}
