/* cspell:words Auswertungen Kategorienvergleich Monatsverlauf */

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
import { useCategoryComparisons, useCategoryTotals, useMonthlyTotals } from '@/hooks/use-analytics'
import { formatDecimal } from '@/lib/format'
import type {
  AnalyticsFilters,
  CategoryTotals,
  ComparisonQuery,
  MonthlyQuery
} from '@/types/analytics'

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

export const AnalyticsDashboard = ({
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
