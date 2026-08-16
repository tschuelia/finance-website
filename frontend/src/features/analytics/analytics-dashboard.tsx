/* cspell:words Ausreißer Cashflow Datenabdeckung Depotwerte Kategorienvergleich Sparquote Vertragsgebundene Vermögensaufteilung Vermögensverlauf Vormonate */

import { AlertTriangle, ArrowDownRight, ArrowUpRight, Landmark, PiggyBank } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis
} from 'recharts'
import type { TooltipValueType } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { useCashFlowDashboard, useWealthDashboard } from '@/hooks/use-analytics'
import { formatDate, formatDecimal } from '@/lib/format'
import type {
  CashFlowDashboard as CashFlowData,
  CashFlowQuery,
  WealthDashboard as WealthData,
  WealthQuery
} from '@/types/analytics'

type AnalyticsTab = 'cashflow' | 'wealth'

type AnalyticsDashboardProps = {
  activeTab: AnalyticsTab
  cashFlowQuery: CashFlowQuery
  onTabChange: (tab: AnalyticsTab) => void
  wealthQuery: WealthQuery
}

const percentageFormatter = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 1
})

const formatPercentage = (value: number): string => percentageFormatter.format(value)

const moneyTooltip = (value: TooltipValueType | undefined, name: number | string | undefined) => {
  const amount = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0)
  return (
    <>
      <span className="text-muted-foreground">{name}</span>
      <span className="ml-auto font-mono font-medium tabular-nums">
        {formatDecimal(Math.abs(amount))}
      </span>
    </>
  )
}

type MetricCardProps = {
  compareLabel: string
  invertTrend?: boolean
  label: string
  percentage?: boolean
  previousValue: number
  value: number | null
}

const MetricCard = ({
  compareLabel,
  invertTrend = false,
  label,
  percentage = false,
  previousValue,
  value
}: MetricCardProps) => {
  if (value === null) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-2xl tabular-nums">–</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Keine Einnahmen im Zeitraum</p>
        </CardContent>
      </Card>
    )
  }
  const change = value - previousValue
  const favorable = invertTrend ? change <= 0 : change >= 0
  const TrendIcon = change >= 0 ? ArrowUpRight : ArrowDownRight
  const formatted = percentage ? formatPercentage(value) : formatDecimal(value)
  const comparison =
    previousValue === 0
      ? `${compareLabel}: ${percentage ? formatPercentage(previousValue) : formatDecimal(previousValue)}`
      : `${formatPercentage(change / Math.abs(previousValue))} ggü. ${compareLabel}`

  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{formatted}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={
            change === 0
              ? 'text-xs text-muted-foreground'
              : favorable
                ? 'flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400'
                : 'flex items-center gap-1 text-xs text-destructive'
          }
        >
          {change === 0 ? null : <TrendIcon className="size-3.5" aria-hidden />}
          {comparison}
        </p>
      </CardContent>
    </Card>
  )
}

const CashFlowChart = ({ data }: { data: CashFlowData }) => (
  <ChartContainer
    className="h-80 w-full"
    config={{
      income: { label: 'Einnahmen', color: 'var(--chart-2)' },
      expense: { label: 'Ausgaben', color: 'var(--chart-5)' },
      net: { label: 'Überschuss', color: 'var(--chart-1)' }
    }}
  >
    <ComposedChart
      accessibilityLayer
      data={data.monthly.map((item) => ({
        ...item,
        expenseDisplay: -item.expense
      }))}
      margin={{ left: 8, right: 8 }}
    >
      <CartesianGrid vertical={false} />
      <ReferenceLine y={0} />
      <XAxis dataKey="label" minTickGap={24} tickLine={false} tickMargin={8} />
      <YAxis
        tickFormatter={(value: number) => formatDecimal(Math.abs(value), { currency: false })}
        width={64}
      />
      <ChartTooltip
        content={<ChartTooltipContent formatter={moneyTooltip} />}
        cursor={false}
        isAnimationActive={false}
      />
      <ChartLegend content={<ChartLegendContent />} />
      <Bar
        dataKey="income"
        fill="var(--color-income)"
        isAnimationActive={false}
        name="Einnahmen"
        radius={[3, 3, 0, 0]}
        stackId="flow"
      />
      <Bar
        dataKey="expenseDisplay"
        fill="var(--color-expense)"
        isAnimationActive={false}
        name="Ausgaben"
        radius={[0, 0, 3, 3]}
        stackId="flow"
      />
      <Line
        dataKey="net"
        dot={false}
        isAnimationActive={false}
        name="Überschuss"
        stroke="var(--color-net)"
        strokeWidth={2}
      />
    </ComposedChart>
  </ChartContainer>
)

const AccountComparisonChart = ({ data }: { data: CashFlowData }) => (
  <ChartContainer
    className="h-[min(28rem,calc(7rem+4rem*var(--account-count)))] w-full"
    config={{
      income: { label: 'Einnahmen', color: 'var(--chart-2)' },
      expense: { label: 'Ausgaben', color: 'var(--chart-5)' }
    }}
    style={{ '--account-count': data.accounts.length } as React.CSSProperties}
  >
    <BarChart accessibilityLayer data={data.accounts} layout="vertical" margin={{ left: 12 }}>
      <CartesianGrid horizontal={false} />
      <XAxis
        type="number"
        tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
      />
      <YAxis dataKey="account_name" type="category" tickLine={false} width={100} />
      <ChartTooltip
        content={<ChartTooltipContent formatter={moneyTooltip} />}
        cursor={false}
        isAnimationActive={false}
      />
      <ChartLegend content={<ChartLegendContent />} />
      <Bar dataKey="income" fill="var(--color-income)" isAnimationActive={false} radius={3} />
      <Bar dataKey="expense" fill="var(--color-expense)" isAnimationActive={false} radius={3} />
    </BarChart>
  </ChartContainer>
)

const topCategories = (data: CashFlowData, limit: number) => {
  const visible = data.categories.slice(0, limit)
  const remaining = data.categories.slice(limit)
  const rows = visible.map((item) => ({
    category: item.category,
    current: item.expense,
    previous: item.previous_expense
  }))
  if (remaining.length > 0) {
    rows.push({
      category: 'Sonstige',
      current: remaining.reduce((sum, item) => sum + item.expense, 0),
      previous: remaining.reduce((sum, item) => sum + item.previous_expense, 0)
    })
  }
  return rows
}

const CategoryComparisonChart = ({ data }: { data: CashFlowData }) => {
  const rows = topCategories(data, 8)
  const remaining = data.categories.slice(8)
  return (
    <div className="grid gap-2">
      <ChartContainer
        className="h-[30rem] w-full"
        config={{
          current: { label: data.period.label, color: 'var(--chart-1)' },
          previous: { label: data.comparison_period.label, color: 'var(--muted-foreground)' }
        }}
      >
        <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
          />
          <YAxis dataKey="category" type="category" tickLine={false} width={112} />
          <ChartTooltip
            content={<ChartTooltipContent formatter={moneyTooltip} />}
            cursor={false}
            isAnimationActive={false}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="current"
            fill="var(--color-current)"
            isAnimationActive={false}
            name={data.period.label}
            radius={3}
          />
          <Bar
            dataKey="previous"
            fill="var(--color-previous)"
            isAnimationActive={false}
            name={data.comparison_period.label}
            radius={3}
          />
        </BarChart>
      </ChartContainer>
      {remaining.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          „Sonstige“ enthält: {remaining.map((item) => item.category).join(', ')}.
        </p>
      ) : null}
    </div>
  )
}

const categoryColor = (index: number): string =>
  [`var(--chart-1)`, `var(--chart-2)`, `var(--chart-3)`, `var(--chart-4)`, `var(--chart-5)`][
    index % 5
  ] ?? 'var(--muted-foreground)'

const CategoryTrendChart = ({ data }: { data: CashFlowData }) => {
  const categoryNames = data.categories.slice(0, 5).map((item) => item.category)
  const categoryKeys = categoryNames.map((category, index) => ({
    category,
    key: `category_${index}`
  }))
  const periods = data.monthly.map((item) => ({ period: item.period, label: item.label }))
  const rows = periods.map((period) => {
    const row: Record<string, number | string> = { ...period, Sonstige: 0 }
    for (const item of data.category_monthly.filter((item) => item.period === period.period)) {
      const key =
        categoryKeys.find((candidate) => candidate.category === item.category)?.key ?? 'other'
      row[key] = Number(row[key] ?? 0) + item.expense
    }
    return row
  })
  const keys = [...categoryKeys, { category: 'Sonstige', key: 'other' }]
  const config = Object.fromEntries(
    keys.map((item, index) => [
      item.key,
      {
        label: item.category,
        color: item.key === 'other' ? 'var(--muted-foreground)' : categoryColor(index)
      }
    ])
  )
  return (
    <ChartContainer className="h-80 w-full" config={config}>
      <BarChart accessibilityLayer data={rows} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" minTickGap={24} tickLine={false} tickMargin={8} />
        <YAxis
          tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
          width={64}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={moneyTooltip} />}
          cursor={false}
          isAnimationActive={false}
        />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((item) => (
          <Bar
            dataKey={item.key}
            fill={`var(--color-${item.key})`}
            isAnimationActive={false}
            key={item.key}
            name={item.category}
            stackId="categories"
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

const ContractChart = ({ data }: { data: CashFlowData }) => {
  const visible = data.contracts.slice(0, 8)
  const remaining = data.contracts.slice(8)
  const rows = [
    ...visible,
    ...(remaining.length === 0
      ? []
      : [
          {
            contract_id: -1,
            contract_name: 'Sonstige',
            owner_name: '',
            expense: remaining.reduce((sum, item) => sum + item.expense, 0),
            monthly_average: remaining.reduce((sum, item) => sum + item.monthly_average, 0),
            share: remaining.reduce((sum, item) => sum + item.share, 0)
          }
        ])
  ]
  return (
    <ChartContainer
      className="h-80 w-full"
      config={{ monthly_average: { label: 'Monatsdurchschnitt', color: 'var(--chart-4)' } }}
    >
      <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
        />
        <YAxis dataKey="contract_name" type="category" tickLine={false} width={112} />
        <ChartTooltip
          content={<ChartTooltipContent formatter={moneyTooltip} />}
          cursor={false}
          isAnimationActive={false}
        />
        <Bar
          dataKey="monthly_average"
          fill="var(--color-monthly_average)"
          isAnimationActive={false}
          radius={3}
        />
      </BarChart>
    </ChartContainer>
  )
}

const CashFlowInsights = ({ data }: { data: CashFlowData }) => {
  const hasInsights =
    data.anomalies.length > 0 || data.increases.length > 0 || data.decreases.length > 0
  return (
    <Card>
      <CardHeader>
        <CardTitle>Auffälligkeiten</CardTitle>
        <CardDescription>
          Robuste Monatsausreißer und die größten Veränderungen im Periodenvergleich.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasInsights ? (
          <EmptyState description="Für diesen Zeitraum wurden keine belastbaren Auffälligkeiten erkannt." />
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <section className="grid content-start gap-2">
              <h3 className="font-medium">Monatsausreißer</h3>
              {data.anomalies.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Ausreißer erkannt.</p>
              ) : (
                data.anomalies.map((item) => (
                  <div className="rounded-lg bg-muted p-3" key={`${item.period}:${item.category}`}>
                    <p className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="size-4 text-amber-600" aria-hidden />
                      {item.category}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDecimal(item.expense)} statt üblich{' '}
                      {formatDecimal(item.baseline_median)}
                    </p>
                  </div>
                ))
              )}
            </section>
            <ChangeList items={data.increases} title="Stärkste Zunahmen" />
            <ChangeList items={data.decreases} title="Stärkste Rückgänge" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const ChangeList = ({ items, title }: { items: CashFlowData['increases']; title: string }) => (
  <section className="grid content-start gap-2">
    <h3 className="font-medium">{title}</h3>
    {items.length === 0 ? (
      <p className="text-sm text-muted-foreground">Keine Veränderung.</p>
    ) : (
      items.map((item) => (
        <div className="flex items-center justify-between gap-3 border-b py-2" key={item.category}>
          <span>{item.category}</span>
          <span
            className={
              item.absolute_change > 0
                ? 'font-mono text-destructive tabular-nums'
                : 'font-mono text-emerald-700 tabular-nums dark:text-emerald-400'
            }
          >
            {item.absolute_change > 0 ? '+' : ''}
            {formatDecimal(item.absolute_change)}
          </span>
        </div>
      ))
    )}
  </section>
)

const CashFlowDashboardView = ({ data }: { data: CashFlowData }) => (
  <div className="grid gap-6">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        compareLabel={data.comparison_period.label}
        label="Einnahmen"
        previousValue={data.summary.income.previous_value}
        value={data.summary.income.value}
      />
      <MetricCard
        compareLabel={data.comparison_period.label}
        invertTrend
        label="Ausgaben"
        previousValue={data.summary.expense.previous_value}
        value={data.summary.expense.value}
      />
      <MetricCard
        compareLabel={data.comparison_period.label}
        label="Überschuss"
        previousValue={data.summary.net.previous_value}
        value={data.summary.net.value}
      />
      <MetricCard
        compareLabel={data.comparison_period.label}
        label="Sparquote"
        percentage
        previousValue={data.summary.savings_rate?.previous_value ?? 0}
        value={data.summary.savings_rate?.value ?? null}
      />
    </div>
    <Card>
      <CardHeader>
        <CardTitle>Cashflow im Monatsverlauf</CardTitle>
        <CardDescription>
          Einnahmen, Ausgaben und Überschuss · {data.period.label}
          {data.excluded_transfer_count > 0
            ? ` · ${data.excluded_transfer_count} bestätigte Umbuchungen ausgeschlossen`
            : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CashFlowChart data={data} />
      </CardContent>
    </Card>
    {data.accounts.length > 1 ? (
      <Card>
        <CardHeader>
          <CardTitle>Cashflow nach Konto</CardTitle>
          <CardDescription>Welche Konten den gemeinsamen Cashflow prägen.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountComparisonChart data={data} />
        </CardContent>
      </Card>
    ) : null}
    <Card>
      <CardHeader>
        <CardTitle>Ausgaben nach Kategorie</CardTitle>
      </CardHeader>
      <CardContent>
        {data.categories.length === 0 ? (
          <EmptyState description="Für diesen Zeitraum liegen keine Ausgaben vor." />
        ) : (
          <Tabs defaultValue="compare">
            <TabsList>
              <TabsTrigger value="compare">Vergleich</TabsTrigger>
              <TabsTrigger value="trend">Verlauf</TabsTrigger>
            </TabsList>
            <TabsContent value="compare">
              <CategoryComparisonChart data={data} />
            </TabsContent>
            <TabsContent value="trend">
              <CategoryTrendChart data={data} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>Vertragsgebundene Ausgaben</CardTitle>
        <CardDescription>
          {formatPercentage(data.contract_expense_share)} der Ausgaben sind Verträgen zugeordnet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.contracts.length === 0 ? (
          <EmptyState description="Im Zeitraum sind keine Ausgaben mit Verträgen verknüpft." />
        ) : (
          <ContractChart data={data} />
        )}
      </CardContent>
    </Card>
    <CashFlowInsights data={data} />
    {data.data_through === null ? null : (
      <p className="text-xs text-muted-foreground">Datenstand: {formatDate(data.data_through)}</p>
    )}
  </div>
)

const WealthTrendChart = ({ data }: { data: WealthData }) => (
  <ChartContainer
    className="h-80 w-full"
    config={{
      total: { label: 'Gesamtvermögen', color: 'var(--chart-1)' },
      bank_balance: { label: 'Bankkonten', color: 'var(--chart-2)' },
      depot_balance: { label: 'Depots', color: 'var(--chart-4)' }
    }}
  >
    <LineChart accessibilityLayer data={data.monthly} margin={{ left: 8, right: 8 }}>
      <CartesianGrid vertical={false} />
      <ReferenceLine y={0} />
      <XAxis dataKey="label" minTickGap={24} tickLine={false} tickMargin={8} />
      <YAxis
        tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
        width={72}
      />
      <ChartTooltip
        content={<ChartTooltipContent formatter={moneyTooltip} />}
        isAnimationActive={false}
      />
      <ChartLegend content={<ChartLegendContent />} />
      <Line
        connectNulls={false}
        dataKey="total"
        dot={false}
        isAnimationActive={false}
        stroke="var(--color-total)"
        strokeWidth={3}
      />
      <Line
        dataKey="bank_balance"
        dot={false}
        isAnimationActive={false}
        stroke="var(--color-bank_balance)"
        strokeWidth={1.5}
      />
      <Line
        connectNulls={false}
        dataKey="depot_balance"
        dot={false}
        isAnimationActive={false}
        stroke="var(--color-depot_balance)"
        strokeDasharray="5 4"
        strokeWidth={1.5}
      />
    </LineChart>
  </ChartContainer>
)

const WealthAllocationChart = ({ data }: { data: WealthData }) => (
  <ChartContainer
    className="h-[min(32rem,calc(7rem+3.5rem*var(--source-count)))] w-full"
    config={{ balance: { label: 'Bestand', color: 'var(--chart-1)' } }}
    style={{ '--source-count': data.sources.length } as React.CSSProperties}
  >
    <BarChart accessibilityLayer data={data.sources} layout="vertical" margin={{ left: 16 }}>
      <CartesianGrid horizontal={false} />
      <ReferenceLine x={0} />
      <XAxis
        type="number"
        tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
      />
      <YAxis dataKey="name" type="category" tickLine={false} width={112} />
      <ChartTooltip
        content={<ChartTooltipContent formatter={moneyTooltip} />}
        cursor={false}
        isAnimationActive={false}
      />
      <Bar dataKey="balance" fill="var(--color-balance)" isAnimationActive={false} radius={3} />
    </BarChart>
  </ChartContainer>
)

const WealthDashboardView = ({ data }: { data: WealthData }) => {
  const knownPoints = data.monthly.filter((point) => point.total !== null)
  const containsEstimate = knownPoints.some((point) => point.estimated)
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Gesamtvermögen</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatDecimal(data.current_total)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Veränderung im Zeitraum</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.absolute_change === null ? '–' : formatDecimal(data.absolute_change)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {data.percentage_change === null
                ? 'Noch keine gemeinsame Vergleichsbasis'
                : formatPercentage(data.percentage_change)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <Landmark className="size-4" aria-hidden /> Bankkonten
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatDecimal(data.liquid_total)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <PiggyBank className="size-4" aria-hidden /> Depots
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatDecimal(data.invested_total)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Vermögensverlauf</CardTitle>
          <CardDescription>
            Kontostände und bekannte Depotwerte · {data.period.label}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {knownPoints.length < 2 ? (
            <EmptyState description="Für einen belastbaren Gesamtverlauf werden mindestens zwei gemeinsame Vermögensstände benötigt." />
          ) : (
            <WealthTrendChart data={data} />
          )}
          {containsEstimate ? (
            <p className="text-xs text-muted-foreground">
              Gestrichelte Depotwerte verwenden den jeweils letzten bekannten Snapshot und sind als
              Schätzung zu lesen.
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Vermögensaufteilung heute</CardTitle>
          <CardDescription>
            Bankkonten und Depots direkt nach ihrem aktuellen Wert verglichen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WealthAllocationChart data={data} />
        </CardContent>
      </Card>
    </div>
  )
}

export const AnalyticsDashboard = ({
  activeTab,
  cashFlowQuery,
  onTabChange,
  wealthQuery
}: AnalyticsDashboardProps) => {
  const cashFlow = useCashFlowDashboard(cashFlowQuery)
  const wealth = useWealthDashboard(wealthQuery, activeTab === 'wealth')

  return (
    <Tabs onValueChange={(value) => onTabChange(value as AnalyticsTab)} value={activeTab}>
      <TabsList className="grid w-full grid-cols-2 sm:w-80">
        <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
        <TabsTrigger value="wealth">Vermögen</TabsTrigger>
      </TabsList>
      <TabsContent value="cashflow">
        {cashFlow.status === 'loading' ? <LoadingState title="Cashflow wird ausgewertet" /> : null}
        {cashFlow.status === 'error' ? <ErrorState error={cashFlow.error} /> : null}
        {cashFlow.status === 'success' ? <CashFlowDashboardView data={cashFlow.data} /> : null}
      </TabsContent>
      <TabsContent value="wealth">
        {wealth.status === 'loading' ? <LoadingState title="Vermögen wird ausgewertet" /> : null}
        {wealth.status === 'error' ? <ErrorState error={wealth.error} /> : null}
        {wealth.status === 'success' ? <WealthDashboardView data={wealth.data} /> : null}
      </TabsContent>
    </Tabs>
  )
}
