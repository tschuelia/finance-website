/* cspell:words Auswertungen Transaktionsfilter */

import { BarChart3 } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { PageHeader } from '@/components/shared/page-header'
import { AnalyticsDashboard } from '@/features/analytics/analytics-dashboard'
import { TransactionFilterForm } from '@/features/transactions/transaction-filters'
import {
  transactionDataFiltersFromSearch,
  transactionDataFiltersToSearchParams
} from '@/features/transactions/transaction-search'
import { usePortfolioOverview } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { parsePositiveId } from '@/lib/format'
import type { TransactionDataFilters } from '@/types/transactions'

const monthValue = (offset: number): string => {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() - offset
  const shifted = new Date(Date.UTC(year, month, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

const canonicalFilterKeys = [
  'q',
  'date_start',
  'date_end',
  'amount_min',
  'amount_max',
  'category_ids',
  'transaction_type'
]

const readFilters = (searchParams: URLSearchParams): TransactionDataFilters =>
  transactionDataFiltersFromSearch(searchParams.toString())

const validMonth = (value: string | null, fallback: string): string =>
  value !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : fallback

export const AnalyticsPage = () => {
  const portfolio = usePortfolioOverview()
  const categories = useCategories()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => readFilters(searchParams), [searchParams])
  const filterKey = useMemo(
    () => transactionDataFiltersToSearchParams(filters).toString(),
    [filters]
  )
  const accountId = parsePositiveId(searchParams.get('konto') ?? undefined)
  const periods: [string, string, string] = [
    validMonth(searchParams.get('vergleich-1'), monthValue(0)),
    validMonth(searchParams.get('vergleich-2'), monthValue(1)),
    validMonth(searchParams.get('vergleich-3'), monthValue(2))
  ]
  const monthsInput = Number(searchParams.get('monate'))
  const months =
    Number.isInteger(monthsInput) && monthsInput >= 1 && monthsInput <= 120 ? monthsInput : 12

  if (portfolio.status === 'loading') {
    return <LoadingState title="Konten werden geladen" />
  }

  if (portfolio.status === 'error') {
    return <ErrorState error={portfolio.error} />
  }

  const accounts = portfolio.data.groups.flatMap((group) => group.accounts)
  const selectedAccount = accounts.find((account) => account.id === accountId)
  const currentMonth = monthValue(0)
  const comparisonRange = [
    currentMonth,
    selectedAccount?.oldest_transaction_date.slice(0, 7) ?? currentMonth,
    selectedAccount?.newest_transaction_date.slice(0, 7) ?? currentMonth,
    ...periods
  ].sort()
  const comparisonStartMonth = comparisonRange[0] ?? currentMonth
  const comparisonEndMonth = comparisonRange.at(-1) ?? currentMonth

  const applyFilters = (nextFilters: TransactionDataFilters) => {
    const next = new URLSearchParams(searchParams)
    for (const key of canonicalFilterKeys) {
      next.delete(key)
    }
    transactionDataFiltersToSearchParams(nextFilters).forEach((value, key) => {
      next.append(key, value)
    })
    setSearchParams(next)
  }

  const changeComparisonPeriod = (index: number, period: string) => {
    const next = new URLSearchParams(searchParams)
    next.set(`vergleich-${index + 1}`, period)
    setSearchParams(next)
  }

  const changeMonths = (nextMonths: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('monate', String(nextMonths))
    setSearchParams(next)
  }

  const categoryError =
    categories.status === 'error'
      ? (categories.error.problem?.detail ?? 'Die Kategorien konnten nicht geladen werden.')
      : undefined

  return (
    <>
      <PageHeader
        description="Erkenne Entwicklungen in Deinen Einnahmen, Ausgaben und Kategorien."
        title="Auswertungen"
      />
      {accounts.length === 0 ? (
        <EmptyState description="Für Auswertungen benötigst Du mindestens ein zugeordnetes Konto." />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-5" aria-hidden />
                Konto auswählen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <select
                className="h-8 w-full max-w-md rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onChange={(event) => {
                  const next = new URLSearchParams(searchParams)
                  next.set('konto', event.target.value)
                  setSearchParams(next)
                }}
                value={accountId === undefined ? '' : String(accountId)}
              >
                <option value="">Bitte Konto auswählen</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.bank}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
          {accountId === undefined ? (
            <EmptyState
              description="Wähle ein Konto aus, um dessen Buchungen auszuwerten."
              title="Kein Konto ausgewählt"
            />
          ) : (
            <>
              <TransactionFilterForm
                categories={categories.status === 'success' ? categories.data : []}
                categoriesError={categoryError}
                categoriesLoading={categories.status === 'loading'}
                filters={filters}
                key={`${accountId}:${filterKey}`}
                onApply={applyFilters}
              />
              <AnalyticsDashboard
                accountId={accountId}
                comparisonEndMonth={comparisonEndMonth}
                comparisonStartMonth={comparisonStartMonth}
                comparisons={{ ...filters, periods }}
                filters={filters}
                monthly={{ ...filters, months }}
                onComparisonPeriodChange={changeComparisonPeriod}
                onMonthsChange={changeMonths}
              />
            </>
          )}
        </>
      )}
    </>
  )
}
