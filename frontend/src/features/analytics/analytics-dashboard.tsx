/* cspell:words Auswertungen Kategorienvergleich Monatsverlauf */

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis
} from 'recharts'
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

const percentageFormatter = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 1
})

const MAX_VISIBLE_CATEGORIES = 6
const OTHER_CATEGORY = 'Sonstige'
const OTHER_CATEGORY_COLOR = 'var(--muted-foreground)'

type ExpenseCategory = {
  category: string
  expense: number
}

type ExpensePieDatum = ExpenseCategory & {
  breakdown: ExpenseCategory[]
  fill: string
}

const categoryColor = (category: string): string => {
  let hash = 0
  for (const character of category) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0
  }
  return `oklch(0.66 0.14 ${hash % 360})`
}

const expenseOrder = (left: ExpenseCategory, right: ExpenseCategory): number =>
  right.expense - left.expense || left.category.localeCompare(right.category, 'de')

const expensePieData = (series: CategoryTotals['series']): ExpensePieDatum[] => {
  const expenses = series
    .filter((item) => item.expense > 0)
    .map((item) => ({ category: item.category, expense: item.expense }))
    .sort(expenseOrder)

  if (expenses.length <= MAX_VISIBLE_CATEGORIES) {
    return expenses.map((item) => ({
      ...item,
      breakdown: [],
      fill: categoryColor(item.category)
    }))
  }

  const namedCategories = expenses.filter((item) => item.category !== OTHER_CATEGORY)
  const visibleCategories = namedCategories.slice(0, MAX_VISIBLE_CATEGORIES)
  const breakdown = [
    ...namedCategories.slice(MAX_VISIBLE_CATEGORIES),
    ...expenses.filter((item) => item.category === OTHER_CATEGORY)
  ].sort(expenseOrder)

  return [
    ...visibleCategories.map((item) => ({
      ...item,
      breakdown: [],
      fill: categoryColor(item.category)
    })),
    {
      category: OTHER_CATEGORY,
      expense: breakdown.reduce((sum, item) => sum + item.expense, 0),
      breakdown,
      fill: OTHER_CATEGORY_COLOR
    }
  ]
}

const CategoryExpensePieChart = ({ series }: { series: CategoryTotals['series'] }) => {
  const chartData = expensePieData(series)
  const total = chartData.reduce((sum, item) => sum + item.expense, 0)
  const chartConfig = Object.fromEntries(
    chartData.map((item) => [item.category, { label: item.category }])
  )

  return (
    <div className="grid gap-3">
      <header className="grid gap-1 text-center">
        <p className="text-sm text-muted-foreground">Ausgaben gesamt</p>
        <p className="text-2xl font-semibold tabular-nums">{formatDecimal(total)}</p>
      </header>
      {chartData.length === 0 ? (
        <EmptyState description="Für diese Auswahl liegen keine Ausgaben vor." />
      ) : (
        <div className="@container">
          <div className="grid items-center gap-4 @md:grid-cols-[minmax(0,18rem)_minmax(10rem,1fr)]">
            <ChartContainer className="mx-auto aspect-square w-full max-w-72" config={chartConfig}>
              <PieChart accessibilityLayer>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        const amount = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value)
                        const category = String(name)
                        const datum = chartData.find((item) => item.category === category)
                        return (
                          <div className="grid min-w-52 gap-2">
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <span
                                  className="size-2.5 shrink-0 rounded-[2px]"
                                  style={{
                                    backgroundColor: datum?.fill ?? categoryColor(category)
                                  }}
                                />
                                {category}
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {formatDecimal(amount)} ·{' '}
                                {percentageFormatter.format(amount / total)}
                              </span>
                            </div>
                            {datum === undefined || datum.breakdown.length === 0 ? null : (
                              <div className="grid max-h-56 gap-1.5 overflow-y-auto border-t pt-2 pr-1">
                                <p className="font-medium">Enthaltene Kategorien</p>
                                {datum.breakdown.map((item) => (
                                  <div
                                    className="flex items-center justify-between gap-4"
                                    key={item.category}
                                  >
                                    <span className="text-muted-foreground">{item.category}</span>
                                    <span className="font-mono tabular-nums">
                                      {formatDecimal(item.expense)} ·{' '}
                                      {percentageFormatter.format(item.expense / total)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      }}
                      hideLabel
                    />
                  }
                  isAnimationActive={false}
                />
                <Pie
                  data={chartData}
                  dataKey="expense"
                  isAnimationActive={false}
                  nameKey="category"
                  stroke="var(--background)"
                  strokeWidth={2}
                >
                  {chartData.map((item) => (
                    <Cell fill={item.fill} key={item.category} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul
              aria-label="Ausgabenkategorien"
              className="grid grid-cols-2 content-center gap-x-4 gap-y-2 text-xs text-muted-foreground @md:grid-cols-1"
            >
              {chartData.map((item) => (
                <li className="flex min-w-0 items-center gap-1.5" key={item.category}>
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="break-words">{item.category}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
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
          <CardDescription>Verteilung der Ausgaben auf die einzelnen Kategorien.</CardDescription>
        </CardHeader>
        <CardContent>
          {categories.status === 'loading' ? (
            <LoadingState title="Kategorien werden ausgewertet" />
          ) : null}
          {categories.status === 'error' ? <ErrorState error={categories.error} /> : null}
          {categories.status === 'success' ? (
            <CategoryExpensePieChart series={categories.data.series} />
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Kategorienvergleich</CardTitle>
          <CardDescription>Verteilung der Ausgaben in den ausgewählten Zeiträumen.</CardDescription>
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
                    <CategoryExpensePieChart series={item.series} />
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
                expense: { label: 'Ausgaben', color: monthlyTotals.data.expense_color },
                total: { label: 'Gesamt', color: 'var(--muted-foreground)' }
              }}
            >
              <ComposedChart
                accessibilityLayer
                data={monthlyTotals.data.series.map((item) => ({
                  label: item.label,
                  income: item.income,
                  expense: item.expense,
                  total: item.income - item.expense
                }))}
                margin={{ left: 8, right: 8 }}
              >
                <CartesianGrid vertical={false} />
                <ReferenceLine y={0} />
                <XAxis dataKey="label" tickLine={false} tickMargin={8} />
                <YAxis
                  domain={[
                    (dataMin: number) => Math.min(0, dataMin),
                    (dataMax: number) => Math.max(0, dataMax)
                  ]}
                  tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={false}
                  isAnimationActive={false}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="total"
                  fill="var(--color-total)"
                  isAnimationActive={false}
                  radius={4}
                />
                <Line
                  dataKey="income"
                  dot={false}
                  isAnimationActive={false}
                  stroke="var(--color-income)"
                  strokeWidth={2}
                />
                <Line
                  dataKey="expense"
                  dot={false}
                  isAnimationActive={false}
                  stroke="var(--color-expense)"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ChartContainer>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
