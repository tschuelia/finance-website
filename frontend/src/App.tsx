/* cspell:words Finanzverwaltung */

import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { ApplicationProviders } from '@/components/providers/application-providers'
import { LoadingState } from '@/components/shared/query-feedback'
import { PortfolioPage } from '@/features/accounts/portfolio-page'
import { AuthProvider } from '@/features/auth/auth-provider'
import { LoginPage } from '@/features/auth/login-page'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { useAuth } from '@/features/auth/use-auth'
import { AppErrorBoundary, FatalErrorPage, NotFoundPage } from '@/features/errors/error-pages'
import { ApplicationShell } from '@/layouts/application-shell'
import { HOME, LOGIN } from '@/routes/urls'

const AnalyticsPage = lazy(async () => ({
  default: (await import('@/features/analytics/analytics-page')).AnalyticsPage
}))
const AccountDetailPage = lazy(async () => ({
  default: (await import('@/features/accounts/account-detail-page')).AccountDetailPage
}))
const DepotPage = lazy(async () => ({
  default: (await import('@/features/accounts/depot-page')).DepotPage
}))
const CategoriesPage = lazy(async () => ({
  default: (await import('@/features/categories/categories-page')).CategoriesPage
}))
const ContractsPage = lazy(async () => ({
  default: (await import('@/features/contracts/contract-pages')).ContractsPage
}))
const ContractFormPage = lazy(async () => ({
  default: (await import('@/features/contracts/contract-pages')).ContractFormPage
}))
const ContractDetailPage = lazy(async () => ({
  default: (await import('@/features/contracts/contract-pages')).ContractDetailPage
}))
const AssignmentReviewPage = lazy(async () => ({
  default: (await import('@/features/assignments/assignment-review-page')).AssignmentReviewPage
}))
const TransactionImportPage = lazy(async () => ({
  default: (await import('@/features/transactions/transaction-import-page')).TransactionImportPage
}))

const deferredPage = (page: ReactNode) => (
  <Suspense fallback={<LoadingState title="Seite wird geladen" />}>{page}</Suspense>
)

const AuthenticatedLayout = () => {
  return (
    <ApplicationShell>
      <Outlet />
    </ApplicationShell>
  )
}

const LoginRoute = () => {
  const { state } = useAuth()

  if (state.status === 'loading') {
    return <LoadingState title="Sitzung wird geprüft" />
  }

  if (state.status === 'authenticated') {
    return <Navigate replace to={HOME} />
  }

  if (state.status === 'error') {
    return <FatalErrorPage />
  }

  return <LoginPage />
}

export const App = () => {
  return (
    <AppErrorBoundary>
      <ApplicationProviders>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<LoginRoute />} path={LOGIN} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AuthenticatedLayout />}>
                  <Route element={<PortfolioPage />} index />
                  <Route element={deferredPage(<AccountDetailPage />)} path="konten/:accountId" />
                  <Route
                    element={deferredPage(<TransactionImportPage />)}
                    path="konten/:accountId/transaktionen/importieren"
                  />
                  <Route element={deferredPage(<DepotPage />)} path="depots/:depotId" />
                  <Route element={deferredPage(<CategoriesPage />)} path="kategorien" />
                  <Route element={deferredPage(<ContractsPage />)} path="vertraege" />
                  <Route element={deferredPage(<ContractFormPage />)} path="vertraege/neu" />
                  <Route
                    element={deferredPage(<ContractDetailPage />)}
                    path="vertraege/:contractId"
                  />
                  <Route element={deferredPage(<AnalyticsPage />)} path="auswertungen" />
                  <Route element={deferredPage(<AssignmentReviewPage />)} path="zuordnungen" />
                </Route>
              </Route>
              <Route element={<NotFoundPage />} path="*" />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ApplicationProviders>
    </AppErrorBoundary>
  )
}
