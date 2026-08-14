/* cspell:words Finanzverwaltung */

import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { ApplicationProviders } from '@/components/providers/application-providers'
import { LoadingState } from '@/components/shared/query-feedback'
import { AccountDetailPage } from '@/features/accounts/account-detail-page'
import { DepotPage } from '@/features/accounts/depot-page'
import { PortfolioPage } from '@/features/accounts/portfolio-page'
import { AnalyticsPage } from '@/features/analytics/analytics-page'
import { AuthProvider } from '@/features/auth/auth-provider'
import { LoginPage } from '@/features/auth/login-page'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { useAuth } from '@/features/auth/use-auth'
import { CategoriesPage } from '@/features/categories/categories-page'
import {
  ContractDetailPage,
  ContractFormPage,
  ContractsPage
} from '@/features/contracts/contract-pages'
import { AppErrorBoundary, FatalErrorPage, NotFoundPage } from '@/features/errors/error-pages'
import { TransactionImportPage } from '@/features/transactions'
import { ApplicationShell } from '@/layouts/application-shell'
import { HOME, LOGIN } from '@/routes/urls'

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
                  <Route element={<AccountDetailPage />} path="konten/:accountId" />
                  <Route
                    element={<TransactionImportPage />}
                    path="konten/:accountId/transaktionen/importieren"
                  />
                  <Route element={<DepotPage />} path="depots/:depotId" />
                  <Route element={<CategoriesPage />} path="kategorien" />
                  <Route element={<ContractsPage />} path="vertraege" />
                  <Route element={<ContractFormPage mode="create" />} path="vertraege/neu" />
                  <Route element={<ContractDetailPage />} path="vertraege/:contractId" />
                  <Route
                    element={<ContractFormPage mode="edit" />}
                    path="vertraege/:contractId/bearbeiten"
                  />
                  <Route element={<AnalyticsPage />} path="auswertungen" />
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
