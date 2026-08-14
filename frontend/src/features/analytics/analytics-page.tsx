/* cspell:words Auswertungen Kategorienvergleich Monatsverlauf Transaktionsfilter */

import { BarChart3 } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MonthPicker } from '@/components/ui/month-picker'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { PageHeader } from '@/components/shared/page-header'
import { TransactionFilterForm } from '@/features/transactions/transaction-filters'
import {
  transactionDataFiltersFromSearch,
  transactionDataFiltersToSearchParams
} from '@/features/transactions/transaction-search'
import { useCategoryComparisons, useCategoryTotals, useMonthlyTotals } from '@/hooks/use-analytics'
import { usePortfolioOverview } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { formatDecimal, parsePositiveId } from '@/lib/format'
import type {
  AnalyticsFilters,
  CategoryTotals,
  ComparisonQuery,
  MonthlyQuery
} from '@/types/analytics'
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

const legacyFilterKeys = ['von', 'bis', 'betrag_von', 'betrag_bis', 'kategorie', 'art']

const withLegacyFilters = (searchParams: URLSearchParams): URLSearchParams => {
  const normalized = new URLSearchParams(searchParams)
  const aliases = [
    ['date_start', 'von'],
    ['date_end', 'bis'],
    ['amount_min', 'betrag_von'],
    ['amount_max', 'betrag_bis'],
    ['transaction_type', 'art']
  ] as const

  for (const [canonical, legacy] of aliases) {
    if (!normalized.has(canonical) && normalized.has(legacy)) {
      normalized.set(canonical, normalized.get(legacy) ?? '')
    }
  }

  if (!normalized.has('category_ids')) {
    for (const categoryId of normalized.getAll('kategorie')) {
      normalized.append('category_ids', categoryId)
    }
  }

  return normalized
}

const readFilters = (searchParams: URLSearchParams): TransactionDataFilters =>
  transactionDataFiltersFromSearch(withLegacyFilters(searchParams).toString())

const validMonth = (value: string | null, fallback: string): string =>
  value !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : fallback

type MonthCountInputProps = {
  onChange: (months: number) => void
  value: number
}

const MonthCountInput = ({ onChange, value }: MonthCountInputProps) => {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="analytics-months">Monate</Label>
      <Input
        className="w-24"
        id="analytics-months"
        max={120}
        min={1}
        onChange={(event) => {
          const parsed = Number(event.target.value)
          if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 120) {
            onChange(parsed)
          }
        }}
        type="number"
        value={value}
      />
    </div>
  )
}

const CategoryChart = ({ data }: { data: CategoryTotals }) => {
  const chartData = data.series.map((item) => ({
    category: item.category,
    income: item.income,
    expense: item.expense
  }))

  if (chartData.length === 0) {
    return (
      <EmptyState description="Für diese Auswahl liegen keine kategorisierten Buchungen vor." />
    )
  }

  return (
    <ChartContainer
      className="min-h-72 w-full"
      config={{
        income: { label: 'Einnahmen', color: data.income_color },
        expense: { label: 'Ausgaben', color: data.expense_color }
      }}
    >
      <BarChart accessibilityLayer data={chartData} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="category" tickLine={false} tickMargin={8} />
        <YAxis tickFormatter={(value: number) => formatDecimal(value, { currency: false })} />
        <ChartTooltip content={<ChartTooltipContent />} cursor={false} isAnimationActive={false} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="income" fill="var(--color-income)" isAnimationActive={false} radius={4} />
        <Bar dataKey="expense" fill="var(--color-expense)" isAnimationActive={false} radius={4} />
      </BarChart>
    </ChartContainer>
  )
}

type AnalyticsDashboardProps = {
  accountId: number
  comparisonEndMonth: string
  comparisonStartMonth: string
  filters: AnalyticsFilters
  comparisons: ComparisonQuery
  monthly: MonthlyQuery
  onComparisonPeriodChange: (index: number, period: string) => void
  onMonthsChange: (months: number) => void
}

const AnalyticsDashboard = ({
  accountId,
  comparisonEndMonth,
  comparisonStartMonth,
  filters,
  comparisons,
  monthly,
  onComparisonPeriodChange,
  onMonthsChange
}: AnalyticsDashboardProps) => {
  const categories = useCategoryTotals(accountId, filters)
  const comparison = useCategoryComparisons(accountId, comparisons)
  const monthlyTotals = useMonthlyTotals(accountId, monthly)

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Kategorien</CardTitle>
          <CardDescription>
            Gegenüberstellung von Einnahmen und Ausgaben je Kategorie.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.status === 'loading' ? (
            <LoadingState title="Kategorien werden ausgewertet" />
          ) : null}
          {categories.status === 'error' ? <ErrorState error={categories.error} /> : null}
          {categories.status === 'success' ? <CategoryChart data={categories.data} /> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Kategorienvergleich</CardTitle>
          <CardDescription>Die ausgewählten Zeiträume nebeneinander.</CardDescription>
        </CardHeader>
        <CardContent>
          {comparison.status === 'error' ? <ErrorState error={comparison.error} /> : null}
          <div className="grid gap-5 lg:grid-cols-3">
            {comparisons.periods.map((period, index) => {
              const item =
                comparison.status === 'success' ? comparison.data.comparisons[index] : undefined

              return (
                <section className="grid content-start gap-3" key={index}>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`analytics-period-${index}`}>Monat {index + 1}</Label>
                    <MonthPicker
                      endMonth={comparisonEndMonth}
                      id={`analytics-period-${index}`}
                      onValueChange={(nextPeriod) => onComparisonPeriodChange(index, nextPeriod)}
                      startMonth={comparisonStartMonth}
                      value={period}
                    />
                  </div>
                  {comparison.status === 'loading' ? (
                    <LoadingState title={`Vergleich ${index + 1} wird ausgewertet`} />
                  ) : null}
                  {comparison.status === 'success' && item === undefined ? (
                    <EmptyState description="Für diesen Vergleichszeitraum liegen keine Daten vor." />
                  ) : null}
                  {comparison.status === 'success' && item !== undefined ? (
                    <CategoryChart
                      data={{
                        income_color: comparison.data.income_color,
                        expense_color: comparison.data.expense_color,
                        series: item.series
                      }}
                    />
                  ) : null}
                </section>
              )
            })}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Monatsverlauf</CardTitle>
          <CardDescription>
            Einnahmen und Ausgaben der letzten {monthly.months} Monate.
          </CardDescription>
          <CardAction>
            <MonthCountInput onChange={onMonthsChange} value={monthly.months} />
          </CardAction>
        </CardHeader>
        <CardContent>
          {monthlyTotals.status === 'loading' ? (
            <LoadingState title="Monatsverlauf wird ausgewertet" />
          ) : null}
          {monthlyTotals.status === 'error' ? <ErrorState error={monthlyTotals.error} /> : null}
          {monthlyTotals.status === 'success' && monthlyTotals.data.series.length === 0 ? (
            <EmptyState description="Für diesen Zeitraum liegen keine Buchungen vor." />
          ) : null}
          {monthlyTotals.status === 'success' && monthlyTotals.data.series.length > 0 ? (
            <ChartContainer
              className="min-h-80 w-full"
              config={{
                income: { label: 'Einnahmen', color: monthlyTotals.data.income_color },
                expense: { label: 'Ausgaben', color: monthlyTotals.data.expense_color }
              }}
            >
              <BarChart
                accessibilityLayer
                data={monthlyTotals.data.series.map((item) => ({
                  label: item.label,
                  income: item.income,
                  expense: item.expense
                }))}
                margin={{ left: 8, right: 8 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} tickMargin={8} />
                <YAxis
                  tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={false}
                  isAnimationActive={false}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="income"
                  fill="var(--color-income)"
                  isAnimationActive={false}
                  radius={4}
                />
                <Bar
                  dataKey="expense"
                  fill="var(--color-expense)"
                  isAnimationActive={false}
                  radius={4}
                />
              </BarChart>
            </ChartContainer>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

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
    for (const key of [...canonicalFilterKeys, ...legacyFilterKeys]) {
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
