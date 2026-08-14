/* cspell:words Auswertungen Kategorienvergleich Buchungsart Monatsverlauf Vergleichszeiträume */

import { BarChart3, Filter, RotateCcw } from 'lucide-react'
import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { PageHeader } from '@/components/shared/page-header'
import { useCategoryComparisons, useCategoryTotals, useMonthlyTotals } from '@/hooks/use-analytics'
import { usePortfolioOverview } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { decimalInputValue, formatDecimal, parseDecimalInput, parsePositiveId } from '@/lib/format'
import type {
  AnalyticsFilters,
  CategoryTotals,
  ComparisonQuery,
  MonthlyQuery
} from '@/types/analytics'
import type { TransactionType } from '@/types/transactions'

const monthValue = (offset: number): string => {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() - offset
  const shifted = new Date(Date.UTC(year, month, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

const readType = (value: string | null): TransactionType =>
  value === 'income' || value === 'expense' ? value : 'all'

const readPositiveIds = (values: string[]): number[] =>
  values.flatMap((value) => {
    const id = parsePositiveId(value)
    return id === undefined ? [] : [id]
  })

const readAmount = (value: string | null): number | undefined =>
  value === null || value === '' ? undefined : parseDecimalInput(value)

const readFilters = (searchParams: URLSearchParams): AnalyticsFilters => ({
  date_start: searchParams.get('von') || undefined,
  date_end: searchParams.get('bis') || undefined,
  amount_min: readAmount(searchParams.get('betrag_von')),
  amount_max: readAmount(searchParams.get('betrag_bis')),
  category_ids: readPositiveIds(searchParams.getAll('kategorie')),
  transaction_type: readType(searchParams.get('art'))
})

type AnalyticsFilterFormProps = {
  accountId: number
  filters: AnalyticsFilters
  periodValues: [string, string, string]
  months: number
  onApply: (values: URLSearchParams) => void
}

const AnalyticsFilterForm = ({
  accountId,
  filters,
  periodValues,
  months,
  onApply
}: AnalyticsFilterFormProps) => {
  const categories = useCategories()
  const [formError, setFormError] = useState<string | undefined>()

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const amountMinValue = String(formData.get('betrag_von') ?? '')
    const amountMaxValue = String(formData.get('betrag_bis') ?? '')
    const amountMin = amountMinValue === '' ? undefined : parseDecimalInput(amountMinValue)
    const amountMax = amountMaxValue === '' ? undefined : parseDecimalInput(amountMaxValue)

    if (
      (amountMinValue !== '' && amountMin === undefined) ||
      (amountMaxValue !== '' && amountMax === undefined)
    ) {
      setFormError('Bitte gib Beträge mit höchstens zwei Nachkommastellen ein.')
      return
    }

    const next = new URLSearchParams()
    const fields = [
      'konto',
      'von',
      'bis',
      'art',
      'vergleich-1',
      'vergleich-2',
      'vergleich-3',
      'monate'
    ]

    for (const field of fields) {
      const value = formData.get(field)
      if (typeof value === 'string' && value !== '') {
        next.set(field, value)
      }
    }

    if (amountMin !== undefined) {
      next.set('betrag_von', String(amountMin))
    }

    if (amountMax !== undefined) {
      next.set('betrag_bis', String(amountMax))
    }

    for (const value of formData.getAll('kategorie')) {
      if (typeof value === 'string' && parsePositiveId(value) !== undefined) {
        next.append('kategorie', value)
      }
    }

    setFormError(undefined)
    onApply(next)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="size-5" aria-hidden />
          Filter
        </CardTitle>
        <CardDescription>Die Auswahl wirkt auf alle Auswertungen dieser Seite.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <input name="konto" type="hidden" value={accountId} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="analytics-date-start">Von</Label>
              <Input
                defaultValue={filters.date_start}
                id="analytics-date-start"
                name="von"
                type="date"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="analytics-date-end">Bis</Label>
              <Input
                defaultValue={filters.date_end}
                id="analytics-date-end"
                name="bis"
                type="date"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="analytics-amount-min">Betrag von</Label>
              <Input
                defaultValue={
                  filters.amount_min === undefined
                    ? undefined
                    : decimalInputValue(filters.amount_min)
                }
                id="analytics-amount-min"
                inputMode="decimal"
                name="betrag_von"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="analytics-amount-max">Betrag bis</Label>
              <Input
                defaultValue={
                  filters.amount_max === undefined
                    ? undefined
                    : decimalInputValue(filters.amount_max)
                }
                id="analytics-amount-max"
                inputMode="decimal"
                name="betrag_bis"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="analytics-type">Buchungsart</Label>
              <select
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                defaultValue={filters.transaction_type}
                id="analytics-type"
                name="art"
              >
                <option value="all">Alle Buchungen</option>
                <option value="income">Einnahmen</option>
                <option value="expense">Ausgaben</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="analytics-months">Monate im Verlauf</Label>
              <Input
                defaultValue={months}
                id="analytics-months"
                max={120}
                min={1}
                name="monate"
                type="number"
              />
            </div>
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Kategorien</legend>
            {categories.status === 'loading' ? (
              <p className="text-sm text-muted-foreground">Kategorien werden geladen …</p>
            ) : null}
            {categories.status === 'error' ? (
              <p className="text-sm text-destructive">Kategorien konnten nicht geladen werden.</p>
            ) : null}
            {categories.status === 'success' && categories.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Es sind noch keine Kategorien vorhanden.
              </p>
            ) : null}
            {categories.status === 'success' && categories.data.length > 0 ? (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {categories.data.map((category) => (
                  <label className="flex items-center gap-2 text-sm" key={category.id}>
                    <input
                      defaultChecked={filters.category_ids.includes(category.id)}
                      name="kategorie"
                      type="checkbox"
                      value={category.id}
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium">Vergleichszeiträume</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {periodValues.map((period, index) => (
                <div className="grid gap-2" key={index}>
                  <Label htmlFor={`analytics-period-${index}`}>Zeitraum {index + 1}</Label>
                  <Input
                    defaultValue={period}
                    id={`analytics-period-${index}`}
                    name={`vergleich-${index + 1}`}
                    type="month"
                  />
                </div>
              ))}
            </div>
          </fieldset>
          {formError === undefined ? null : <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Filter anwenden</Button>
            <Button
              onClick={() => onApply(new URLSearchParams({ konto: String(accountId) }))}
              type="button"
              variant="outline"
            >
              <RotateCcw aria-hidden />
              Zurücksetzen
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
        <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="income" fill="var(--color-income)" radius={4} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}

type AnalyticsDashboardProps = {
  accountId: number
  filters: AnalyticsFilters
  comparisons: ComparisonQuery
  monthly: MonthlyQuery
}

const AnalyticsDashboard = ({
  accountId,
  filters,
  comparisons,
  monthly
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
          {comparison.status === 'loading' ? (
            <LoadingState title="Vergleich wird ausgewertet" />
          ) : null}
          {comparison.status === 'error' ? <ErrorState error={comparison.error} /> : null}
          {comparison.status === 'success' && comparison.data.comparisons.length === 0 ? (
            <EmptyState description="Für die Vergleichszeiträume liegen keine Daten vor." />
          ) : null}
          {comparison.status === 'success' && comparison.data.comparisons.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-3">
              {comparison.data.comparisons.map((item) => (
                <div className="grid gap-2" key={item.period}>
                  <h3 className="font-medium">{item.label}</h3>
                  <CategoryChart
                    data={{
                      income_color: comparison.data.income_color,
                      expense_color: comparison.data.expense_color,
                      series: item.series
                    }}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Monatsverlauf</CardTitle>
          <CardDescription>
            Einnahmen und Ausgaben der letzten {monthly.months} Monate.
          </CardDescription>
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
                <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="income" fill="var(--color-income)" radius={4} />
                <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
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
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => readFilters(searchParams), [searchParams])
  const accountId = parsePositiveId(searchParams.get('konto') ?? undefined)
  const periods: [string, string, string] = [
    searchParams.get('vergleich-1') || monthValue(0),
    searchParams.get('vergleich-2') || monthValue(1),
    searchParams.get('vergleich-3') || monthValue(2)
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

  const applyFilters = (next: URLSearchParams) => setSearchParams(next)

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
              <AnalyticsFilterForm
                accountId={accountId}
                filters={filters}
                months={months}
                onApply={applyFilters}
                periodValues={periods}
              />
              <AnalyticsDashboard
                accountId={accountId}
                comparisons={{ ...filters, periods }}
                filters={filters}
                monthly={{ ...filters, months }}
              />
            </>
          )}
        </>
      )}
    </>
  )
}
