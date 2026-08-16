import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/query-feedback'
import { formatPercentage } from '@/features/analytics/analytics-format'
import { MetricCard } from '@/features/analytics/analytics-shared'
import {
  AccountComparisonChart,
  ActiveContractHistoryChart,
  CashFlowChart,
  CategoryComparisonChart,
  CategoryTrendChart,
  ContractComparisonChart
} from '@/features/analytics/cash-flow-charts'
import { formatDate, formatDecimal } from '@/lib/format'
import type { CashFlowDashboard as CashFlowData } from '@/types/analytics'

const ContractAnalytics = ({ data }: { data: CashFlowData }) => {
  const activeContracts = data.contracts.filter((contract) => contract.is_active)
  const activeMonthlyAverage =
    activeContracts.reduce((sum, contract) => sum + contract.expense, 0) / data.period.month_count
  return (
    <Tabs defaultValue="compare">
      <TabsList>
        <TabsTrigger value="compare">Kostenvergleich</TabsTrigger>
        <TabsTrigger value="history">Verlauf aktiver Verträge</TabsTrigger>
      </TabsList>
      <TabsContent className="grid gap-3" value="compare">
        <p className="text-sm text-muted-foreground">
          Gesamtausgaben je Vertrag im ausgewählten Zeitraum.
        </p>
        <ContractComparisonChart data={data} />
      </TabsContent>
      <TabsContent className="grid gap-3" value="history">
        {activeContracts.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              Monatliche Ausgaben aktiver Verträge · Durchschnitt:{' '}
              {formatDecimal(activeMonthlyAverage)}.
            </p>
            <ActiveContractHistoryChart data={data} />
          </>
        ) : (
          <EmptyState description="Für aktive Verträge liegen im Zeitraum keine Ausgaben vor." />
        )}
      </TabsContent>
    </Tabs>
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

const CashFlowInsights = ({ data }: { data: CashFlowData }) => {
  const hasInsights =
    data.anomalies.length > 0 || data.increases.length > 0 || data.decreases.length > 0
  return (
    <Card>
      <CardHeader>
        <CardTitle>Auffälligkeiten</CardTitle>
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

export const CashFlowDashboardView = ({ data }: { data: CashFlowData }) => (
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
          {formatPercentage(data.contract_expense_share)} der Ausgaben sind Verträgen zugeordnet ·{' '}
          {data.period.label}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.contracts.length === 0 ? (
          <EmptyState description="Im Zeitraum sind keine Ausgaben mit Verträgen verknüpft." />
        ) : (
          <ContractAnalytics data={data} />
        )}
      </CardContent>
    </Card>
    <CashFlowInsights data={data} />
    {data.data_through === null ? null : (
      <p className="text-xs text-muted-foreground">Datenstand: {formatDate(data.data_through)}</p>
    )}
  </div>
)
